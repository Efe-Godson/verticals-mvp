// Place at: src/lib/aiClient.js
import { supabase } from '../supabaseClient'

async function throwFunctionError(error) {
  // Supabase wraps non-2xx function replies in a generic FunctionsHttpError.
  // Preserve the function's JSON error message so the UI can tell the user
  // what actually needs attention (for example, an API-key or quota issue).
  const response = error?.context
  if (response instanceof Response) {
    try {
      const payload = await response.clone().json()
      if (payload?.error) throw new Error(payload.error)
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message !== 'Unexpected end of JSON input') {
        throw parseError
      }
    }
  }
  throw error
}

// Generates (or fetches the cached) full structured analysis for a form's
// current filtered submission set. Manual-trigger only — call this from a
// button click, not on mount, to keep free-tier usage predictable.
export async function fetchAIAnalysis(formId, dateRangeLabel, submissionIds, languageStyle = 'plain') {
  const { data, error } = await supabase.functions.invoke('ai-analyst', {
    body: { form_id: formId, date_range_label: dateRangeLabel, submission_ids: submissionIds, language_style: languageStyle },
  })
  if (error) await throwFunctionError(error)
  if (data?.error) throw new Error(data.error)
  return data
}

// Natural-language Q&A over the same aggregated stats. Always live (no
// caching), since each question is different.
export async function askAIQuestion(formId, question, submissionIds, languageStyle = 'plain') {
  const { data, error } = await supabase.functions.invoke('ai-ask', {
    body: { form_id: formId, question, submission_ids: submissionIds, language_style: languageStyle },
  })
  if (error) await throwFunctionError(error)
  if (data?.error) throw new Error(data.error)
  return data.answer
}
