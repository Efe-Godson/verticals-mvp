// Verticals skeleton primitives (Universal Loading States brief §3A, §10).
//
// Rules baked in:
//  - quiet neutral surface, ~1.5s pulse, honours prefers-reduced-motion
//    (all via the .vskel class in index.css)
//  - match the SHAPE of the real content - pass width/height/radius
//  - no layout shift: a skeleton should occupy the same box as what
//    replaces it, so these are used INSIDE the real containers (a card, a
//    <tbody>, the KPI grid) rather than as a separate full-page screen.

// One bar. `w` / `h` accept any CSS length (default: full width, 1em tall).
export function Skeleton({ w = '100%', h = '1em', radius, circle = false, style, className = '' }) {
  return (
    <span
      className={`vskel ${circle ? 'vskel--circle' : ''} ${className}`}
      style={{ width: w, height: h, borderRadius: circle ? '50%' : radius, ...style }}
      aria-hidden="true"
    />
  )
}

// A paragraph of `lines` bars with slightly varied widths so it doesn't
// read as a solid block. Last line is shorter.
export function SkeletonText({ lines = 3, style }) {
  const widths = ['92%', '84%', '96%', '78%', '88%', '70%']
  return (
    <span className="vskel-group" style={{ display: 'block', ...style }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          className="vskel vskel--text"
          style={{ width: i === lines - 1 ? '55%' : widths[i % widths.length] }}
        />
      ))}
    </span>
  )
}

// Card-shaped placeholder: a title bar + a few text lines, in the app's
// standard .card box so padding / radius / border match exactly.
export function SkeletonCard({ lines = 2, style }) {
  return (
    <div className="card" style={{ padding: '1rem 1.1rem', ...style }} aria-hidden="true">
      <Skeleton w="45%" h="0.9rem" style={{ marginBottom: '0.8rem' }} />
      <SkeletonText lines={lines} />
    </div>
  )
}

// KPI strip: `count` equal cards, each a tiny label bar + a big value bar.
// Mirrors the .pay-kpis / .kpi-grid layout so nothing jumps on load.
export function SkeletonKpis({ count = 4, className = 'pay-kpis' }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="pay-kpi">
          <Skeleton w="55%" h="0.6rem" style={{ marginBottom: '0.5rem' }} />
          <Skeleton w="80%" h="1.2rem" />
        </div>
      ))}
    </div>
  )
}

// Table body placeholder. Keeps the caller's real <thead> visible; this is
// just the <tbody>. `cols` can be a number or an array of width hints.
export function SkeletonTableRows({ rows = 6, cols = 5, cellStyle }) {
  const colList = Array.isArray(cols) ? cols : Array.from({ length: cols }).map(() => null)
  const rowWidths = ['70%', '85%', '55%', '92%', '64%', '78%', '48%', '88%']
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {colList.map((hint, c) => (
            <td key={c} style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)', ...cellStyle }}>
              <Skeleton w={hint || rowWidths[(r + c) % rowWidths.length]} h="0.8rem" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

// Standalone table skeleton (header + body) for when the caller doesn't
// already render its own header during load.
export function SkeletonTable({ columns = ['', '', '', '', ''], rows = 6 }) {
  return (
    <div className="table-wrap" aria-hidden="true">
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{ padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <Skeleton w="60%" h="0.7rem" />
              </th>
            ))}
          </tr>
        </thead>
        <SkeletonTableRows rows={rows} cols={columns.length} />
      </table>
    </div>
  )
}

// Chart-shaped placeholder: baseline + a row of bars of varied heights,
// rather than one grey rectangle (brief §3A).
export function SkeletonChart({ height = 220, bars = 9, style }) {
  const heights = [40, 68, 52, 84, 60, 92, 46, 74, 58, 80, 50]
  return (
    <div
      className="card"
      style={{ padding: '1rem', height, display: 'flex', alignItems: 'flex-end', gap: '0.5rem', ...style }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <Skeleton key={i} w={`${100 / bars}%`} h={`${heights[i % heights.length]}%`} radius="4px 4px 0 0" />
      ))}
    </div>
  )
}
