import { useState, useEffect, useCallback } from "react";
import { MultimediaService } from "../services/MultimediaService";
import { VideoService } from "../services/VideoService";
import { v4 as uuidv4 } from "uuid";
import {
    Loader2, Search, Trash2, Link2, Unlink, Upload, FileAudio, FileImage, FileText, X, Music, Image, File
} from "lucide-react";

const TYPE_CONFIG = {
    voicenote: { icon: FileAudio, label: "Voice Note", color: "bg-purple-100 text-purple-700", extensions: [".mp3", ".wav", ".m4a", ".ogg"] },
    image: { icon: FileImage, label: "Image", color: "bg-blue-100 text-blue-700", extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"] },
    pdf: { icon: FileText, label: "PDF", color: "bg-red-100 text-red-700", extensions: [".pdf"] },
};

function getTypeFromExtension(fileName) {
    const ext = "." + fileName.split(".").pop().toLowerCase();
    for (const [type, config] of Object.entries(TYPE_CONFIG)) {
        if (config.extensions.includes(ext)) return type;
    }
    return null;
}

function getMimeType(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    const mimeMap = {
        mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg",
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
        pdf: "application/pdf",
    };
    return mimeMap[ext] || "application/octet-stream";
}

export default function MultimediaPage() {
    const [multimedia, setMultimedia] = useState([]);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [linkingItem, setLinkingItem] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [mmData, videoData] = await Promise.all([
                MultimediaService.getAll(),
                VideoService.getAll()
            ]);
            setMultimedia(mmData);
            setVideos(videoData);
        } catch (error) {
            console.error("Failed to load multimedia:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (item) => {
        if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
        try {
            // Delete from R2
            const { ListObjectsV2Command, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
            const { r2Client, R2_BUCKET_NAME } = await import("../config/r2");

            if (r2Client && item.fileUrl) {
                // fileUrl is like "multimedia/{id}/{filename}" — delete the whole prefix
                const prefix = `multimedia/${item.id}/`;
                const listCmd = new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Prefix: prefix });
                const listRes = await r2Client.send(listCmd);
                if (listRes.Contents && listRes.Contents.length > 0) {
                    await r2Client.send(new DeleteObjectsCommand({
                        Bucket: R2_BUCKET_NAME,
                        Delete: { Objects: listRes.Contents.map(o => ({ Key: o.Key })) }
                    }));
                }
            }

            await MultimediaService.delete(item.id);
            setMultimedia(prev => prev.filter(m => m.id !== item.id));
        } catch (error) {
            alert("Failed to delete: " + error.message);
        }
    };

    const handleUnlink = async (item) => {
        try {
            await MultimediaService.unlinkFromVideo(item.id);
            setMultimedia(prev => prev.map(m => m.id === item.id ? { ...m, videoId: null } : m));
        } catch (error) {
            alert("Failed to unlink: " + error.message);
        }
    };

    const handleLink = async (multimediaId, videoId) => {
        try {
            await MultimediaService.linkToVideo(multimediaId, videoId);
            setMultimedia(prev => prev.map(m => m.id === multimediaId ? { ...m, videoId } : m));
            setLinkingItem(null);
        } catch (error) {
            alert("Failed to link: " + error.message);
        }
    };

    const getVideoTitle = (videoId) => {
        const video = videos.find(v => v.id === videoId);
        return video?.title || "Unknown Video";
    };

    const filtered = multimedia.filter(item => {
        const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.fileName?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === "all" || item.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Multimedia</h1>
                <button
                    onClick={() => setIsUploadOpen(true)}
                    className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 shadow-sm"
                >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search multimedia..."
                        className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {["all", "voicenote", "image", "pdf"].map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterType === type
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                        >
                            {type === "all" ? "All" : TYPE_CONFIG[type]?.label || type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-slate-200">
                    <Upload className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">
                        {multimedia.length === 0 ? "No multimedia yet" : "No results found"}
                    </h3>
                    <p className="mt-1 text-slate-500">
                        {multimedia.length === 0 ? "Upload voice notes, images, or PDFs to get started." : "Try adjusting your search or filter."}
                    </p>
                </div>
            ) : (
                <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">File</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Linked Video</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {filtered.map((item) => {
                                const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.pdf;
                                const Icon = config.icon;
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Icon className="h-5 w-5 text-slate-400 mr-3" />
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">{item.title}</div>
                                                    <div className="text-xs text-slate-500">{item.fileName}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${config.color}`}>
                                                {config.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {item.videoId ? (
                                                <span className="text-slate-700">{getVideoTitle(item.videoId)}</span>
                                            ) : (
                                                <span className="text-slate-400 italic">Unlinked</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {item.createdAt?.toDate?.().toLocaleDateString() || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {item.videoId ? (
                                                    <button
                                                        onClick={() => handleUnlink(item)}
                                                        className="p-1.5 text-slate-400 hover:text-orange-500 transition-colors"
                                                        title="Unlink from video"
                                                    >
                                                        <Unlink className="h-4 w-4" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setLinkingItem(item)}
                                                        className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                                                        title="Link to video"
                                                    >
                                                        <Link2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Upload Modal */}
            {isUploadOpen && (
                <UploadMultimediaModal
                    videos={videos}
                    onClose={() => setIsUploadOpen(false)}
                    onUploaded={() => { setIsUploadOpen(false); loadData(); }}
                />
            )}

            {/* Link to Video Modal */}
            {linkingItem && (
                <LinkToVideoModal
                    item={linkingItem}
                    videos={videos}
                    onClose={() => setLinkingItem(null)}
                    onLink={handleLink}
                />
            )}
        </div>
    );
}

function UploadMultimediaModal({ videos, onClose, onUploaded }) {
    const [title, setTitle] = useState("");
    const [selectedVideoId, setSelectedVideoId] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedFilePath, setSelectedFilePath] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleSelectFile = async () => {
        try {
            const { open } = await import("@tauri-apps/plugin-dialog");
            const selected = await open({
                multiple: false,
                filters: [{
                    name: "Multimedia",
                    extensions: ["mp3", "wav", "m4a", "ogg", "jpg", "jpeg", "png", "webp", "gif", "pdf"]
                }]
            });
            if (selected) {
                const name = selected.split(/[/\\]/).pop();
                setSelectedFile({ name, path: selected });
                setSelectedFilePath(selected);
                if (!title) setTitle(name.replace(/\.[^.]+$/, ""));
            }
        } catch (err) {
            console.error("Failed to open dialog:", err);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !title) return;

        const type = getTypeFromExtension(selectedFile.name);
        if (!type) {
            alert("Unsupported file type.");
            return;
        }

        setUploading(true);
        setProgress(0);

        try {
            const { readFile } = await import("@tauri-apps/plugin-fs");
            const { Upload } = await import("@aws-sdk/lib-storage");
            const { r2Client, R2_BUCKET_NAME } = await import("../config/r2");

            if (!r2Client) throw new Error("R2 Client not initialized");

            const fileContent = await readFile(selectedFilePath);
            const itemId = uuidv4();
            const mimeType = getMimeType(selectedFile.name);
            const r2Key = `multimedia/${itemId}/${selectedFile.name}`;

            const upload = new Upload({
                client: r2Client,
                params: {
                    Bucket: R2_BUCKET_NAME,
                    Key: r2Key,
                    Body: fileContent,
                    ContentType: mimeType,
                },
            });

            upload.on("httpUploadProgress", (p) => {
                if (p.total) setProgress(Math.round((p.loaded / p.total) * 100));
            });

            await upload.done();
            setProgress(100);

            // Save to Firestore
            await MultimediaService.create({
                id: itemId,
                title,
                type,
                fileUrl: r2Key,
                fileName: selectedFile.name,
                fileSize: fileContent.byteLength || fileContent.length || 0,
                mimeType,
                videoId: selectedVideoId || null,
            });

            onUploaded();
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Upload failed: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Upload Multimedia</h2>
                    <button onClick={onClose}><X className="h-6 w-6 text-gray-500" /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter a title..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Link to Video (Optional)</label>
                        <select
                            className="w-full p-2 border rounded-md"
                            value={selectedVideoId}
                            onChange={(e) => setSelectedVideoId(e.target.value)}
                        >
                            <option value="">None — upload as unlinked</option>
                            {videos.map(v => (
                                <option key={v.id} value={v.id}>{v.title}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">File</label>
                        {selectedFile ? (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border">
                                <File className="h-5 w-5 text-gray-400" />
                                <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                                <button
                                    onClick={() => { setSelectedFile(null); setSelectedFilePath(null); }}
                                    className="text-red-500 hover:text-red-700 text-sm font-bold"
                                >×</button>
                            </div>
                        ) : (
                            <button
                                onClick={handleSelectFile}
                                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                            >
                                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">Click to select a file</p>
                                <p className="text-xs text-gray-400 mt-1">MP3, WAV, JPG, PNG, PDF, etc.</p>
                            </button>
                        )}
                    </div>

                    {uploading && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile || !title || uploading}
                            className="rounded-md bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? `Uploading ${progress}%...` : "Upload"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LinkToVideoModal({ item, videos, onClose, onLink }) {
    const [searchTerm, setSearchTerm] = useState("");

    const filtered = videos.filter(v =>
        v.title?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Link "{item.title}" to a Video</h2>
                    <button onClick={onClose}><X className="h-5 w-5 text-gray-500" /></button>
                </div>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search videos..."
                        className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    {filtered.map(video => (
                        <button
                            key={video.id}
                            onClick={() => onLink(item.id, video.id)}
                            className="w-full flex items-center gap-3 p-3 text-left bg-gray-50 rounded-md border hover:bg-blue-50 hover:border-blue-200 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-900 truncate">{video.title}</div>
                            </div>
                            <Link2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <p className="text-center text-gray-500 py-4">No videos found.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
