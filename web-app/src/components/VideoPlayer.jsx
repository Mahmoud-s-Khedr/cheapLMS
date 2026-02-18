import React, { useRef, useEffect, useState } from 'react'
import Hls from 'hls.js'

export default function VideoPlayer({ videoPath, token, videoTitle }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [availableQualities, setAvailableQualities] = useState([])
  const [selectedQuality, setSelectedQuality] = useState('auto')

  useEffect(() => {
    if (!videoPath || !token) return

    const video = videoRef.current
    if (!video) return

    // Construct video URL
    const workerUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL
    // Helper to ensure we point to the master playlist
    const fullPath = videoPath.endsWith('.m3u8') ? videoPath : `${videoPath}/master.m3u8`
    const videoUrl = `${workerUrl}/${fullPath}?token=${token}`

    try {
      setIsLoading(true)
      setError(null)

      // Check if browser supports HLS.js
      if (Hls.isSupported()) {
        let recoverMediaAttempts = 0;
        let recoverNetworkAttempts = 0;

        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,
          // Start playback faster — don't wait for huge buffers
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 30 * 1000 * 1000, // 30 MB
          backBufferLength: 30,
          // Let ABR pick the best starting quality for the connection
          startLevel: -1,
          // Don't load a higher resolution than the player element size
          capLevelToPlayerSize: true,
          // Generous timeouts for slow connections (20s segments need time)
          fragLoadingTimeOut: 30000,
          fragLoadingMaxRetry: 4,
          fragLoadingRetryDelay: 2000,
          manifestLoadingTimeOut: 15000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 15000,
          levelLoadingMaxRetry: 3,
          xhrSetup: function (xhr, url) {
            xhr.withCredentials = true
          },
        })

        // Handle manifest parsed (get available qualities)
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          const qualities = data.levels.map((level) => ({
            height: level.height,
            bitrate: level.bitrate,
            name:
              level.height >= 1080
                ? '1080p'
                : level.height >= 720
                  ? '720p'
                  : level.height >= 480
                    ? '480p'
                    : '360p',
          }))

          setAvailableQualities(qualities)
          setIsLoading(false)
        })

        // Handle errors with auto-recovery
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (recoverNetworkAttempts < 3) {
                  recoverNetworkAttempts++
                  console.warn(`Network error, attempting recovery (${recoverNetworkAttempts}/3)...`)
                  hls.startLoad()
                } else {
                  setError('Network error. Please check your connection and try again.')
                  setIsLoading(false)
                }
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                if (recoverMediaAttempts < 3) {
                  recoverMediaAttempts++
                  console.warn(`Media error, attempting recovery (${recoverMediaAttempts}/3)...`)
                  hls.recoverMediaError()
                } else {
                  setError('Error playing video. Please try refreshing.')
                  setIsLoading(false)
                }
                break
              default:
                setError('An error occurred while loading the video.')
                setIsLoading(false)
            }
          }
        })

        hls.attachMedia(video)
        hls.loadSource(videoUrl)
        hlsRef.current = hls

        return () => {
          hls.destroy()
        }
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari has native HLS support
        video.src = videoUrl
        setIsLoading(false)
      } else {
        setError('Your browser does not support HLS streaming.')
        setIsLoading(false)
      }
    } catch (err) {
      setError('Failed to initialize video player.')
      setIsLoading(false)
      console.error('Video player error:', err)
    }
  }, [videoPath, token])

  const handleQualityChange = (qualityIndex) => {
    if (hlsRef.current && qualityIndex !== undefined) {
      if (qualityIndex === -1) {
        hlsRef.current.currentLevel = -1 // Auto
        setSelectedQuality('auto')
      } else {
        hlsRef.current.currentLevel = qualityIndex
        const quality = availableQualities[qualityIndex]
        setSelectedQuality(quality?.name || 'auto')
      }
    }
  }

  return (
    <div className="bg-black rounded-lg overflow-hidden">
      {/* Video Container */}
      <div className="relative bg-black">
        <video
          ref={videoRef}
          controls
          className="w-full h-auto"
          playsInline
        />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75">
            <div className="text-center text-white">
              <p className="text-lg font-semibold">{error}</p>
              <p className="text-sm mt-2 text-gray-300">
                Try refreshing the page or contact support if the problem persists
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quality Selector (only show if HLS.js is being used) */}
      {availableQualities.length > 0 && !error && (
        <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
          <span className="text-white text-sm">Quality:</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleQualityChange(-1)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${selectedQuality === 'auto'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              Auto
            </button>
            {availableQualities.map((quality, idx) => (
              <button
                key={idx}
                onClick={() => handleQualityChange(idx)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${selectedQuality === quality.name
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                {quality.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Video Info */}
      {videoTitle && !isLoading && !error && (
        <div className="bg-gray-800 px-4 py-2">
          <p className="text-white text-sm">{videoTitle}</p>
        </div>
      )}
    </div>
  )
}
