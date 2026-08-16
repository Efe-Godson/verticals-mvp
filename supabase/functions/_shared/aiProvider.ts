// Place at: supabase/functions/_shared/aiProvider.ts
// Every AI edge function (ai-analyst, ai-ask, extract-products-ai,
// extract-order-ai) calls the model through generateText() instead of
// hitting Gemini directly. Gemini stays primary - its responseSchema mode
// gives strict structured output, worth keeping as the default - but a 429
// (free-tier quota exhausted) or 503 (model overloaded/unavailable)
// automatically retries the same prompt against OpenRouter's hosted Llama
// instead of just failing the request outright. Only those two statuses
// trigger the fallback: a real prompt/parsing error would fail the same way
// on the second provider too, so there's nothing to gain retrying those,
// just double the latency on a request that was never going to succeed.
const GEMINI_MODEL = 'gemini-flash-latest'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct'

async function callGemini(prompt: string, jsonSchema?: object) {
  const res = await fetch(`${GEMINI_URL}?key=${Deno.env.get('GEMINI_API_KEY')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(jsonSchema ? { generationConfig: { responseMimeType: 'application/json', responseSchema: jsonSchema } } : {}),
    }),
  })
  if (!res.ok) {
    const err = new Error(`Gemini API error: ${res.status} ${await res.text()}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No content returned from Gemini')
  return text
}

// OpenRouter has no equivalent of Gemini's schema-constrained decoding -
// response_format: json_object only guarantees valid JSON, not a specific
// shape. Callers' prompts describe the expected fields in prose (for
// Gemini's benefit too, schema or not), but nested key names (e.g.
// "fieldId"/"value" inside extract-order-ai's answers array) only ever
// appear in the RESPONSE_SCHEMA object itself, which Gemini enforces via
// responseSchema but which OpenRouter never sees. Left alone, OpenRouter
// guesses at key names and silently drops or mis-shapes whatever part of
// the prompt was less explicit - so the schema is serialized into the
// prompt here to give it the exact shape to follow.
async function callOpenRouter(prompt: string, jsonSchema?: object) {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) throw new Error('Gemini is rate-limited and OPENROUTER_API_KEY is not set, so there is no fallback available right now.')

  const fullPrompt = jsonSchema
    ? `${prompt}\n\nRespond with ONLY a JSON object matching exactly this schema (use these exact property names and nesting, omit nothing the schema requires):\n${JSON.stringify(jsonSchema)}`
    : prompt

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: fullPrompt }],
      ...(jsonSchema ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('No content returned from OpenRouter')
  return text
}

// jsonSchema: pass the Gemini responseSchema object for structured output -
// used for Gemini's own strict decoding, and doubles as the signal to ask
// OpenRouter for JSON mode on fallback. Omit for a plain free-text answer
// (see ai-ask).
export async function generateText(prompt: string, jsonSchema?: object) {
  try {
    return await callGemini(prompt, jsonSchema)
  } catch (err) {
    const status = (err as Error & { status?: number }).status
    if (status !== 429 && status !== 503) throw err
    return await callOpenRouter(prompt, jsonSchema)
  }
}
