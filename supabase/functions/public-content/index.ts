// Place at: supabase/functions/public-content/index.ts
// Deploy: supabase functions deploy public-content
// Public, unauthenticated by design (verify_jwt = false in config.toml) -
// this is what backs every public Trust/Legal/Resources page. legal_pages,
// subprocessors and resource_articles have no public RLS SELECT policy at
// all (admin-only, see the trust_legal_content migration), so this is the
// only way a visitor's browser ever sees this content - and every branch
// below explicitly lists its selected columns (never `select('*')`) and
// filters status = 'published' server-side, so draft_content can't leak
// even if RLS is ever loosened by accident later.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/stats.ts'

const LEGAL_PAGE_COLUMNS = 'slug, title, seo_title, seo_description, last_updated, published_content, status'
const RESOURCE_LIST_COLUMNS = 'slug, title, category, short_description, published_at'
const RESOURCE_FULL_COLUMNS = 'slug, title, category, short_description, published_content, seo_title, seo_description, published_at'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { action, slug, category } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'get_page') {
      if (!slug) return jsonResponse({ error: 'slug is required' }, 400)
      const { data, error } = await supabase
        .from('legal_pages').select(LEGAL_PAGE_COLUMNS)
        .eq('slug', slug).eq('status', 'published').maybeSingle()
      if (error) throw error
      return jsonResponse({ page: data || null })
    }

    if (action === 'list_resources') {
      let query = supabase
        .from('resource_articles').select(RESOURCE_LIST_COLUMNS)
        .eq('status', 'published').order('published_at', { ascending: false })
      if (category) query = query.eq('category', category)
      const { data, error } = await query
      if (error) throw error
      return jsonResponse({ articles: data || [] })
    }

    if (action === 'get_resource') {
      if (!slug) return jsonResponse({ error: 'slug is required' }, 400)
      const { data, error } = await supabase
        .from('resource_articles').select(RESOURCE_FULL_COLUMNS)
        .eq('slug', slug).eq('status', 'published').maybeSingle()
      if (error) throw error
      if (!data) return jsonResponse({ article: null, related: [] })

      const { data: related, error: relatedError } = await supabase
        .from('resource_articles').select(RESOURCE_LIST_COLUMNS)
        .eq('status', 'published').eq('category', data.category)
        .neq('slug', slug).order('published_at', { ascending: false }).limit(3)
      if (relatedError) throw relatedError

      return jsonResponse({ article: data, related: related || [] })
    }

    if (action === 'get_subprocessors') {
      const { data: intro, error: introError } = await supabase
        .from('legal_pages').select(LEGAL_PAGE_COLUMNS)
        .eq('slug', 'subprocessors').eq('status', 'published').maybeSingle()
      if (introError) throw introError

      const { data: providers, error: providersError } = await supabase
        .from('subprocessors').select('id, provider_name, purpose, data_involved, link')
        .eq('status', 'Active').order('sort_order', { ascending: true })
      if (providersError) throw providersError

      return jsonResponse({ intro: intro || null, providers: providers || [] })
    }

    return jsonResponse({ error: `Unknown action "${action}"` }, 400)
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
