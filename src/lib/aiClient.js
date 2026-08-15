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
// current filtered submission set. Manual-trigger only: call this from a
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

// Turns pasted, unstructured text (a menu copied from a PDF, a price list,
// whatever) into a product list for ProductManager's "Use AI" import - the
// caller is expected to show these for review/editing before adding them,
// not commit them straight to the catalogue the way the .xlsx import does.
export async function extractProductsFromText(text) {
  const { data, error } = await supabase.functions.invoke('extract-products-ai', { body: { text } })
  if (error) await throwFunctionError(error)
  if (data?.error) throw new Error(data.error)
  return data.products
}

// Turns a pasted order message into cart items + field answers for
// PublicForm.jsx's "Fill from Text" button - products/fields describe the
// current form's own catalogue and question list so the model only ever
// returns ids that actually exist on it. `rules` is the shop owner's own
// free-text extraction guidance (settings.aiFillRules, set on FormSettings)
// - optional extra instructions layered on top of the fixed prompt, never a
// substitute for it. Caller shows these for review before applying them,
// same "never commit straight from AI" rule as extractProductsFromText above.
export async function extractOrderFromText(text, products, fields, rules) {
  const { data, error } = await supabase.functions.invoke('extract-order-ai', { body: { text, products, fields, rules } })
  if (error) await throwFunctionError(error)
  if (data?.error) throw new Error(data.error)
  return data
}
