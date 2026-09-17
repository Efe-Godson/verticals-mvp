import NameInput from './components/NameInput'
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
import ShareModal from './ShareModal'
import Modal from './components/Modal'
import HomeRecycleBinDialog from './HomeRecycleBinDialog'
import { useRecycleBinTrigger } from './RecycleBinContext'
import { categoryColor, CategoryIcon } from './templateVisuals'
import { usePageTitle } from './PageTitleContext'
import { SkeletonCard } from './components/Skeleton'
import { RefreshingIndicator } from './components/InlineLoader'
import { getPageCache, setPageCache } from './hooks/pageCache'
import { ErrorState } from './ErrorState'
import EmptyState from './components/EmptyState'
import { completeOnboardingEntry } from './lib/completeOnboardingEntry'

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
function BusinessTile({ template, displayName, secondaryLabel, role, ownerEmail, onManage, onShare, onRename, onDelete }) {
  const color = categoryColor(template.category)
  const [menuOpen, setMenuOpen] = useState(false)
  const isOwner = role === 'owner'
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
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '160px', overflow: 'hidden'
            }}>
              {!isOwner && (
                <div style={{
                  padding: '0.55rem 0.8rem', fontSize: '0.72rem', color: 'var(--color-muted)', textAlign: 'left',
                  borderBottom: '1px solid var(--color-border)', wordBreak: 'break-word',
                }}>
                  Shared by {ownerEmail}
                </div>
              )}
              {isOwner && (
                <div
                  onClick={() => { setMenuOpen(false); onShare() }}
                  style={{ padding: '0.55rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left' }}
                >
                  Share all locations…
                </div>
              )}
              <div
                onClick={() => { setMenuOpen(false); onRename() }}
                style={{ padding: '0.55rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left' }}
              >
                Rename
              </div>
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
        {displayName}
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

  const [usedTemplates, setUsedTemplates] = useState([]) // [{ template, locationCount, singleFormId, secondaryLabel, ownerId, role, ownerEmail, workflowName }]
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [shareTarget, setShareTarget] = useState(null) // { templateSlug, displayName } | null
  const [renameTarget, setRenameTarget] = useState(null) // { ownerId, template, currentName } | null
  const [renameInput, setRenameInput] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [pendingDeleteKey, setPendingDeleteKey] = useState(null) // "ownerId:slug"
  const [pendingBinConfirm, setPendingBinConfirm] = useState(null) // { type: 'permanentDelete', formId } | { type: 'emptyBin' }
  const [binCount, setBinCount] = useState(0)
  const [showBin, setShowBin] = useState(false)
  const [trashedForms, setTrashedForms] = useState([])
  const [loadingBin, setLoadingBin] = useState(false)

  const cacheKey = session ? `businesses-home:${session.user.id}` : null

  // The one place a workspace picked pre-signup (src/onboarding/
  // OnboardingPage.jsx) actually gets created - see completeOnboardingEntry
  // for why this can't happen until now. This is the first authenticated
  // page every login lands on, so it's the natural place to check once per
  // session; a normal login with nothing pending is a no-op read of an
  // empty sessionStorage key.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    completeOnboardingEntry(session).then(destination => {
      if (!cancelled && destination) navigate(destination, { replace: true })
    })
    return () => { cancelled = true }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTemplates({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setRefreshing(true)
    setError('')
    try {
      // list_accessible_workflows() replaces a plain "my own forms" query -
      // it returns everything this account can reach: workflows owned
      // outright, plus workflows/locations an owner has shared as Admin
      // (Viewer shares are resolved here too, but filtered out below - Home
      // never shows a Viewer-role tile, see RecordsHome.jsx/Reports.jsx for
      // where those surface instead). Grouped by (owner_id, template_slug)
      // rather than template_slug alone, since the same slug (e.g.
      // "restaurant") isn't unique across different owners' accounts.
      const { data: rows, error: rowsError } = await supabase.rpc('list_accessible_workflows')
      if (rowsError) throw rowsError

      const byKey = {} // "ownerId:slug" -> { ownerId, slug, role, ownerEmail, formIds, workflowName }
      ;(rows || []).filter(r => r.role !== 'viewer').forEach(r => {
        byKey[`${r.owner_id}:${r.template_slug}`] = {
          ownerId: r.owner_id, slug: r.template_slug, role: r.role,
          ownerEmail: r.owner_email, formIds: r.form_ids || [], workflowName: r.workflow_name,
        }
      })

      const keys = Object.keys(byKey)
      if (keys.length === 0) {
        setUsedTemplates([])
        setPageCache(cacheKey, [])
        return
      }

      const slugs = [...new Set(Object.values(byKey).map(e => e.slug))]
      const { data: templates, error: templatesError } = await supabase.from('templates').select('*').in('slug', slugs)
      if (templatesError) throw templatesError

      // Each tile's secondary line is whichever count is actually meaningful
      // for that kind of template - staff for the payroll bundle, locations
      // for Retail/Restaurant, otherwise how many responses it's collected.
      const list = (await Promise.all(Object.values(byKey).map(async entry => {
        const template = (templates || []).find(t => t.slug === entry.slug)
        if (!template) return null
        const isBundle = template.bundle?.length > 0
        let secondaryLabel
        if (isBundle) {
          const { count } = await supabase.from('submissions').select('id', { count: 'exact', head: true })
            .eq('form_id', entry.formIds[0]).is('deleted_at', null)
          secondaryLabel = `${count || 0} staff`
        } else if (usesLocationCount(template.category)) {
          secondaryLabel = `${entry.formIds.length} location${entry.formIds.length !== 1 ? 's' : ''}`
        } else {
          const { count } = await supabase.from('submissions').select('id', { count: 'exact', head: true })
            .in('form_id', entry.formIds).is('deleted_at', null)
          secondaryLabel = `${count || 0} response${count === 1 ? '' : 's'}`
        }
        return {
          template, locationCount: entry.formIds.length, singleFormId: entry.formIds[0], formIds: entry.formIds,
          secondaryLabel, ownerId: entry.ownerId, role: entry.role, ownerEmail: entry.ownerEmail,
          workflowName: entry.workflowName,
        }
      }))).filter(Boolean)
      setUsedTemplates(list)
      setPageCache(cacheKey, list)
    } catch (err) {
      // A cached view (if any) stays on screen - see the effect below,
      // which only shows this ErrorState when there was nothing to fall
      // back to.
      setError(err.message || 'Could not load your businesses.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadBinCount() {
    const { count } = await supabase
      .from('forms').select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .not('deleted_at', 'is', null)
    setBinCount(count || 0)
  }

  useEffect(() => {
    if (!session) return
    const cached = getPageCache(cacheKey)
    if (cached) {
      setUsedTemplates(cached)
      setLoading(false)
      loadTemplates({ quiet: true })
    } else {
      loadTemplates()
    }
    loadBinCount()
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Deletes every location under this workflow, not just entry.singleFormId -
  // a tile can stand for several locations at once (Restaurant, Retail),
  // and "Delete" on the tile has to mean all of them or it'd silently only
  // remove one while claiming to have deleted "the business". Keyed by
  // ownerId+slug (not slug alone) since Home can now show another owner's
  // workflow (shared as Admin) alongside one of my own at the same slug.
  async function performDeleteBusiness() {
    const key = pendingDeleteKey
    setPendingDeleteKey(null)
    const entry = usedTemplates.find(u => `${u.ownerId}:${u.template.slug}` === key)
    if (!entry) return
    const { error } = await supabase.from('forms').update({ deleted_at: new Date().toISOString() }).in('id', entry.formIds)
    if (error) {
      showToast('Could not delete: ' + error.message, 'error')
      return
    }
    setUsedTemplates(current => current.filter(u => `${u.ownerId}:${u.template.slug}` !== key))
    setBinCount(count => count + entry.formIds.length)
    showToast(`"${entry.template.name}" moved to Recycle Bin.`, 'success')
  }

  function openRenameModal(entry) {
    setRenameInput(entry.workflowName || entry.template.name)
    setRenameTarget(entry)
  }

  // Blank, or typing the template's own name back, clears the override
  // (deletes the row) instead of storing a redundant one - workflow_names
  // having no row for this (owner, slug) is exactly what "use the template's
  // default name" means server-side too, see list_accessible_workflows().
  async function saveWorkflowName(e) {
    e.preventDefault()
    const entry = renameTarget
    const trimmed = renameInput.trim()
    setRenaming(true)
    try {
      if (!trimmed || trimmed === entry.template.name) {
        const { error } = await supabase.from('workflow_names')
          .delete().eq('owner_id', entry.ownerId).eq('template_slug', entry.template.slug)
        if (error) throw new Error(error.message)
        setUsedTemplates(current => current.map(u =>
          u.ownerId === entry.ownerId && u.template.slug === entry.template.slug ? { ...u, workflowName: null } : u
        ))
      } else {
        const { error } = await supabase.from('workflow_names').upsert(
          { owner_id: entry.ownerId, template_slug: entry.template.slug, display_name: trimmed, updated_at: new Date().toISOString() },
          { onConflict: 'owner_id,template_slug' }
        )
        if (error) throw new Error(error.message)
        setUsedTemplates(current => current.map(u =>
          u.ownerId === entry.ownerId && u.template.slug === entry.template.slug ? { ...u, workflowName: trimmed } : u
        ))
      }
      setRenameTarget(null)
      showToast('Renamed.', 'success')
    } catch (err) {
      showToast('Could not rename: ' + err.message, 'error')
    } finally {
      setRenaming(false)
    }
  }

  function manage({ template, singleFormId, ownerId, role }) {
    if (template.bundle?.length > 0) {
      const destination = template.bundle[0]?.settings?.payrollRole === 'employees'
        ? `/form/${singleFormId}/payroll?panel=1`
        : `/form/${singleFormId}/edit?panel=1`
      navigate(destination)
      return
    }
    // Own workflows keep the clean URL - ?owner= is only added once this
    // tile stands for someone else's workflow (an Admin share), so
    // TemplateLocations.jsx knows whose locations to load.
    const ownerParam = role === 'owner' ? '' : `?owner=${ownerId}`
    navigate(`/templates/${template.slug}/locations${ownerParam}`)
  }

  // Split by role, not just "everything usedTemplates returns" - a workflow
  // shared with you (Admin role) isn't yours to count toward your own
  // workflow/location totals or to offer the "+ Add a template" tile
  // under, so it gets its own section instead of blending into "Your
  // Workflows" the way it used to (with just a "Shared by" caption on the
  // tile - see BusinessTile's dropdown for where that moved).
  const myTemplates = usedTemplates.filter(u => u.role === 'owner')
  const sharedTemplates = usedTemplates.filter(u => u.role !== 'owner')
  const workflowCount = myTemplates.length
  const locationTotal = myTemplates.reduce((sum, u) => sum + (u.template.bundle?.length > 0 ? 0 : u.locationCount), 0)

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <style>{`
        .template-tile { transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease; }
        .template-tile:hover { border-color: var(--color-primary); box-shadow: 0 4px 14px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .template-tile:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      `}</style>

      {!loading && myTemplates.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.7rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
              Your Workflows
            </span>
            <RefreshingIndicator show={refreshing} />
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
            {workflowCount} workflow{workflowCount !== 1 ? 's' : ''} · {locationTotal} location{locationTotal !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem' }} aria-busy="true">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} lines={2} style={{ minHeight: '160px' }} />)}
        </div>
      ) : error && usedTemplates.length === 0 ? (
        <ErrorState message={error} onRetry={() => loadTemplates()} />
      ) : myTemplates.length === 0 ? (
        <EmptyState
          title="Set up your first workflow"
          message="Pick a template to start collecting records, tracking sales, or running payroll - everything else builds on top of it."
          action={<button onClick={() => navigate('/templates')}>Choose a template</button>}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem' }}>
          {myTemplates.map((entry) => {
            const { template, secondaryLabel, singleFormId, ownerId, role, ownerEmail, workflowName } = entry
            return (
            <BusinessTile
              key={`${ownerId}:${template.slug}`}
              template={template}
              displayName={workflowName || template.name}
              secondaryLabel={secondaryLabel}
              role={role}
              ownerEmail={ownerEmail}
              onManage={() => manage({ template, singleFormId, ownerId, role })}
              onShare={() => setShareTarget({ templateSlug: template.slug, displayName: workflowName || template.name })}
              onRename={() => openRenameModal(entry)}
              onDelete={() => setPendingDeleteKey(`${ownerId}:${template.slug}`)}
            />
            )
          })}
          <AddTemplateTile />
        </div>
      )}

      {!loading && sharedTemplates.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginTop: '1.6rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
              Shared with me
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem' }}>
            {sharedTemplates.map((entry) => {
              const { template, secondaryLabel, singleFormId, ownerId, role, ownerEmail, workflowName } = entry
              return (
              <BusinessTile
                key={`${ownerId}:${template.slug}`}
                template={template}
                displayName={workflowName || template.name}
                secondaryLabel={secondaryLabel}
                role={role}
                ownerEmail={ownerEmail}
                onManage={() => manage({ template, singleFormId, ownerId, role })}
                onShare={() => setShareTarget({ templateSlug: template.slug, displayName: workflowName || template.name })}
                onRename={() => openRenameModal(entry)}
                onDelete={() => setPendingDeleteKey(`${ownerId}:${template.slug}`)}
              />
              )
            })}
          </div>
        </>
      )}

      {pendingDeleteKey && (() => {
        const entry = usedTemplates.find(u => `${u.ownerId}:${u.template.slug}` === pendingDeleteKey)
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
            onCancel={() => setPendingDeleteKey(null)}
          />
        )
      })()}

      {shareTarget && (
        <ShareModal
          scope="workflow"
          templateSlug={shareTarget.templateSlug}
          displayName={shareTarget.displayName}
          onClose={() => setShareTarget(null)}
        />
      )}

      {renameTarget && (
        <Modal size="sm" onClose={() => setRenameTarget(null)} title="Rename this workflow">
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            Shown here on Home instead of "{renameTarget.template.name}". Leave it as the template's own name to clear this.
          </p>
          <form onSubmit={saveWorkflowName}>
            <NameInput
              type="text" autoFocus value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder={renameTarget.template.name}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button type="button" className="secondary" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button type="submit" disabled={renaming}>{renaming ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
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
