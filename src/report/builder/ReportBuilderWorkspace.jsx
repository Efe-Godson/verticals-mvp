// Place at: src/report/builder/ReportBuilderWorkspace.jsx
// Route: /form/:id/report/builder. The contained analytical workspace
// (brief §3): full-bleed, its own chrome, three panels - Data | Canvas |
// Catalogue+Configure. Replaces the old single-widget ReportBuilder.jsx.
import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../../Toast'
import { LoadingState } from '../../LoadingState'
import { ErrorState } from '../../ErrorState'
import { runQuery } from '../engine'
import { useReportBuilder } from './useReportBuilder'
import DataPanel from './DataPanel'
import VisualCatalog from './VisualCatalog'
import ConfigPanel from './ConfigPanel'
import BuilderCanvas from './BuilderCanvas'
import BuilderFilterBar from './BuilderFilterBar'
import EmptyState from './EmptyState'
import ViewDataModal from './ViewDataModal'

export default function ReportBuilderWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const rb = useReportBuilder(id)
  const [selectedId, setSelectedId] = useState(null)
  const [viewDataId, setViewDataId] = useState(null)
  const [mobilePane, setMobilePane] = useState(null) // 'data' | 'build' | null
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (selectedId && !rb.visuals.some(v => v.id === selectedId)) setSelectedId(null)
  }, [rb.visuals, selectedId])

  const results = useMemo(() => {
    const out = {}
    for (const v of rb.visuals) {
      try {
        out[v.id] = runQuery(
          { ...v.query, filters: v.filters },
          { form: rb.form, submissions: rb.scopedSubmissions, previousSubmissions: rb.previousSubmissions },
        )
      } catch (err) {
        out[v.id] = null
        if (import.meta.env.DEV) console.error('runQuery failed for', v.id, err)
      }
    }
    return out
  }, [rb.visuals, rb.form, rb.scopedSubmissions, rb.previousSubmissions])

  if (rb.loading) return <LoadingState label="Loading Report Builder..." />
  if (rb.error && !rb.form) return <ErrorState message={rb.error} />

  const selected = rb.visuals.find(v => v.id === selectedId) || null

  function handleSelect(vid, dp) {
    setSelectedId(vid)
    if (dp) rb.updateVisual(vid, { selectedDatapoint: dp })
  }
  function addVisual(type) {
    const newId = rb.addVisual(type)
    setSelectedId(newId)
    setMobilePane(null)
  }
  async function handleSave() {
    const { error } = await rb.save()
    showToast(error ? 'Could not save workspace.' : 'Workspace saved.', error ? 'error' : 'success')
  }
  function handlePromote(vid) {
    rb.promote(vid)
    showToast('Promoted to Reports.', 'success')
  }
  function handleDemote(vid) {
    rb.demote(vid)
    showToast('Removed from Reports.', 'info')
  }

  const RIGHT = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ overflowY: 'auto', borderBottom: '1px solid var(--color-border)', flexShrink: 0, maxHeight: '46%' }}>
        <VisualCatalog onAdd={addVisual} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ConfigPanel
          visual={selected}
          form={rb.form}
          onQuery={patch => rb.updateVisualQuery(selectedId, patch)}
          onVisual={patch => rb.updateVisual(selectedId, patch)}
          onViewData={() => setViewDataId(selectedId)}
          onPromote={() => handlePromote(selectedId)}
          onDemote={() => handleDemote(selectedId)}
        />
      </div>
    </div>
  )

  return (
    <div className="rb-workspace" style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      <style>{`
        .rb-workspace .rb-canvas .react-grid-item.react-grid-placeholder { background: var(--color-primary); opacity: 0.18; border-radius: var(--radius); }
        .rb-cols { display: grid; grid-template-columns: 232px 1fr 316px; flex: 1; min-height: 0; }
        .rb-cols > * { min-height: 0; overflow: hidden; }
        .rb-side { background: var(--color-surface); }
        @media (max-width: 900px) { .rb-cols { grid-template-columns: 1fr; } .rb-side { display: none; } }
      `}</style>

      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.9rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
        <button className="secondary" onClick={() => navigate(`/form/${id}/report`)} style={{ fontSize: '0.82rem' }}>← Exit Builder</button>
        <strong style={{ letterSpacing: '0.06em', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Report Builder</strong>
        <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rb.form?.name}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
          <button className="secondary" onClick={() => setPreview(p => !p)} style={{ fontSize: '0.82rem' }}>{preview ? 'Edit' : 'Preview'}</button>
          <button onClick={handleSave} disabled={rb.saving} style={{ fontSize: '0.82rem' }}>
            {rb.saving ? 'Saving…' : rb.dirty ? 'Save*' : 'Save'}
          </button>
        </div>
      </div>

      {/* mobile pane toggles */}
      <div className="rb-mobile-tabs" style={{ display: 'none' }} />

      <BuilderFilterBar form={rb.form} filters={rb.builderFilters} onChange={rb.setBuilderFilters} />

      <div className="rb-cols">
        {!preview && <div className="rb-side" style={{ borderRight: '1px solid var(--color-border)' }}><DataPanel form={rb.form} /></div>}

        <div style={{ overflow: 'auto', position: 'relative' }}>
          {rb.visuals.length === 0 ? (
            <EmptyState onAddVisual={() => addVisual('bar')} onAddPivot={() => addVisual('pivot')} />
          ) : (
            <BuilderCanvas
              visuals={rb.visuals}
              results={results}
              form={rb.form}
              selectedId={selectedId}
              onSelect={handleSelect}
              onLayoutChange={layout => rb.setCanvasLayout(layout)}
              onConfigure={vid => { setSelectedId(vid); setMobilePane('build') }}
              onDuplicate={rb.duplicateVisual}
              onRemove={vid => { rb.removeVisual(vid); if (selectedId === vid) setSelectedId(null) }}
              onViewData={setViewDataId}
              onPromote={handlePromote}
              onDemote={handleDemote}
              onClearDatapoint={vid => rb.updateVisual(vid, { selectedDatapoint: null })}
            />
          )}
        </div>

        {!preview && <div className="rb-side" style={{ borderLeft: '1px solid var(--color-border)' }}>{RIGHT}</div>}
      </div>

      {/* mobile drawer for build panel */}
      {mobilePane === 'build' && (
        <div onClick={() => setMobilePane(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 120, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="rb-side" style={{ width: '100%', maxHeight: '85vh', borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {RIGHT}
          </div>
        </div>
      )}

      {/* mobile: floating add button */}
      <button
        className="rb-fab"
        onClick={() => setMobilePane('build')}
        style={{ position: 'fixed', right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))', display: 'none', zIndex: 110, borderRadius: 999, padding: '0.7rem 1.1rem', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}
      >
        Configure
      </button>
      <style>{`@media (max-width: 900px) { .rb-fab { display: block !important; } }`}</style>

      {viewDataId && (
        <ViewDataModal
          visual={rb.visuals.find(v => v.id === viewDataId)}
          result={results[viewDataId]}
          form={rb.form}
          submissions={rb.submissions}
          onClose={() => setViewDataId(null)}
        />
      )}
    </div>
  )
}
