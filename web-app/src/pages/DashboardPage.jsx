import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import Navigation from '../components/Navigation'
import PlaylistCard from '../components/PlaylistCard'
import VideoList from '../components/VideoList'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, isAdmin, logout } = useAuth()
  const [playlists, setPlaylists] = useState([])
  const [videos, setVideos] = useState([])
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [showVideoList, setShowVideoList] = useState(false)
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true)
  const [isLoadingVideos, setIsLoadingVideos] = useState(false)
  const [error, setError] = useState(null)

  // Load user's playlists on mount
  useEffect(() => {
    const loadPlaylists = async () => {
      if (!user?.uid) return

      try {
        setIsLoadingPlaylists(true)
        setError(null)
        let playlistsData = []

        if (isAdmin) {
          // Admins see all playlists
          const allPlaylistsDocs = await getDocs(collection(db, 'playlists'))
          playlistsData = allPlaylistsDocs.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        } else {
          // Query playlistAccess for current user
          const accessQuery = query(
            collection(db, 'playlistAccess'),
            where('userId', '==', user.uid)
          )
          const accessDocs = await getDocs(accessQuery)
          const playlistIds = accessDocs.docs.map((doc) => doc.data().playlistId)

          if (playlistIds.length === 0) {
            setPlaylists([])
            setIsLoadingPlaylists(false)
            return
          }

          // Load playlist documents
          for (const playlistId of playlistIds) {
            try {
              const playlistQuery = query(
                collection(db, 'playlists'),
                where('__name__', '==', playlistId)
              )
              const playlistDocs = await getDocs(playlistQuery)
              playlistDocs.forEach((doc) => {
                playlistsData.push({
                  id: doc.id,
                  ...doc.data(),
                })
              })
            } catch (err) {
              console.error(`Error loading playlist ${playlistId}:`, err)
            }
          }
        }

        setPlaylists(playlistsData)
      } catch (err) {
        setError('Failed to load playlists. Please try again.')
        console.error('Error loading playlists:', err)
      } finally {
        setIsLoadingPlaylists(false)
      }
    }

    loadPlaylists()
  }, [user?.uid, isAdmin])

  // Load videos for selected playlist
  const handlePlaylistClick = async (playlist) => {
    setSelectedPlaylist(playlist)
    setShowVideoList(true)

    try {
      setIsLoadingVideos(true)

      // 1. Fetch video IDs from playlist subcollection
      const itemsQuery = query(collection(db, 'playlists', playlist.id, 'items'))
      const itemsSnapshot = await getDocs(itemsQuery)

      if (itemsSnapshot.empty) {
        setVideos([])
        setIsLoadingVideos(false)
        return
      }

      // 2. Fetch actual video documents
      const videoPromises = itemsSnapshot.docs.map(async (itemDoc) => {
        const itemData = itemDoc.data()
        const videoDoc = await getDoc(doc(db, 'videos', itemDoc.id)) // itemId is videoId
        if (videoDoc.exists()) {
          return { id: videoDoc.id, ...videoDoc.data(), ...itemData }
        }
        return null
      })

      const videosData = (await Promise.all(videoPromises))
        .filter(v => v !== null)
        .sort((a, b) => (a.position || 0) - (b.position || 0)) // Fallback sort if not sorted in query

      setVideos(videosData)
    } catch (err) {
      setError('Failed to load videos. Please try again.')
      console.error('Error loading videos:', err)
    } finally {
      setIsLoadingVideos(false)
    }
  }

  const handleVideoSelect = (video) => {
    // Navigate to video player
    navigate(`/player/${video.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onLogout={logout} />

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.displayName?.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-600 mt-2">
            {playlists.length === 0
              ? "You don't have access to any courses yet. Ask your admin for access."
              : `You have access to ${playlists.length} course${playlists.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Playlists Grid */}
        {isLoadingPlaylists ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              <p className="mt-4 text-gray-600">Loading courses...</p>
            </div>
          </div>
        ) : playlists.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C6.5 6.253 2 10.771 2 16.5S6.5 26.747 12 26.747s10-4.518 10-10.247S17.5 6.253 12 6.253z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">No courses available</h3>
            <p className="text-gray-600 mt-2">
              Contact your administrator to get access to courses.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onClick={() => handlePlaylistClick(playlist)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Video List Modal */}
      {showVideoList && selectedPlaylist && (
        <VideoList
          videos={videos}
          selectedPlaylist={selectedPlaylist}
          onVideoSelect={handleVideoSelect}
          isLoading={isLoadingVideos}
          onBack={() => {
            setShowVideoList(false)
            setSelectedPlaylist(null)
            setVideos([])
          }}
        />
      )}
    </div>
  )
}
