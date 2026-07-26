// Place at: src/PayrollDashboard.jsx
// Route: /form/:id/payroll — the payroll vertical's landing page (spec
// module 1 "Dashboard"). The per-employee Paid/Pending table lives at
// /form/:id/payroll/payments (spec module 6 "Payment Page").
import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { calculateEmployeePayroll, getDailySalary, eventPeriod, eventEmployeeId, EMPLOYEE_FIELDS, EVENT_FIELDS } from './payroll/calculatePayroll'
import StatTile from './report/components/StatTile'
import PieChart from './report/components/PieChart'
import HorizontalBarChart from './report/components/HorizontalBarChart'

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function PayrollSubNav({ id, active }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
      {[{ key: 'dashboard', label: 'Dashboard', to: `/form/${id}/payroll` }, { key: 'payments', label: 'Payments', to: `/form/${id}/payroll/payments` }].map(tab => (
        <Link
          key={tab.key}
          to={tab.to}
          style={{
            padding: '0.6rem 0.9rem', fontSize: '0.88rem', fontWeight: 600,
            color: active === tab.key ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: active === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const ACTIVITY_VERB = {
  'Missed Day': 'missed work',
  'Half Day': 'worked a half day',
  'Overtime': 'logged overtime',
  'Bonus': 'received a bonus',
  'Fine': 'received a fine',
  'Allowance': 'received an allowance',
  'Extra Work Day': 'worked an extra day',
  'Advance Payment': 'took a salary advance',
  'Other Adjustment': 'had an adjustment recorded',
}

function PayrollDashboard() {
  const { id } = useParams()

  const [form, setForm] = useState(null)
  const [eventsForm, setEventsForm] = useState(null)
  const [employees, setEmployees] = useState([])
  const [events, setEvents] = useState([])
  const [payments, setPayments] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState(currentPeriod())

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
          .order('created_at', { ascending: false })
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

  const dailySalaryTotal = useMemo(() => {
    const payrollSettings = form?.settings?.payroll
    return employees
      .filter(e => (e.data[EMPLOYEE_FIELDS.status] || 'Active') !== 'Inactive')
      .reduce((sum, e) => sum + getDailySalary(Number(e.data[EMPLOYEE_FIELDS.monthlySalary]) || 0, payrollSettings, period), 0)
  }, [employees, form, period])

  const dailySalaryData = useMemo(() => {
    const [year, month] = period.split('-').map(Number)
    const isCurrentPeriod = period === currentPeriod()
    const daysToShow = isCurrentPeriod ? new Date().getDate() : new Date(year, month, 0).getDate()
    return Array.from({ length: daysToShow }, (_, i) => ({
      label: new Date(year, month - 1, i + 1).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      count: Math.round(dailySalaryTotal),
    }))
  }, [period, dailySalaryTotal])

  if (loading) return <div className="page">Loading...</div>
  if (error) return <div className="page"><p style={{ color: 'red' }}>{error}</p></div>

  const totalDue = breakdowns.reduce((sum, b) => sum + b.finalSalary, 0)
  const totalDeductions = breakdowns.reduce((sum, b) => sum + b.deductions, 0)
  const totalAdditions = breakdowns.reduce((sum, b) => sum + b.additions, 0)
  const paidCount = breakdowns.filter(b => payments[`${b.employeeId}:${period}`]?.status === 'paid').length
  const pendingCount = breakdowns.length - paidCount

  const recentActivity = events.slice(0, 8).map(event => {
    const employee = employees.find(e => e.id === eventEmployeeId(event) || e.id === event.data[EVENT_FIELDS.employee]?.recordId)
    const type = event.data[EVENT_FIELDS.type]
    return {
      id: event.id,
      text: `${employee?.data[EMPLOYEE_FIELDS.name] || event.data[EVENT_FIELDS.employee]?.label || 'Someone'} ${ACTIVITY_VERB[type] || `had a "${type}" event`}`,
      when: timeAgo(event.created_at),
    }
  })

  return (
    <div className="page" style={{ maxWidth: '960px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{form.name}</div>
          <h1 style={{ margin: '0.2rem 0 0', fontSize: '1.6rem' }}>Payroll Dashboard</h1>
        </div>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ padding: '0.5rem' }} />
      </div>

      <PayrollSubNav id={id} active="dashboard" />

      {!eventsForm && (
        <p style={{ color: 'var(--color-muted)', marginBottom: '1rem' }}>
          No linked Salary Events form found — deductions and additions will show as zero until one is linked.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
        <StatTile label="Total Salary Due" value={`₦${totalDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <StatTile label="Total Staff" value={employees.length} />
        <StatTile label="Total Paid" value={paidCount} />
        <StatTile label="Total Pending" value={pendingCount} />
        <StatTile label="Total Deductions" value={`₦${totalDeductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <StatTile label="Total Bonuses/Adjustments" value={`₦${totalAdditions.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        <div className="card" style={{ padding: '1.2rem' }}>
          <HorizontalBarChart
            title="Daily Salary Liability"
            data={dailySalaryData}
            formatValue={(v) => `₦${v.toLocaleString()}`}
            maxBars={31}
            bare
          />
        </div>

        <div className="card" style={{ padding: '1.2rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>Payroll Progress</div>
          {breakdowns.length === 0 ? (
            <p style={{ color: '#999', fontSize: '0.85rem' }}>No employees yet.</p>
          ) : (
            <PieChart size={140} data={[{ label: 'Paid', count: paidCount }, { label: 'Pending', count: pendingCount }]} />
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '1.2rem', marginTop: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>Recent Activity</div>
        {recentActivity.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>No salary events recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentActivity.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', borderBottom: '1px solid #f0f0f0', paddingBottom: '0.5rem' }}>
                <span>{item.text}</span>
                <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap', marginLeft: '0.8rem' }}>{item.when}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default PayrollDashboard
export { PayrollSubNav }
