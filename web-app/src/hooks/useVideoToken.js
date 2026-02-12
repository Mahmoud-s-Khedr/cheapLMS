import { useEffect, useState, useRef } from 'react'
import { auth, functions } from '../lib/firebase'
import { httpsCallable } from 'firebase/functions'

const TOKEN_REFRESH_BUFFER = 15 * 60 * 1000 // 15 minutes before expiry

export function useVideoToken(videoId) {
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const refreshTimeoutRef = useRef(null)

  const requestToken = async (forceRefresh = false) => {
    if (!videoId || !auth.currentUser) {
      setError('Not authenticated or video ID missing')
      setIsLoading(false)
      return null
    }

    try {
      setError(null)

      // Ensure we have a fresh ID token (though the Callable handles auth context, getting it explicitly ensures session is valid)
      await auth.currentUser.getIdToken(true)

      // Call Cloud Function using SDK (handles auth, region, and CORS automatically)
      const generateTokenFn = httpsCallable(functions, 'generateToken');
      const result = await generateTokenFn({ videoId });
      const data = result.data;

      setToken(data.token)
      setIsLoading(false)

      // Schedule refresh before expiry
      if (data.expiresAt) {
        const now = Date.now()
        const expiresAt = new Date(data.expiresAt).getTime()
        const timeUntilRefresh = expiresAt - now - TOKEN_REFRESH_BUFFER

        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
        }

        if (timeUntilRefresh > 0) {
          refreshTimeoutRef.current = setTimeout(() => {
            requestToken(true)
          }, timeUntilRefresh)
        }
      }

      return data.token
    } catch (err) {
      setError(err.message)
      setIsLoading(false)
      console.error('Token request error:', err)
      return null
    }
  }

  // Request token on mount or when videoId changes
  useEffect(() => {
    setIsLoading(true)
    requestToken()

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [videoId])

  return { token, isLoading, error, refreshToken: requestToken }
}
