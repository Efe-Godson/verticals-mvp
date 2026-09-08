// Place at: supabase/functions/log-sign-in/index.ts
// Deploy: supabase functions deploy log-sign-in
// Called once by src/AuthContext.jsx on every SIGNED_IN event (fire-and-
// forget - never blocks the login UX). Feeds list_concurrent_sessions() (see
// the sign_in_events migration), which src/AlertsPage.jsx's backing function
// (list-alerts) checks for the "same account signed in from multiple places"
// alert.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'
import { clientIp, callerId, enforceRateLimit } from '../_shared/rateLimit.ts'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const uid = await callerId(req, supabase)
    if (!uid) return jsonResponse({ error: 'Invalid or expired session' }, 401)

    // Generous but not unbounded - guards against a buggy client re-firing
    // this in a loop, not against normal use (one call per real sign-in).
    const limited = await enforceRateLimit(
      supabase, `log-sign-in:${uid}`,
      { max: 20, windowSeconds: 60 },
      { function: 'log-sign-in', user_id: uid },
    )
    if (limited) return limited

    const { error } = await supabase.from('sign_in_events').insert([{
      user_id: uid,
      ip: clientIp(req),
      user_agent: req.headers.get('user-agent'),
    }])
    if (error) throw error

    return jsonResponse({ ok: true })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
