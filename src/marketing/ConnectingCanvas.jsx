// Place at: src/marketing/ConnectingCanvas.jsx
// A literal architecture diagram (Form -> Records -> Report) rather than
// another paragraph of feature copy - the same numbers appear at every
// stage so a visitor sees Capture -> Organise -> Understand actually
// happen to one piece of data, not just described in prose.
import { Fragment } from 'react'
import { ArrowDown } from 'lucide-react'
import ScrollReveal from './ScrollReveal'

const STAGES = [
  {
    label: 'Form',
    rows: [['Item', 'Chicken Combo'], ['Quantity', '2'], ['Amount', '₦9,000']],
  },
  {
    label: 'Records',
    rows: [['12 Sep · Chicken Combo × 2', '₦9,000']],
  },
  {
    label: 'Report',
    rows: [['Chicken · Top Product', '₦184k ↑']],
  },
]

export default function ConnectingCanvas() {
  return (
    <section className="mkt-section" id="connects">
      <div className="mkt-container">
        <div className="mkt-section-head">
          <p className="mkt-eyebrow">Everything connects</p>
          <h2 className="mkt-heading">One record becomes the whole picture.</h2>
          <p className="mkt-subheading" style={{ margin: '0 auto' }}>
            What you capture is exactly what shows up in your records, and exactly what your
            reports are built from.
          </p>
        </div>
        <ScrollReveal className="mkt-canvas">
          {STAGES.map((stage, i) => (
            <Fragment key={stage.label}>
              <div className="mkt-canvas-stage">
                <div className="mkt-canvas-panel">
                  <div className="mkt-outcome-panel-label">{stage.label}</div>
                  {stage.rows.map(([name, value]) => (
                    <div className="mkt-outcome-row" key={name}>
                      <span>{name}</span>
                      <span className="mkt-outcome-row-value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="mkt-canvas-connector" aria-hidden="true">
                  <span className="mkt-canvas-dot" />
                  <ArrowDown size={16} />
                </div>
              )}
            </Fragment>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}
