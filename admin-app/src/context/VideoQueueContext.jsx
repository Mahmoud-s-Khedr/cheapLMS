import { createContext, useContext, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import { VideoService } from "../services/VideoService";

const VideoQueueContext = createContext();

const getErrorMessage = (error) => {
    if (!error) return "Unknown error";
    if (typeof error === "string") return error;
    if (error.message) return error.message;
    return JSON.stringify(error);
};

const classifyUploadError = (error) => {
    const message = getErrorMessage(error);

    if (/failed to fetch|networkerror|load failed/i.test(message)) {
        return "network_or_cors";
    }

    if (/forbidden|accessdenied|signaturedoesnotmatch|invalidaccesskeyid/i.test(message)) {
        return "auth_or_signature";
    }

    return "unknown";
};

const getEndpointHost = (endpoint) => {
    try {
        return endpoint ? new URL(endpoint).host : "unknown";
    } catch {
        return "unknown";
    }
};

const formatUploadFailure = ({ fileName, r2Key, appOrigin, endpointHost, category, error }) => {
    const baseMessage = getErrorMessage(error);
    const details = `origin=${appOrigin} endpoint=${endpointHost} key=${r2Key}`;

    if (category === "network_or_cors") {
        return `Failed to upload ${fileName}: ${baseMessage}. Upload request was blocked before response (${details}). For Windows release, add your packaged app origin (for example https://tauri.localhost) to R2 AllowedOrigins.`;
    }

    if (category === "auth_or_signature") {
        return `Failed to upload ${fileName}: ${baseMessage}. R2 rejected credentials/signature (${details}). Verify VITE_R2_* build-time values.`;
    }

    return `Failed to upload ${fileName}: ${baseMessage} (${details}).`;
};

export function VideoQueueProvider({ children }) {
    const [queue, setQueue] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Load queue from local storage on mount
    useEffect(() => {
        const savedQueue = localStorage.getItem("videoQueue");
        if (savedQueue) {
            try {
                setQueue(JSON.parse(savedQueue));
            } catch (e) {
                console.error("Failed to parse videoQueue:", e);
            }
        }
    }, []);

    // Save queue on change
    useEffect(() => {
        localStorage.setItem("videoQueue", JSON.stringify(queue));
    }, [queue]);

    useEffect(() => {
        let unlisten;
        async function setupListener() {
            const { listen } = await import('@tauri-apps/api/event');
            unlisten = await listen('video-progress', (event) => {
                const { id, progress } = event.payload;
                updateItemStatus(id, "processing", Math.round(progress));
            });
        }
        setupListener();
        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    const addToQueue = async (files, playlistId, qualities = ["720p"], thumbnailPath = null) => {
        const newItems = Array.from(files).map(file => ({
            id: uuidv4(),
            file,
            path: file.path || file.name, // Tauri dropzone gives path
            name: file.name,
            playlistId,
            qualities,
            thumbnailPath, // custom thumbnail (shared across batch, or null for auto-gen)
            status: "queued",
            progress: 0,
            error: null
        }));

        // Ensure path is captured
        const itemsWithPaths = newItems.map((item, index) => ({
            ...item,
            path: files[index].path || files[index].name
        }));

        setQueue(prev => [...prev, ...itemsWithPaths]);
    };

    // Watch queue processing
    useEffect(() => {
        if (isProcessing) return;

        const nextItem = queue.find(item => item.status === "queued");
        if (nextItem) {
            processItem(nextItem);
        }
    }, [queue, isProcessing]);

    const processItem = async (item) => {
        setIsProcessing(true);
        updateItemStatus(item.id, "processing", 0);

        try {
            console.log("Processing item:", item);

            if (!item.path) {
                throw new Error("File path not found.");
            }

            // 2. Transcode
            const { join, tempDir } = await import("@tauri-apps/api/path");
            const outputDir = await join(await tempDir(), "cheaplms_processing", item.id);
            console.log("Transcoding to:", outputDir);

            await invoke("process_video", {
                config: {
                    id: item.id,
                    input_path: item.path,
                    output_dir: outputDir,
                    qualities: item.qualities || ["720p"],
                    segment_duration: parseInt(localStorage.getItem("hlsSegmentDuration") || "4", 10)
                }
            });

            updateItemStatus(item.id, "uploading", 0);

            // 3. Generate or use custom thumbnail
            let thumbnailLocalPath;
            if (item.thumbnailPath) {
                thumbnailLocalPath = item.thumbnailPath;
            } else {
                // Auto-generate thumbnail from video
                thumbnailLocalPath = await join(outputDir, "thumbnail.jpg");
                try {
                    await invoke("generate_thumbnail", {
                        inputPath: item.path,
                        outputPath: thumbnailLocalPath
                    });
                    console.log("Thumbnail generated:", thumbnailLocalPath);
                } catch (thumbErr) {
                    console.warn("Thumbnail generation failed, continuing without:", thumbErr);
                    thumbnailLocalPath = null;
                }
            }

            // 4. Upload to R2
            console.log("Uploading from:", outputDir);
            const r2BasePath = await uploadToR2(item.id, outputDir, item.playlistId);

            // 5. Upload thumbnail to R2
            let thumbnailUrl = null;
            if (thumbnailLocalPath) {
                try {
                    thumbnailUrl = await uploadThumbnail(item.id, thumbnailLocalPath);
                    console.log("Thumbnail uploaded:", thumbnailUrl);
                } catch (thumbUploadErr) {
                    console.warn("Thumbnail upload failed, continuing without:", thumbUploadErr);
                }
            }

            // 6. Save to Firestore
            await VideoService.create({
                title: item.name,
                playlistId: item.playlistId,
                status: "ready",
                processedAt: new Date(),
                r2Path: r2BasePath, // Store the path for the player
                thumbnailUrl // null if thumbnail failed
            });

            updateItemStatus(item.id, "completed", 100);
        } catch (error) {
            console.error("Processing failed:", error);
            updateItemStatus(item.id, "error", 0, error.toString());
        } finally {
            setIsProcessing(false);
        }
    };

    const uploadToR2 = async (itemId, dir, playlistId) => {
        try {
            // Import dynamically to avoid build issues if dependencies aren't ready
            const { readFile, readDir } = await import("@tauri-apps/plugin-fs");
            const { Upload } = await import("@aws-sdk/lib-storage");
            const { r2Client, R2_BUCKET_NAME, R2_CONFIG_ISSUES, R2_ENDPOINT } = await import("../config/r2");
            const { join } = await import("@tauri-apps/api/path");
            const appOrigin = window?.location?.origin || "unknown";
            const endpointHost = getEndpointHost(R2_ENDPOINT);

            // Validate R2 Config
            if (!r2Client) {
                const issueSummary = Array.isArray(R2_CONFIG_ISSUES) && R2_CONFIG_ISSUES.length > 0
                    ? R2_CONFIG_ISSUES.join(" ")
                    : "R2 client initialization failed.";
                throw new Error(`R2 Client is not initialized. ${issueSummary}`);
            }
            if (!R2_BUCKET_NAME) throw new Error("R2 Bucket Name is missing. Check VITE_R2_BUCKET_NAME in .env.");

            console.log("R2 Config Validated. Bucket:", R2_BUCKET_NAME);

            // 1. List files recursively
            const getFilesRecursive = async (dir) => {
                try {
                    console.log(`Reading directory: ${dir}`);
                    const entries = await readDir(dir);
                    let files = [];
                    for (const entry of entries) {
                        try {
                            const fullPath = await join(dir, entry.name);
                            if (entry.isDirectory) {
                                console.log(`Entering subdirectory: ${fullPath}`);
                                const subFiles = await getFilesRecursive(fullPath);
                                files = files.concat(subFiles);
                            } else {
                                files.push({ ...entry, path: fullPath });
                            }
                        } catch (joinErr) {
                            console.error(`Error processing entry ${entry.name} in ${dir}:`, joinErr);
                        }
                    }
                    return files;
                } catch (readDirErr) {
                    console.error(`Error reading directory ${dir}:`, readDirErr);
                    throw new Error(`Failed to read directory ${dir}: ${readDirErr.message}`);
                }
            };

            let files = [];
            try {
                files = await getFilesRecursive(dir);
            } catch (err) {
                console.error("Recursive listing failed:", err);
                throw err;
            }

            const totalFiles = files.length;
            let uploadedFiles = 0;

            console.log(`Found ${totalFiles} files to upload in ${dir} (recursively)`);

            if (totalFiles === 0) {
                throw new Error(`Transcoding failed or no files generated in ${dir}`);
            }

            for (const file of files) {
                const filePath = file.path;
                let fileContent;
                try {
                    console.log(`Reading file: ${filePath}`);
                    fileContent = await readFile(filePath);
                } catch (readErr) {
                    console.error(`Failed to read file ${filePath}:`, readErr);
                    throw new Error(`Failed to read file ${filePath}: ${readErr.message}`);
                }

                // Construct R2 Key
                const normalizedDir = dir.replace(/\\+$/, "");
                const normalizedFilePath = filePath;
                const relativePath = normalizedFilePath
                    .replace(normalizedDir, "")
                    .replace(/^[/\\]/, "")
                    .replace(/\\/g, "/");
                const r2Key = `videos/${itemId}/${relativePath}`;

                // Determine Content Type
                let contentType = "application/octet-stream";
                if (file.name.endsWith(".m3u8")) contentType = "application/vnd.apple.mpegurl";
                else if (file.name.endsWith(".ts")) contentType = "video/MP2T";
                else if (file.name.endsWith(".mp4")) contentType = "video/mp4";
                else if (file.name.endsWith(".jpg")) contentType = "image/jpeg";

                // Upload
                console.log(`Starting upload for ${file.name} to ${r2Key}, size: ${fileContent.byteLength || fileContent.length}`);

                try {
                    const upload = new Upload({
                        client: r2Client,
                        params: {
                            Bucket: R2_BUCKET_NAME,
                            Key: r2Key,
                            Body: fileContent,
                            ContentType: contentType,
                        },
                    });

                    upload.on("httpUploadProgress", (progress) => {
                        const fileProgress = (progress.loaded / progress.total) * 100;
                        const totalProgress = ((uploadedFiles + (fileProgress / 100)) / totalFiles) * 100;
                        updateItemStatus(itemId, "uploading", Math.round(totalProgress));
                    });

                    await upload.done();
                    uploadedFiles++;
                    console.log(`Uploaded ${file.name}`);
                } catch (uploadErr) {
                    const category = classifyUploadError(uploadErr);
                    const diagnosticError = formatUploadFailure({
                        fileName: file.name,
                        r2Key,
                        appOrigin,
                        endpointHost,
                        category,
                        error: uploadErr,
                    });

                    console.error(`Failed to upload ${file.name} to R2:`, {
                        category,
                        appOrigin,
                        endpointHost,
                        r2Key,
                        errorMessage: getErrorMessage(uploadErr),
                    });

                    throw new Error(diagnosticError);
                }
            }

            return `videos/${itemId}`; // Return the base path in R2
        } catch (error) {
            console.error("R2 Upload Failed:", error);
            // Enhanced error logging to capture "undefined" errors
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const fullError = error instanceof Error ? error.stack : error;
            console.error("Full R2 Error Stack:", fullError);

            throw new Error(`Upload failed: ${errorMessage || 'Unknown error'}`);
        }
    };

    const uploadThumbnail = async (itemId, localPath) => {
        try {
            const { readFile } = await import("@tauri-apps/plugin-fs");
            const { Upload } = await import("@aws-sdk/lib-storage");
            const { r2Client, R2_BUCKET_NAME } = await import("../config/r2");

            const fileContent = await readFile(localPath);

            const ext = localPath.split('.').pop().toLowerCase();
            const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            const r2Key = `thumbnails/${itemId}.${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpg'}`;

            const upload = new Upload({
                client: r2Client,
                params: {
                    Bucket: R2_BUCKET_NAME,
                    Key: r2Key,
                    Body: fileContent,
                    ContentType: contentType,
                },
            });

            await upload.done();

            // Construct public thumbnail URL via Worker
            const workerUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL || '';
            return `${workerUrl}/${r2Key}`;
        } catch (error) {
            console.error("Thumbnail upload failed:", error);
            throw error;
        }
    };

    const updateItemStatus = (id, status, progress, error = null) => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, status, progress, error } : item
        ));
    };

    const removeFromQueue = (id) => {
        setQueue(prev => prev.filter(item => item.id !== id));
    };

    const value = {
        queue,
        addToQueue,
        removeFromQueue,
        isProcessing
    };

    return (
        <VideoQueueContext.Provider value={value}>
            {children}
        </VideoQueueContext.Provider>
    );
}

export const useVideoQueue = () => useContext(VideoQueueContext);
