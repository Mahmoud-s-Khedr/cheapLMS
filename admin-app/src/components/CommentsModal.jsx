import { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../config/firebase";
import { X, Trash2, MessageSquare, Loader2 } from "lucide-react";

export default function CommentsModal({ isOpen, video, onClose }) {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        if (isOpen && video?.id) {
            loadComments();
        }
    }, [isOpen, video]);

    const loadComments = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, "videos", video.id, "comments"),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Failed to load comments:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (commentId) => {
        if (!confirm("Are you sure you want to delete this comment?")) return;
        setDeletingId(commentId);
        try {
            await deleteDoc(doc(db, "videos", video.id, "comments", commentId));
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch (error) {
            console.error("Failed to delete comment:", error);
            alert("Failed to delete comment");
        } finally {
            setDeletingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-blue-500" />
                            Moderate Comments
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 truncate max-w-lg">
                            {video?.title}
                        </p>
                    </div>
                    <button onClick={onClose}><X className="h-5 w-5 text-gray-500 hover:text-gray-700" /></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                    {loading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            No comments found for this video.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {comments.map(c => (
                                <div key={c.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-semibold text-slate-900">{c.userName || "Unknown"}</span>
                                            <span className="text-xs text-slate-500 ml-2">
                                                {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString() : "Recently"}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            disabled={deletingId === c.id}
                                            className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1"
                                            title="Delete Comment"
                                        >
                                            {deletingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-slate-700 whitespace-pre-wrap text-sm">{c.text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded hover:bg-slate-200 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
