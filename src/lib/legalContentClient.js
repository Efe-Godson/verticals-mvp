// Place at: src/lib/legalContentClient.js
// Thin wrapper over the public-content edge function - the only way a
// public page reads Trust/Legal/Resources content, since legal_pages,
// subprocessors and resource_articles have no public RLS SELECT policy
// (see the trust_legal_content migration and public-content/index.ts).
import { supabase } from '../supabaseClient'

async function throwFunctionError(error) {
  const response = error?.context
  if (response instanceof Response) {
    try {
      const payload = await response.clone().json()
      if (payload?.error) throw new Error(payload.error)
      if (payload?.message) throw new Error(payload.message)
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message !== 'Unexpected end of JSON input') {
        throw parseError
      }
    }
  }
  throw error
}

async function invoke(body) {
  const { data, error } = await supabase.functions.invoke('public-content', { body })
  if (error) await throwFunctionError(error)
  if (data?.error) throw new Error(data.error)
  return data
}

// Returns { page } - page is null if the slug has never been published.
export async function getPage(slug) {
  return invoke({ action: 'get_page', slug })
}

// Returns { articles }.
export async function listResources(category) {
  return invoke({ action: 'list_resources', category })
}

// Returns { article, related } - article is null if the slug isn't a
// published article.
export async function getResource(slug) {
  return invoke({ action: 'get_resource', slug })
}

// Returns { intro, providers }.
export async function getSubprocessors() {
  return invoke({ action: 'get_subprocessors' })
}
