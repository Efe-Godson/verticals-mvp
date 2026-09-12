// Place at: src/report/focus/FocusModeModal.jsx
// The Focus Mode shell (brief §5-6): expand a visual into a dedicated
// analysis workspace - chart, then its complete result, always stacked
// (never side-by-side), so the same layout already works on a phone.
import Modal from '../../components/Modal'

export default function FocusModeModal({
  onClose, title, subtitle, breadcrumbLabel, onBreadcrumbBack,
  controls, chart, table, footer, applyBar,
}) {
  return (
    <Modal open onClose={onClose} size="full" hideHeader bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1.1rem 1.3rem 0.8rem', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {breadcrumbLabel && (
          <button
            className="secondary"
            onClick={onBreadcrumbBack}
            style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem', marginBottom: '0.5rem' }}
          >
            &larr; {title}
          </button>
        )}
        <h3 style={{ margin: 0, fontSize: '1.1rem', paddingRight: '2.5rem' }}>
          {breadcrumbLabel ? breadcrumbLabel : title}
        </h3>
        {subtitle && <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>{subtitle}</div>}
        {controls && (
          <div data-html2canvas-ignore="true" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.8rem' }}>
            {controls}
          </div>
        )}
      </div>

      <div style={{ padding: '1rem 1.3rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {chart && <div style={{ marginBottom: '1.3rem' }}>{chart}</div>}
        {table}
        <AboutSlot>{footer}</AboutSlot>
      </div>

      {applyBar && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', padding: '0.8rem 1.3rem', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
          {applyBar}
        </div>
      )}
    </Modal>
  )
}

function AboutSlot({ children }) {
  if (!children) return null
  return children
}
