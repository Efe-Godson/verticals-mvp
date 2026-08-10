import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// These are already supabase-js's defaults - made explicit so "stay signed
// in until you log out" doesn't silently regress if that ever changes.
// A short/forced re-login despite this is a project-level Auth session
// setting (Supabase dashboard > Authentication > Sessions), not a client
// config issue.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
})