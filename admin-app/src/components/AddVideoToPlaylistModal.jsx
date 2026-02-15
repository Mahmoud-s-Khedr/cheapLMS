import { useState, useEffect } from "react";
import { VideoService } from "../services/VideoService";
import { Search, Plus, Film, Check, Loader2 } from "lucide-react";

export default function AddVideoToPlaylistModal({ isOpen, onClose, onAdd, existingVideoIds = [] }) {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [adding, setAdding] = useState(new Set());

    useEffect(() => {
        if (isOpen) {
            loadVideos();
        }
    }, [isOpen]);

    const loadVideos = async () => {
        setLoading(true);
        try {
            const data = await VideoService.getAll();
            setVideos(data);
        } catch (error) {
            console.error("Failed to load videos:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (video) => {
        setAdding(prev => new Set(prev).add(video.id));
        try {
            await onAdd(video.id);
        } finally {
            setAdding(prev => {
                const next = new Set(prev);
                next.delete(video.id);
                return next;
            });
        }
    };

    if (!isOpen) return null;

    const filteredVideos = videos.filter(v =>
        !existingVideoIds.includes(v.id) &&
        v.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Add Video to Playlist</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search library..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto min-h-0 border rounded-lg border-slate-100">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
                    ) : filteredVideos.length === 0 ? (
                        <div className="text-center p-8 text-slate-400">
                            {searchTerm ? "No matching videos found." : "No selectable videos found."}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredVideos.map(video => (
                                <div key={video.id} className="p-3 flex items-center gap-3 hover:bg-slate-50">
                                    <div className="h-10 w-16 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                                        {video.thumbnailUrl ? (
                                            <img src={video.thumbnailUrl} className="w-full h-full object-cover" />
                                        ) : <Film className="h-4 w-4 m-auto text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-slate-800 truncate">{video.title}</div>
                                        <div className="text-xs text-slate-500">
                                            {video.durationSeconds ? `${Math.round(video.durationSeconds / 60)}m` : ''} • {video.status}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAdd(video)}
                                        disabled={adding.has(video.id)}
                                        className="p-2 rounded-full hover:bg-blue-100 text-blue-600 disabled:opacity-50"
                                    >
                                        {adding.has(video.id) ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
