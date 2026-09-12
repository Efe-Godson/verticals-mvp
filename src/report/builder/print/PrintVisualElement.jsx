// Place at: src/report/builder/print/PrintVisualElement.jsx
// One Report Builder visual placed on a print page (brief §26, §31). Ranking
// shown here is an `override` on this print placement only - it is read
// with a fallback to the visual's own saved query and never written back to
// it, so "Dashboard: Top 10, Print: Top 5" never cross-contaminate.
import { runQuery } from '../../engine'
import VisualRenderer from '../visuals/VisualRenderer'
import FocusRankingControl from '../../focus/FocusRankingControl'

const iconBtn = {
  border: '1px solid var(--color-border)', borderRadius: '5px', padding: '0.1rem 0.4rem',
  fontSize: '0.72rem', cursor: 'pointer', background: 'var(--color-surface)', color: 'var(--color-muted)',
}

export default function PrintVisualElement({ visual, form, submissions, override, editing, onChangeOverride, onRemove }) {
  if (!visual) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem', border: '1px dashed #ccc' }}>
        Visual not found (it may have been deleted)
      </div>
    )
  }

  const query = {
    ...visual.query,
    filters: visual.filters,
    topN: override?.topN !== undefined ? override.topN : visual.query.topN,
    sort: override?.sort || visual.query.sort,
  }
  let result = null
  try { result = runQuery(query, { form, submissions }) } catch { /* leave null, VisualRenderer shows empty state */ }

  const canRank = !!visual.query.dimension
  const rankMode = query.sort === 'metric-asc' ? 'bottom' : 'top'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.85rem', color: '#111', flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{visual.title}</strong>
        {editing && canRank && (
          <FocusRankingControl
            mode={rankMode}
            n={query.topN ?? null}
            onChange={(m, n) => onChangeOverride({ topN: n, sort: m === 'bottom' ? 'metric-asc' : 'metric-desc' })}
          />
        )}
        {editing && <button style={iconBtn} onClick={onRemove} title="Remove">✕</button>}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <VisualRenderer visual={visual} result={result} form={form} />
      </div>
    </div>
  )
}
