// Place at: src/lib/submissionsClient.js
import { supabase } from '../supabaseClient'

async function throwFunctionError(error) {
  const response = error?.context
  if (response instanceof Response) {
    try {
      const payload = await response.clone().json()
      if (payload?.error) throw new Error(payload.error)
      // The platform gateway itself (rejecting before our function code
      // even runs) uses `message`, not `error`.
      if (payload?.message) throw new Error(payload.message)
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message !== 'Unexpected end of JSON input') {
        throw parseError
      }
    }
  }
  throw error
}

// Submits a public form response. Routed through the submit-form edge
// function (rather than inserting into `submissions` directly from the
// browser) so the form's published/paused/archived status is enforced
// server-side and the submitter's IP can be stamped, see submit-form's
// header comment for why.
export async function submitForm(formId, data) {
  const { data: result, error } = await supabase.functions.invoke('submit-form', {
    body: { form_id: formId, data },
  })
  if (error) await throwFunctionError(error)
  if (result?.error) throw new Error(result.error)
  return result
}

// Looks up a submission by its edit_token, an unguessable UUID handed back
// once at submit time, never listed anywhere public. That token is the
// access control, not a login.
export async function getSubmissionByToken(editToken) {
  const { data: result, error } = await supabase.functions.invoke('manage-submission', {
    body: { action: 'get', edit_token: editToken },
  })
  if (error) await throwFunctionError(error)
  if (result?.error) throw new Error(result.error)
  return result
}

export async function updateSubmissionByToken(editToken, data) {
  const { data: result, error } = await supabase.functions.invoke('manage-submission', {
    body: { action: 'update', edit_token: editToken, data },
  })
  if (error) await throwFunctionError(error)
  if (result?.error) throw new Error(result.error)
  return result
}
