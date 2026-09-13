// Place at: supabase/functions/manage-share/index.ts
// Deploy: supabase functions deploy manage-share
// Lets a workflow/location owner manage Google-Workspace-style collaborator
// shares (see supabase/migrations/20260913170000_collaborator_shares.sql).
// Runs with the service-role key because inviting a collaborator by email
// requires the Admin API (auth.admin.inviteUserByEmail) - same reason
// manage-staff needs it for auth.admin.createUser. requireScopeOwner
// re-checks ownership on every call since this bypasses RLS entirely; only
// the original owner can list/invite/update/remove shares - not even an
// admin collaborator can manage sharing themselves.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

async function requireScopeOwner(
  req: Request,
  supabase: any,
  scope: string,
  params: { template_slug?: string; form_id?: string },
) {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return { error: 'Missing Authorization header', status: 401 }

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData?.user) return { error: 'Invalid or expired session', status: 401 }
  const ownerId = userData.user.id
  const ownerEmail = userData.user.email

  if (scope === 'location') {
    if (!params.form_id) return { error: 'form_id is required', status: 400 }
    const { data: form, error: formError } = await supabase
      .from('forms').select('id, user_id').eq('id', params.form_id).single()
    // Same "not found" (not "forbidden") shape as manage-staff/_shared/stats.ts's
    // requireFormOwner - doesn't confirm to a stranger that a form_id exists
    // at all if they don't own it.
    if (formError || !form || form.user_id !== ownerId) return { error: 'Location not found', status: 404 }
    return { ownerId, ownerEmail }
  }

  if (scope === 'workflow') {
    if (!params.template_slug) return { error: 'template_slug is required', status: 400 }
    const { data: form, error: formError } = await supabase
      .from('forms').select('id')
      .eq('user_id', ownerId).eq('settings->>templateSlug', params.template_slug)
      .is('deleted_at', null).limit(1).maybeSingle()
    if (formError || !form) return { error: 'Workflow not found', status: 404 }
    return { ownerId, ownerEmail }
  }

  return { error: 'scope must be "workflow" or "location"', status: 400 }
}

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action, scope, template_slug, form_id } = body

    const { error: ownerError, status, ownerId, ownerEmail } =
      await requireScopeOwner(req, supabase, scope, { template_slug, form_id })
    if (ownerError) return jsonResponse({ error: ownerError }, status)

    const limited = await enforceRateLimit(
      supabase, `manage-share:${ownerId}`,
      { max: 60, windowSeconds: 60 },
      { function: 'manage-share', action, scope, template_slug, form_id },
    )
    if (limited) return limited

    if (action === 'list') {
      let query = supabase
        .from('collaborator_shares')
        .select('id, email, role, created_at')
        .eq('owner_id', ownerId)
        .eq('scope', scope)
        .order('created_at', { ascending: false })
      query = scope === 'workflow' ? query.eq('template_slug', template_slug) : query.eq('form_id', form_id)
      const { data, error } = await query
      if (error) throw error
      return jsonResponse({ shares: data })
    }

    if (action === 'invite') {
      const { email, role } = body
      if (!email?.trim() || !email.includes('@')) return jsonResponse({ error: 'A valid email is required' }, 400)
      if (!['admin', 'viewer'].includes(role)) return jsonResponse({ error: 'role must be "admin" or "viewer"' }, 400)
      const trimmedEmail = email.trim().toLowerCase()

      if (trimmedEmail === ownerEmail?.toLowerCase()) {
        return jsonResponse({ error: 'You already own this - invite someone else.' }, 400)
      }

      const { data: shareRow, error: upsertError } = await supabase
        .from('collaborator_shares')
        .upsert([{
          owner_id: ownerId,
          scope,
          template_slug: scope === 'workflow' ? template_slug : null,
          form_id: scope === 'location' ? form_id : null,
          email: trimmedEmail,
          role,
          invited_by: ownerId,
          owner_email: ownerEmail,
        }], { onConflict: scope === 'workflow' ? 'owner_id,template_slug,email' : 'form_id,email' })
        .select('id, email, role, created_at')
        .single()
      if (upsertError) return jsonResponse({ error: upsertError.message }, 400)

      // Best-effort: if this email already belongs to a Supabase Auth user,
      // inviteUserByEmail errors ("already registered") - the share row
      // above already grants access regardless, so that's not a failure
      // here, just a signal to skip sending an email nobody needs. Any
      // OTHER invite error (mail provider outage, bad redirect config, etc.)
      // still shouldn't block the share itself, but is worth surfacing to
      // the owner rather than silently swallowing - hence emailSent below
      // instead of always returning ok.
      const origin = req.headers.get('origin')
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(trimmedEmail, {
        redirectTo: origin ? `${origin}/reset-password` : undefined,
      })
      const emailSent = !inviteError
      if (inviteError) console.error('inviteUserByEmail failed (share still created):', inviteError.message)

      return jsonResponse({ share: shareRow, emailSent })
    }

    if (action === 'update_role') {
      const { share_id, role } = body
      if (!share_id) return jsonResponse({ error: 'share_id is required' }, 400)
      if (!['admin', 'viewer'].includes(role)) return jsonResponse({ error: 'role must be "admin" or "viewer"' }, 400)

      const { data, error } = await supabase
        .from('collaborator_shares')
        .update({ role })
        .eq('id', share_id).eq('owner_id', ownerId)
        .select('id, email, role, created_at').single()
      if (error || !data) return jsonResponse({ error: 'Share not found' }, 404)
      return jsonResponse({ share: data })
    }

    if (action === 'remove') {
      const { share_id } = body
      if (!share_id) return jsonResponse({ error: 'share_id is required' }, 400)

      const { error } = await supabase
        .from('collaborator_shares').delete().eq('id', share_id).eq('owner_id', ownerId)
      if (error) throw error
      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
