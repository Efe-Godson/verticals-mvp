import ScrollReveal from './ScrollReveal'

function CaptureVisual() {
  return (
    <div className="mkt-walk-visual mkt-walk-visual--shaded">
      <div className="mkt-outcome-panel-label">New record</div>
      {['Item', 'Quantity', 'Amount'].map(field => (
        <div className="mkt-walk-field" key={field}>
          <div className="mkt-walk-field-label">{field}</div>
          <div className="mkt-walk-field-input" />
        </div>
      ))}
    </div>
  )
}

function RecordsVisual() {
  const rows = [
    ['12 Sep', 'Chicken combo', '₦4,500'],
    ['12 Sep', 'Shoes', '₦15,600'],
    ['12 Sep', 'Jollof platter', '₦3,200'],
    ['11 Sep', 'Bags', '₦11,800'],
    ['11 Sep', 'Fried rice', '₦2,800'],
    ['10 Sep', 'Chair', '₦7,400'],
  ]
  return (
    <div className="mkt-walk-visual mkt-walk-visual--shaded">
      <div className="mkt-outcome-panel-label">Records</div>
      {rows.map(row => (
        <div className="mkt-outcome-row" key={row.join('-')}>
          <span>{row[0]} &middot; {row[1]}</span>
          <span className="mkt-outcome-row-value">{row[2]}</span>
        </div>
      ))}
    </div>
  )
}

function ReportsVisual() {
  return (
    <div className="mkt-walk-visual mkt-walk-visual--shaded">
      <div className="mkt-outcome-panel-label">This month vs. last</div>
      <svg viewBox="0 0 240 90" width="100%" height="90" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="0,70 40,60 80,65 120,40 160,45 200,20 240,25" fill="none" stroke="var(--color-border)" strokeWidth="2" />
        <polyline points="0,80 40,55 80,58 120,35 160,30 200,15 240,10" fill="none" stroke="var(--chart-series-1)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

const ROWS = [
  {
    step: '01 · Capture',
    heading: 'Collect information your way.',
    desc: 'Create forms and workflows around what you actually need to record.',
    tags: ['Custom fields', 'Public forms', 'Mobile friendly'],
    Visual: CaptureVisual,
  },
  {
    step: '02 · Organise',
    heading: 'Everything stays organised.',
    desc: "Search, filter and review what you've collected without digging through scattered files.",
    tags: ['Search', 'Filter', 'Sort', 'Export'],
    Visual: RecordsVisual,
  },
  {
    step: '03 · Understand',
    heading: "See what's actually happening.",
    desc: 'Turn your records into summaries, trends, comparisons and reports.',
    tags: ['Trends', 'Comparisons', 'Breakdown', 'Performance'],
    Visual: ReportsVisual,
  },
]

export default function ProductWalkthrough() {
  return (
    <section className="mkt-section" id="product">
      <div className="mkt-container">
        <div className="mkt-section-head">
          <p className="mkt-eyebrow">How Verticals works</p>
          <h2 className="mkt-heading">From something you record to something you understand.</h2>
        </div>
        {ROWS.map((row, i) => (
          <ScrollReveal className={`mkt-walk-row${i % 2 === 1 ? ' mkt-walk-row--reverse' : ''}`} key={row.heading}>
            <div className="mkt-walk-text">
              <span className="mkt-walk-step">{row.step}</span>
              <h3 className="mkt-walk-heading">{row.heading}</h3>
              <p className="mkt-walk-desc">{row.desc}</p>
              <div className="mkt-walk-tags">
                {row.tags.map(tag => <span className="mkt-walk-tag" key={tag}>{tag}</span>)}
              </div>
            </div>
            <div className="mkt-walk-visual-wrap">
              <row.Visual />
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  )
}
