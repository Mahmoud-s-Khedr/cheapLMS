import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function CommentSection({ videoId }) {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, isAdmin } = useAuth();

    useEffect(() => {
        if (!videoId) return;

        const q = query(
            collection(db, 'videos', videoId, 'comments'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setComments(commentsData);
        });

        return () => unsubscribe();
    }, [videoId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'videos', videoId, 'comments'), {
                text: newComment.trim(),
                userId: user.uid,
                userName: user.displayName || 'Anonymous Student',
                createdAt: serverTimestamp()
            });
            setNewComment('');
        } catch (err) {
            console.error('Error adding comment:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (commentId) => {
        if (!window.confirm('Are you sure you want to delete this comment?')) return;
        try {
            await deleteDoc(doc(db, 'videos', videoId, 'comments', commentId));
        } catch (err) {
            console.error('Error deleting comment:', err);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm dark:border dark:border-slate-700 mt-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Comments ({comments.length})
            </h2>

            {/* Add Comment Form */}
            {user && (
                <form onSubmit={handleSubmit} className="mb-8">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold shrink-0">
                            {user.displayName ? user.displayName[0].toUpperCase() : 'S'}
                        </div>
                        <div className="flex-1">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
                                rows="3"
                                disabled={isSubmitting}
                            />
                            <div className="mt-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={!newComment.trim() || isSubmitting}
                                    className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:ring-4 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSubmitting ? 'Posting...' : 'Post Comment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {/* Comments List */}
            <div className="space-y-6">
                {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-gray-400 font-medium shrink-0">
                            {comment.userName ? comment.userName[0].toUpperCase() : 'U'}
                        </div>
                        <div className="flex-1 bg-gray-50 dark:bg-slate-700/50 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {comment.userName}
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                                        {comment.createdAt?.toDate().toLocaleDateString()}
                                    </span>
                                </div>
                                {(isAdmin || (user && user.uid === comment.userId)) && (
                                    <button
                                        onClick={() => handleDelete(comment.id)}
                                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium transition-colors"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {comment.text}
                            </p>
                        </div>
                    </div>
                ))}
                {comments.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                        No comments yet. Be the first to start the discussion!
                    </p>
                )}
            </div>
        </div>
    );
}
