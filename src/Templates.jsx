import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'
import TemplateEditorDialog from './TemplateEditorDialog'

function TemplatesSkeleton() {
  return (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="card" style={{ padding: '1.2rem', height: '220px' }} />
      ))}
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
    <div className="page" style={{ maxWidth: '1080px' }}>
      <div className="card" style={{ padding: '1.4rem 1.5rem', marginBottom: '1.2rem', background: 'linear-gradient(135deg, #f9fbff 0%, #f3f7ff 100%)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Templates
        </div>
        <h1 style={{ margin: '0.35rem 0 0.55rem', fontSize: '1.8rem' }}>Start faster with ready-made form ideas</h1>
        <p style={{ margin: 0, color: 'var(--color-muted)', maxWidth: '720px', lineHeight: 1.6 }}>
          Pick a starting point for your business or organization and launch a polished form in minutes.
        </p>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="secondary" onClick={() => setEditingTemplate({})}>+ New Template</button>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.2rem' }}>
          <input
            type="text"
            placeholder="Search templates..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ padding: '0.5rem 0.7rem', minWidth: '200px', flex: '0 1 240px' }}
          />
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={activeCategory === cat ? '' : 'secondary'}
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem', borderRadius: '999px' }}
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
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {visible.map((template) => (
            <div key={template.id} className="card" style={{ padding: '1.2rem 1.2rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {template.eyebrow && (
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {template.eyebrow}
                </div>
              )}
              <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{template.name}</div>
              {template.description && (
                <div style={{ color: 'var(--color-muted)', lineHeight: 1.55, fontSize: '0.94rem' }}>
                  {template.description}
                </div>
              )}
              <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>
                {template.bundle?.length > 0
                  ? `${template.bundle.length} linked forms`
                  : `${template.fields?.length || 0} field${template.fields?.length !== 1 ? 's' : ''}`}
              </div>
              {template.highlights?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  {template.highlights.map((item) => (
                    <span key={item} style={{ border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.28rem 0.6rem', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                      {item}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {myFormsBySlug[template.slug] ? (
                  <button style={{ width: '100%' }} onClick={() => accessTemplate(template)}>
                    Access {template.name}
                  </button>
                ) : (
                  <button style={{ width: '100%' }} disabled={startingSlug === template.slug} onClick={() => startTemplate(template)}>
                    {startingSlug === template.slug ? 'Creating…' : `Start ${template.name}`}
                  </button>
                )}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="secondary" style={{ flex: 1, fontSize: '0.82rem' }} onClick={() => setEditingTemplate(template)}>
                      Manage
                    </button>
                    <button className="secondary" style={{ flex: 1, fontSize: '0.82rem', color: '#c0392b' }} onClick={() => setPendingDeleteId(template.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
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
