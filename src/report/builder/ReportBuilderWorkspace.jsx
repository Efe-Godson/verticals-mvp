// Place at: src/report/builder/ReportBuilderWorkspace.jsx
// Route: /form/:id/report/builder. The contained analytical workspace
// (brief §3): full-bleed, its own chrome, three panels - Data | Canvas |
// Catalogue+Configure. On a phone (brief §22) the canvas goes full-width
// and single-column; Data, the Visual Catalogue and Configure each open
// from a bottom toolbar as a drawer / sheet.
import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../../Toast'
import PageSkeleton from '../../components/PageSkeleton'
import { ErrorState } from '../../ErrorState'
import useIsMobile from '../../hooks/useIsMobile'
import { runQuery } from '../engine'
import { useReportBuilder } from './useReportBuilder'
import DataPanel from './DataPanel'
import VisualCatalog from './VisualCatalog'
import ConfigPanel from './ConfigPanel'
import BuilderCanvas from './BuilderCanvas'
import BuilderFilterBar from './BuilderFilterBar'
import EmptyState from './EmptyState'
import ViewDataModal from './ViewDataModal'
import DatasetTableModal from './DatasetTableModal'

export default function ReportBuilderWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const rb = useReportBuilder(id)
  const isMobile = useIsMobile(900)
  const [selectedId, setSelectedId] = useState(null)
  const [viewDataId, setViewDataId] = useState(null)
  const [showDataset, setShowDataset] = useState(false)
  const [mobilePane, setMobilePane] = useState(null) // 'data' | 'catalog' | 'config' | null
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (selectedId && !rb.visuals.some(v => v.id === selectedId)) setSelectedId(null)
  }, [rb.visuals, selectedId])

  useEffect(() => { if (!isMobile) setMobilePane(null) }, [isMobile])

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

  if (rb.loading) return <PageSkeleton variant="report" />
  if (rb.error && !rb.form) return <ErrorState message={rb.error} />

  const selected = rb.visuals.find(v => v.id === selectedId) || null

  function handleSelect(vid, dp) {
    setSelectedId(vid)
    if (dp) rb.updateVisual(vid, { selectedDatapoint: dp })
  }
  function addVisual(type) {
    const newId = rb.addVisual(type)
    setSelectedId(newId)
    setMobilePane(isMobile ? 'config' : null)
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

  const configPanel = (
    <ConfigPanel
      visual={selected}
      form={rb.form}
      onQuery={patch => rb.updateVisualQuery(selectedId, patch)}
      onVisual={patch => rb.updateVisual(selectedId, patch)}
      onViewData={() => setViewDataId(selectedId)}
      onPromote={() => handlePromote(selectedId)}
      onDemote={() => handleDemote(selectedId)}
    />
  )

  const RIGHT = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ overflowY: 'auto', borderBottom: '1px solid var(--color-border)', flexShrink: 0, maxHeight: '46%' }}>
        <VisualCatalog onAdd={addVisual} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>{configPanel}</div>
    </div>
  )

  return (
    <div className="rb-workspace" style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      <style>{`
        .rb-workspace .rb-canvas .react-grid-item.react-grid-placeholder { background: var(--color-primary); opacity: 0.18; border-radius: var(--radius); }
        .rb-cols { display: grid; grid-template-columns: 232px 1fr 316px; flex: 1; min-height: 0; }
        .rb-cols > * { min-height: 0; overflow: hidden; }
        .rb-side { background: var(--color-surface); }
        .rb-mobile-bar { display: none; }
        @media (max-width: 900px) {
          .rb-cols { grid-template-columns: 1fr; }
          .rb-side { display: none; }
          .rb-mobile-bar {
            display: flex; flex-shrink: 0; border-top: 1px solid var(--color-border);
            background: var(--color-surface); padding-bottom: env(safe-area-inset-bottom);
          }
          .rb-mobile-bar button { flex: 1; border-radius: 0; background: var(--color-surface); color: var(--color-text); border: none; font-size: 0.82rem; }
          .rb-drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 120; }
          .rb-drawer-left { position: fixed; top: 0; left: 0; bottom: 0; width: min(280px, 82vw); background: var(--color-surface); z-index: 121; box-shadow: 4px 0 18px rgba(0,0,0,0.2); display: flex; flex-direction: column; }
          .rb-sheet { position: fixed; left: 0; right: 0; bottom: 0; max-height: 85vh; background: var(--color-surface); z-index: 121; border-radius: 16px 16px 0 0; box-shadow: 0 -4px 18px rgba(0,0,0,0.2); display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
        }
      `}</style>

      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.7rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
        <button className="secondary" onClick={() => navigate(`/form/${id}/report`)} style={{ fontSize: '0.8rem', flexShrink: 0 }}>← Exit</button>
        {!isMobile && <strong style={{ letterSpacing: '0.06em', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Report Builder</strong>}
        <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{rb.form?.name}</span>
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          <button className="secondary" onClick={() => setShowDataset(true)} style={{ fontSize: '0.8rem' }}>Data ▤</button>
          <button className="secondary" onClick={() => setPreview(p => !p)} style={{ fontSize: '0.8rem' }}>{preview ? 'Edit' : 'Preview'}</button>
          <button onClick={handleSave} disabled={rb.saving} style={{ fontSize: '0.8rem' }}>
            {rb.saving ? 'Saving…' : rb.dirty ? 'Save*' : 'Save'}
          </button>
        </div>
      </div>

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
              singleColumn={isMobile}
              onSelect={handleSelect}
              onLayoutChange={layout => rb.setCanvasLayout(layout)}
              onConfigure={vid => { setSelectedId(vid); if (isMobile) setMobilePane('config') }}
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

      {/* mobile bottom toolbar */}
      {!preview && (
        <div className="rb-mobile-bar">
          <button onClick={() => setMobilePane('data')}>Data</button>
          <button onClick={() => setMobilePane('catalog')} style={{ borderLeft: '1px solid var(--color-border)' }}>+ Visual</button>
          <button onClick={() => setMobilePane('config')} style={{ borderLeft: '1px solid var(--color-border)' }} disabled={!selected}>Configure</button>
        </div>
      )}

      {mobilePane && (
        <>
          <div className="rb-drawer-backdrop" onClick={() => setMobilePane(null)} />
          {mobilePane === 'data' ? (
            <div className="rb-drawer-left"><DataPanel form={rb.form} /></div>
          ) : (
            <div className="rb-sheet">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--color-border)' }}>
                <strong style={{ fontSize: '0.9rem' }}>{mobilePane === 'catalog' ? 'Add a visual' : 'Configure'}</strong>
                <button className="secondary" style={{ fontSize: '0.8rem' }} onClick={() => setMobilePane(null)}>Done</button>
              </div>
              <div style={{ overflowY: 'auto' }}>
                {mobilePane === 'catalog' ? <VisualCatalog onAdd={addVisual} /> : configPanel}
              </div>
            </div>
          )}
        </>
      )}

      {viewDataId && (
        <ViewDataModal
          visual={rb.visuals.find(v => v.id === viewDataId)}
          result={results[viewDataId]}
          form={rb.form}
          submissions={rb.submissions}
          onClose={() => setViewDataId(null)}
        />
      )}

      {showDataset && (
        <DatasetTableModal
          form={rb.form}
          submissions={rb.submissions}
          onClose={() => setShowDataset(false)}
        />
      )}
    </div>
  )
}
