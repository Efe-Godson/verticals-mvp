import Modal from './Modal'
import { LoadingSpinner } from '../LoadingState'

export default function AppUpdateModal({ open }) {
  return (
    <Modal open={open} size="sm" hideHeader sheetOnMobile={false} bodyStyle={{ padding: '2rem 1.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        <LoadingSpinner size={24} color="var(--color-primary)" />
        <div>
          <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Updating app</strong>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.86rem' }}>Loading the latest version…</span>
        </div>
      </div>
    </Modal>
  )
}