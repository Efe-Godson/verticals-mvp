import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { syncThemeColorFromAccount } from './theme'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // Staff accounts (created from a form's Admin page) are scoped to exactly
  // one form. null = not a staff account (the owner, or no session).
  // undefined = still checking.
  const [staffFormId, setStaffFormId] = useState(undefined)

  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      try {
        // supabase-js v2 auto-detects auth tokens/codes in the URL (detectSessionInUrl
        // defaults to true) during client init, so a plain getSession() is enough here.
        const { data } = await supabase.auth.getSession()

        if (!mounted) return

        setSession(data?.session ?? null)
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

  useEffect(() => {
    let mounted = true
    if (!session) {
      setStaffFormId(null)
      return
    }
    setStaffFormId(undefined)
    supabase
      .from('form_staff').select('form_id').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (mounted) setStaffFormId(data?.form_id ?? null)
      })
    return () => { mounted = false }
  }, [session?.user?.id])

  // The cached (localStorage) color painted at boot may be stale or just
  // the default - once there's a real session, pull the account's actual
  // theme color (RLS resolves this to the owner's own row, or their
  // employer's row for a staff login) so it's consistent across devices.
  useEffect(() => {
    if (!session) return
    syncThemeColorFromAccount(supabase)
  }, [session?.user?.id])

  // Keeps form_staff.last_seen_at fresh while a staff session is open, so
  // the owner's Admin page can show who's actually active right now versus
  // just having a login (see AdminStaff.jsx). Pings immediately, then every
  // 60s - stops the moment staffFormId goes away (sign out, tab close).
  useEffect(() => {
    if (!staffFormId) return
    function ping() {
      supabase.functions.invoke('manage-staff', { body: { action: 'heartbeat', form_id: staffFormId } })
    }
    ping()
    const interval = setInterval(ping, 60000)
    return () => clearInterval(interval)
  }, [staffFormId])

  return (
    <AuthContext.Provider value={{ session, loading, staffFormId }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}