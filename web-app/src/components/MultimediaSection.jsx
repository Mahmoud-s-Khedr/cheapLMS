import React, { useEffect, useState } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

const WORKER_URL = import.meta.env.VITE_CLOUDFLARE_WORKER_URL

function getFileUrl(fileUrl) {
    // fileUrl is like "multimedia/{id}/{filename}" — serve via the worker
    if (!fileUrl) return ''
    return `${WORKER_URL}/${fileUrl}`
}

export default function MultimediaSection({ videoId }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [expandedImage, setExpandedImage] = useState(null)

    useEffect(() => {
        const load = async () => {
            if (!videoId) {
                setLoading(false)
                return
            }
            try {
                const q = query(
                    collection(db, 'multimedia'),
                    where('videoId', '==', videoId),
                    orderBy('createdAt', 'desc')
                )
                const snap = await getDocs(q)
                setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            } catch (err) {
                console.error('Error loading multimedia:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [videoId])

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm dark:border dark:border-slate-700">
                <div className="animate-pulse space-y-3">
                    <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded w-40" />
                    <div className="h-16 bg-gray-100 dark:bg-slate-700 rounded" />
                </div>
            </div>
        )
    }

    if (items.length === 0) return null

    const voicenotes = items.filter(i => i.type === 'voicenote')
    const images = items.filter(i => i.type === 'image')
    const pdfs = items.filter(i => i.type === 'pdf')

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm dark:border dark:border-slate-700 space-y-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Learning Materials
            </h2>

            {/* Voice Notes */}
            {voicenotes.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                        🎙️ Voice Notes
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {voicenotes.map(item => (
                            <div key={item.id} className="flex flex-col gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800/50 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.title}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{item.fileName}</p>
                                    </div>
                                    <a
                                        href={getFileUrl(item.fileUrl)}
                                        download={item.fileName}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-700 transition-colors shrink-0"
                                        title="Download Voice Note"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </a>
                                </div>
                                <audio
                                    controls
                                    crossOrigin="anonymous"
                                    className="w-full h-10"
                                    preload="metadata"
                                >
                                    <source src={getFileUrl(item.fileUrl)} type={item.mimeType || 'audio/mpeg'} />
                                    Your browser does not support audio playback.
                                </audio>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Images */}
            {images.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                        🖼️ Images
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {images.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setExpandedImage(item)}
                                className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:border-primary-300 transition-colors"
                            >
                                <img
                                    src={getFileUrl(item.fileUrl)}
                                    alt={item.title}
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    loading="lazy"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                    <p className="text-xs text-white font-medium truncate">{item.title}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* PDFs */}
            {pdfs.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                        📄 Documents
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pdfs.map(item => (
                            <div key={item.id} className="flex flex-col p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm hover:shadow-md transition-shadow group">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300">
                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                                        </svg>
                                    </div>
                                    <a
                                        href={getFileUrl(item.fileUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="Download Document"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </a>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2">{item.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={item.fileName}>{item.fileName}</p>
                                </div>
                                <a
                                    href={getFileUrl(item.fileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Open Document
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Image Lightbox */}
            {expandedImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setExpandedImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setExpandedImage(null)}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 text-3xl font-bold"
                        >
                            ×
                        </button>
                        <img
                            src={getFileUrl(expandedImage.fileUrl)}
                            alt={expandedImage.title}
                            crossOrigin="anonymous"
                            className="max-w-full max-h-[85vh] rounded-lg object-contain"
                        />
                        <p className="text-white text-center mt-3 font-medium">{expandedImage.title}</p>
                    </div>
                </div>
            )}
        </div>
    )
}
