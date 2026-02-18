import { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { UserService } from "../services/UserService";
import { X, UserPlus, Loader2, Search } from "lucide-react";

const functions = getFunctions(undefined, "europe-west1");

export default function BulkAccessModal({ playlistId, playlistTitle, existingUserIds = [], onClose, onGranted }) {
    const [emailText, setEmailText] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // User search state
    const [allUsers, setAllUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [usersLoading, setUsersLoading] = useState(true);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const users = await UserService.getAll();
            setAllUsers(users);
        } catch (err) {
            console.error("Failed to load users:", err);
        } finally {
            setUsersLoading(false);
        }
    };

    const emails = emailText
        .split(/[,\n]+/)
        .map(e => e.trim())
        .filter(Boolean);

    const filteredUsers = allUsers.filter(u => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            u.email?.toLowerCase().includes(q) ||
            u.displayName?.toLowerCase().includes(q) ||
            u.name?.toLowerCase().includes(q)
        );
    });

    const addUserEmail = (email) => {
        const current = emailText.trim();
        if (current.includes(email)) return; // already added
        setEmailText(current ? `${current}\n${email}` : email);
    };

    const isAlreadyAdded = (email) => emails.includes(email);
    const hasAccess = (userId) => existingUserIds.includes(userId);

    const handleGrant = async () => {
        if (emails.length === 0) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const bulkGrant = httpsCallable(functions, "bulkGrantAccess");
            const res = await bulkGrant({ playlistId, emails });
            setResult(res.data);
            if (onGranted) onGranted();
        } catch (err) {
            console.error("Bulk grant failed:", err);
            setError(err.message || "Failed to grant access.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Grant Access</h2>
                        <p className="text-sm text-gray-500 mt-0.5">{playlistTitle}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {/* User search list */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select users
                        </label>
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name or email..."
                                className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                            {usersLoading ? (
                                <div className="p-4 text-center text-gray-400 text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                                    Loading users...
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="p-4 text-center text-gray-400 text-sm">
                                    No users found
                                </div>
                            ) : (
                                filteredUsers.map(user => {
                                    const alreadyHasAccess = hasAccess(user.id);
                                    const added = isAlreadyAdded(user.email);
                                    return (
                                        <button
                                            key={user.id}
                                            onClick={() => !alreadyHasAccess && !added && addUserEmail(user.email)}
                                            disabled={alreadyHasAccess || added}
                                            className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm border-b border-gray-100 last:border-0 transition-colors ${alreadyHasAccess
                                                    ? "bg-gray-50 text-gray-400 cursor-default"
                                                    : added
                                                        ? "bg-blue-50 text-blue-700 cursor-default"
                                                        : "hover:bg-gray-50 text-gray-700"
                                                }`}
                                        >
                                            <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                                                {(user.displayName || user.name || user.email || "?").charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">
                                                    {user.displayName || user.name || "No name"}
                                                </p>
                                                <p className="text-xs text-gray-400 truncate">{user.email}</p>
                                            </div>
                                            {alreadyHasAccess && (
                                                <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                                                    Has access
                                                </span>
                                            )}
                                            {added && !alreadyHasAccess && (
                                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex-shrink-0">
                                                    Added
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Manual email textarea */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Or type emails manually
                        </label>
                        <textarea
                            value={emailText}
                            onChange={(e) => setEmailText(e.target.value)}
                            placeholder="Enter email addresses, one per line or comma-separated"
                            rows={3}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            {emails.length} email{emails.length !== 1 ? "s" : ""} selected
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md">
                            {error}
                        </div>
                    )}

                    {result && (
                        <div className="space-y-2">
                            {result.granted?.length > 0 && (
                                <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-md">
                                    ✅ Granted access to {result.granted.length} user{result.granted.length !== 1 ? "s" : ""}
                                </div>
                            )}
                            {result.notFound?.length > 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm p-3 rounded-md">
                                    ⚠️ Not found: {result.notFound.join(", ")}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        {result ? "Done" : "Cancel"}
                    </button>
                    {!result && (
                        <button
                            onClick={handleGrant}
                            disabled={loading || emails.length === 0}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <UserPlus className="h-4 w-4" />
                            )}
                            Grant Access
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
