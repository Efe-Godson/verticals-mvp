// Hand-built mock of a real Verticals Sales Overview, using seeded example
// numbers - not a screenshot (none exist yet), but not invented UI either:
// the shape (stat tiles, a trend chart, a top-products list) mirrors the
// real Home/Report screens. An inline SVG sparkline keeps this out of any
// charting-library bundle so the hero stays light on first paint.
const TOP_PRODUCTS = [
  { name: 'Chicken', value: '₦184k' },
  { name: 'Shoes', value: '₦156k' },
  { name: 'Jollof Rice', value: '₦142k' },
  { name: 'Bags', value: '₦118k' },
  { name: 'Fried Rice', value: '₦96k' },
  { name: 'Chair', value: '₦74k' },
]

function Sparkline() {
  return (
    <svg viewBox="0 0 240 56" width="100%" height="56" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0,44 L24,40 L48,42 L72,30 L96,34 L120,20 L144,24 L168,12 L192,16 L216,6 L240,10"
        fill="none"
        stroke="var(--chart-series-1)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const STATS = [
  { value: '₦1.24m', label: 'Sales', delta: '↑ 12.8%' },
  { value: '342', label: 'Orders', delta: '↑ 6.4%' },
  { value: '₦318k', label: 'Expenses', delta: '↑ 3.1%', negative: true },
]

export default function HeroPreview() {
  return (
    <div className="mkt-preview-card" aria-hidden="true">
      <p className="mkt-preview-title">Performance Report</p>

      <div className="mkt-preview-stats">
        {STATS.map(stat => (
          <div className="mkt-preview-stat-tile" key={stat.label}>
            <div className="mkt-preview-stat-value">{stat.value}</div>
            <div className="mkt-preview-stat-label-row">
              <span className="mkt-preview-stat-label">{stat.label}</span>
              <span className={`mkt-preview-stat-delta${stat.negative ? ' mkt-preview-stat-delta--negative' : ''}`}>{stat.delta}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mkt-preview-chart">
        <div className="mkt-preview-chart-label">Performance</div>
        <Sparkline />
      </div>

      <div className="mkt-preview-chart-label">Top Products</div>
      <div className="mkt-preview-rows">
        {TOP_PRODUCTS.map(p => (
          <div className="mkt-preview-row" key={p.name}>
            <span className="mkt-preview-row-name">{p.name}</span>
            <span className="mkt-preview-row-value">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
