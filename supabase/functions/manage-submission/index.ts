// Place at: supabase/functions/manage-submission/index.ts
// Deploy: supabase functions deploy manage-submission
// Public, unauthenticated by design (verify_jwt = false): lets a respondent
// who holds their own submission's edit_token (an unguessable UUID, handed
// back once at submit time and never listed anywhere public) fetch or update
// that one response, without needing an account. Looking a row up by
// edit_token instead of by id is the actual access control here: knowing a
// submission's database id is not enough to read or change it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const body = await req.json()
    const { action, edit_token } = body
    if (!edit_token) return jsonResponse({ error: 'edit_token is required' }, 400)

    if (action === 'get') {
      const { data: submission, error } = await supabase
        .from('submissions').select('id, form_id, data, order_number')
        .eq('edit_token', edit_token).single()
      if (error || !submission) return jsonResponse({ error: 'Submission not found' }, 404)

      const { data: form, error: formError } = await supabase
        .from('forms').select('*').eq('id', submission.form_id).single()
      if (formError || !form) return jsonResponse({ error: 'Form not found' }, 404)

      return jsonResponse({ submission, form })
    }

    if (action === 'update') {
      const { data } = body
      if (!data || typeof data !== 'object') return jsonResponse({ error: 'data is required' }, 400)

      const { data: existing, error: findError } = await supabase
        .from('submissions').select('id, data').eq('edit_token', edit_token).single()
      if (findError || !existing) return jsonResponse({ error: 'Submission not found' }, 404)

      // Merge rather than replace: the client only knows about the form's
      // *current* fields, so a plain overwrite would silently drop any key
      // that was on this submission but isn't on the form anymore (a field
      // removed since it was submitted, or _respondent_email if email
      // collection has since been turned off).
      const mergedData = { ...(existing.data || {}), ...data }

      const { error: updateError } = await supabase
        .from('submissions').update({ data: mergedData }).eq('id', existing.id)
      if (updateError) throw updateError

      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
