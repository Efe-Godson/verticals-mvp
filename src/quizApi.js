// Place at: src/quizApi.js
// Thin wrapper around every quiz-* edge function call. Mirrors
// AdminStaff.jsx's invokeManageStaff/functionErrorMessage pair (retry once
// after a session refresh on failure, surface the real error.body message
// instead of supabase-js's generic "non-2xx status code" string) but
// generalized to any function name since Quiz calls ten different ones.
import { supabase } from './supabaseClient'

export async function functionErrorMessage(invokeError, data) {
  if (data?.error) return data.error
  if (invokeError?.context?.json) {
    try {
      const body = await invokeError.context.json()
      if (body?.error) return body.error
    } catch { /* body wasn't JSON, fall through to the generic message */ }
  }
  return invokeError?.message || 'Unknown error'
}

// Admin-only quiz functions (create-quiz-room, generate-quiz-questions, etc.)
// need a fresh JWT the same way manage-staff does - a tab left idle can hold
// a stale access token that these functions reject even though the rest of
// the app still shows the user as signed in.
export async function invokeQuiz(name, body) {
  let result = await supabase.functions.invoke(name, { body })
  if (result.error) {
    await supabase.auth.refreshSession()
    result = await supabase.functions.invoke(name, { body })
  }
  if (result.error) {
    throw new Error(await functionErrorMessage(result.error, result.data))
  }
  return result.data
}
