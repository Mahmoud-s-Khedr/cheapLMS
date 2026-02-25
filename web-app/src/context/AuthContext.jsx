import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../lib/firebase'
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { messaging } from '../lib/firebase'
import { getToken } from 'firebase/messaging'
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role)
          } else {
            setUserRole('student')
          }

          // Try to set up notifications
          try {
            const msg = await messaging();
            if (msg) {
              const permission = await Notification.requestPermission();
              if (permission === 'granted') {
                const token = await getToken(msg, {
                  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
                });
                if (token) {
                  await updateDoc(doc(db, 'users', currentUser.uid), {
                    fcmTokens: arrayUnion(token)
                  });
                }
              }
            }
          } catch (notifErr) {
            console.error('Failed to set up notifications:', notifErr);
          }

        } catch (err) {
          console.error('Error fetching user role:', err)
          setUserRole('student')
        }
      } else {
        setUserRole(null)
      }
      setUser(currentUser)
      setIsLoading(false)
    })

    return unsubscribe
  }, [])

  const login = async () => {
    try {
      setError(null)
      const provider = new GoogleAuthProvider()
      // Force account selection every time
      provider.setCustomParameters({
        prompt: 'select_account',
      })
      const result = await signInWithPopup(auth, provider)
      return result.user
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const logout = async () => {
    try {
      setError(null)
      await signOut(auth)
      setUser(null)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const value = {
    user,
    userRole,
    isAdmin: userRole === 'admin',
    isLoading,
    error,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
