import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useVideoQueue } from "../context/VideoQueueContext";
import { PlaylistService } from "../services/PlaylistService";
import { X, UploadCloud, FileVideo, ImagePlus } from "lucide-react";

export default function UploadModal({ isOpen, onClose }) {
    const { addToQueue } = useVideoQueue();
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState("");
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [selectedQualities, setSelectedQualities] = useState(["720p"]); // Default to 720p
    const [thumbnailPath, setThumbnailPath] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);

    useEffect(() => {
        if (isOpen) {
            PlaylistService.getAll()
                .then(data => {
                    console.log("Fetched playlists:", data);
                    setPlaylists(data);
                })
                .catch(err => console.error("Failed to load playlists:", err));
        }
    }, [isOpen]);

    const onDrop = useCallback((acceptedFiles) => {
        // Dropzone might not give absolute paths, so we prefer the dialog. 
        // But if we do get them (e.g. Tauri configured correctly), we use them.
        // We'll warn if path is missing.
        const validFiles = acceptedFiles.map(f => {
            // In some Tauri setups, f.path is populated.
            return f;
        });
        setSelectedFiles(prev => [...prev, ...validFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        noClick: true, // we will use our own button or area click
        accept: {
            'video/*': ['.mp4', '.mov', '.avi', '.mkv']
        }
    });

    const handleSelectFiles = async () => {
        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({
                multiple: true,
                filters: [{
                    name: 'Videos',
                    extensions: ['mp4', 'mov', 'avi', 'mkv']
                }]
            });

            if (selected) {
                // 'selected' is an array of strings (paths) or objects? 
                // Documentation says string[] if multiple=true and not directory.
                // Let's verify. Tauri v2 plugin-dialog returns strings.

                const newFiles = selected.map(path => {
                    // Extract name from path
                    // Linux/Mac use /, Windows uses \
                    const name = path.split(/[/\\]/).pop();
                    return {
                        name,
                        path,
                        size: 0 // We don't know size yet, checking validation later
                    };
                });

                setSelectedFiles(prev => [...prev, ...newFiles]);
            }
        } catch (err) {
            console.error("Failed to open dialog:", err);
        }
    };

    const handleSelectThumbnail = async () => {
        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Images',
                    extensions: ['jpg', 'jpeg', 'png', 'webp']
                }]
            });
            if (selected) {
                setThumbnailPath(selected);
                // Create a preview URL using Tauri's convertFileSrc
                const { convertFileSrc } = await import('@tauri-apps/api/core');
                setThumbnailPreview(convertFileSrc(selected));
            }
        } catch (err) {
            console.error("Failed to select thumbnail:", err);
        }
    };

    const handleUpload = () => {
        // Playlist is now optional
        // if (!selectedPlaylist) { ... } 

        if (selectedFiles.length === 0) return;
        if (selectedQualities.length === 0) {
            alert("Please select at least one quality");
            return;
        }

        addToQueue(selectedFiles, selectedPlaylist, selectedQualities, thumbnailPath);
        onClose();
        setSelectedFiles([]);
        setSelectedPlaylist("");
        setSelectedQualities(["720p"]);
        setThumbnailPath(null);
        setThumbnailPreview(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Upload Videos</h2>
                    <button onClick={onClose}><X className="h-6 w-6 text-gray-500" /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Target Playlist</label>
                        <select
                            className="w-full p-2 border rounded-md"
                            value={selectedPlaylist}
                            onChange={(e) => setSelectedPlaylist(e.target.value)}
                        >
                            <option value="">Select a playlist...</option>
                            {playlists.map(p => (
                                <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Qualities</label>
                        <div className="flex flex-wrap gap-3">
                            {["1080p", "720p", "480p", "360p"].map(q => (
                                <label key={q} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedQualities.includes(q)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedQualities(prev => [...prev, q]);
                                            } else {
                                                setSelectedQualities(prev => prev.filter(item => item !== q));
                                            }
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{q}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Thumbnail Picker */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail (Optional)</label>
                        {thumbnailPreview ? (
                            <div className="relative inline-block">
                                <img src={thumbnailPreview} alt="Thumbnail preview" className="h-24 rounded-md border border-gray-200 object-cover" />
                                <button
                                    onClick={() => { setThumbnailPath(null); setThumbnailPreview(null); }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                                >×</button>
                            </div>
                        ) : (
                            <button
                                onClick={handleSelectThumbnail}
                                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <ImagePlus className="h-4 w-4" />
                                Select thumbnail image
                            </button>
                        )}
                        <p className="text-xs text-gray-400 mt-1">If not provided, a thumbnail will be auto-generated from the video.</p>
                    </div>

                    <div
                        {...getRootProps()}
                        onClick={handleSelectFiles}
                        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                            }`}
                    >
                        <input {...getInputProps()} />
                        <UploadCloud className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        {isDragActive ? (
                            <p className="text-blue-500">Drop the videos here ...</p>
                        ) : (
                            <p className="text-gray-500">Click to select videos (Dialog)</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">Supports MP4, MOV, MKV, AVI</p>
                    </div>

                    {selectedFiles.length > 0 && (
                        <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                            {selectedFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center text-sm p-2 bg-gray-50 rounded">
                                    <FileVideo className="h-4 w-4 mr-2 text-gray-500" />
                                    <span className="truncate flex-1">{file.name}</span>
                                    <span className="text-gray-400 text-xs ml-2">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedFiles(files => files.filter((_, i) => i !== idx));
                                        }}
                                        className="ml-2 text-red-500 hover:text-red-700 font-bold"
                                    >×</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleUpload}
                            disabled={selectedFiles.length === 0}
                            className="rounded-md bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add {selectedFiles.length} Videos to Queue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
