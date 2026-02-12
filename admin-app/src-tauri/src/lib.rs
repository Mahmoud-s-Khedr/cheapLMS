use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProbeResult {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub format_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessConfig {
    pub id: String, // Add ID for event emission
    pub input_path: String,
    pub output_dir: String,
    pub qualities: Vec<String>, // e.g., ["1080p", "720p"]
    pub segment_duration: Option<u32>, // HLS segment duration in seconds (default: 4)
}

#[tauri::command]
async fn probe_media(app: tauri::AppHandle, path: String) -> Result<ProbeResult, String> {
    let sidecar_command = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
    let (mut rx, mut _child) = sidecar_command
        .args(["-i", &path, "-hide_banner"]) 
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut stderr_output = String::new();
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stderr(line) = event {
             stderr_output.push_str(&String::from_utf8_lossy(&line));
        }
    }
    
    let duration_regex = regex::Regex::new(r"Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap();
    let video_regex = regex::Regex::new(r"Video: .*, (\d{3,5})x(\d{3,5})").unwrap();
    
    let mut duration = 0.0;
    if let Some(caps) = duration_regex.captures(&stderr_output) {
        let h: f64 = caps[1].parse().unwrap_or(0.0);
        let m: f64 = caps[2].parse().unwrap_or(0.0);
        let s: f64 = caps[3].parse().unwrap_or(0.0);
        let ms: f64 = caps[4].parse().unwrap_or(0.0);
        duration = h * 3600.0 + m * 60.0 + s + ms / 100.0;
    }

    let mut width = 0;
    let mut height = 0;
    if let Some(caps) = video_regex.captures(&stderr_output) {
        width = caps[1].parse().unwrap_or(0);
        height = caps[2].parse().unwrap_or(0);
    }

    Ok(ProbeResult {
        duration,
        width,
        height,
        format_name: "unknown".to_string(),
    })
}

#[derive(Clone, Serialize)]
struct ProgressPayload {
    id: String,
    progress: f64,
}

#[tauri::command]
async fn process_video(app: tauri::AppHandle, config: ProcessConfig) -> Result<String, String> {
    // 1. Probe duration
    let probe = probe_media(app.clone(), config.input_path.clone()).await?;
    let total_duration = probe.duration;

    // 2. Prepare Output Directory
    fs::create_dir_all(&config.output_dir).map_err(|e| e.to_string())?;

    let mut master_playlist = String::from("#EXTM3U\n#EXT-X-VERSION:3\n");
    let qualities = if config.qualities.is_empty() { vec!["720p".to_string()] } else { config.qualities };

    for quality in &qualities {
        let (scale, bitrate, bandwidth) = match quality.as_str() {
            "1080p" => ("scale=-2:1080", "4500k", "5000000"),
            "720p" => ("scale=-2:720", "2500k", "2800000"),
            "480p" => ("scale=-2:480", "1250k", "1400000"),
            "360p" => ("scale=-2:360", "800k", "900000"),
            _ => ("scale=-2:720", "2500k", "2800000"), // Default
        };

        // Create subdir (e.g., /tmp/.../720p)
        let quality_dir = format!("{}/{}", config.output_dir, quality);
        fs::create_dir_all(&quality_dir).map_err(|e| e.to_string())?;

        let segment_filename = format!("{}/%03d.ts", quality_dir);
        let playlist_filename = format!("{}/playlist.m3u8", quality_dir);

        let bufsize = format!("{}k", (bitrate.trim_end_matches('k').parse::<u32>().unwrap_or(2500) * 2));

        let seg_dur = config.segment_duration.unwrap_or(4);
        let seg_dur_str = seg_dur.to_string();
        // GOP = segment_duration * 12fps (keyframes align with segments)
        let gop_size = (seg_dur * 12).to_string();

        let args = vec![
            "-i", &config.input_path,
            "-y",
            "-c:a", "aac", "-ar", "48000", "-b:a", "128k",
            "-c:v", "libx264", "-profile:v", "main", "-crf", "20", "-sc_threshold", "0",
            "-g", &gop_size, "-keyint_min", &gop_size,
            "-hls_time", &seg_dur_str,
            "-hls_playlist_type", "vod",
            "-vf", scale,
            "-b:v", bitrate,
            "-maxrate", bitrate,
            "-bufsize", &bufsize,
            "-hls_segment_filename", &segment_filename,
            &playlist_filename
        ];

        let sidecar_command = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
        let (mut rx, mut _child) = sidecar_command
            .args(&args)
            .spawn()
            .map_err(|e| e.to_string())?;

        let mut stderr_output = String::new();
        let time_regex = regex::Regex::new(r"time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap();

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    stderr_output.push_str(&text);
                    if let Some(caps) = time_regex.captures(&text) {
                        let h: f64 = caps[1].parse().unwrap_or(0.0);
                        let m: f64 = caps[2].parse().unwrap_or(0.0);
                        let s: f64 = caps[3].parse().unwrap_or(0.0);
                        let ms: f64 = caps[4].parse().unwrap_or(0.0);
                        let current_time = h * 3600.0 + m * 60.0 + s + ms / 100.0;
                        if total_duration > 0.0 {
                            let progress = (current_time / total_duration) * 100.0;
                            // TODO: Adjust progress calculation for multiple passes if needed
                            let _ = app.emit("video-progress", ProgressPayload {
                                id: config.id.clone(),
                                progress, // This gives 0-100 for EACH quality. UI will see it jump. 
                                          // For MVP, just showing activity is fine.
                            });
                        }
                    }
                }
                CommandEvent::Terminated(payload) => {
                     if let Some(code) = payload.code {
                         if code != 0 {
                             return Err(format!("FFmpeg failed for {}: code {}: {}", quality, code, stderr_output));
                         }
                     }
                }
                _ => {}
            }
        }
        
        // Append to master playlist
        // #EXT-X-STREAM-INF:BANDWIDTH=...,RESOLUTION=...
        // quality/playlist.m3u8
        let resolution = match quality.as_str() {
             "1080p" => "1920x1080",
             "720p" => "1280x720",
             "480p" => "854x480",
             "360p" => "640x360",
             _ => "1280x720",
        };
        master_playlist.push_str(&format!("#EXT-X-STREAM-INF:BANDWIDTH={},RESOLUTION={}\n{}/playlist.m3u8\n", bandwidth, resolution, quality));
    }

    // Write Master Playlist
    let master_path = format!("{}/master.m3u8", config.output_dir);
    fs::write(&master_path, master_playlist).map_err(|e| e.to_string())?;

    Ok("Conversion complete".to_string())
}

#[tauri::command]
async fn generate_thumbnail(app: tauri::AppHandle, input_path: String, output_path: String) -> Result<String, String> {
    // 1. Probe duration to seek to 25%
    let probe = probe_media(app.clone(), input_path.clone()).await?;
    let seek_time = probe.duration * 0.25;

    // Format seek time as HH:MM:SS.mm
    let hours = (seek_time / 3600.0) as u32;
    let minutes = ((seek_time % 3600.0) / 60.0) as u32;
    let seconds = seek_time % 60.0;
    let seek_str = format!("{:02}:{:02}:{:05.2}", hours, minutes, seconds);

    // 2. Extract single frame as JPEG, scaled to 640px wide
    let sidecar_command = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
    let (mut rx, mut _child) = sidecar_command
        .args([
            "-ss", &seek_str,
            "-i", &input_path,
            "-vframes", "1",
            "-vf", "scale=640:-1",
            "-q:v", "2",
            "-y",
            &output_path,
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut stderr_output = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                stderr_output.push_str(&String::from_utf8_lossy(&line));
            }
            CommandEvent::Terminated(payload) => {
                if let Some(code) = payload.code {
                    if code != 0 {
                        return Err(format!("FFmpeg thumbnail failed: code {}: {}", code, stderr_output));
                    }
                }
            }
            _ => {}
        }
    }

    Ok(output_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![probe_media, process_video, generate_thumbnail])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
