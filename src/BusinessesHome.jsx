// Place at: src/BusinessesHome.jsx
// The landing page after login: one tile per template you've actually put
// to use (grouped by settings.templateSlug across however many locations
// you've added), plus "+ Add Template" into the full gallery for starting
// a new one. Clicking a used template goes to its locations page (or,
// for bundle templates, straight to the one instance they still have).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'
import ConfirmDialog from './ConfirmDialog'
import HomeRecycleBinDialog from './HomeRecycleBinDialog'
import { useRecycleBinTrigger } from './RecycleBinContext'
import { categoryColor, CategoryIcon } from './templateVisuals'
import { usePageTitle } from './PageTitleContext'

// Retail/Restaurant are the only categories where "how many locations" is
// itself the meaningful fact about the business - every other template is
// a single workflow, so its card shows how much has been put into it
// (response/staff count) instead of a location count that's almost always 1.
function usesLocationCount(category) {
  return category === 'Retail' || category === 'Restaurant'
}

// Every used-template tile gets the same ⋮ menu now (previously only the
// payroll bundle did, since deleting a multi-location template used to only
// ever touch its first form - see performDeleteBusiness's formIds.in(...)
// batch below, which is what makes "Delete" a well-defined single action
// here even when a tile stands for several locations at once).
function BusinessTile({ template, secondaryLabel, onManage, onDelete }) {
  const color = categoryColor(template.category)
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div
      className="template-tile"
      onClick={onManage}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onManage() } }}
      style={{
        position: 'relative', border: '1px solid var(--color-border)', borderRadius: '12px',
        background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '1.1rem 0.9rem 0.9rem', textAlign: 'center', cursor: 'pointer'
      }}
    >
      <div style={{ position: 'absolute', top: 0, right: 0 }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          title="More options"
          aria-label="More options"
          style={{
            width: '44px', height: '44px', padding: 0,
            border: 'none', background: 'transparent', color: 'var(--color-muted)',
            fontSize: '1.1rem', lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ⋮
        </button>
        {menuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setMenuOpen(false)} />
            <div className="dropdown-panel" style={{
              position: 'absolute', top: '100%', right: '0.4rem', marginTop: '-0.3rem',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '130px', overflow: 'hidden'
            }}>
              <div
                onClick={() => { setMenuOpen(false); onDelete() }}
                style={{ padding: '0.55rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer', color: '#c0392b', textAlign: 'left' }}
              >
                Delete
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{
        width: '42px', height: '42px', borderRadius: '10px', background: `${color}16`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.9rem'
      }}>
        <CategoryIcon category={template.category} color={color} />
      </div>
      <span style={{
        fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.25, marginBottom: '0.35rem',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>
        {template.name}
      </span>
      {secondaryLabel && (
        <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
          {secondaryLabel}
        </span>
      )}
    </div>
  )
}

function AddTemplateTile() {
  return (
    <Link
      to="/templates"
      className="template-tile"
      style={{
        gridColumn: '1 / -1', border: '1.5px dashed var(--color-border)', borderRadius: '12px',
        background: 'transparent', display: 'flex', alignItems: 'center', gap: '0.7rem',
        padding: '0.9rem 1rem', color: 'var(--color-muted)', textDecoration: 'none'
      }}
    >
      <span style={{
        width: '32px', height: '32px', borderRadius: '8px', border: '1.5px dashed var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 700, flexShrink: 0,
      }}>
        +
      </span>
      <span style={{ textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Add a template</span>
        <span style={{ display: 'block', fontSize: '0.75rem' }}>Create another workflow</span>
      </span>
    </Link>
  )
}

function BusinessesHome() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { setTrigger } = useRecycleBinTrigger()
  usePageTitle('Home')

  const [usedTemplates, setUsedTemplates] = useState([]) // [{ template, locationCount, singleFormId, secondaryLabel }]
  const [loading, setLoading] = useState(true)

  const [pendingDeleteSlug, setPendingDeleteSlug] = useState(null)
  const [pendingBinConfirm, setPendingBinConfirm] = useState(null) // { type: 'permanentDelete', formId } | { type: 'emptyBin' }
  const [binCount, setBinCount] = useState(0)
  const [showBin, setShowBin] = useState(false)
  const [trashedForms, setTrashedForms] = useState([])
  const [loadingBin, setLoadingBin] = useState(false)

  async function loadTemplates() {
    setLoading(true)
    const { data: forms } = await supabase
      .from('forms').select('id, settings')
      .eq('user_id', session.user.id)
      .is('deleted_at', null)
      .not('settings->>templateSlug', 'is', null)
      .is('settings->>primaryFormId', null)

    const bySlug = {} // slug -> { count, firstFormId, formIds }
    ;(forms || []).forEach(f => {
      const slug = f.settings?.templateSlug
      if (!slug) return
      if (!bySlug[slug]) bySlug[slug] = { count: 0, firstFormId: f.id, formIds: [] }
      bySlug[slug].count += 1
      bySlug[slug].formIds.push(f.id)
    })

    const slugs = Object.keys(bySlug)
    if (slugs.length === 0) {
      setUsedTemplates([])
      setLoading(false)
      return
    }

    const { data: templates } = await supabase.from('templates').select('*').in('slug', slugs)

    // Each tile's secondary line is whichever count is actually meaningful
    // for that kind of template - staff for the payroll bundle, locations
    // for Retail/Restaurant, otherwise how many responses it's collected.
    const list = await Promise.all((templates || []).map(async template => {
      const entry = bySlug[template.slug]
      const isBundle = template.bundle?.length > 0
      let secondaryLabel
      if (isBundle) {
        const { count } = await supabase.from('submissions').select('id', { count: 'exact', head: true })
          .eq('form_id', entry.firstFormId).is('deleted_at', null)
        secondaryLabel = `${count || 0} staff`
      } else if (usesLocationCount(template.category)) {
        secondaryLabel = `${entry.count} location${entry.count !== 1 ? 's' : ''}`
      } else {
        const { count } = await supabase.from('submissions').select('id', { count: 'exact', head: true })
          .in('form_id', entry.formIds).is('deleted_at', null)
        secondaryLabel = `${count || 0} response${count === 1 ? '' : 's'}`
      }
      return { template, locationCount: entry.count, singleFormId: entry.firstFormId, formIds: entry.formIds, secondaryLabel }
    }))
    setUsedTemplates(list)
    setLoading(false)
  }

  async function loadBinCount() {
    const { count } = await supabase
      .from('forms').select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .not('deleted_at', 'is', null)
    setBinCount(count || 0)
  }

  useEffect(() => {
    loadTemplates()
    loadBinCount()
  }, [session])

  // Publishes the bin's open handler + count to NavBar, same pattern as
  // Home.jsx/TemplateLocations.jsx - whichever of these is mounted owns it.
  useEffect(() => {
    setTrigger({ onOpen: openBin, count: binCount })
    return () => setTrigger(null)
  }, [binCount])

  async function openBin() {
    setShowBin(true)
    setLoadingBin(true)
    const { data } = await supabase
      .from('forms').select('id, name, settings, deleted_at')
      .eq('user_id', session.user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setTrashedForms(data || [])
    setLoadingBin(false)
  }

  async function restoreForm(formId) {
    const { error } = await supabase.from('forms').update({ deleted_at: null }).eq('id', formId)
    if (error) {
      showToast('Could not restore: ' + error.message, 'error')
      return
    }
    setTrashedForms(current => current.filter(f => f.id !== formId))
    setBinCount(count => Math.max(0, count - 1))
    showToast('Restored.', 'success')
    loadTemplates()
  }

  async function performPermanentDelete(formId) {
    const { error } = await supabase.from('forms').delete().eq('id', formId)
    if (error) {
      showToast('Could not permanently delete: ' + error.message, 'error')
      return
    }
    setTrashedForms(current => current.filter(f => f.id !== formId))
    setBinCount(count => Math.max(0, count - 1))
    showToast('Permanently deleted.', 'success')
  }

  async function performEmptyBin() {
    const ids = trashedForms.map(f => f.id)
    if (ids.length === 0) return
    const { error } = await supabase.from('forms').delete().in('id', ids)
    if (error) {
      showToast('Could not empty the bin: ' + error.message, 'error')
      return
    }
    setTrashedForms([])
    setBinCount(0)
    showToast('Recycle Bin emptied.', 'success')
  }

  function handleBinConfirm() {
    const confirm = pendingBinConfirm
    setPendingBinConfirm(null)
    if (!confirm) return
    if (confirm.type === 'permanentDelete') performPermanentDelete(confirm.formId)
    else if (confirm.type === 'emptyBin') performEmptyBin()
  }

  // Deletes every location under this slug, not just entry.singleFormId -
  // a tile can stand for several locations at once (Restaurant, Retail),
  // and "Delete" on the tile has to mean all of them or it'd silently only
  // remove one while claiming to have deleted "the business".
  async function performDeleteBusiness() {
    const slug = pendingDeleteSlug
    setPendingDeleteSlug(null)
    const entry = usedTemplates.find(u => u.template.slug === slug)
    if (!entry) return
    const { error } = await supabase.from('forms').update({ deleted_at: new Date().toISOString() }).in('id', entry.formIds)
    if (error) {
      showToast('Could not delete: ' + error.message, 'error')
      return
    }
    setUsedTemplates(current => current.filter(u => u.template.slug !== slug))
    setBinCount(count => count + entry.formIds.length)
    showToast(`"${entry.template.name}" moved to Recycle Bin.`, 'success')
  }

  function manage({ template, singleFormId }) {
    if (template.bundle?.length > 0) {
      const destination = template.bundle[0]?.settings?.payrollRole === 'employees'
        ? `/form/${singleFormId}/payroll?panel=1`
        : `/form/${singleFormId}/edit?panel=1`
      navigate(destination)
      return
    }
    navigate(`/templates/${template.slug}/locations`)
  }

  const workflowCount = usedTemplates.length
  const locationTotal = usedTemplates.reduce((sum, u) => sum + (u.template.bundle?.length > 0 ? 0 : u.locationCount), 0)

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <style>{`
        .template-tile { transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease; }
        .template-tile:hover { border-color: var(--color-primary); box-shadow: 0 4px 14px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .template-tile:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      `}</style>

      {!loading && usedTemplates.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
            Your Workflows
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
            {workflowCount} workflow{workflowCount !== 1 ? 's' : ''} · {locationTotal} location{locationTotal !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem' }}>
          {[0, 1, 2].map(i => <div key={i} className="card" style={{ minHeight: '160px' }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem' }}>
          {usedTemplates.map(({ template, secondaryLabel, singleFormId }) => (
            <BusinessTile
              key={template.slug}
              template={template}
              secondaryLabel={secondaryLabel}
              onManage={() => manage({ template, singleFormId })}
              onDelete={() => setPendingDeleteSlug(template.slug)}
            />
          ))}
          <AddTemplateTile />
        </div>
      )}

      {pendingDeleteSlug && (() => {
        const entry = usedTemplates.find(u => u.template.slug === pendingDeleteSlug)
        const locationCount = entry?.formIds?.length ?? 1
        return (
          <ConfirmDialog
            title="Move this business to the Recycle Bin?"
            message={
              locationCount > 1
                ? `This moves all ${locationCount} locations of "${entry.template.name}" to the Recycle Bin. You can restore them later.`
                : 'You can restore it later from the Recycle Bin.'
            }
            confirmLabel="Move to Bin"
            onConfirm={performDeleteBusiness}
            onCancel={() => setPendingDeleteSlug(null)}
          />
        )
      })()}

      {showBin && (
        <HomeRecycleBinDialog
          forms={trashedForms}
          loading={loadingBin}
          onRestore={restoreForm}
          onPermanentDelete={(formId) => setPendingBinConfirm({ type: 'permanentDelete', formId })}
          onEmptyBin={() => trashedForms.length > 0 && setPendingBinConfirm({ type: 'emptyBin' })}
          onClose={() => setShowBin(false)}
        />
      )}

      {pendingBinConfirm && (
        <ConfirmDialog
          title={pendingBinConfirm.type === 'emptyBin' ? 'Empty Recycle Bin?' : 'Permanently delete this form?'}
          message={
            pendingBinConfirm.type === 'emptyBin'
              ? `Permanently delete all ${trashedForms.length} form(s) in the bin, along with their records? This cannot be undone.`
              : 'This will permanently delete this form and all of its records. This cannot be undone.'
          }
          confirmLabel="Delete"
          danger
          onConfirm={handleBinConfirm}
          onCancel={() => setPendingBinConfirm(null)}
        />
      )}
    </div>
  )
}

export default BusinessesHome
