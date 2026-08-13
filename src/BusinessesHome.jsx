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

// Bundle templates (Employees + Salary Events, etc.) have no Locations
// sub-page of their own - there's only ever the one form - so deleting
// them has to happen right here instead. Regular templates delete their
// individual locations from TemplateLocations.jsx instead, since a
// business tile here can represent several of them at once.
function BusinessTile({ template, locationCount, onManage, onDelete }) {
  const color = categoryColor(template.category)
  const isBundle = template.bundle?.length > 0
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div
      className="template-tile"
      onClick={onManage}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onManage() } }}
      style={{
        position: 'relative', aspectRatio: '1', border: '1px solid var(--color-border)', borderRadius: '12px',
        background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '0.4rem', padding: '0.9rem', textAlign: 'center', cursor: 'pointer'
      }}
    >
      {isBundle && (
        <div style={{ position: 'absolute', top: '0.4rem', right: '0.4rem' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            title="More options"
            aria-label="More options"
            style={{
              width: '24px', height: '24px', padding: 0,
              borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-muted)',
              fontSize: '1rem', lineHeight: 1, cursor: 'pointer'
            }}
          >
            ⋮
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setMenuOpen(false)} />
              <div className="dropdown-panel" style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '0.2rem',
                background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
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
      )}
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
      {locationCount > 0 && (
        <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
          {locationCount} location{locationCount !== 1 ? 's' : ''}
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
        aspectRatio: '1', border: '1.5px dashed var(--color-border)', borderRadius: '12px',
        background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '0.4rem', padding: '0.9rem', color: 'var(--color-muted)',
        textDecoration: 'none'
      }}
    >
      <span style={{ fontSize: '1.4rem', lineHeight: 1, fontWeight: 700 }}>+</span>
      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Add Template</span>
    </Link>
  )
}

function BusinessesHome() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { setTrigger } = useRecycleBinTrigger()

  const [usedTemplates, setUsedTemplates] = useState([]) // [{ template, locationCount, singleFormId, isBundle }]
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

    const bySlug = {} // slug -> { count, firstFormId }
    ;(forms || []).forEach(f => {
      const slug = f.settings?.templateSlug
      if (!slug) return
      if (!bySlug[slug]) bySlug[slug] = { count: 0, firstFormId: f.id }
      bySlug[slug].count += 1
    })

    const slugs = Object.keys(bySlug)
    if (slugs.length === 0) {
      setUsedTemplates([])
      setLoading(false)
      return
    }

    const { data: templates } = await supabase.from('templates').select('*').in('slug', slugs)
    const list = (templates || []).map(template => ({
      template,
      locationCount: bySlug[template.slug].count,
      singleFormId: bySlug[template.slug].firstFormId,
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

  async function performDeleteBusiness() {
    const slug = pendingDeleteSlug
    setPendingDeleteSlug(null)
    const entry = usedTemplates.find(u => u.template.slug === slug)
    if (!entry) return
    const { error } = await supabase.from('forms').update({ deleted_at: new Date().toISOString() }).eq('id', entry.singleFormId)
    if (error) {
      showToast('Could not delete: ' + error.message, 'error')
      return
    }
    setUsedTemplates(current => current.filter(u => u.template.slug !== slug))
    setBinCount(count => count + 1)
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

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <style>{`
        .template-tile { transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease; }
        .template-tile:hover { border-color: var(--color-primary); box-shadow: 0 4px 14px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .template-tile:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
        <h1 style={{ margin: 0 }}>Your Businesses</h1>
      </div>
      <p style={{ color: 'var(--color-muted)', marginTop: 0, marginBottom: '1.5rem' }}>
        Everything you've set up from a template, in one place.
      </p>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.8rem' }}>
          {[0, 1, 2].map(i => <div key={i} className="card" style={{ aspectRatio: '1' }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.8rem' }}>
          {usedTemplates.map(({ template, locationCount, singleFormId }) => (
            <BusinessTile
              key={template.slug}
              template={template}
              locationCount={template.bundle?.length > 0 ? 0 : locationCount}
              onManage={() => manage({ template, singleFormId })}
              onDelete={() => setPendingDeleteSlug(template.slug)}
            />
          ))}
          <AddTemplateTile />
        </div>
      )}

      {pendingDeleteSlug && (
        <ConfirmDialog
          title="Move this business to the Recycle Bin?"
          message="You can restore it later from the Recycle Bin."
          confirmLabel="Move to Bin"
          onConfirm={performDeleteBusiness}
          onCancel={() => setPendingDeleteSlug(null)}
        />
      )}

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
