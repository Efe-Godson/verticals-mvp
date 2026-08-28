import Modal from '../../components/Modal'
import AIInsightCards from './AIInsightCards'

export default function AIRecommendationsModal({ formId, dateRangeLabel, submissionIds, onClose }) {
  return (
    <Modal size="lg" onClose={onClose} title="AI recommendations">
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: 0, marginBottom: '1.2rem' }}>
        Suggested actions, key takeaways, and outlook, generated from the current filter.
      </p>
      <AIInsightCards
        formId={formId}
        dateRangeLabel={dateRangeLabel}
        submissionIds={submissionIds}
        hideExecutiveSummary
      />
    </Modal>
  )
}
