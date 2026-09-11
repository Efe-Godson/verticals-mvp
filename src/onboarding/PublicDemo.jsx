// Place at: src/onboarding/PublicDemo.jsx
// The "demo" kind of entry intent (Sales, Reporting) - a stats tile plus the
// real Report component, both reading the one seeded is_demo business
// (public/anonymous-readable, see the "Anyone can view demo forms/
// submissions" RLS policies), same reuse of a real component by formId
// prop that src/lab/demo/DemoExperience.jsx already relies on for the
// admin-only /lab/demo page. No admin-config layer yet (that's Phase 2's
// Demo Data Manager) - every "demo" intent shares this one dataset for now.
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Report from '../Report'
import { InlineLoader } from '../components/InlineLoader'
import { ErrorState } from '../ErrorState'

function computeStats(form, submissions) {
  const cartField = form.fields.find(f => f.type === 'cart')
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let todaySales = 0
  let todayOrders = 0
  const itemCounts = {} // name -> quantity sold, across every order

  submissions.forEach(sub => {
    const cartData = cartField ? sub.data[cartField.id] : null
    if (!cartData) return
    const isToday = new Date(sub.created_at) >= todayStart
    if (isToday) {
      todayOrders += 1
      todaySales += (cartData.total || 0) + (Number(cartData.deliveryFee) || 0)
    }
    ;(cartData.items || []).forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity
    })
  })

  const topSelling = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name)

  return { todaySales, todayOrders, topSelling }
}

export default function PublicDemo({ onCreateWorkspace }) {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: form, error } = await supabase.from('forms').select('*').eq('is_demo', true).maybeSingle()
      if (cancelled) return
      if (error || !form) {
        setState({ status: 'error', message: "The demo isn't available right now - you can still create your own workspace." })
        return
      }
      const { data: submissions } = await supabase
        .from('submissions').select('data, created_at').eq('form_id', form.id).is('deleted_at', null)
      if (cancelled) return
      setState({ status: 'ready', form, stats: computeStats(form, submissions || []) })
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ paddingBottom: '5rem' }}>
      {/* Fixed above everything, including Report's own modals - "keep a
          clear CTA available" per the design brief, regardless of what
          state the demo view below is in. */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 250,
        padding: '0.8rem 1rem calc(0.8rem + env(safe-area-inset-bottom))',
        background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
      }}>
        <button type="button" onClick={onCreateWorkspace} style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'block', padding: '0.85rem', fontSize: '1rem', fontWeight: 600 }}>
          Create your workspace →
        </button>
      </div>

      {state.status === 'loading' && (
        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}><InlineLoader label="Loading demo..." /></div>
      )}

      {state.status === 'error' && (
        <div style={{ padding: '2rem 1rem' }}><ErrorState message={state.message} /></div>
      )}

      {state.status === 'ready' && (
        <div className="page" style={{ maxWidth: 860 }}>
          <div style={{ display: 'grid', gap: '0.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', margin: '0 0 1.4rem' }}>
            <div className="card" style={{ padding: '1rem 1.1rem' }}>
              <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700 }}>Today</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: 2 }}>₦{state.stats.todaySales.toLocaleString()}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{state.stats.todayOrders} order{state.stats.todayOrders !== 1 ? 's' : ''}</div>
            </div>
            {state.stats.topSelling.length > 0 && (
              <div className="card" style={{ padding: '1rem 1.1rem' }}>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700, marginBottom: '0.4rem' }}>Top Selling</div>
                {state.stats.topSelling.map((name, i) => (
                  <div key={name} style={{ fontSize: '0.9rem', fontWeight: i === 0 ? 700 : 500 }}>{name}</div>
                ))}
              </div>
            )}
          </div>

          <Report formId={state.form.id} />
        </div>
      )}
    </div>
  )
}
