import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { PlaylistService } from "../services/PlaylistService";
import { UserService } from "../services/UserService";
import { ArrowLeft, Plus, Trash2, GripVertical, Film, Loader2, UserPlus, Users, X } from "lucide-react";
import AddVideoToPlaylistModal from "../components/AddVideoToPlaylistModal";
import BulkAccessModal from "../components/BulkAccessModal";

export default function PlaylistDetailsPage() {
    const { id } = useParams();
    const [playlist, setPlaylist] = useState(null);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Access management state
    const [activeTab, setActiveTab] = useState("videos"); // "videos" | "access"
    const [accessList, setAccessList] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [accessLoading, setAccessLoading] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [revoking, setRevoking] = useState(false);

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    useEffect(() => {
        if (activeTab === "access" && id) {
            loadAccessData();
        }
    }, [activeTab, id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const p = await PlaylistService.get(id);
            if (p) {
                setPlaylist(p);
                const v = await PlaylistService.getVideos(id);
                setVideos(v);
            }
        } catch (error) {
            console.error("Failed to load playlist details:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadAccessData = async () => {
        setAccessLoading(true);
        try {
            const [accessDocs, users] = await Promise.all([
                UserService.getPlaylistAccess(id),
                UserService.getAll()
            ]);
            setAllUsers(users);
            // Enrich access docs with user info
            const enriched = accessDocs.map(doc => {
                const user = users.find(u => u.id === doc.userId);
                return {
                    ...doc,
                    userName: user?.displayName || user?.name || "Unknown",
                    userEmail: user?.email || "Unknown",
                };
            });
            setAccessList(enriched);
        } catch (error) {
            console.error("Failed to load access data:", error);
        } finally {
            setAccessLoading(false);
        }
    };

    const handleRemoveVideo = async (videoId) => {
        if (!confirm("Remove this video from the playlist? (Video will remain in library)")) return;
        try {
            await PlaylistService.removeVideo(id, videoId);
            setVideos(prev => prev.filter(v => v.id !== videoId));
        } catch (error) {
            alert("Failed to remove video");
        }
    };

    const handleAddVideo = async (videoId) => {
        try {
            await PlaylistService.addVideo(id, videoId);
            const v = await PlaylistService.getVideos(id);
            setVideos(v);
            setIsAddModalOpen(false);
        } catch (error) {
            alert("Failed to add video");
            console.error(error);
        }
    };

    const handleRevokeSelected = async () => {
        if (selectedUsers.size === 0) return;
        if (!confirm(`Revoke access for ${selectedUsers.size} user(s)?`)) return;

        setRevoking(true);
        try {
            await UserService.bulkRevokeAccess(id, Array.from(selectedUsers));
            setSelectedUsers(new Set());
            await loadAccessData();
        } catch (error) {
            alert("Failed to revoke access");
            console.error(error);
        } finally {
            setRevoking(false);
        }
    };

    const toggleUserSelection = (userId) => {
        setSelectedUsers(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedUsers.size === accessList.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(accessList.map(a => a.userId)));
        }
    };

    if (loading) return <div className="text-center py-12">Loading...</div>;
    if (!playlist) return <div className="text-center py-12">Playlist not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <Link to="/playlists" className="text-sm text-slate-500 hover:text-blue-600 flex items-center mb-2">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Playlists
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">{playlist.title}</h1>
                    <p className="text-slate-500 mt-1 max-w-2xl">{playlist.description}</p>
                    <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">{videos.length} Videos</span>
                        <span>Created {playlist.createdAt?.toDate ? playlist.createdAt.toDate().toLocaleDateString() : 'Unknown'}</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab("videos")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "videos"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                >
                    <Film className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                    Videos ({videos.length})
                </button>
                <button
                    onClick={() => setActiveTab("access")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "access"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                >
                    <Users className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                    Access ({accessList.length})
                </button>
            </div>

            {/* Videos Tab */}
            {activeTab === "videos" && (
                <>
                    <div className="flex justify-end">
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 shadow-sm"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Video
                        </button>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {videos.length === 0 ? (
                            <div className="text-center py-16">
                                <Film className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-slate-900">This playlist is empty</h3>
                                <p className="mt-1 text-slate-500 mb-6">Add videos from your library to get started.</p>
                                <button
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Video
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {videos.map((video, index) => (
                                    <div key={video.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 group transition-colors">
                                        <div className="text-slate-400 cursor-move">
                                            <GripVertical className="h-5 w-5" />
                                        </div>
                                        <div className="text-slate-500 font-mono text-sm w-6">
                                            {index + 1}
                                        </div>
                                        <div className="h-16 w-28 bg-slate-200 rounded overflow-hidden flex-shrink-0 relative">
                                            {video.thumbnailUrl ? (
                                                <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                    <Film className="h-6 w-6" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-slate-900 truncate">{video.title}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)}:${String(Math.floor(video.durationSeconds % 60)).padStart(2, '0')}` : '--:--'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveVideo(video.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remove from playlist"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Access Tab */}
            {activeTab === "access" && (
                <>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {selectedUsers.size > 0 && (
                                <button
                                    onClick={handleRevokeSelected}
                                    disabled={revoking}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50"
                                >
                                    {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                    Revoke {selectedUsers.size} selected
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setIsBulkModalOpen(true)}
                            className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 shadow-sm"
                        >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Grant Access
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {accessLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            </div>
                        ) : accessList.length === 0 ? (
                            <div className="text-center py-16">
                                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-slate-900">No users with access</h3>
                                <p className="mt-1 text-slate-500 mb-6">Grant access to users by their email address.</p>
                                <button
                                    onClick={() => setIsBulkModalOpen(true)}
                                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Grant Access
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Select all header */}
                                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedUsers.size === accessList.length && accessList.length > 0}
                                        onChange={toggleSelectAll}
                                        className="rounded border-slate-300"
                                    />
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        {selectedUsers.size > 0 ? `${selectedUsers.size} selected` : `${accessList.length} users with access`}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {accessList.map(access => (
                                        <div key={access.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={selectedUsers.has(access.userId)}
                                                onChange={() => toggleUserSelection(access.userId)}
                                                className="rounded border-slate-300"
                                            />
                                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                                                {access.userName?.charAt(0)?.toUpperCase() || "?"}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 truncate">{access.userName}</p>
                                                <p className="text-xs text-slate-500 truncate">{access.userEmail}</p>
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {access.grantedAt?.toDate ? access.grantedAt.toDate().toLocaleDateString() : "—"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            <AddVideoToPlaylistModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddVideo}
                existingVideoIds={videos.map(v => v.id)}
            />

            {isBulkModalOpen && (
                <BulkAccessModal
                    playlistId={id}
                    playlistTitle={playlist.title}
                    existingUserIds={accessList.map(a => a.userId)}
                    onClose={() => setIsBulkModalOpen(false)}
                    onGranted={loadAccessData}
                />
            )}
        </div>
    );
}
