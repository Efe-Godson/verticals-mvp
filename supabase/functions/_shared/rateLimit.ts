// Place at: supabase/functions/_shared/rateLimit.ts
// Shared by every edge function - see supabase/migrations/*_rate_limits.sql
// for the table + RPC this calls, and *_alert_events.sql for the alert log.
import { jsonResponse } from './stats.ts'

// The browser SDK never sends a real client IP (edge functions run behind a
// proxy) - x-forwarded-for is the standard header the edge network sets,
// cf-connecting-ip a fallback for anything fronted by Cloudflare instead.
// Same logic submit-form/index.ts already used for IP-stamping submissions;
// centralized here now that more than one function needs it.
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('cf-connecting-ip') || null
}

// The authenticated caller's user id, or null if there's no/invalid JWT -
// same Authorization-header-> supabase.auth.getUser() pattern as
// _shared/stats.ts's requireFormOwner, generalized for functions that just
// need "who is this" rather than a specific ownership check.
export async function callerId(req: Request, supabase: any): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  const { data, error } = await supabase.auth.getUser(jwt)
  if (error || !data?.user) return null
  return data.user.id
}

// Checks + increments the shared counter for `key` inside a fixed window.
// Fails OPEN: if the RPC itself errors (DB hiccup, migration not applied
// yet), the request is allowed through rather than a broken limiter taking
// the whole app down.
export async function checkRateLimit(
  supabase: any,
  key: string,
  opts: { max: number; windowSeconds: number },
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_max: opts.max,
    p_window_seconds: opts.windowSeconds,
  })
  if (error) {
    console.error('rate limit check failed, failing open:', error)
    return true
  }
  return data === true
}

// Records a rate-limit trip to the Lab's Alerts feed (see AlertsPage.jsx).
// Best-effort - a failure here should never turn an already-blocked request
// into a 500, so this deliberately swallows its own errors.
export async function recordRateLimitAlert(
  supabase: any,
  detail: { function: string; key: string; ip?: string | null; [extra: string]: unknown },
): Promise<void> {
  try {
    await supabase.from('alert_events').insert([{ type: 'rate_limit', detail }])
  } catch (err) {
    console.error('could not record rate_limit alert:', err)
  }
}

// One-liner for the common case: check the limit, and if it's tripped, log
// the alert and hand back the 429 response to return immediately.
export async function enforceRateLimit(
  supabase: any,
  key: string,
  opts: { max: number; windowSeconds: number },
  alertDetail: { function: string; ip?: string | null; [extra: string]: unknown },
): Promise<Response | null> {
  const allowed = await checkRateLimit(supabase, key, opts)
  if (allowed) return null
  await recordRateLimitAlert(supabase, { ...alertDetail, key })
  return jsonResponse({ error: 'Too many requests. Please slow down and try again shortly.' }, 429)
}
