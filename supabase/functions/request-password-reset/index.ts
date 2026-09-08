// Place at: supabase/functions/request-password-reset/index.ts
// Deploy: supabase functions deploy request-password-reset
// Public, unauthenticated by design (verify_jwt = false) - src/Login.jsx's
// forgot-password submit calls this instead of
// supabase.auth.resetPasswordForEmail directly, so the response can be made
// enumeration-safe on purpose rather than relying on however Supabase Auth
// happens to behave: this ALWAYS returns { ok: true }, identical shape and
// status, whether or not the email matches an account, and regardless of
// whether the reset email itself sent successfully. Also the one place this
// flow can be rate-limited and logged (see email_events / Email Monitor) -
// a client-only supabase.auth call gives us neither.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'
import { clientIp, enforceRateLimit } from '../_shared/rateLimit.ts'

const GENERIC_OK = { ok: true }

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { email } = await req.json()
    if (!email?.trim()) return jsonResponse({ error: 'email is required' }, 400)
    const trimmedEmail = email.trim()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // A public link - rate-limited by IP, same as submit-form.
    const ip = clientIp(req)
    const limited = await enforceRateLimit(
      supabase, `request-password-reset:${ip ?? 'unknown'}`,
      { max: 5, windowSeconds: 3600 },
      { function: 'request-password-reset', ip },
    )
    // Even when rate-limited, respond with the same generic shape - a
    // different response here would itself be a signal an attacker could
    // use to distinguish "this IP is being throttled" from normal, which
    // isn't otherwise meaningful to leak either way.
    if (limited) return jsonResponse(GENERIC_OK)

    // Internal only - never returned to the caller.
    const { data: exists, error: existsError } = await supabase.rpc('email_exists', { p_email: trimmedEmail })
    if (existsError) console.error('email_exists check failed:', existsError)
    const accountExisted = exists === true

    if (accountExisted) {
      // The anon-key client is what actually triggers Supabase's own reset
      // email - same call the browser used to make directly, just proxied
      // through here now so it can be rate-limited and logged first.
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      )
      const { error: resetError } = await anonClient.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: req.headers.get('origin')
          ? `${req.headers.get('origin')}/reset-password`
          : undefined,
      })
      if (resetError) console.error('resetPasswordForEmail failed:', resetError.message)
    }

    try {
      await supabase.from('email_events').insert([{
        type: 'password_reset_request',
        email: trimmedEmail,
        account_existed: accountExisted,
        ip,
      }])
    } catch (err) {
      console.error('could not record email_event:', err)
    }

    return jsonResponse(GENERIC_OK)
  } catch (err) {
    // Even an unexpected failure shouldn't reveal anything - log server-side,
    // still answer generically.
    console.error('request-password-reset failed:', err)
    return jsonResponse(GENERIC_OK)
  }
})
