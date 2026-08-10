// Place at: supabase/functions/manage-staff/index.ts
// Deploy: supabase functions deploy manage-staff
// Lets a form owner create/reset/remove staff logins scoped to one form.
// Runs with the service-role key because creating a confirmed auth user (or
// resetting another user's password, or deleting a user) requires the Admin
// API - the anon key can't do any of that from the client. requireFormOwner
// re-checks ownership on every call since this bypasses RLS entirely.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders, requireFormOwner } from '../_shared/stats.ts'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action, form_id } = body
    if (!form_id) return jsonResponse({ error: 'form_id is required' }, 400)

    // Staff call this themselves (see AuthContext.jsx's heartbeat interval)
    // to keep their own last_seen_at fresh - not an owner action, so it's
    // handled before requireFormOwner, which would reject a staff caller.
    if (action === 'heartbeat') {
      const authHeader = req.headers.get('Authorization') || ''
      const jwt = authHeader.replace(/^Bearer\s+/i, '')
      if (!jwt) return jsonResponse({ error: 'Missing Authorization header' }, 401)
      const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
      if (userError || !userData?.user) return jsonResponse({ error: 'Invalid or expired session' }, 401)

      const { error } = await supabase
        .from('form_staff')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('form_id', form_id).eq('user_id', userData.user.id)
      if (error) throw error
      return jsonResponse({ ok: true })
    }

    const { error: ownerError, status, form: ownedForm } = await requireFormOwner(req, supabase, form_id)
    if (ownerError) return jsonResponse({ error: ownerError }, status)
    const ownerId = ownedForm.user_id

    if (action === 'list') {
      const { data, error } = await supabase
        .from('form_staff').select('id, email, created_at, last_seen_at').eq('form_id', form_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return jsonResponse({ staff: data })
    }

    if (action === 'create') {
      const { email, password } = body
      if (!email || !password) return jsonResponse({ error: 'email and password are required' }, 400)
      if (password.length < 6) return jsonResponse({ error: 'Password must be at least 6 characters' }, 400)

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (createError) return jsonResponse({ error: createError.message }, 400)

      const { data: staffRow, error: insertError } = await supabase
        .from('form_staff')
        .insert([{ form_id, user_id: created.user.id, email, created_by: ownerId }])
        .select('id, email, created_at').single()

      if (insertError) {
        // Roll back the auth user so a failed assignment doesn't leave an
        // orphaned account nobody can see or manage.
        await supabase.auth.admin.deleteUser(created.user.id)
        return jsonResponse({ error: insertError.message }, 400)
      }

      return jsonResponse({ staff: staffRow })
    }

    if (action === 'reset_password') {
      const { staff_id, password } = body
      if (!staff_id || !password) return jsonResponse({ error: 'staff_id and password are required' }, 400)
      if (password.length < 6) return jsonResponse({ error: 'Password must be at least 6 characters' }, 400)

      const { data: staffRow, error: findError } = await supabase
        .from('form_staff').select('user_id').eq('id', staff_id).eq('form_id', form_id).single()
      if (findError || !staffRow) return jsonResponse({ error: 'Staff account not found' }, 404)

      const { error: updateError } = await supabase.auth.admin.updateUserById(staffRow.user_id, { password })
      if (updateError) return jsonResponse({ error: updateError.message }, 400)

      return jsonResponse({ ok: true })
    }

    if (action === 'delete') {
      const { staff_id } = body
      if (!staff_id) return jsonResponse({ error: 'staff_id is required' }, 400)

      const { data: staffRow, error: findError } = await supabase
        .from('form_staff').select('user_id').eq('id', staff_id).eq('form_id', form_id).single()
      if (findError || !staffRow) return jsonResponse({ error: 'Staff account not found' }, 404)

      await supabase.from('form_staff').delete().eq('id', staff_id)
      await supabase.auth.admin.deleteUser(staffRow.user_id)

      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
