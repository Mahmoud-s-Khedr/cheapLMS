import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function NotificationsDropdown() {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        // Fetch notifications aimed at 'all' or specific user
        const q = query(
            collection(db, 'notifications'),
            where('targetId', 'in', ['all', user.uid])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const dismissed = JSON.parse(localStorage.getItem('dismissed_notifications') || '[]');
            const clearedTime = parseInt(localStorage.getItem('notifications_cleared_time') || '0', 10);

            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(doc => doc.createdAt && doc.createdAt.toMillis() > clearedTime && !dismissed.includes(doc.id));

            // Sort locally
            data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

            setNotifications(data.slice(0, 10)); // keep last 10

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
        const dismissed = JSON.parse(localStorage.getItem('dismissed_notifications') || '[]');
        dismissed.push(id);
        if (dismissed.length > 50) dismissed.shift();
        localStorage.setItem('dismissed_notifications', JSON.stringify(dismissed));

        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const handleClearAll = (e) => {
        e.stopPropagation();
        localStorage.setItem('notifications_cleared_time', Date.now().toString());
        setNotifications([]);
        setUnreadCount(0);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={toggleDropdown}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors relative"
                aria-label="Notifications"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-700 rounded-lg shadow-lg py-2 z-50 border border-gray-200 dark:border-slate-600">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-600 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
                        {notifications.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map((note) => (
                                <div key={note.id} className="relative px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors border-b border-gray-100 dark:border-slate-600/50 last:border-0 group">
                                    <button
                                        onClick={(e) => handleDismiss(e, note.id)}
                                        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label="Dismiss notification"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1 pr-6">{note.title}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">{note.message}</p>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                        {note.createdAt?.toDate().toLocaleString()}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                                No new notifications
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
