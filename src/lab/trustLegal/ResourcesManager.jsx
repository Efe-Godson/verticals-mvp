// Place at: src/lab/trustLegal/ResourcesManager.jsx
// Lab -> Trust & Legal -> Resources: the article list (brief section 8) plus
// the New Article / Edit flows, which hand off to ArticleEditor.
import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../Toast'
import ConfirmDialog from '../../ConfirmDialog'
import Modal from '../../components/Modal'
import { ErrorState } from '../../ErrorState'
import MarkdownContent from '../../lib/MarkdownContent'
import ArticleEditor from './ArticleEditor'

export default function ResourcesManager() {
  const { showToast } = useToast()
  const [articles, setArticles] = useState(null) // null while loading
  const [error, setError] = useState('')
  const [view, setView] = useState('list') // 'list' | 'new' | { editId }
  const [previewing, setPreviewing] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  async function load() {
    setError('')
    const { data, error: fetchError } = await supabase
      .from('resource_articles').select('*').order('updated_at', { ascending: false })
    if (fetchError) { setError('Could not load articles: ' + fetchError.message); return }
    setArticles(data || [])
  }

  useEffect(() => { load() }, [])

  async function togglePublish(article) {
    const publishing = article.status !== 'published'
    const patch = publishing
      ? { status: 'published', published_content: article.draft_content ?? article.published_content ?? '', published_at: new Date().toISOString() }
      : { status: 'draft' }
    const { error: updateError } = await supabase.from('resource_articles').update(patch).eq('id', article.id)
    if (updateError) { showToast('Could not update: ' + updateError.message, 'error'); return }
    showToast(publishing ? 'Article published.' : 'Article unpublished.', 'success')
    load()
  }

  async function performDelete() {
    const id = pendingDeleteId
    setPendingDeleteId(null)
    const { error: deleteError } = await supabase.from('resource_articles').delete().eq('id', id)
    if (deleteError) { showToast('Could not delete: ' + deleteError.message, 'error'); return }
    setArticles(current => current.filter(a => a.id !== id))
    showToast('Article deleted.', 'success')
  }

  if (view === 'new') return <ArticleEditor onDone={() => { setView('list'); load() }} />
  if (view && typeof view === 'object') return <ArticleEditor articleId={view.editId} onDone={() => { setView('list'); load() }} />

  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <div className="toolbar-row" style={{ justifyContent: 'space-between', marginBottom: '1.2rem' }}>
        <h2 style={{ margin: 0 }}>Resources</h2>
        <button type="button" onClick={() => setView('new')}>+ New Article</button>
      </div>

      {articles === null ? null : articles.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <p>No articles yet.</p>
          <button type="button" style={{ marginTop: '0.5rem' }} onClick={() => setView('new')}>Write the first one</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)' }}>Title</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)' }}>Category</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)' }}>Updated</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.7rem' }}>{a.title}</td>
                  <td style={{ padding: '0.7rem', color: 'var(--color-muted)' }}>{a.category}</td>
                  <td style={{ padding: '0.7rem' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                      color: a.status === 'published' ? 'var(--status-good)' : 'var(--color-muted)',
                      background: a.status === 'published' ? 'color-mix(in srgb, var(--status-good) 15%, transparent)' : 'var(--color-bg)',
                    }}>
                      {a.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td style={{ padding: '0.7rem', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                    {new Date(a.updated_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.7rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button type="button" className="secondary" onClick={() => setView({ editId: a.id })}>Edit</button>
                      <button type="button" className="secondary" onClick={() => setPreviewing(a)}>Preview</button>
                      <button type="button" className="secondary" onClick={() => togglePublish(a)}>
                        {a.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" className="secondary" style={{ color: '#c0392b' }} onClick={() => setPendingDeleteId(a.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewing && (
        <Modal size="xl" onClose={() => setPreviewing(null)} title={`Preview: ${previewing.title}`}>
          {previewing.short_description && <p style={{ color: 'var(--color-muted)', fontWeight: 600 }}>{previewing.short_description}</p>}
          <MarkdownContent content={previewing.draft_content ?? previewing.published_content} />
        </Modal>
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete this article?"
          message="This permanently removes it, including its published version if it's live."
          confirmLabel="Delete" danger
          onConfirm={performDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
}
