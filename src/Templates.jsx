import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'
import Modal from './components/Modal'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'
import TemplateEditorDialog from './TemplateEditorDialog'
import { categoryColor, CategoryIcon } from './templateVisuals'
import { createLocationForm, locationDestination } from './locations'
import { usePageTitle } from './PageTitleContext'
import { Skeleton } from './components/Skeleton'

function TemplatesSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.8rem' }} aria-busy="true">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <Skeleton key={i} h="auto" style={{ aspectRatio: '1', borderRadius: '12px' }} />
      ))}
    </div>
  )
}

// One simple square tile per template: icon, name, one action. Started
// templates show "Manage" (back into that instance, side panel already
// open); not-yet-started ones show "Add". Kept deliberately plain so a
// whole gallery of these reads as a clean grid, not a wall of copy.
function TemplateTile({ template, started, starting, onAdd, onManage }) {
  const color = categoryColor(template.category)

  return (
    <div
      className="template-tile"
      style={{
        position: 'relative', aspectRatio: '1', border: '1px solid var(--color-border)', borderRadius: '12px',
        background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '0.5rem', padding: '0.9rem', textAlign: 'center'
      }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: '10px', background: `${color}16`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <CategoryIcon category={template.category} color={color} />
      </div>

      <span style={{
        fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.25,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>
        {template.name}
      </span>

      {started ? (
        <button className="secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.8rem', width: '100%' }} onClick={onManage}>
          Manage
        </button>
      ) : (
        <button style={{ fontSize: '0.78rem', padding: '0.3rem 0.8rem', width: '100%' }} disabled={starting} onClick={onAdd}>
          {starting ? '…' : 'Add'}
        </button>
      )}
    </div>
  )
}

function Templates() {
  const { session } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  usePageTitle('Templates')

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchText, setSearchText] = useState('')
  const [startingSlug, setStartingSlug] = useState(null)
  const [myFormsBySlug, setMyFormsBySlug] = useState({}) // { [templateSlug]: primaryFormId }, most recent instance
  const [editingTemplate, setEditingTemplate] = useState(null) // null = closed, {} = new (template edits/deletes happen elsewhere in admin)
  const [locationModalTemplate, setLocationModalTemplate] = useState(null) // template awaiting a location name for its first location
  const [locationNameInput, setLocationNameInput] = useState('')
  const [creatingLocation, setCreatingLocation] = useState(false)
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
  // or a single-form template's own form), that's the one worth going
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
  // "$employees" pointing at another entry's `key`, those don't have real
  // ids until the forms are actually created, so this resolves them after
  // insert instead of the template storing real (and reusable) form ids.
  //
  // The bundle's first entry becomes the "primary" form: the one that
  // shows up in the main Home list. Every other entry gets settings.
  // primaryFormId pointing back at it, which Home filters out of the list
  // entirely (they'd otherwise clutter it as extra, mostly-internal cards,
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

  // Bundle templates (multi-form, e.g. Employees + Salary Events) keep the
  // old single-instance behavior - locations are a per-form concept, and a
  // bundle is already several linked forms, so layering locations on top
  // of that is its own project, not folded in here.
  async function startTemplate(template) {
    setStartingSlug(template.slug)
    try {
      if (template.bundle?.length > 0) {
        const createdByKey = await startBundleTemplate(template)
        showToast(`"${template.name}" created: ${template.bundle.length} forms set up and linked.`, 'success')
        const primaryFormId = createdByKey[template.bundle[0].key]
        // Payroll-flavored bundles (settings.payrollRole === 'employees' on
        // the primary entry) have a purpose-built Dashboard, more useful
        // as a landing page than the empty form builder.
        const destination = template.bundle[0].settings?.payrollRole === 'employees'
          ? `/form/${primaryFormId}/payroll?panel=1`
          : `/form/${primaryFormId}/edit?panel=1`
        setMyFormsBySlug(current => ({ ...current, [template.slug]: primaryFormId }))
        navigate(destination)
        return
      }

      // Single-form templates: this is really "add the first location" -
      // TemplateLocations.jsx's own addLocation() handles every location
      // after this one the same way.
      setLocationNameInput(template.name)
      setLocationModalTemplate(template)
    } finally {
      setStartingSlug(null)
    }
  }

  async function confirmCreateFirstLocation(e) {
    e.preventDefault()
    if (!locationNameInput.trim()) return
    setCreatingLocation(true)
    try {
      const form = await createLocationForm({ session, template: locationModalTemplate, locationName: locationNameInput })
      showToast(`"${form.name}" created, customize it now.`, 'success')
      setMyFormsBySlug(current => ({ ...current, [locationModalTemplate.slug]: form.id }))
      const destination = locationDestination(locationModalTemplate, form.id)
      setLocationModalTemplate(null)
      navigate(destination)
    } catch (err) {
      showToast('Could not create this location: ' + err.message, 'error')
    } finally {
      setCreatingLocation(false)
    }
  }

  function manageTemplate(template) {
    if (template.bundle?.length > 0) {
      const formId = myFormsBySlug[template.slug]
      if (!formId) return
      const destination = template.bundle[0]?.settings?.payrollRole === 'employees'
        ? `/form/${formId}/payroll?panel=1`
        : `/form/${formId}/edit?panel=1`
      navigate(destination)
      return
    }
    navigate(`/templates/${template.slug}/locations`)
  }

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <style>{`
        .template-tile { transition: border-color 0.12s ease, box-shadow 0.12s ease; }
        .template-tile:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      `}</style>
      <div className="card" style={{ padding: '1.4rem 1.5rem', marginBottom: '1.2rem', background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-primary-soft) 100%)' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.8rem' }}>
            {inUseTemplates.map(template => (
              <TemplateTile
                key={template.id}
                template={template}
                started
                onManage={() => manageTemplate(template)}
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
              No templates are published yet, check back soon.
            </div>
          )}

          {!loading && templates.length > 0 && visible.length === 0 && (
            <p style={{ color: 'var(--color-muted)' }}>No templates match your search.</p>
          )}

          {!loading && visible.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.8rem' }}>
              {visible.map((template) => (
                <TemplateTile
                  key={template.id}
                  template={template}
                  started={!!myFormsBySlug[template.slug]}
                  starting={startingSlug === template.slug}
                  onAdd={() => startTemplate(template)}
                  onManage={() => manageTemplate(template)}
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

      {locationModalTemplate && (
        <Modal size="sm" onClose={() => setLocationModalTemplate(null)} title="Name this location">
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            "{locationModalTemplate.name}" for e.g. your first branch, shop, or site. You can add more locations later.
          </p>
          <form onSubmit={confirmCreateFirstLocation}>
            <input
              type="text" required autoFocus value={locationNameInput}
              onChange={(e) => setLocationNameInput(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button type="button" className="secondary" onClick={() => setLocationModalTemplate(null)}>Cancel</button>
              <button type="submit" disabled={creatingLocation}>{creatingLocation ? 'Creating...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default Templates
