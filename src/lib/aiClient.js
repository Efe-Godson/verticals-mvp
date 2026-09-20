// Place at: src/lib/aiClient.js
import { supabase } from '../supabaseClient'
import { TEMPLATE_ADMIN_USER_ID } from '../adminAccount'

// Raw AI-provider errors (quota, API-key, upstream 503s) are only
// actionable by the person who can fix the underlying config, so only the
// admin account gets the original err.message. Everyone else - including
// anonymous PublicForm visitors - gets a short, retry-oriented message
// instead of a string like "Gemini API error: 503 ...".
export async function describeAIError(err, friendlyMessage) {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id === TEMPLATE_ADMIN_USER_ID) return err.message
  return friendlyMessage
}

// Mirrors AdminStaff.jsx's invokeManageStaff/functionErrorMessage and
// quizApi.js's invokeQuiz: supabase-js only populates `data` on a 2xx reply -
// on anything else `data` is null and `error.message` is just the generic
// "Edge Function returned a non-2xx status code". The real reason lives in
// the response body: either our own function's `{ error }` shape, or - when
// the platform gateway rejects the request before our function code even
// runs (e.g. a stale JWT on a tab left idle) - the gateway's own `{ message }`
// shape (`{"code":"UNAUTHORIZED_INVALID_JWT_FORMAT","message":"Invalid JWT"}`).
// A stale token is worth one retry after a session refresh rather than
// immediately surfacing an error - the rest of the app doesn't otherwise show
// one here, since RLS-backed table queries route around the same staleness
// more gracefully than a token an edge function validates directly.
async function functionErrorMessage(invokeError, data) {
  if (data?.error) return data.error
  if (invokeError?.context?.json) {
    try {
      const body = await invokeError.context.json()
      if (body?.error) return body.error
      if (body?.message) return body.message
    } catch { /* body wasn't JSON, fall through to the generic message */ }
  }
  return invokeError?.message || 'Unknown error'
}

async function invokeAI(name, body) {
  let result = await supabase.functions.invoke(name, { body })
  if (result.error) {
    await supabase.auth.refreshSession()
    result = await supabase.functions.invoke(name, { body })
  }
  if (result.error) throw new Error(await functionErrorMessage(result.error, result.data))
  if (result.data?.error) throw new Error(result.data.error)
  return result.data
}

// Generates (or fetches the cached) full structured analysis for a form's
// current filtered submission set. Manual-trigger only: call this from a
// button click, not on mount, to keep free-tier usage predictable.
export async function fetchAIAnalysis(formId, dateRangeLabel, submissionIds, languageStyle = 'plain') {
  return invokeAI('ai-analyst', {
    form_id: formId, date_range_label: dateRangeLabel, submission_ids: submissionIds, language_style: languageStyle,
  })
}

// Natural-language Q&A over the same aggregated stats. Always live (no
// caching), since each question is different.
export async function askAIQuestion(formId, question, submissionIds, languageStyle = 'plain') {
  const data = await invokeAI('ai-ask', {
    form_id: formId, question, submission_ids: submissionIds, language_style: languageStyle,
  })
  return data.answer
}

// Turns pasted, unstructured text (a menu copied from a PDF, a price list,
// whatever) into a product list for ProductManager's "Use AI" import - the
// caller is expected to show these for review/editing before adding them,
// not commit them straight to the catalogue the way the .xlsx import does.
export async function extractProductsFromText(text) {
  const data = await invokeAI('extract-products-ai', { text })
  return data.products
}

const PRODUCT_FILTER_STOPWORDS = new Set(['and', 'the', 'with', 'for', 'of', 'a', 'an', 'to', 'in', 'on', 'at'])
// Below this catalogue size, filtering isn't worth the risk - a small
// product list barely affects prompt length either way, so just send it all.
const PRODUCT_FILTER_THRESHOLD = 60
// A filtered set this thin is more likely a bad match (unusual phrasing,
// product codes instead of names) than a genuinely tiny order - falling
// back to the full catalogue trades away this request's speedup rather than
// risk missing a real product.
const PRODUCT_FILTER_MIN_MATCHES = 3

// extract-order-ai's prompt embeds the whole product catalogue verbatim
// (see its buildPrompt) - for a shop with hundreds of SKUs that's usually
// the largest chunk of the prompt the model has to read before it can even
// start generating, and token count is the dominant driver of extraction
// latency. This trims the catalogue down to only products plausibly
// mentioned in the pasted text before it ever reaches the network request.
// Deliberately generous (a substring match on any significant word in the
// product's name, not an exact or edit-distance fuzzy match) so a typo or
// pluralization ("cokes" for "Coke") still matches.
function filterProductsForText(products, text) {
  const list = products || []
  if (list.length <= PRODUCT_FILTER_THRESHOLD) return list
  const haystack = text.toLowerCase()
  const matches = list.filter(p => {
    const words = (p.name || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !PRODUCT_FILTER_STOPWORDS.has(w))
    return words.some(w => haystack.includes(w))
  })
  return matches.length >= PRODUCT_FILTER_MIN_MATCHES ? matches : list
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
  return invokeAI('extract-order-ai', { text, products: filterProductsForText(products, text), fields, rules })
}
