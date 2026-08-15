// Place at: src/shortLinks.js
// Self-hosted alternative to the plain /form/:id link (see PosSidePanel's
// Share Link) - a short, random code stored in short_links that /s/:code
// (ShortLinkRedirect.jsx) resolves back to the real form. Reuses a form's
// existing code instead of minting a new one on every Share Link click.
import { supabase } from './supabaseClient'

// Same excluded-lookalikes reasoning as the quiz room code generator
// (_shared/quiz.ts): no 0/O or 1/I, so a code read aloud or handwritten
// isn't ambiguous.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const MAX_ATTEMPTS = 5

function generateCode() {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

export async function getOrCreateShortLink(formId) {
  const { data: existing } = await supabase
    .from('short_links').select('code').eq('form_id', formId)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (existing?.code) return existing.code

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode()
    const { error } = await supabase.from('short_links').insert([{ code, form_id: formId }])
    if (!error) return code
    if (error.code !== '23505') throw new Error(error.message) // anything but a unique-violation on `code` is unexpected
  }
  throw new Error('Could not generate a short link.')
}
