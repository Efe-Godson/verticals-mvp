// Place at: supabase/functions/list-email-events/index.ts
// Deploy: supabase functions deploy list-email-events
// Admin-only (verify_jwt = true, re-checked here since email_events has no
// RLS policies at all - only the service role, i.e. this function, can read
// it). Backs src/EmailMonitorPage.jsx (/lab/email-monitor).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'
import { callerId } from '../_shared/rateLimit.ts'

const ADMIN_USER_ID = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe'

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

    const { data, error } = await supabase
      .from('email_events')
      .select('id, type, email, account_existed, ip, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error

    const events = data || []
    const now = Date.now()
    const countSince = (ms: number) => events.filter((e: any) => now - new Date(e.created_at).getTime() < ms).length

    return jsonResponse({
      events,
      password_reset_requests: {
        last_hour: countSince(60 * 60 * 1000),
        last_day: countSince(24 * 60 * 60 * 1000),
      },
    })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
