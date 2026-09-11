// Place at: src/expenses/ExpenseOverview.jsx
// The Expenses home: this month's spend at a glance, a big Add button, the
// period breakdown, and the last few expenses. Anything deeper lives in
// Reports (/form/:id/report).
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useExpenses } from './ExpenseShell'
import QuickAddExpense from './QuickAddExpense'
import { InlineLoader } from '../components/InlineLoader'
import { ErrorState } from '../ErrorState'
import { formatNaira } from '../report/helpers/analysisUtils'
import { amountFieldId, dateFieldId } from './expenseFields'

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const daysAgo = (n) => { const d = startOfToday(); d.setDate(d.getDate() - n); return d }
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export default function ExpenseOverview() {
  const { form, formId } = useExpenses()
  const [searchParams, setSearchParams] = useSearchParams()
  const [subs, setSubs] = useState(null)
  const [error, setError] = useState('')
  const addOpen = searchParams.get('add') === '1'

  const amountKey = amountFieldId(form)
  const dateKey = dateFieldId(form)

  async function load() {
    setError('')
    const { data, error: e } = await supabase
      .from('submissions').select('id, data, created_at')
      .eq('form_id', formId).is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (e) { setError(e.message || 'Could not load expenses.'); return }
    setSubs(data || [])
  }
  useEffect(() => { load() }, [formId]) // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() { setSearchParams(p => { p.set('add', '1'); return p }, { replace: true }) }
  function closeAdd() { setSearchParams(p => { p.delete('add'); return p }, { replace: true }) }

  const stats = useMemo(() => {
    if (!subs) return null
    const amt = (s) => Number(s.data?.[amountKey]) || 0
    const when = (s) => {
      const raw = s.data?.[dateKey]
      const d = raw ? new Date(raw) : new Date(s.created_at)
      return isNaN(d.getTime()) ? new Date(s.created_at) : d
    }
    const now = new Date()
    const thisMonth = monthKey(now)
    const prevMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const todayStart = startOfToday()
    const weekStart = daysAgo(6)

    let month = 0, prev = 0, week = 0, today = 0
    const byCategory = {}
    for (const s of subs) {
      const a = amt(s)
      const d = when(s)
      const mk = monthKey(d)
      if (mk === thisMonth) {
        month += a
        byCategory[s.data?.category || 'Uncategorised'] = (byCategory[s.data?.category || 'Uncategorised'] || 0) + a
      }
      if (mk === prevMonth) prev += a
      if (d >= weekStart) week += a
      if (d >= todayStart) today += a
    }

    const categories = Object.entries(byCategory)
      .map(([label, total]) => ({ label, total, pct: month > 0 ? Math.round((total / month) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)

    const recent = [...subs]
      .sort((a, b) => when(b) - when(a))
      .slice(0, 3)
      .map(s => ({ id: s.id, desc: s.data?.description || s.data?.category || 'Expense', category: s.data?.category, amount: amt(s) }))

    const trend = prev > 0 ? Math.round(((month - prev) / prev) * 100) : null
    return { month, week, today, categories, recent, trend, count: subs.length }
  }, [subs, amountKey, dateKey])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!stats) return <div style={{ padding: '2rem 0' }}><InlineLoader label="Loading expenses…" /></div>

  return (
    <div>
      <h1 style={{ margin: '0 0 1.4rem' }}>{form.name}</h1>

      {/* Hero: this month */}
      <div className="card pay-stat accent" style={{ padding: '1.2rem 1.3rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: 'clamp(1.6rem, 7vw, 2.2rem)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {formatNaira(stats.month)}
        </div>
        <div style={{ color: 'var(--color-muted)', marginTop: '0.15rem' }}>
          Spent this month
          {stats.trend !== null && (
            <span style={{ marginLeft: '0.6rem', fontWeight: 600, color: stats.trend > 0 ? 'var(--status-critical)' : 'var(--status-good)' }}>
              {stats.trend > 0 ? '▲' : '▼'} {Math.abs(stats.trend)}% vs last month
            </span>
          )}
        </div>
      </div>

      <button type="button" onClick={openAdd} style={{ width: '100%', minHeight: 50, fontSize: '1rem', marginBottom: '1.6rem' }}>
        + Add Expense
      </button>

      {/* Period tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1.8rem' }}>
        {[['Today', stats.today], ['This week', stats.week], ['This month', stats.month]].map(([label, val]) => (
          <div key={label} className="pay-stat" style={{ textAlign: 'left' }}>
            <div className="l">{label}</div>
            <div className="v" style={{ fontSize: '1rem' }}>{formatNaira(val)}</div>
          </div>
        ))}
      </div>

      {/* Recent */}
      <h2 style={{ fontSize: '1rem', margin: '0 0 0.6rem' }}>Recent expenses</h2>
      {stats.recent.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>No expenses recorded yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {stats.recent.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.9rem' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.desc}{r.category && <span style={{ color: 'var(--color-muted)' }}> · {r.category}</span>}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatNaira(r.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {addOpen && <QuickAddExpense form={form} onClose={closeAdd} onSaved={load} />}
    </div>
  )
}
