import ScrollReveal from './ScrollReveal'

function TopProductsPanel() {
  const rows = [
    { name: 'Chicken', value: '₦184k', up: true },
    { name: 'Jollof Rice', value: '₦142k' },
    { name: 'Fried Rice', value: '₦96k' },
  ]
  return (
    <div>
      <div className="mkt-outcome-panel-label">Top Products</div>
      {rows.map(r => (
        <div className="mkt-outcome-row" key={r.name}>
          <span>{r.name}</span>
          <span className="mkt-outcome-row-value">{r.value}{r.up ? ' ↑' : ''}</span>
        </div>
      ))}
    </div>
  )
}

function ProgressPanel() {
  const rows = [
    { name: 'Daniel', value: '+18%' },
    { name: 'Faith', value: '+14%' },
    { name: 'Thecla', value: '+11%' },
  ]
  return (
    <div>
      <div className="mkt-outcome-panel-label">Progress</div>
      {rows.map(r => (
        <div className="mkt-outcome-row" key={r.name}>
          <span>{r.name}</span>
          <span className="mkt-outcome-row-value">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function TopExpensesPanel() {
  const rows = [
    { name: 'Inventory', pct: 42 },
    { name: 'Transport', pct: 21 },
    { name: 'Utilities', pct: 16 },
  ]
  return (
    <div>
      <div className="mkt-outcome-panel-label">Top Expenses</div>
      {rows.map(r => (
        <div key={r.name} style={{ marginBottom: 10 }}>
          <div className="mkt-outcome-row" style={{ borderTop: 'none', paddingBottom: 0 }}>
            <span>{r.name}</span>
            <span className="mkt-outcome-row-value">{r.pct}%</span>
          </div>
          <div className="mkt-outcome-bar-track">
            <div className="mkt-outcome-bar-fill" style={{ width: `${r.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const EXAMPLES = [
  { question: "What's selling the most?", Panel: TopProductsPanel },
  { question: 'Which students improved?', Panel: ProgressPanel },
  { question: 'Where is my money going?', Panel: TopExpensesPanel },
]

export default function OutcomeExamples() {
  return (
    <section className="mkt-section--compact">
      <div className="mkt-container">
        <div className="mkt-section-head">
          <p className="mkt-eyebrow">Your records, answered</p>
          <h2 className="mkt-heading">Your records start answering useful questions.</h2>
        </div>
        <ScrollReveal className="mkt-outcome-grid">
          {EXAMPLES.map(({ question, Panel }) => (
            <div className="mkt-outcome-card" key={question}>
              <p className="mkt-outcome-question">{question}</p>
              <Panel />
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}
