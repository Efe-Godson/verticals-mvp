// Small shared bits for the Payroll module: the modal shell (the app has no
// shared Modal component - this is the same recipe as ConfirmDialog.jsx),
// money/month helpers, and status-badge mapping.
import { formatNaira } from '../report/helpers/analysisUtils'
import { DEDUCTION_TYPES, ADDITION_TYPES, ENTRY_TYPE_LABELS } from './calculatePayroll'

export function money(value, decimals = 0) {
  return formatNaira(value, decimals)
}

export function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month) {
  const [y, m] = String(month).split('-').map(Number)
  if (!y || !m) return month
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

// "All Locations" + one option per active location. `value` is '' for all.
export function LocationFilter({ locations = [], value, onChange, style }) {
  if (!locations.length) return null
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={style}>
      <option value="">All Locations</option>
      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  )
}

// Keep rows whose employee is at `locationId` (or all when it's empty).
export function atLocation(rows, locationId, getEmployeeId, employeesById) {
  if (!locationId) return rows
  return rows.filter(r => {
    const emp = employeesById[getEmployeeId(r)]
    return emp && emp.primary_location_id === locationId
  })
}

export function MonthPicker({ value, onChange, style }) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: '0.5rem', ...style }}
    />
  )
}

// Centered overlay + card. `wide` bumps the max width; on narrow screens the
// card fills the viewport (doc section 52 - don't squeeze the desktop modal).
export function PayrollModal({ title, onClose, children, footer, wide = false, maxWidth }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius)',
          width: maxWidth || (wide ? '640px' : '480px'), maxWidth: '100%',
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.3rem', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h3>
          <button className="secondary" onClick={onClose} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>Close</button>
        </div>
        <div style={{ padding: '1.3rem', overflowY: 'auto' }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', padding: '1rem 1.3rem', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.9rem' }}>
      <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.3rem' }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>{hint}</span>}
    </label>
  )
}

const inputStyle = { width: '100%', boxSizing: 'border-box' }
export function TextInput(props) { return <input {...props} style={{ ...inputStyle, ...props.style }} /> }
export function Select(props) { return <select {...props} style={{ ...inputStyle, ...props.style }} /> }

// payroll_records.status -> form-state-badge variant + label
const RECORD_BADGE = {
  draft: ['draft', 'Draft'],
  pending_approval: ['paused', 'Pending Approval'],
  approved: ['live', 'Approved'],
  on_hold: ['paused', 'On Hold'],
  paid: ['live', 'Paid'],
  failed: ['archived', 'Failed'],
  cancelled: ['archived', 'Cancelled'],
}

export function RecordStatusBadge({ status }) {
  const [variant, label] = RECORD_BADGE[status] || ['draft', status]
  return <span className={`form-state-badge ${variant}`}>{label}</span>
}

const EMP_BADGE = {
  active: ['live', 'Active'],
  on_leave: ['paused', 'On Leave'],
  suspended: ['paused', 'Suspended'],
  inactive: ['archived', 'Inactive'],
  terminated: ['archived', 'Terminated'],
}

export function EmployeeStatusBadge({ status }) {
  const [variant, label] = EMP_BADGE[status] || ['draft', status]
  return <span className={`form-state-badge ${variant}`}>{label}</span>
}

// Grouped <optgroup> options for an entry-type <select>. `enabled` (array or
// null) narrows the list per the workspace's Settings (doc section 62).
export function entryTypeGroups(enabled) {
  const allow = (t) => !enabled || enabled.includes(t)
  return {
    deduction: DEDUCTION_TYPES.filter(allow).map(t => ({ value: t, label: ENTRY_TYPE_LABELS[t] })),
    addition: ADDITION_TYPES.filter(allow).map(t => ({ value: t, label: ENTRY_TYPE_LABELS[t] })),
  }
}

export function categoryOf(entryType) {
  return DEDUCTION_TYPES.includes(entryType) ? 'deduction' : 'addition'
}

export const DAY_ENTRY_TYPES = ['missed_day', 'extra_day']
