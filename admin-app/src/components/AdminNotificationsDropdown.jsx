import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Bell, X } from 'lucide-react';

export default function AdminNotificationsDropdown() {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        // Fetch notifications aimed at 'all' or 'admin'
        const q = query(
            collection(db, 'notifications'),
            where('targetId', 'in', ['all', 'admin'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const dismissed = JSON.parse(localStorage.getItem('admin_dismissed_notifications') || '[]');
            const clearedTime = parseInt(localStorage.getItem('admin_notifications_cleared_time') || '0', 10);

            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(doc => doc.createdAt && doc.createdAt.toMillis() > clearedTime && !dismissed.includes(doc.id));

            // Sort by createdAt locally
            data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

            setNotifications(data.slice(0, 15)); // keep last 15

            if (!isOpen) {
                setUnreadCount(data.length);
            }
        });

        return () => unsubscribe();
    }, [user, isOpen]);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            setUnreadCount(0);
        }
    };

    const handleDismiss = (e, id) => {
        e.stopPropagation();
        const dismissed = JSON.parse(localStorage.getItem('admin_dismissed_notifications') || '[]');
        dismissed.push(id);
        if (dismissed.length > 50) dismissed.shift();
        localStorage.setItem('admin_dismissed_notifications', JSON.stringify(dismissed));

        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const handleClearAll = (e) => {
        e.stopPropagation();
        localStorage.setItem('admin_notifications_cleared_time', Date.now().toString());
        setNotifications([]);
        setUnreadCount(0);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={toggleDropdown}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors relative"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-2 z-50 border border-slate-200">
                    <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-slate-900">System Notifications</h3>
                        {notifications.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map((note) => (
                                <div key={note.id} className="relative px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
                                    <button
                                        onClick={(e) => handleDismiss(e, note.id)}
                                        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label="Dismiss notification"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <p className="text-sm font-medium text-slate-900 mb-1 pr-6">{note.title}</p>
                                    <p className="text-xs text-slate-600 mb-2">{note.message}</p>
                                    <p className="text-[10px] text-slate-400">
                                        {note.createdAt?.toDate().toLocaleString()}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-sm text-slate-500">
                                No new notifications
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
