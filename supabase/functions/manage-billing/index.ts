// Place at: supabase/functions/manage-billing/index.ts
// Deploy: supabase functions deploy manage-billing
// Manual plan activation only - there's no live payment provider yet (see
// the approved Pricing & Usage plan). Runs with the service-role key since
// activate_plan() is a security definer RPC not exposed to authenticated
// directly (its whole point is that a client can never set its own price/
// entry_limit - it always re-reads plan_catalogue server-side). Reading
// the current subscription/usage status doesn't need this function at all
// - src/BillingPage.jsx reads those tables directly, since RLS already
// scopes them to the caller's own owner_id.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

const VALID_PLANS = ['starter', 'business', 'growth', 'scale']
const VALID_INTERVALS = ['monthly', 'quarterly', 'half_year', 'yearly']

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: auth, error: authError } = await client.auth.getUser(jwt)
    if (authError || !auth.user) return jsonResponse({ error: 'Sign in to manage billing.' }, 401)

    const body = await req.json()
    if (body.action !== 'activate') return jsonResponse({ error: 'Unknown action' }, 400)

    const limited = await enforceRateLimit(client, `manage-billing:${auth.user.id}`,
      { max: 20, windowSeconds: 3600 }, { function: 'manage-billing', action: 'activate' })
    if (limited) return limited

    if (!VALID_PLANS.includes(body.plan)) return jsonResponse({ error: 'Unknown plan. Use Contact Sales for Enterprise.' }, 400)
    if (!VALID_INTERVALS.includes(body.billing_interval)) return jsonResponse({ error: 'Unknown billing interval' }, 400)

    const { data, error } = await client.rpc('activate_plan', {
      p_actor: auth.user.id, p_plan: body.plan, p_billing_interval: body.billing_interval,
    })
    if (error) throw new Error(error.message)
    return jsonResponse({ subscription: data })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Could not update your plan.' }, 400)
  }
})
