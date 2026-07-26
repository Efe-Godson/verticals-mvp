import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'
import TemplateEditorDialog from './TemplateEditorDialog'

const ROW_HEIGHT = 64

// Stable per-category color so the square reads as more than a label —
// consistent across sessions since it's keyed by name, not insertion order.
const CATEGORY_COLORS = {
  'Retail': '#0ea5e9', 'Restaurant': '#f97316', 'Education': '#8b5cf6',
  'Healthcare': '#ef4444', 'Nonprofit': '#16a34a', 'Events': '#d946ef',
  'HR & Operations': '#0070f3', 'Other': '#6b7280',
}
function categoryColor(category) {
  return CATEGORY_COLORS[category] || '#6b7280'
}

function TemplatesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="card" style={{ height: ROW_HEIGHT }} />
      ))}
    </div>
  )
}

// Square (name) + rectangle (details + actions) pair, same height, kept
// small enough that ~10 fit on screen without scrolling — this page is
// meant to be scanned quickly, not browsed like a gallery of big cards.
function TemplateRow({ template, started, starting, isAdmin, onStart, onAccess, onManage, onDelete }) {
  const detail = template.description
    || (template.bundle?.length > 0 ? `${template.bundle.length} linked forms` : `${template.fields?.length || 0} field${template.fields?.length !== 1 ? 's' : ''}`)
  const color = categoryColor(template.category)

  return (
    <div className="template-row" style={{ display: 'flex', gap: '0.5rem', height: ROW_HEIGHT }}>
      <div
        className="template-row-tile"
        style={{
          width: ROW_HEIGHT, height: ROW_HEIGHT, flexShrink: 0,
          borderRadius: '8px', borderLeft: `3px solid ${color}`,
          background: `${color}14`,
          padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', overflow: 'hidden'
        }}
      >
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.25, color: 'var(--color-text)',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>
          {template.name}
        </span>
      </div>

      <div
        className="template-row-tile"
        style={{
          flex: 1, height: ROW_HEIGHT, minWidth: 0,
          border: '1px solid var(--color-border)', borderRadius: '8px',
          padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem'
        }}
      >
        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0
          }}>
            {template.category}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {detail}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0, alignItems: 'center' }}>
          {isAdmin && (
            <>
              <button className="secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }} onClick={onManage}>Manage</button>
              <button className="secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem', color: '#c0392b' }} onClick={onDelete}>Delete</button>
            </>
          )}
          {started ? (
            <button className="secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }} onClick={onAccess}>Access</button>
          ) : (
            <button style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }} disabled={starting} onClick={onStart}>
              {starting ? '…' : 'Start'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Templates() {
  const { session } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchText, setSearchText] = useState('')
  const [startingSlug, setStartingSlug] = useState(null)
  const [myFormsBySlug, setMyFormsBySlug] = useState({}) // { [templateSlug]: primaryFormId } — most recent instance
  const [editingTemplate, setEditingTemplate] = useState(null) // null = closed, {} = new, template object = editing
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [allForms, setAllForms] = useState([]) // admin-only: for TemplateEditorDialog's "link to" choices
  const [galleryExpanded, setGalleryExpanded] = useState(true)

  const isAdmin = session.user.id === TEMPLATE_ADMIN_USER_ID

  async function loadTemplates() {
    setLoading(true)
    const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false })
    if (!error) setTemplates(data || [])
    setLoading(false)
  }

  useEffect(() => { loadTemplates() }, [])

  // "Access" vs "Start": has this user already created a form from this
  // template? Only forms with no primaryFormId count (a bundle's primary,
  // or a single-form template's own form) — that's the one worth going
  // back to. Picks the most recent if started more than once.
  useEffect(() => {
    async function loadMyInstances() {
      const { data } = await supabase
        .from('forms').select('id, settings, created_at')
        .eq('user_id', session.user.id)
        .is('deleted_at', null)
        .not('settings->>templateSlug', 'is', null)
        .order('created_at', { ascending: false })

      const bySlug = {}
      ;(data || []).forEach(f => {
        const slug = f.settings?.templateSlug
        if (slug && !f.settings?.primaryFormId && !bySlug[slug]) bySlug[slug] = f.id
      })
      setMyFormsBySlug(bySlug)
    }
    loadMyInstances()
  }, [session, templates])

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('forms').select('id, name, fields')
      .eq('user_id', session.user.id)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .then(({ data }) => setAllForms(data || []))
  }, [session, isAdmin])

  async function confirmDeleteTemplate() {
    const id = pendingDeleteId
    setPendingDeleteId(null)
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) {
      showToast('Could not delete template: ' + error.message, 'error')
      return
    }
    setTemplates(current => current.filter(t => t.id !== id))
    showToast('Template deleted.', 'success')
  }

  const categories = useMemo(() => {
    const set = new Set(templates.map(t => t.category))
    return ['All', ...Array.from(set).sort()]
  }, [templates])

  const visible = templates.filter(t => {
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory
    const matchesSearch = !searchText.trim() ||
      t.name.toLowerCase().includes(searchText.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchText.toLowerCase()) ||
      t.highlights?.some(h => h.toLowerCase().includes(searchText.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const inUseTemplates = templates.filter(t => myFormsBySlug[t.slug])

  // Bundle templates (e.g. Employees + Salary Events) create multiple forms
  // at once. A linked_record field's linkedFormId can be a placeholder like
  // "$employees" pointing at another entry's `key` — those don't have real
  // ids until the forms are actually created, so this resolves them after
  // insert instead of the template storing real (and reusable) form ids.
  //
  // The bundle's first entry becomes the "primary" form — the one that
  // shows up in the main Home list. Every other entry gets settings.
  // primaryFormId pointing back at it, which Home filters out of the list
  // entirely (they'd otherwise clutter it as extra, mostly-internal cards —
  // e.g. Salary Events isn't something you browse on its own, you reach it
  // from the Employees form's Payroll tab or NavBar's Linked Forms menu).
  async function startBundleTemplate(template) {
    const createdByKey = {}
    let primaryFormId = null

    function resolvePlaceholder(value) {
      return typeof value === 'string' && value.startsWith('$') ? createdByKey[value.slice(1)] : value
    }

    for (const spec of template.bundle) {
      const resolvedFields = spec.fields.map(field => (
        field.type === 'linked_record' ? { ...field, linkedFormId: resolvePlaceholder(field.linkedFormId) } : field
      ))
      const resolvedSpecSettings = spec.settings
        ? Object.fromEntries(Object.entries(spec.settings).map(([k, v]) => [k, resolvePlaceholder(v)]))
        : {}
      const resolvedSettings = {
        ...resolvedSpecSettings,
        templateSlug: template.slug,
        templateBundleKey: spec.key,
        ...(primaryFormId ? { primaryFormId } : {}),
      }

      const { data, error } = await supabase.from('forms').insert([{
        name: spec.name,
        fields: resolvedFields,
        settings: resolvedSettings,
        status: 'draft',
        user_id: session.user.id,
      }]).select().single()

      if (error || !data) throw new Error(error?.message || `Could not create "${spec.name}"`)
      if (!primaryFormId) primaryFormId = data.id
      createdByKey[spec.key] = data.id
    }

    return createdByKey
  }

  async function startTemplate(template) {
    setStartingSlug(template.slug)
    try {
      if (template.bundle?.length > 0) {
        const createdByKey = await startBundleTemplate(template)
        showToast(`"${template.name}" created — ${template.bundle.length} forms set up and linked.`, 'success')
        const primaryFormId = createdByKey[template.bundle[0].key]
        // Payroll-flavored bundles (settings.payrollRole === 'employees' on
        // the primary entry) have a purpose-built Dashboard — more useful
        // as a landing page than the empty form builder.
        const destination = template.bundle[0].settings?.payrollRole === 'employees'
          ? `/form/${primaryFormId}/payroll`
          : `/form/${primaryFormId}/edit`
        setMyFormsBySlug(current => ({ ...current, [template.slug]: primaryFormId }))
        navigate(destination)
        return
      }

      const { data, error } = await supabase.from('forms').insert([{
        name: template.name,
        fields: template.fields,
        status: 'draft',
        user_id: session.user.id,
        settings: { templateSlug: template.slug },
      }]).select().single()

      if (error || !data) throw new Error(error?.message || 'unknown error')
      showToast(`"${template.name}" created — customize it now.`, 'success')
      setMyFormsBySlug(current => ({ ...current, [template.slug]: data.id }))
      navigate(`/form/${data.id}/edit`)
    } catch (err) {
      showToast('Could not start this template: ' + err.message, 'error')
    } finally {
      setStartingSlug(null)
    }
  }

  function accessTemplate(template) {
    const formId = myFormsBySlug[template.slug]
    if (!formId) return
    const destination = template.bundle?.[0]?.settings?.payrollRole === 'employees'
      ? `/form/${formId}/payroll`
      : `/form/${formId}/records`
    navigate(destination)
  }

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <style>{`
        .template-row-tile { transition: border-color 0.12s ease, box-shadow 0.12s ease; }
        .template-row:hover .template-row-tile { border-color: var(--color-primary); }
        .template-row:hover .template-row-tile:first-child { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      `}</style>
      <div className="card" style={{ padding: '1.4rem 1.5rem', marginBottom: '1.2rem', background: 'linear-gradient(135deg, #f9fbff 0%, #f3f7ff 100%)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Templates
        </div>
        <h1 style={{ margin: '0.35rem 0 0.55rem', fontSize: '1.8rem' }}>Start faster with ready-made form ideas</h1>
        <p style={{ margin: 0, color: 'var(--color-muted)', maxWidth: '720px', lineHeight: 1.6 }}>
          Pick a starting point for your business or organization and launch a polished form in minutes.
        </p>
      </div>

      {!loading && inUseTemplates.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 0.7rem', fontSize: '0.85rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Templates in Use
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {inUseTemplates.map(template => (
              <TemplateRow
                key={template.id}
                template={template}
                started
                onAccess={() => accessTemplate(template)}
              />
            ))}
          </div>
        </div>
      )}

      <div
        onClick={() => setGalleryExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', marginBottom: '0.8rem' }}
      >
        <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', transform: galleryExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
        <h3 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          All Templates
        </h3>
        {isAdmin && (
          <button
            className="secondary"
            onClick={(e) => { e.stopPropagation(); setEditingTemplate({}) }}
            style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
          >
            + New Template
          </button>
        )}
      </div>

      {galleryExpanded && (
        <>
          {!loading && templates.length > 0 && (
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Search templates..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ padding: '0.45rem 0.7rem', minWidth: '200px', flex: '0 1 240px' }}
              />
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={activeCategory === cat ? '' : 'secondary'}
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', borderRadius: '999px' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && <TemplatesSkeleton />}

          {!loading && templates.length === 0 && (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
              No templates are published yet — check back soon.
            </div>
          )}

          {!loading && templates.length > 0 && visible.length === 0 && (
            <p style={{ color: 'var(--color-muted)' }}>No templates match your search.</p>
          )}

          {!loading && visible.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {visible.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  started={!!myFormsBySlug[template.slug]}
                  starting={startingSlug === template.slug}
                  isAdmin={isAdmin}
                  onStart={() => startTemplate(template)}
                  onAccess={() => accessTemplate(template)}
                  onManage={() => setEditingTemplate(template)}
                  onDelete={() => setPendingDeleteId(template.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editingTemplate && (
        <TemplateEditorDialog
          template={editingTemplate.id ? editingTemplate : null}
          realForms={allForms}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => { setEditingTemplate(null); loadTemplates() }}
        />
      )}

      {pendingDeleteId && (
        <div
          onClick={() => setPendingDeleteId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', width: '380px', maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 0.7rem' }}>Delete this template?</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', margin: '0 0 1.3rem' }}>
              This removes it from the Templates page for everyone. Forms already created from it are unaffected.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button className="secondary" onClick={() => setPendingDeleteId(null)}>Cancel</button>
              <button style={{ background: '#c0392b' }} onClick={confirmDeleteTemplate}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Templates
