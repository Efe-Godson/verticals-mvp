// Place at: src/report/PromotedVisuals.jsx
// Rendered additively at the bottom of Report.jsx. Shows the Builder visuals
// the user promoted (reportVisibility), on their own Reports grid
// (reportLayout - separate from the Builder canvas layout). An "Edit Layout"
// toggle turns on move / resize / enlarge / shrink / remove-from-Reports
// without touching the rest of the Reports page.
import { useMemo, useRef, useState } from 'react'
import RGL, { WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { supabase } from '../supabaseClient'
import useIsMobile from '../hooks/useIsMobile'
import { runQuery } from './engine'
import VisualRenderer from './builder/visuals/VisualRenderer'

const Grid = WidthProvider(RGL)

function defaultReportLayout(v, i) {
  const l = v.reportLayout
  if (l && Number.isFinite(l.x) && Number.isFinite(l.y) && Number.isFinite(l.w) && Number.isFinite(l.h)) return l
  return { x: (i % 2) * 6, y: Math.floor(i / 2) * 5, w: 6, h: 5 }
}

export default function PromotedVisuals({ form, submissions }) {
  const [visuals, setVisuals] = useState(() => (form?.settings?.reportBuilder?.visuals || []).filter(v => v.reportVisibility))
  const [editing, setEditing] = useState(false)
  const settingsRef = useRef(form?.settings || {})
  const isMobile = useIsMobile(720)

  const results = useMemo(() => {
    const out = {}
    for (const v of visuals) {
      try {
        out[v.id] = runQuery({ ...v.query, filters: v.filters }, { form, submissions })
      } catch { out[v.id] = null }
    }
    return out
  }, [visuals, form, submissions])

  if (!visuals.length) return null

  const layout = visuals.map((v, i) => {
    const base = defaultReportLayout(v, i)
    return isMobile
      ? { i: v.id, x: 0, y: i * base.h, w: 12, h: base.h, minW: 2, minH: 3, static: !editing }
      : { i: v.id, ...base, minW: 2, minH: 3 }
  })

  async function persist(nextVisuals) {
    // merge back into the full visuals array (promoted + not) so we don't drop the others
    const all = (settingsRef.current?.reportBuilder?.visuals || []).map(v => {
      const upd = nextVisuals.find(n => n.id === v.id)
      return upd || v
    })
    const updatedSettings = {
      ...settingsRef.current,
      reportBuilder: { ...(settingsRef.current.reportBuilder || {}), visuals: all, updatedAt: new Date().toISOString() },
    }
    settingsRef.current = updatedSettings
    await supabase.from('forms').update({ settings: updatedSettings }).eq('id', form.id)
  }

  function onLayoutChange(next) {
    if (!editing || isMobile) return // mobile layout is forced single-column; don't persist it over the desktop layout
    const updated = visuals.map(v => {
      const l = next.find(x => x.i === v.id)
      return l ? { ...v, reportLayout: { x: l.x, y: l.y, w: l.w, h: l.h } } : v
    })
    setVisuals(updated)
    persist(updated)
  }

  function resize(id, dw, dh) {
    const updated = visuals.map(v => {
      if (v.id !== id) return v
      const cur = v.reportLayout || defaultReportLayout(v, 0)
      return { ...v, reportLayout: { ...cur, w: Math.max(2, Math.min(12, cur.w + dw)), h: Math.max(3, cur.h + dh) } }
    })
    setVisuals(updated)
    persist(updated)
  }

  function removeFromReports(id) {
    const updated = visuals.filter(v => v.id !== id)
    const demoted = visuals.map(v => v.id === id ? { ...v, reportVisibility: false } : v)
    setVisuals(updated)
    persist(demoted)
  }

  return (
    <div id="report-builder-visuals" style={{ marginTop: '2rem' }}>
      <style>{`
        #report-builder-visuals .react-grid-item.react-grid-placeholder { background: var(--color-primary); opacity: 0.18; border-radius: var(--radius); }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>From Report Builder</h2>
        <button className="secondary" style={{ fontSize: '0.8rem' }} onClick={() => setEditing(e => !e)}>
          {editing ? 'Done' : 'Edit Layout'}
        </button>
      </div>

      <Grid
        layout={layout}
        cols={12}
        rowHeight={44}
        margin={[14, 14]}
        containerPadding={[0, 0]}
        compactType="vertical"
        preventCollision={false}
        isDraggable={editing}
        isResizable={editing}
        resizeHandles={['se']}
        onLayoutChange={onLayoutChange}
        draggableCancel=".rb-promoted-btn"
      >
        {visuals.map(v => (
          <div key={v.id} className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: '1 1 120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</span>
              {editing && (
                <>
                  <button className="secondary rb-promoted-btn" style={btn} title="Wider" onClick={() => resize(v.id, 2, 0)}>＋W</button>
                  <button className="secondary rb-promoted-btn" style={btn} title="Narrower" onClick={() => resize(v.id, -2, 0)}>－W</button>
                  <button className="secondary rb-promoted-btn" style={btn} title="Taller" onClick={() => resize(v.id, 0, 2)}>＋H</button>
                  <button className="secondary rb-promoted-btn" style={btn} title="Shorter" onClick={() => resize(v.id, 0, -2)}>－H</button>
                  <button className="secondary rb-promoted-btn" style={btn} title="Remove from Reports" onClick={() => removeFromReports(v.id)}>✕</button>
                </>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column' }}>
              <VisualRenderer visual={v} result={results[v.id]} form={form} />
            </div>
          </div>
        ))}
      </Grid>
    </div>
  )
}

const btn = { padding: '0.15rem 0.4rem', fontSize: '0.68rem', lineHeight: 1 }
