import { useState, useEffect } from "react";
import { UserService } from "../services/UserService";
import { PlaylistService } from "../services/PlaylistService";
import { useAuth } from "../context/AuthContext";
import { Loader2, Search, User as UserIcon } from "lucide-react";

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await UserService.getAll();
            setUsers(data);
        } catch (error) {
            console.error("Failed to load users", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Users</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                {user.photoURL ? (
                                                    <img className="h-10 w-10 rounded-full" src={user.photoURL} alt="" />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                                                        <UserIcon className="h-5 w-5 text-slate-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-slate-900">{user.displayName || "No Name"}</div>
                                                <div className="text-sm text-slate-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${user.role === 'admin'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-green-100 text-green-700'
                                            }`}>
                                            {user.role || 'student'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {user.createdAt?.toDate?.().toLocaleDateString() || "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => setSelectedUser(user)}
                                            className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                        >
                                            Manage Access
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="text-center py-12">
                            <div className="inline-flex justify-center items-center w-12 h-12 rounded-full bg-slate-100 mb-3">
                                <Search className="h-6 w-6 text-slate-400" />
                            </div>
                            <p className="text-slate-500">No users found matching "{searchTerm}"</p>
                        </div>
                    )}
                </div>
            )}

            {selectedUser && (
                <AccessControlModal
                    isOpen={!!selectedUser}
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                />
            )}
        </div>
    );
}

function AccessControlModal({ isOpen, user, onClose }) {
    const [playlists, setPlaylists] = useState([]);
    const [userAccess, setUserAccess] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user: currentUser } = useAuth();

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, user.id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [allPlaylists, access] = await Promise.all([
                PlaylistService.getAll(),
                UserService.getUserAccess(user.id)
            ]);
            setPlaylists(allPlaylists);
            setUserAccess(access);
        } catch (error) {
            console.error("Failed to load access data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGrant = async (playlistId) => {
        try {
            await UserService.grantAccess(playlistId, user.id, currentUser?.email || "unknown");
            loadData(); // Reload to update button state
        } catch (error) {
            alert("Failed to grant access");
        }
    };

    const handleRevoke = async (accessId) => {
        try {
            await UserService.revokeAccess(accessId);
            loadData(); // Reload to update button state
        } catch (error) {
            alert("Failed to revoke access");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Manage Access: {user.displayName || user.email}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                </div>

                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
                ) : (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-700">Available Playlists</h3>
                        <div className="space-y-2">
                            {playlists.map(playlist => {
                                const access = userAccess.find(a => a.playlistId === playlist.id);
                                return (
                                    <div key={playlist.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                                        <div>
                                            <div className="font-medium">{playlist.title}</div>
                                            <div className="text-xs text-gray-500">{playlist.id}</div>
                                        </div>
                                        {access ? (
                                            <button
                                                onClick={() => handleRevoke(access.id)}
                                                className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 border border-red-200 rounded hover:bg-red-50 transition-colors"
                                            >
                                                Revoke Access
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleGrant(playlist.id)}
                                                className="text-green-600 hover:text-green-800 text-sm font-medium px-3 py-1 border border-green-200 rounded hover:bg-green-50 transition-colors"
                                            >
                                                Grant Access
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            {playlists.length === 0 && (
                                <p className="text-gray-500 text-sm">No playlists found.</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
