import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { useVideoToken } from '../hooks/useVideoToken'
import VideoPlayer from '../components/VideoPlayer'
import Navigation from '../components/Navigation'

export default function PlayerPage() {
  const { videoId } = useParams()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [video, setVideo] = useState(null)
  const [isLoadingVideo, setIsLoadingVideo] = useState(true)
  const [error, setError] = useState(null)
  const { token, isLoading: isLoadingToken, error: tokenError } = useVideoToken(videoId)

  // Load video metadata
  useEffect(() => {
    const loadVideo = async () => {
      if (!videoId) {
        setError('Video not found')
        setIsLoadingVideo(false)
        return
      }

      try {
        const videoDoc = await getDoc(doc(db, 'videos', videoId))
        if (videoDoc.exists()) {
          setVideo({
            id: videoDoc.id,
            ...videoDoc.data(),
          })
        } else {
          setError('Video not found')
        }
      } catch (err) {
        setError('Failed to load video')
        console.error('Error loading video:', err)
      } finally {
        setIsLoadingVideo(false)
      }
    }

    loadVideo()
  }, [videoId])

  if (isLoadingVideo || isLoadingToken) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation onLogout={logout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              <p className="mt-4 text-gray-600">Loading video...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onLogout={logout} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-6 flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </button>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {tokenError && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-medium">{tokenError}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-3 inline-block px-4 py-2 bg-yellow-600 text-white rounded font-medium hover:bg-yellow-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}

        {/* Video Content */}
        {video && token && (
          <div className="space-y-6">
            {/* Video Player */}
            <VideoPlayer
              videoPath={video.r2Path}
              token={token}
              videoTitle={video.title}
            />

            {/* Video Info */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {video.title}
              </h1>
              {video.description && (
                <p className="text-gray-600 mb-4">{video.description}</p>
              )}

              {/* Additional Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                {video.durationSeconds && (
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Duration</p>
                    <p className="text-gray-900 font-semibold">
                      {Math.floor(video.durationSeconds / 3600)}h{' '}
                      {Math.floor((video.durationSeconds % 3600) / 60)}m
                    </p>
                  </div>
                )}
                {video.uploadedAt && (
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Uploaded</p>
                    <p className="text-gray-900 font-semibold">
                      {new Date(video.uploadedAt.toDate()).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {video.qualities && (
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Qualities</p>
                    <p className="text-gray-900 font-semibold">
                      {Array.isArray(video.qualities)
                        ? video.qualities.join(', ')
                        : 'Multiple'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
