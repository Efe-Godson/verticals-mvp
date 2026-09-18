// Place at: src/components/SubscriptionReminderModal.jsx
// One parameterized modal covering every lifecycle milestone (day -7/0/+4/
// +8/+12), rather than five bespoke components - the copy is the only thing
// that varies per milestone, per the approved plan's severity ladder
// (informational -> attention -> warning -> strong warning -> urgent),
// deliberately never alarming/red even at the final stage.
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import { PLAN_LABELS, formatNaira } from '../lib/pricingConfig'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const COPY = {
  'day_-7': {
    title: 'Your subscription renews in 7 days',
    secondary: 'Not now',
  },
  day_0: {
    title: 'Your subscription has expired',
    body: (s) => `You can continue using Verticals during your 12-day grace period. Renew before ${formatDate(s.grace_period_ends_at)} to avoid restrictions on new entries.`,
    secondary: 'Continue for now',
  },
  'day_+4': {
    title: '8 days left in your grace period',
    body: (s) => `Renew your subscription before ${formatDate(s.grace_period_ends_at)} to continue creating new entries without interruption.`,
    secondary: 'Remind me later',
  },
  'day_+8': {
    title: 'Your grace period ends in 4 days',
    body: () => "After that, you'll still be able to view your data, but you won't be able to create new entries until your subscription is renewed.",
    secondary: 'Continue',
  },
  'day_+12': {
    title: 'Your grace period ends today',
    body: () => 'Renew your subscription today to keep adding new records. Your existing records and reports will remain available if your account becomes restricted.',
    secondary: null,
  },
}

export default function SubscriptionReminderModal({ subscription, milestone, onClose }) {
  const navigate = useNavigate()
  const copy = COPY[milestone]
  if (!copy) return null

  const body = milestone === 'day_-7'
    ? `Your ${PLAN_LABELS[subscription.plan]} subscription is due for renewal on ${formatDate(subscription.current_period_end)}. Renew now to keep your workspace running without interruption.`
    : copy.body?.(subscription)

  return (
    <Modal size="sm" onClose={onClose} title={copy.title}>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.88rem', margin: '0 0 1rem' }}>{body}</p>

      {milestone !== 'day_+8' && (
        <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius)', padding: '0.8rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Plan</span><strong>{PLAN_LABELS[subscription.plan]}</strong></div>
          {subscription.price_ngn > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Amount due</span><strong>{formatNaira(subscription.price_ngn)}</strong></div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{milestone === 'day_-7' ? 'Renewal date' : 'Grace period ends'}</span>
            <strong>{milestone === 'day_-7' ? formatDate(subscription.current_period_end) : formatDate(subscription.grace_period_ends_at)}</strong>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button style={{ flex: 1 }} onClick={() => { onClose(); navigate('/billing') }}>
          {milestone === 'day_-7' ? 'Renew subscription' : 'Renew now'}
        </button>
        {copy.secondary && (
          <button className="secondary" style={{ flex: 1 }} onClick={onClose}>{copy.secondary}</button>
        )}
      </div>
    </Modal>
  )
}
