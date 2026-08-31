// Compact KPI strip shared by the Staff and Events pages. Same visual
// language as the Payments page's .pay-kpi cards, but self-contained (no
// dependency on PayrollMonthly's inline <style>). Auto-wraps 4 -> 2 -> 1
// via the .pay-stats grid in index.css. Max 4 cards.
export default function StatCards({ items = [] }) {
  const cards = items.slice(0, 4)
  if (!cards.length) return null
  return (
    <div className="pay-stats" aria-label="summary">
      {cards.map((it, i) => (
        <div key={it.label || i} className={`pay-stat${it.accent ? ' accent' : ''}`}>
          <div className="l">{it.label}</div>
          <div className="v" style={it.color ? { color: it.color } : undefined}>{it.value}</div>
          {it.sub != null && <div className="s">{it.sub}</div>}
        </div>
      ))}
    </div>
  )
}
