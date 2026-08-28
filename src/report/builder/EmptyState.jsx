// Place at: src/report/builder/EmptyState.jsx
// Brief §23 - small, not an onboarding flow.
export default function EmptyState({ onAddVisual, onAddPivot }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', padding: '2rem', gap: '0.5rem' }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>Build your first visual</div>
      <div style={{ color: 'var(--color-muted)', maxWidth: 420 }}>
        Explore your data and create charts, tables and deeper analysis.
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={onAddVisual}>+ Add Visual</button>
        <button className="secondary" onClick={onAddPivot}>Add Pivot Table</button>
      </div>
    </div>
  )
}
