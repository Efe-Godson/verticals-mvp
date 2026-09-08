// Place at: supabase/functions/list-alerts/index.ts
// Deploy: supabase functions deploy list-alerts
// Admin-only (verify_jwt = true, and re-checked here since alert_events has
// no RLS policies at all - only the service role, i.e. this function, can
// read it). Backs src/AlertsPage.jsx (/lab/alerts).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'
import { callerId } from '../_shared/rateLimit.ts'

// Same admin account src/adminAccount.js's TEMPLATE_ADMIN_USER_ID names -
// kept as a literal here rather than importing the frontend module, since
// edge functions and the Vite app aren't part of the same build.
const ADMIN_USER_ID = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe'

// Concurrent-session alerts aren't written as they happen (unlike rate_limit
// ones, inserted inline by enforceRateLimit) - there's no single "this just
// became concurrent" event, only the standing fact of it. So this page's own
// load checks list_concurrent_sessions() and records anything new, deduped
// against the last hour so an ongoing situation doesn't spawn a fresh row
// every time an admin opens the page.
async function recordConcurrentSessionAlerts(supabase: any) {
  const { data: findings, error } = await supabase.rpc('list_concurrent_sessions', { p_window_hours: 24 })
  if (error) { console.error('list_concurrent_sessions failed:', error); return }
  if (!findings?.length) return

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  for (const finding of findings) {
    const { data: existing } = await supabase
      .from('alert_events')
      .select('id')
      .eq('type', 'concurrent_sessions')
      .eq('detail->>user_id', finding.user_id)
      .gte('created_at', since)
      .limit(1)
    if (existing?.length) continue

    await supabase.from('alert_events').insert([{
      type: 'concurrent_sessions',
      detail: { user_id: finding.user_id, email: finding.email, sessions: finding.sessions },
    }])
  }
}

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const uid = await callerId(req, supabase)
    if (uid !== ADMIN_USER_ID) return jsonResponse({ error: 'Not authorized' }, 403)

    await recordConcurrentSessionAlerts(supabase)

    const { data, error } = await supabase
      .from('alert_events')
      .select('id, type, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error

    return jsonResponse({ alerts: data || [] })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
