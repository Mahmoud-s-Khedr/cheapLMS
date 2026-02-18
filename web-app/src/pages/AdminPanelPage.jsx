import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { db } from '../lib/firebase'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'

const functions = getFunctions(undefined, 'europe-west1')

export default function AdminPanelPage() {
    const { user, isAdmin, logout } = useAuth()

    const [playlists, setPlaylists] = useState([])
    const [selectedPlaylist, setSelectedPlaylist] = useState(null)
    const [accessList, setAccessList] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [accessLoading, setAccessLoading] = useState(false)

    // Grant form
    const [emailInput, setEmailInput] = useState('')
    const [granting, setGranting] = useState(false)
    const [grantResult, setGrantResult] = useState(null)

    // Revoke
    const [selectedUserIds, setSelectedUserIds] = useState(new Set())
    const [revoking, setRevoking] = useState(false)

    if (!isAdmin) return <Navigate to="/dashboard" replace />

    useEffect(() => {
        loadPlaylists()
    }, [])

    useEffect(() => {
        if (selectedPlaylist) {
            loadAccess(selectedPlaylist.id)
        } else {
            setAccessList([])
        }
    }, [selectedPlaylist])

    const loadPlaylists = async () => {
        setLoading(true)
        try {
            const snap = await getDocs(query(collection(db, 'playlists'), orderBy('createdAt', 'desc')))
            setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() })))

            // Load all users for name resolution
            const usersSnap = await getDocs(collection(db, 'users'))
            setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch (err) {
            console.error('Failed to load playlists:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadAccess = async (playlistId) => {
        setAccessLoading(true)
        setSelectedUserIds(new Set())
        setGrantResult(null)
        try {
            const snap = await getDocs(query(
                collection(db, 'playlistAccess'),
                where('playlistId', '==', playlistId)
            ))
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            const enriched = docs.map(doc => {
                const u = allUsers.find(usr => usr.id === doc.userId)
                return {
                    ...doc,
                    userName: u?.displayName || u?.name || 'Unknown',
                    userEmail: u?.email || 'Unknown',
                }
            })
            setAccessList(enriched)
        } catch (err) {
            console.error('Failed to load access:', err)
        } finally {
            setAccessLoading(false)
        }
    }

    const handleGrant = async () => {
        const emails = emailInput.split(/[,\n]+/).map(e => e.trim()).filter(Boolean)
        if (emails.length === 0 || !selectedPlaylist) return
        setGranting(true)
        setGrantResult(null)
        try {
            const bulkGrant = httpsCallable(functions, 'bulkGrantAccess')
            const res = await bulkGrant({ playlistId: selectedPlaylist.id, emails })
            setGrantResult(res.data)
            setEmailInput('')
            await loadAccess(selectedPlaylist.id)
        } catch (err) {
            setGrantResult({ error: err.message })
        } finally {
            setGranting(false)
        }
    }

    const handleRevokeSelected = async () => {
        if (selectedUserIds.size === 0 || !selectedPlaylist) return
        if (!confirm(`Revoke access for ${selectedUserIds.size} user(s)?`)) return
        setRevoking(true)
        try {
            const bulkRevoke = httpsCallable(functions, 'bulkRevokeAccess')
            await bulkRevoke({ playlistId: selectedPlaylist.id, userIds: Array.from(selectedUserIds) })
            setSelectedUserIds(new Set())
            await loadAccess(selectedPlaylist.id)
        } catch (err) {
            alert('Revoke failed: ' + err.message)
        } finally {
            setRevoking(false)
        }
    }

    const toggleUser = (userId) => {
        setSelectedUserIds(prev => {
            const next = new Set(prev)
            if (next.has(userId)) next.delete(userId)
            else next.add(userId)
            return next
        })
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
            <Navigation onLogout={logout} />

            <div className="max-w-6xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Admin Panel</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Playlist List */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm dark:border dark:border-slate-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="font-semibold text-gray-900 dark:text-white">Playlists</h2>
                        </div>
                        {loading ? (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[60vh] overflow-y-auto">
                                {playlists.map(pl => (
                                    <button
                                        key={pl.id}
                                        onClick={() => setSelectedPlaylist(pl)}
                                        className={`w-full text-left px-4 py-3 transition-colors text-sm ${selectedPlaylist?.id === pl.id
                                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        {pl.title}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Access Management */}
                    <div className="lg:col-span-2 space-y-6">
                        {!selectedPlaylist ? (
                            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm dark:border dark:border-slate-700 p-12 text-center">
                                <p className="text-gray-500 dark:text-gray-400">Select a playlist to manage access</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm dark:border dark:border-slate-700 p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                        {selectedPlaylist.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                        Grant or revoke access for this playlist
                                    </p>

                                    {/* Grant Form */}
                                    <div className="space-y-3">
                                        <textarea
                                            value={emailInput}
                                            onChange={(e) => setEmailInput(e.target.value)}
                                            placeholder="Enter email addresses, comma or newline separated"
                                            rows={3}
                                            className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
                                        />
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleGrant}
                                                disabled={granting || !emailInput.trim()}
                                                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
                                            >
                                                {granting ? 'Granting...' : 'Grant Access'}
                                            </button>
                                            {grantResult?.granted?.length > 0 && (
                                                <span className="text-xs text-green-600 dark:text-green-400">
                                                    ✅ Granted to {grantResult.granted.length}
                                                </span>
                                            )}
                                            {grantResult?.notFound?.length > 0 && (
                                                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                                    ⚠️ Not found: {grantResult.notFound.join(', ')}
                                                </span>
                                            )}
                                            {grantResult?.error && (
                                                <span className="text-xs text-red-600 dark:text-red-400">
                                                    ❌ {grantResult.error}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* User List */}
                                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm dark:border dark:border-slate-700 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                                            Users with access ({accessList.length})
                                        </h4>
                                        {selectedUserIds.size > 0 && (
                                            <button
                                                onClick={handleRevokeSelected}
                                                disabled={revoking}
                                                className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline disabled:opacity-50"
                                            >
                                                {revoking ? 'Revoking...' : `Revoke ${selectedUserIds.size} selected`}
                                            </button>
                                        )}
                                    </div>

                                    {accessLoading ? (
                                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
                                    ) : accessList.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                                            No users have access to this playlist yet.
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[40vh] overflow-y-auto">
                                            {accessList.map(access => (
                                                <div key={access.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUserIds.has(access.userId)}
                                                        onChange={() => toggleUser(access.userId)}
                                                        className="rounded border-gray-300 dark:border-slate-600"
                                                    />
                                                    <div className="h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-medium flex-shrink-0">
                                                        {access.userName?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                            {access.userName}
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                            {access.userEmail}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                                        {access.grantedAt?.toDate ? access.grantedAt.toDate().toLocaleDateString() : '—'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
