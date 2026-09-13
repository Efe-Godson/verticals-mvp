// Place at: src/lab/trustLegal/ArticleEditor.jsx
// Create/edit a single Resource article. Same draft-vs-published semantics
// as LegalPageEditor (Save Draft never touches published_content), applied
// to resource_articles instead of the fixed-slug legal_pages rows - so this
// one also has to handle "doesn't exist yet" (a brand-new article only gets
// inserted on its first Save Draft/Publish).
import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../Toast'
import Modal from '../../components/Modal'
import { ModalBodySkeleton } from '../../components/PageSkeleton'
import { ErrorState } from '../../ErrorState'
import MarkdownContent from '../../lib/MarkdownContent'

const CATEGORIES = ['Privacy', 'Security', 'Data', 'AI', 'Guides', 'Product', 'Business']

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function ArticleEditor({ articleId, onDone }) {
  const { showToast } = useToast()
  const isNew = !articleId
  const [row, setRow] = useState(isNew ? {} : null)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [shortDescription, setShortDescription] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  async function load() {
    if (isNew) return
    setError('')
    setRow(null)
    const { data, error: fetchError } = await supabase
      .from('resource_articles').select('*').eq('id', articleId).single()
    if (fetchError) { setError('Could not load this article: ' + fetchError.message); return }
    setRow(data)
    setTitle(data.title)
    setSlug(data.slug)
    setCategory(data.category)
    setShortDescription(data.short_description || '')
    setSeoTitle(data.seo_title || '')
    setSeoDescription(data.seo_description || '')
    setContent(data.draft_content ?? data.published_content ?? '')
  }

  useEffect(() => { load() }, [articleId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(publish) {
    if (!title.trim() || !slug.trim()) { showToast('Title and slug are required.', 'error'); return }
    setSaving(true)
    try {
      const patch = {
        title: title.trim(), slug: slug.trim(), category, short_description: shortDescription || null,
        seo_title: seoTitle || null, seo_description: seoDescription || null,
        draft_content: content, updated_at: new Date().toISOString(),
      }
      if (publish) {
        patch.published_content = content
        patch.status = 'published'
        patch.published_at = new Date().toISOString()
      }

      if (isNew && !row?.id) {
        const { data: inserted, error: insertError } = await supabase
          .from('resource_articles').insert([{ ...patch, status: publish ? 'published' : 'draft' }]).select().single()
        if (insertError) throw new Error(insertError.message)
        setRow(inserted)
      } else {
        const { error: updateError } = await supabase.from('resource_articles').update(patch).eq('id', row.id)
        if (updateError) throw new Error(updateError.message)
      }
      showToast(publish ? 'Article published.' : 'Draft saved.', 'success')
      onDone()
    } catch (err) {
      showToast('Could not save: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (row === null) return <ModalBodySkeleton rows={6} />

  return (
    <div>
      <div className="toolbar-row" style={{ justifyContent: 'space-between', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <h2 style={{ margin: 0 }}>{isNew && !row?.id ? 'New article' : 'Edit article'}</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="secondary" onClick={onDone}>Back</button>
          <button type="button" className="secondary" onClick={() => setShowPreview(true)}>Preview</button>
          <button type="button" className="secondary" disabled={saving} onClick={() => save(false)}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button type="button" disabled={saving} onClick={() => save(true)}>
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
          Title
          <input
            type="text" value={title}
            onChange={e => {
              setTitle(e.target.value)
              if (!slugTouched) setSlug(slugify(e.target.value))
            }}
            style={{ width: '100%', marginTop: '0.35rem' }}
          />
        </label>
        <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
          Slug
          <input
            type="text" value={slug}
            onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
            style={{ width: '100%', marginTop: '0.35rem' }}
          />
        </label>
        <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
          Category
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', marginTop: '0.35rem' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block', marginBottom: '1rem' }}>
        Short description
        <input type="text" value={shortDescription} onChange={e => setShortDescription(e.target.value)}
          style={{ width: '100%', marginTop: '0.35rem' }} placeholder="Shown on the article card and at the top of the article." />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
          SEO title
          <input type="text" value={seoTitle} onChange={e => setSeoTitle(e.target.value)}
            style={{ width: '100%', marginTop: '0.35rem' }} placeholder={`${title || 'Article'} | Verticals`} />
        </label>
        <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
          SEO description
          <input type="text" value={seoDescription} onChange={e => setSeoDescription(e.target.value)}
            style={{ width: '100%', marginTop: '0.35rem' }} />
        </label>
      </div>

      <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
        Article content
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder="Paste Markdown here - headings, lists, bold/italic, links, tables and blockquotes all render automatically."
          rows={18}
          style={{ width: '100%', marginTop: '0.35rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem' }}
        />
      </label>

      {showPreview && (
        <Modal size="xl" onClose={() => setShowPreview(false)} title={`Preview: ${title || 'Untitled'}`}>
          {shortDescription && <p style={{ color: 'var(--color-muted)', fontWeight: 600 }}>{shortDescription}</p>}
          {content ? <MarkdownContent content={content} /> : (
            <p style={{ color: 'var(--color-muted)' }}>Nothing to preview yet.</p>
          )}
        </Modal>
      )}
    </div>
  )
}
