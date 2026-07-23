import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      try {
        const [sessionResult, callbackResult] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getSessionFromUrl({ storeSession: true })
        ])

        if (!mounted) return

        const activeSession = callbackResult?.data?.session ?? sessionResult?.data?.session ?? null
        setSession(activeSession)
      } catch (error) {
        console.error('Auth initialization failed', error)
        if (mounted) {
          setSession(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}