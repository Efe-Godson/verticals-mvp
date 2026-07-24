import AIInsightCards from './AIInsightCards'

export default function AIRecommendationsModal({ formId, dateRangeLabel, submissionIds, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)', borderRadius: '12px', padding: '1.5rem',
          width: '720px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 18px 45px rgba(0,0,0,0.16)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <h3 style={{ margin: 0 }}>AI recommendations</h3>
          <button onClick={onClose} className="secondary">Close</button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.2rem', marginBottom: '1.2rem' }}>
          Suggested actions, key takeaways, and outlook — generated from the current filter.
        </p>

        <AIInsightCards
          formId={formId}
          dateRangeLabel={dateRangeLabel}
          submissionIds={submissionIds}
          hideExecutiveSummary
        />
      </div>
    </div>
  )
}
