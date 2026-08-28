// Place at: src/report/builder/visuals/KpiViz.jsx
// Number / KPI / comparison / progress card off a scalar StandardResult.
// Shares StatTile's visual language but rendered inline so it can fill a
// grid cell.
import { valueFormatter } from '../format'
import { formatNumber } from '../format'

export default function KpiViz({ result, visual = {}, display = {} }) {
  const scalar = result?.scalar || { value: result?.total || 0 }
  const fmt = valueFormatter(result)
  const cmp = scalar.comparison
  const variant = visual.type === 'progress' ? 'progress' : (visual.type === 'comparison' ? 'comparison' : 'kpi')

  const target = Number(display.target) || 0
  const pct = target > 0 ? Math.min(100, (scalar.value / target) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: '0.5rem 0.25rem', gap: '0.35rem' }}>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {fmt(scalar.value)}
      </div>
      {variant === 'comparison' && cmp && (
        <div style={{
          fontSize: '0.82rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
          color: cmp.direction === 'up' ? 'var(--status-good)' : 'var(--status-critical)',
        }}>
          {cmp.direction === 'up' ? '▲' : '▼'} {cmp.percent === undefined ? fmt(Math.abs(cmp.delta)) : `${Math.abs(cmp.percent)}%`} vs previous period
        </div>
      )}
      {variant === 'progress' && (
        <div style={{ marginTop: '0.2rem' }}>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--color-primary-soft)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)' }} />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
            {target > 0 ? `${Math.round(pct)}% of ${fmt(target)} target` : 'Set a target in Configure'}
          </div>
        </div>
      )}
      {variant === 'kpi' && (
        <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
          {result?.count != null ? `${formatNumber(result.count)} record${result.count === 1 ? '' : 's'}` : ''}
        </div>
      )}
    </div>
  )
}
