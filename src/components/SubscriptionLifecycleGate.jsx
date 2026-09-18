// Place at: src/components/SubscriptionLifecycleGate.jsx
// Mounted once, globally (see App.jsx) - shows the one-time reminder modal
// (see SubscriptionReminderModal.jsx) the first time a milestone's reminder
// hasn't been shown yet, then falls back to a persistent-but-quiet banner
// for as long as the subscription stays off "active". Skipped for staff
// sessions entirely (they're excluded from billing already, same as
// /account/  /billing themselves - see StaffScopedRoute in App.jsx) and for
// signed-out visitors.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import SubscriptionReminderModal from './SubscriptionReminderModal'

const STATUS_BANNER = {
  expiring_soon: { tone: 'info', text: (s) => `Your subscription renews on ${fmt(s.current_period_end)}.` },
  grace_period: { tone: 'warning', text: (s) => `Your subscription needs renewing - you have until ${fmt(s.grace_period_ends_at)} before new entries pause.` },
  restricted: { tone: 'critical', text: () => 'New entries are paused until your subscription is renewed.' },
}

function fmt(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const BANNER_STYLE = {
  info: { background: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
  warning: { background: 'var(--color-warning-soft)', color: '#8a5a12' },
  critical: { background: 'var(--color-warning-soft)', color: '#a8382a' },
}

export default function SubscriptionLifecycleGate() {
  const { session, staffFormId } = useAuth()
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState(null)
  const [reminder, setReminder] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [bannerClosed, setBannerClosed] = useState(false)

  useEffect(() => {
    if (!session || staffFormId) return
    let cancelled = false
    supabase.rpc('get_subscription_and_pending_reminder').then(({ data }) => {
      if (cancelled || !data) return
      setSubscription(data.subscription)
      setReminder(data.reminder)
      setShowModal(!!data.reminder && !data.reminder.shown_as_modal_at)
    })
    return () => { cancelled = true }
  }, [session, staffFormId])

  if (!session || staffFormId || !subscription) return null

  async function closeModal() {
    setShowModal(false)
    if (reminder) await supabase.rpc('mark_reminder_seen', { p_reminder_id: reminder.id, p_kind: 'modal' })
  }

  const bannerSpec = STATUS_BANNER[subscription.status]

  return (
    <>
      {showModal && reminder && (
        <SubscriptionReminderModal subscription={subscription} milestone={reminder.milestone} onClose={closeModal} />
      )}
      {!showModal && bannerSpec && !bannerClosed && (
        <div
          style={{
            position: 'sticky', top: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.8rem', padding: '0.5rem 1rem', fontSize: '0.85rem', flexWrap: 'wrap', ...BANNER_STYLE[bannerSpec.tone],
          }}
        >
          <span>{bannerSpec.text(subscription)}</span>
          <button
            className="secondary"
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', flexShrink: 0 }}
            onClick={() => navigate('/billing')}
          >
            {subscription.status === 'restricted' ? 'View billing' : 'Renew now'}
          </button>
          <button
            aria-label="Dismiss"
            onClick={() => setBannerClosed(true)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 0.2rem' }}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
