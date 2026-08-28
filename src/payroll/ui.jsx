// Small shared bits for the Payroll module: the modal shell (now an alias
// over the app-wide src/components/Modal.jsx), money/month helpers, and
// status-badge mapping.
import Modal from '../components/Modal'
import { formatNaira } from '../report/helpers/analysisUtils'
import { DEDUCTION_TYPES, ADDITION_TYPES, ENTRY_TYPE_LABELS } from './calculatePayroll'

// Segoe UI (the default on Windows/Chrome) draws the ₦ glyph with long
// horizontal strike bars that visually run into the following digits, so a
// figure reads as struck-through. A narrow no-break space after the symbol
// separates them cleanly.
export function money(value, decimals = 0) {
  return formatNaira(value, decimals).replace('₦', '₦ ')
}

// Turn a raw thrown error / Supabase error into one plain sentence for a
// toast. Keeps short human messages, replaces jargon, hides long dumps.
export function friendlyError(err, fallback = 'Something went wrong. Please try again.') {
  const raw = (err && (err.message || err.error_description || err.msg || err.details)) || String(err || '')
  if (!raw) return fallback
  if (/failed to fetch|networkerror|timeout|net::/i.test(raw)) return 'Network problem — check your connection and try again.'
  if (/duplicate key|already exists|unique constraint/i.test(raw)) return 'That already exists.'
  if (/permission|not authorized|rls|row-level security|jwt/i.test(raw)) return "You don't have permission to do that. Try signing in again."
  if (/violates .*constraint|check constraint/i.test(raw)) return "That change isn't allowed here."
  if (/not found|no rows/i.test(raw)) return 'That record could no longer be found — it may have changed. Reload and try again.'
  return raw.length > 160 ? fallback : raw
}

// Abbreviated currency for tight spaces (mobile KPI cards): ₦3.27M, ₦42.5K.
// Pair with title={money(value)} so the exact figure is a tap/hover away.
function trimZeros(s) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}
export function moneyShort(value) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}₦ ${trimZeros((abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2))}M`
  if (abs >= 10_000) return `${sign}₦ ${trimZeros((abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1))}K`
  return `${sign}₦ ${abs.toLocaleString()}`
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

// Now a thin alias over the shared <Modal> (src/components/Modal.jsx) so
// payroll modals get the same bottom-sheet-on-phone behaviour as the rest
// of the app. `wide` -> size="lg", otherwise size="md".
export function PayrollModal({ title, onClose, children, footer, wide = false, maxWidth, hideHeader = false }) {
  return (
    <Modal
      size={maxWidth ? 'lg' : (wide ? 'lg' : 'md')}
      onClose={onClose}
      title={title}
      footer={footer}
      hideHeader={hideHeader}
    >
      {children}
    </Modal>
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

// Generated payroll records only ever surface as two payment states:
// Paid (green) or Pending (amber). Every other stored token - the historic
// 'draft', plus 'cancelled'/'failed' edge cases - reads as Pending. These
// are semantic colours and deliberately do NOT follow the app theme.
export function RecordStatusBadge({ status }) {
  const paid = status === 'paid'
  return <span className={`form-state-badge ${paid ? 'live' : 'draft'}`}>{paid ? 'Paid' : 'Pending'}</span>
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

// Role / department / location are multi-value (job_titles / department_ids /
// location_ids). These read them back tolerant of the legacy single columns
// (job_title / department_id / primary_location_id) still present on older
// rows. See 20260828120000_payroll_multi_category.sql.
export function roleList(emp) {
  if (emp?.job_titles?.length) return emp.job_titles
  if (emp?.job_title) return emp.job_title.split('/').map(s => s.trim()).filter(Boolean)
  return []
}
export function deptIds(emp) {
  if (emp?.department_ids?.length) return emp.department_ids
  return emp?.department_id ? [emp.department_id] : []
}
export function locationIds(emp) {
  if (emp?.location_ids?.length) return emp.location_ids
  return emp?.primary_location_id ? [emp.primary_location_id] : []
}
export function namesFor(ids, nameById) {
  return (ids || []).map(id => nameById[id]).filter(Boolean).join(', ')
}

// payroll_departments / payroll_locations have no unique-name constraint, and
// the inline "+ Add" + the importer have historically created duplicates
// ("Main Kitchen" as three rows). Collapse same-name rows (case/space
// -insensitive) to the first for pickers and filters; keep the full list for
// resolving any id -> name.
export function dedupeByName(rows = []) {
  const seen = new Set()
  return rows.filter(r => {
    const k = String(r?.name || '').trim().toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export const DAY_ENTRY_TYPES = ['missed_day', 'extra_day']
