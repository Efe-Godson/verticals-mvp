import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { emailConfigured, sendTransactionalEmail } from '../_shared/transactionalEmail.ts'
import { hashTransferToken, transferEmail } from '../_shared/transferEmail.ts'

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: auth, error: authError } = await client.auth.getUser(jwt)
    if (authError || !auth.user?.email_confirmed_at) return jsonResponse({ error: 'Sign in with a verified email account.' }, 401)
    const body = await req.json()
    const { action } = body
    if (!['request','status','cancel','review','accept','decline'].includes(action)) return jsonResponse({ error: 'Unknown action' }, 400)
    const limited = await enforceRateLimit(client, `workflow-transfer:${auth.user.id}:${action === 'request' ? 'email' : 'actions'}`,
      action === 'request' ? { max: 5, windowSeconds: 3600 } : { max: 60, windowSeconds: 60 }, { function: 'manage-workflow-transfer', action })
    if (limited) return limited
    async function rpc(params: Record<string, unknown>) {
      const { data, error } = await client.rpc('manage_workflow_transfer', { p_actor: auth.user.id, ...params })
      if (error) throw new Error(error.code === '23505' ? 'An invitation is already pending. Cancel it before sending another.' : error.message)
      return data
    }
    const siteUrl = (Deno.env.get('APP_SITE_URL') || 'https://verticalsapp.com').replace(/\/$/, '')
    if (!siteUrl.startsWith('https://')) throw new Error('A secure application URL is required.')
    if (action === 'request') {
      if (!emailConfigured()) return jsonResponse({ error: 'Transfer email delivery has not been configured yet.' }, 503)
      if (typeof body.template_slug !== 'string' || typeof body.email !== 'string') return jsonResponse({ error: 'Workflow and recipient email are required.' }, 400)
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
      const transfer = await rpc({ p_action: 'request', p_slug: body.template_slug, p_email: body.email, p_hash: await hashTransferToken(token) })
      const link = `${siteUrl}/workflow-transfer/${transfer.id}#token=${token}`
      const message = `${transfer.owner_email} has offered to transfer ownership of "${transfer.display_name}" and all its locations to you. Sign in with ${transfer.recipient_email} to review and accept. Nothing changes until you accept. This invitation expires in 7 days.`
      try {
        await sendTransactionalEmail(transfer.recipient_email, 'Review a Verticals workflow ownership transfer', transferEmail({ title: 'Workflow ownership transfer', message, link }), `${message}\n\n${link}`, `${transfer.id}-invite`)
      } catch (error) {
        await rpc({ p_action: 'email_failed', p_id: transfer.id })
        throw error
      }
      const pending = await rpc({ p_action: 'sent', p_id: transfer.id })
      return jsonResponse({ transfer: pending })
    }
    if (action === 'status') return jsonResponse({ transfer: await rpc({ p_action: 'status', p_slug: body.template_slug }) })
    if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.id)) return jsonResponse({ error: 'Invalid invitation.' }, 400)
    if (action === 'cancel') return jsonResponse({ transfer: await rpc({ p_action: 'cancel', p_id: body.id }) })
    if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return jsonResponse({ error: 'Invalid invitation link.' }, 400)
    const args = { p_id: body.id, p_hash: await hashTransferToken(body.token) }
    const before = await rpc({ ...args, p_action: 'review' })
    const transfer = action === 'review' ? before : await rpc({ ...args, p_action: action })
    let notificationFailed = false
    if (action === 'accept' && before.status !== 'accepted') {
      const message = `Ownership of "${transfer.display_name}" has transferred from ${transfer.owner_email} to ${transfer.recipient_email}. Existing records and other collaborators remain in place. The previous owner no longer has access. Google Sheets must be reconnected by the new owner.`
      const notifications = await Promise.allSettled([transfer.owner_email, transfer.recipient_email].map((email, index) =>
        sendTransactionalEmail(email, 'Workflow ownership transfer completed', transferEmail({ title: 'Transfer completed', message, link: siteUrl, label: 'Open Verticals' }), message, `${transfer.id}-accepted-${index}`)))
      notificationFailed = notifications.some(result => result.status === 'rejected')
    }
    return jsonResponse({ transfer, notificationFailed })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unable to process the transfer.' }, 400)
  }
})
