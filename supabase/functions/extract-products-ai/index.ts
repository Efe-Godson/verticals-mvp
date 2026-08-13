// Place at: supabase/functions/extract-products-ai/index.ts
// Deploy: supabase functions deploy extract-products-ai
// Secret: reuses GEMINI_API_KEY (already set for ai-analyst/ai-ask)
// Turns arbitrary pasted text (a menu copied from a PDF, a WhatsApp price
// list, whatever) into a structured product list for ProductManager's
// "Use AI" import option. Authenticated but not form-scoped - unlike ai-
// analyst/ai-ask this never reads a form's own data, it's a stateless text-
// in/JSON-out utility, so there's no ownership to check, just a signed-in
// caller (verify_jwt = true) to keep it off the open internet.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'

const GEMINI_MODEL = 'gemini-flash-latest'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const MAX_TEXT_LENGTH = 12000 // generous for a pasted menu/price list, cheap guard against runaway prompts

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'number' },
          unit: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['name', 'price'],
      },
    },
  },
  required: ['products'],
}

function buildPrompt(text: string) {
  return `Extract a product/menu catalogue from the text below, which was pasted by a shop or restaurant owner from some other source (a PDF, a spreadsheet, a WhatsApp message, a handwritten list, anything).

For each distinct item found:
- name: the product/menu item name, cleaned up (fix obvious typos, consistent capitalization), but don't invent or rename it into something different.
- price: the numeric price only (no currency symbol or commas). If a range is given, use the lower number.
- unit: a short unit like "pcs", "kg", "plate" - only if the text actually implies one, otherwise omit it.
- category: a short grouping label (e.g. "Drinks", "Mains", "Apparel") only if the text groups items that way or it's obvious, otherwise omit it.

Skip lines that are clearly not products (headers, addresses, phone numbers, promotional text). Do not invent products that aren't in the text.

Text:
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

    const { text } = await req.json()
    if (!text?.trim()) return jsonResponse({ error: 'text is required' }, 400)
    const trimmedText = text.trim().slice(0, MAX_TEXT_LENGTH)

    const geminiRes = await fetch(`${GEMINI_URL}?key=${Deno.env.get('GEMINI_API_KEY')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(trimmedText) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
    })
    if (!geminiRes.ok) throw new Error(`Gemini API error: ${geminiRes.status} ${await geminiRes.text()}`)

    const geminiData = await geminiRes.json()
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) throw new Error('No content returned from Gemini')

    const { products } = JSON.parse(responseText)
    if (!Array.isArray(products)) throw new Error('Gemini returned no products')

    return jsonResponse({
      products: products
        .filter((p: any) => p?.name?.toString().trim())
        .map((p: any) => ({
          name: p.name.toString().trim(),
          price: Number(p.price) || 0,
          unit: p.unit ? p.unit.toString().trim() : '',
          category: p.category ? p.category.toString().trim() : '',
        })),
    })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
