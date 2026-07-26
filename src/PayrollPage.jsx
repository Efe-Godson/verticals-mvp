// Place at: src/PayrollPage.jsx
// Route: /form/:id/payroll — :id is the Employees form. Finds its paired
// Salary Events form via settings.linkedEmployeesFormId, computes each
// employee's breakdown for the selected period, and lets the owner mark
// Paid/Pending (persisted in payroll_payments; the breakdown itself is
// always recomputed live from Employees + Salary Events).
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useToast } from './Toast'
import { calculateEmployeePayroll, eventPeriod, eventEmployeeId } from './payroll/calculatePayroll'
import StatTile from './report/components/StatTile'

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function DetailsModal({ breakdown, status, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', width: '460px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>{breakdown.name}</h3>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
          <Row label="Base salary" value={breakdown.monthlySalary} />
          <Row label="Daily salary" value={breakdown.dailySalary} />
          {breakdown.lineItems.map((item, i) => (
            <Row key={i} label={item.type} value={item.signedAmount} signed />
          ))}
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '0.4rem', paddingTop: '0.6rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Final amount payable</span>
            <span>₦{breakdown.finalSalary.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Status: {status === 'paid' ? 'Paid' : 'Pending'}</div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, signed }) {
  const formatted = `${signed && value >= 0 ? '+' : ''}₦${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${signed && value < 0 ? ' (deducted)' : ''}`
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span>{formatted}</span>
    </div>
  )
}

function PayrollPage() {
  const { id } = useParams()
  const { showToast } = useToast()

  const [form, setForm] = useState(null)
  const [eventsForm, setEventsForm] = useState(null)
  const [employees, setEmployees] = useState([])
  const [events, setEvents] = useState([])
  const [payments, setPayments] = useState({}) // { [employeeSubmissionId]: { status, amount } }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState(currentPeriod())
  const [detailsFor, setDetailsFor] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      const { data: formData, error: formError } = await supabase.from('forms').select('*').eq('id', id).single()
      if (formError || !formData) { setError('Form not found.'); setLoading(false); return }
      if (formData.settings?.payrollRole !== 'employees') {
        setError('This form is not set up as a Payroll Employees form.')
        setLoading(false)
        return
      }
      setForm(formData)

      const { data: linkedEventsForm } = await supabase
        .from('forms').select('*')
        .eq('settings->>linkedEmployeesFormId', id)
        .is('deleted_at', null)
        .maybeSingle()
      setEventsForm(linkedEventsForm || null)

      const { data: employeeSubs } = await supabase
        .from('submissions').select('*').eq('form_id', id).is('deleted_at', null)
      setEmployees(employeeSubs || [])

      if (linkedEventsForm) {
        const { data: eventSubs } = await supabase
          .from('submissions').select('*').eq('form_id', linkedEventsForm.id).is('deleted_at', null)
        setEvents(eventSubs || [])
      }

      const { data: paymentRows } = await supabase
        .from('payroll_payments').select('*').eq('employees_form_id', id)
      const paymentMap = {}
      ;(paymentRows || []).forEach(p => { paymentMap[`${p.employee_submission_id}:${p.period}`] = p })
      setPayments(paymentMap)

      setLoading(false)
    }
    load()
  }, [id])

  const breakdowns = useMemo(() => {
    const payrollSettings = form?.settings?.payroll
    return employees.map(employee => {
      const employeeEvents = events.filter(e => eventEmployeeId(e) === employee.id && eventPeriod(e) === period)
      return calculateEmployeePayroll(employee, employeeEvents, payrollSettings, period)
    })
  }, [employees, events, period, form])

  async function markStatus(employeeId, status, amount) {
    const key = `${employeeId}:${period}`
    const { data, error } = await supabase
      .from('payroll_payments')
      .upsert(
        { employees_form_id: id, employee_submission_id: employeeId, period, status, amount, marked_at: new Date().toISOString() },
        { onConflict: 'employees_form_id,employee_submission_id,period' }
      )
      .select().single()

    if (error) {
      showToast('Could not update payment status: ' + error.message, 'error')
      return
    }
    setPayments(current => ({ ...current, [key]: data }))
    showToast(status === 'paid' ? 'Marked as paid.' : 'Marked as pending.', 'success')
  }

  if (loading) return <div className="page">Loading...</div>
  if (error) return <div className="page"><p style={{ color: 'red' }}>{error}</p></div>

  const totalDue = breakdowns.reduce((sum, b) => sum + b.finalSalary, 0)
  const totalDeductions = breakdowns.reduce((sum, b) => sum + b.deductions, 0)
  const totalAdditions = breakdowns.reduce((sum, b) => sum + b.additions, 0)
  const paidCount = breakdowns.filter(b => payments[`${b.employeeId}:${period}`]?.status === 'paid').length
  const pendingCount = breakdowns.length - paidCount

  return (
    <div className="page" style={{ maxWidth: '960px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{form.name}</div>
          <h1 style={{ margin: '0.2rem 0 0', fontSize: '1.6rem' }}>Payroll</h1>
        </div>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ padding: '0.5rem' }} />
      </div>

      {!eventsForm && (
        <p style={{ color: 'var(--color-muted)', marginTop: '1rem' }}>
          No linked Salary Events form found — deductions and additions will show as zero until one is linked.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '1.2rem' }}>
        <StatTile label="Total Salary Due" value={`₦${totalDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <StatTile label="Total Staff" value={breakdowns.length} />
        <StatTile label="Paid" value={paidCount} />
        <StatTile label="Pending" value={pendingCount} />
        <StatTile label="Total Deductions" value={`₦${totalDeductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <StatTile label="Total Additions" value={`₦${totalAdditions.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
      </div>

      <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {['Employee', 'Monthly Salary', 'Deductions', 'Additions', 'Final Salary', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb', padding: '0.6rem 0.7rem', fontSize: '0.82rem', color: 'var(--color-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakdowns.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '1.5rem', color: 'var(--color-muted)' }}>No employees yet.</td></tr>
            )}
            {breakdowns.map(b => {
              const payment = payments[`${b.employeeId}:${period}`]
              const status = payment?.status || 'pending'
              return (
                <tr key={b.employeeId}>
                  <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid #eee' }}>{b.name}</td>
                  <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid #eee' }}>₦{b.monthlySalary.toLocaleString()}</td>
                  <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid #eee', color: '#c0392b' }}>₦{b.deductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid #eee', color: '#1a7f37' }}>₦{b.additions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid #eee', fontWeight: 700 }}>₦{b.finalSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid #eee' }}>
                    <span className={`form-state-badge ${status === 'paid' ? 'live' : 'paused'}`}>{status === 'paid' ? 'Paid' : 'Pending'}</span>
                  </td>
                  <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}>
                    <button className="secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', marginRight: '0.4rem' }} onClick={() => setDetailsFor(b.employeeId)}>
                      View Details
                    </button>
                    {status === 'paid' ? (
                      <button className="secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => markStatus(b.employeeId, 'pending', b.finalSalary)}>
                        Mark Pending
                      </button>
                    ) : (
                      <button style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => markStatus(b.employeeId, 'paid', b.finalSalary)}>
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detailsFor && (
        <DetailsModal
          breakdown={breakdowns.find(b => b.employeeId === detailsFor)}
          status={payments[`${detailsFor}:${period}`]?.status || 'pending'}
          onClose={() => setDetailsFor(null)}
        />
      )}
    </div>
  )
}

export default PayrollPage
