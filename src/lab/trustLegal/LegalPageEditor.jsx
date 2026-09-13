// Place at: src/lab/trustLegal/LegalPageEditor.jsx
// Shared editor for the 5 fixed-slug pages (Trust Center, Security, Privacy
// Policy, Terms of Service, Cookie Policy) and reused by SubprocessorsEditor
// for the Subprocessors page's own optional Markdown intro. One row per
// slug already exists (seeded by the trust_legal_content migration), so
// this only ever updates, never inserts.
//
// Draft vs. Publish (brief section 12): "Save Draft" writes draft_content
// only - published_content (what the public page reads) is untouched, so a
// previously published page stays live exactly as-is until "Publish" is
// pressed again, which copies the current text into published_content.
import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../Toast'
import Modal from '../../components/Modal'
import { ModalBodySkeleton } from '../../components/PageSkeleton'
import { ErrorState } from '../../ErrorState'
import MarkdownContent from '../../lib/MarkdownContent'

export default function LegalPageEditor({ slug, label, contentOnly = false }) {
  const { showToast } = useToast()
  const [row, setRow] = useState(null) // null while loading
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  async function load() {
    setError('')
    setRow(null)
    const { data, error: fetchError } = await supabase
      .from('legal_pages').select('*').eq('slug', slug).single()
    if (fetchError) { setError('Could not load this page: ' + fetchError.message); return }
    setRow(data)
    setTitle(data.title || label)
    setLastUpdated(data.last_updated || '')
    setSeoTitle(data.seo_title || '')
    setSeoDescription(data.seo_description || '')
    setContent(data.draft_content ?? data.published_content ?? '')
  }

  useEffect(() => { load() }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(publish) {
    setSaving(true)
    try {
      const patch = {
        title, seo_title: seoTitle || null, seo_description: seoDescription || null,
        last_updated: lastUpdated || null, draft_content: content, updated_at: new Date().toISOString(),
      }
      if (publish) {
        patch.published_content = content
        patch.status = 'published'
        patch.published_at = new Date().toISOString()
      }
      const { error: saveError } = await supabase.from('legal_pages').update(patch).eq('slug', slug)
      if (saveError) throw new Error(saveError.message)
      showToast(publish ? `${label} published.` : `${label} draft saved.`, 'success')
      load()
    } catch (err) {
      showToast('Could not save: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (row === null) return <ModalBodySkeleton rows={5} />

  return (
    <div>
      <div className="toolbar-row" style={{ justifyContent: 'space-between', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>{label}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            Status: <strong style={{ color: row.status === 'published' ? 'var(--status-good)' : 'var(--color-muted)' }}>
              {row.status === 'published' ? 'Published' : 'Draft'}
            </strong>
            {row.status === 'published' && ' - editing here saves a new draft; the live page keeps showing the last published version until you Publish again.'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="secondary" onClick={() => setShowPreview(true)}>Preview</button>
          <button type="button" className="secondary" disabled={saving} onClick={() => save(false)}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button type="button" disabled={saving} onClick={() => save(true)}>
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {!contentOnly && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
              Page title
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', marginTop: '0.35rem' }} />
            </label>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
              Slug
              <input type="text" value={`/${slug}`} disabled style={{ width: '100%', marginTop: '0.35rem', opacity: 0.6 }} />
            </label>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
              Last updated
              <input type="date" value={lastUpdated || ''} onChange={e => setLastUpdated(e.target.value)} style={{ width: '100%', marginTop: '0.35rem' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
              SEO title
              <input type="text" value={seoTitle} onChange={e => setSeoTitle(e.target.value)} style={{ width: '100%', marginTop: '0.35rem' }} placeholder={`${title} | Verticals`} />
            </label>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
              SEO description
              <input type="text" value={seoDescription} onChange={e => setSeoDescription(e.target.value)} style={{ width: '100%', marginTop: '0.35rem' }} />
            </label>
          </div>
        </>
      )}

      <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block' }}>
        Content {contentOnly && '(optional intro, shown above the provider table)'}
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder="Paste Markdown here - headings, lists, bold/italic, links, tables and blockquotes all render automatically."
          rows={18}
          style={{ width: '100%', marginTop: '0.35rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem' }}
        />
      </label>

      {showPreview && (
        <Modal size="xl" onClose={() => setShowPreview(false)} title={`Preview: ${title}`}>
          {content ? <MarkdownContent content={content} /> : (
            <p style={{ color: 'var(--color-muted)' }}>Nothing to preview yet - the public page would show its placeholder.</p>
          )}
        </Modal>
      )}
    </div>
  )
}
