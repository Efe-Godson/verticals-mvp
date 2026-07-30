// Place at: supabase/functions/submit-form/index.ts
// Deploy: supabase functions deploy submit-form
// Public, unauthenticated by design (verify_jwt = false in config.toml):
// this is what accepts form responses from anonymous respondents on
// PublicForm.jsx. Moving submission-insert here (instead of a direct
// supabase.from('submissions').insert() from the browser) buys two things
// the client-side path couldn't: the form's published/paused/archived status
// is enforced server-side (the client-side check in PublicForm.jsx is only
// ever a UX nicety), and we can stamp the submitter's real IP address as
// seen by the edge network, which a client can't reliably self-report.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'

function clientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('cf-connecting-ip') || null
}

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { form_id, data } = await req.json()
    if (!form_id || !data || typeof data !== 'object') {
      return jsonResponse({ error: 'form_id and data are required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: form, error: formError } = await supabase
      .from('forms').select('id, status').eq('id', form_id).single()
    if (formError || !form) return jsonResponse({ error: 'Form not found' }, 404)

    if (form.status === 'paused') {
      return jsonResponse({ error: 'This form is temporarily paused and is not accepting responses right now.' }, 403)
    }
    if (form.status === 'archived') {
      return jsonResponse({ error: 'This form has been archived and is no longer accepting responses.' }, 403)
    }
    if (form.status !== 'published') {
      return jsonResponse({ error: 'This form is not live yet.' }, 403)
    }

    const editToken = crypto.randomUUID()

    const { data: submission, error: insertError } = await supabase
      .from('submissions')
      .insert([{ form_id, data, ip_address: clientIp(req), edit_token: editToken }])
      .select('id, order_number, edit_token')
      .single()

    if (insertError) throw insertError

    return jsonResponse({
      id: submission.id,
      order_number: submission.order_number,
      edit_token: submission.edit_token,
    })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
