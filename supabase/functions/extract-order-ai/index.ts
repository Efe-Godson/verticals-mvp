// Place at: supabase/functions/extract-order-ai/index.ts
// Deploy: supabase functions deploy extract-order-ai
// Secret: reuses GEMINI_API_KEY (already set for ai-analyst/ai-ask/extract-products-ai)
// Turns a pasted order (a WhatsApp message, an SMS, a handwritten note read
// aloud) into cart items + field answers for PublicForm.jsx's order screen
// "Fill from Text" button - the cashier pastes the raw message instead of
// re-typing it into the form by hand. Stateless: the caller sends the
// current form's own product list and field list (id/label/type/options)
// right in the request body, so this never touches the database itself and
// has nothing to check ownership of - same shape as extract-products-ai.
// Authenticated (verify_jwt = true) only to keep it off the open internet;
// PublicForm.jsx only shows the button to a signed-in operator anyway.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'

const GEMINI_MODEL = 'gemini-flash-latest'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const MAX_TEXT_LENGTH = 6000
const MAX_RULES_LENGTH = 2000

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'number' },
        },
        required: ['productId', 'quantity'],
      },
    },
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fieldId: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['fieldId', 'value'],
      },
    },
  },
  required: ['items', 'answers'],
}

function buildPrompt(text: string, products: any[], fields: any[], rules: string, today: string) {
  const productList = products.map(p => `- id="${p.id}" name="${p.name}"`).join('\n')
  const fieldList = fields.map(f => {
    const options = f.options?.length ? ` options=[${f.options.map((o: string) => `"${o}"`).join(', ')}]` : ''
    return `- id="${f.id}" label="${f.label}" type="${f.type}"${options}`
  }).join('\n')

  return `A shop's cashier pasted the message below (a customer's order, sent by WhatsApp, SMS, or read aloud) and wants it turned into a filled-in order form. Today's date is ${today}. Extract two things:

1. items: which products from the catalogue below were ordered, and how many of each. Only use a productId that appears in the catalogue - never invent one, and never guess a product that isn't clearly meant even if something similar is mentioned. If a quantity isn't stated for an item that's otherwise clearly ordered, use 1.

Catalogue:
${productList || '(no products defined)'}

2. answers: for the other form fields below, pull out a value from the text if the text clearly states one. Only use a fieldId that appears in the list - never invent one, and skip a field entirely if the text doesn't address it (don't guess or invent a value). For a field with an "options" list, the value must be an exact match to one of those options (pick the closest one if the text implies it, e.g. "she'll pick it up" implies a "Pickup" option) - if none fit, skip that field. For a field with type="date", the value must be exactly YYYY-MM-DD - resolve relative terms ("today", "tomorrow", "next Monday") against today's date above, and skip the field entirely if no date is stated or implied (don't default to today just because a date field exists). For a field with type="location", the value should describe the place as "City, State, Country" in that order, using only whichever parts the text actually states (e.g. just "Lekki" if that's all that's said) - don't infer a state or country the text doesn't imply.

Fields:
${fieldList || '(no other fields)'}
${rules ? `
The shop owner has set these extra rules for how to fill things in - apply them whenever they're relevant, but they never override the hard constraints above (still only ever use a real productId/fieldId, and still only an exact options match):
"""
${rules}
"""
` : ''}
Message:
"""
${text}
"""`
}

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return jsonResponse({ error: 'Missing Authorization header' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !userData?.user) return jsonResponse({ error: 'Invalid or expired session' }, 401)

    const { text, products, fields, rules } = await req.json()
    if (!text?.trim()) return jsonResponse({ error: 'text is required' }, 400)
    const trimmedText = text.trim().slice(0, MAX_TEXT_LENGTH)
    const safeProducts = Array.isArray(products) ? products : []
    const safeFields = Array.isArray(fields) ? fields : []
    const trimmedRules = rules?.trim().slice(0, MAX_RULES_LENGTH) || ''
    const today = new Date().toISOString().slice(0, 10)

    const geminiRes = await fetch(`${GEMINI_URL}?key=${Deno.env.get('GEMINI_API_KEY')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(trimmedText, safeProducts, safeFields, trimmedRules, today) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
    })
    if (!geminiRes.ok) throw new Error(`Gemini API error: ${geminiRes.status} ${await geminiRes.text()}`)

    const geminiData = await geminiRes.json()
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) throw new Error('No content returned from Gemini')

    const parsed = JSON.parse(responseText)
    const productIds = new Set(safeProducts.map((p: any) => p.id))
    const fieldsById = new Map(safeFields.map((f: any) => [f.id, f]))

    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .filter((item: any) => item?.productId && productIds.has(item.productId) && Number(item.quantity) > 0)
      .map((item: any) => ({ productId: item.productId, quantity: Math.round(Number(item.quantity)) }))

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

    const answers = (Array.isArray(parsed.answers) ? parsed.answers : [])
      .filter((a: any) => a?.fieldId && fieldsById.has(a.fieldId) && a.value?.toString().trim())
      .map((a: any) => {
        const field = fieldsById.get(a.fieldId)
        const value = a.value.toString().trim()
        // Location isn't validated here - matching "City, State, Country"
        // against the real country/state/city dataset needs locationData.js,
        // which lives client-side (see AiFillModal.handleExtract); this just
        // passes the raw text through for the client to parse.
        if (field.type === 'date') {
          return DATE_RE.test(value) ? { fieldId: a.fieldId, value } : null
        }
        if (field.options?.length) {
          const match = field.options.find((o: string) => o.toLowerCase() === value.toLowerCase())
          return match ? { fieldId: a.fieldId, value: match } : null
        }
        return { fieldId: a.fieldId, value }
      })
      .filter(Boolean)

    return jsonResponse({ items, answers })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
