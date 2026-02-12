import { useState, useEffect } from "react";
import { PlaylistService } from "../services/PlaylistService";
import { Plus, Edit, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Schema for Playlist Form
const playlistSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().optional(),
    thumbnailUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

function PlaylistModal({ isOpen, initialData, onClose, onSubmit }) {
    const isEdit = !!initialData;
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(playlistSchema),
        defaultValues: {
            title: initialData?.title || "",
            description: initialData?.description || "",
            thumbnailUrl: initialData?.thumbnailUrl || "",
        },
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <h2 className="text-xl font-bold mb-4">{isEdit ? "Edit Playlist" : "Create Playlist"}</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Title</label>
                        <input
                            {...register("title")}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            {...register("description")}
                            rows={3}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Thumbnail URL (Optional)</label>
                        <input
                            {...register("thumbnailUrl")}
                            placeholder="https://example.com/image.jpg"
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {errors.thumbnailUrl && <p className="text-red-500 text-xs mt-1">{errors.thumbnailUrl.message}</p>}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEdit ? "Update" : "Create")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function PlaylistsPage() {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlaylist, setEditingPlaylist] = useState(null);

    useEffect(() => {
        loadPlaylists();
    }, []);

    const loadPlaylists = async () => {
        setLoading(true);
        try {
            const data = await PlaylistService.getAll();
            setPlaylists(data);
        } catch (error) {
            console.error("Failed to load playlists", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingPlaylist(null);
        setIsModalOpen(true);
    };

    const handleEdit = (playlist) => {
        setEditingPlaylist(playlist);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this playlist? This action cannot be undone.")) {
            try {
                await PlaylistService.delete(id);
                loadPlaylists();
            } catch (error) {
                alert("Failed to delete playlist");
            }
        }
    };

    const handleFormSubmit = async (data) => {
        try {
            if (editingPlaylist) {
                await PlaylistService.update(editingPlaylist.id, data);
            } else {
                await PlaylistService.create(data);
            }
            setIsModalOpen(false);
            loadPlaylists();
        } catch (error) {
            console.error(error);
            alert("Operation failed");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Playlists</h1>
                <button
                    onClick={handleCreate}
                    className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Playlist
                </button>
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : playlists.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-slate-100">
                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-blue-50 rounded-full">
                            <Plus className="h-8 w-8 text-blue-500" />
                        </div>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">No playlists yet</h3>
                    <p className="mt-1 text-slate-500">Create your first playlist to organize videos.</p>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {playlists.map((playlist) => (
                        <div key={playlist.id} className="group overflow-hidden rounded-xl bg-white shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200">
                            <div className="relative h-48 bg-slate-100">
                                {playlist.thumbnailUrl ? (
                                    <img
                                        src={playlist.thumbnailUrl}
                                        alt={playlist.title}
                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                                        <ImageIcon className="h-12 w-12" />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEdit(playlist)}
                                        className="rounded-lg bg-white/90 p-2 text-slate-600 shadow-sm hover:text-blue-600 hover:bg-white transition-colors"
                                    >
                                        <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(playlist.id)}
                                        className="rounded-lg bg-white/90 p-2 text-slate-600 shadow-sm hover:text-red-600 hover:bg-white transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-5">
                                <h3 className="text-lg font-semibold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">{playlist.title}</h3>
                                <p className="mt-1 text-sm text-slate-500 line-clamp-2 min-h-[2.5em]">
                                    {playlist.description || "No description provided."}
                                </p>
                                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-medium text-slate-400">
                                    <span className="bg-slate-50 px-2 py-1 rounded">{playlist.videoCount || 0} videos</span>
                                    <span>{playlist.updatedAt?.toDate?.().toLocaleDateString() || "Just now"}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <PlaylistModal
                    isOpen={isModalOpen}
                    initialData={editingPlaylist}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleFormSubmit}
                />
            )}
        </div>
    );
}
