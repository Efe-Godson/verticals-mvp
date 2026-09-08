// Small shared bits for the Payroll module: the modal shell (now an alias
// over the app-wide src/components/Modal.jsx), money/month helpers, and
// status-badge mapping.
import { useEffect, useRef, useState } from 'react'
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
  if (/failed to fetch|networkerror|timeout|net::/i.test(raw)) return 'Network problem - check your connection and try again.'
  if (/duplicate key|already exists|unique constraint/i.test(raw)) return 'That already exists.'
  if (/permission|not authorized|rls|row-level security|jwt/i.test(raw)) return "You don't have permission to do that. Try signing in again."
  if (/violates .*constraint|check constraint/i.test(raw)) return "That change isn't allowed here."
  if (/not found|no rows/i.test(raw)) return 'That record could no longer be found - it may have changed. Reload and try again.'
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

// Single-pick "combobox": a text input that filters a dropdown of employees
// as you type, for filter bars where a plain <select> would mean scrolling
// an unsearchable list - mobile's native picker has no search box at all.
// Shows the current pick when closed; focusing it reopens the list filtered
// by whatever's typed. `employees` is assumed already narrowed to whatever
// the caller wants offered (e.g. by location).
export function EmployeeSearchSelect({ employees = [], value, onChange, placeholder = 'All Employees', style }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef(null)
  const selected = employees.find(e => e.id === value)

  useEffect(() => {
    if (!open) return
    function onDocDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  const q = query.trim().toLowerCase()
  const visible = q ? employees.filter(e => e.full_name.toLowerCase().includes(q)) : employees

  function pick(id) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', ...style }}>
      <input
        type="text"
        value={open ? query : (selected ? selected.full_name : '')}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 0.25rem)', left: 0, right: 0, zIndex: 20,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
          maxHeight: '220px', overflowY: 'auto', boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
        }}>
          <div
            onMouseDown={() => pick('')}
            style={{ padding: '0.5rem 0.7rem', fontSize: '0.9rem', cursor: 'pointer', color: value ? 'var(--color-text)' : 'var(--color-primary)', fontWeight: value ? 400 : 600 }}
          >
            {placeholder}
          </div>
          {visible.length === 0 && <div style={{ padding: '0.5rem 0.7rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>No matches.</div>}
          {visible.map(e => (
            <div
              key={e.id}
              onMouseDown={() => pick(e.id)}
              style={{ padding: '0.5rem 0.7rem', fontSize: '0.9rem', cursor: 'pointer', background: e.id === value ? 'var(--color-bg)' : 'transparent' }}
            >
              {e.full_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Search-filterable multi-select checklist of employees, for modals that
// pick one or more staff from what can be a long roster (Add Entry, Bulk
// Entry) - a bare checkbox list has no way to jump to a name at all. Filters
// live as you type, matching name, employee number, and role. Whoever's
// picked also shows as removable chips above the list, so the selection
// stays visible even when those rows have scrolled out of view.
export function EmployeeChecklist({ employees = [], selectedIds, onToggle, style, maxHeight = '150px', emptyText = 'No employees yet.' }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const visible = q
    ? employees.filter(e => {
        const roles = roleList(e).join(' ').toLowerCase()
        return e.full_name.toLowerCase().includes(q) || (e.employee_number || '').toLowerCase().includes(q) || roles.includes(q)
      })
    : employees

  return (
    <div style={style}>
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
          {selectedIds.map(id => {
            const emp = employees.find(e => e.id === id)
            return (
              <span
                key={id}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
                  border: '1px solid var(--color-primary)', borderRadius: 999,
                  padding: '0.15rem 0.25rem 0.15rem 0.6rem', fontSize: '0.82rem', fontWeight: 600,
                }}
              >
                {emp?.full_name || 'Unknown'}
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  aria-label={`Remove ${emp?.full_name || 'employee'}`}
                  style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '1.05rem', lineHeight: 1, padding: '0 0.2rem' }}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
      {employees.length > 5 && (
        <input
          type="text"
          placeholder="Search employees…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.4rem' }}
        />
      )}
      <div style={{ maxHeight, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.5rem' }}>
        {employees.length === 0 && <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{emptyText}</div>}
        {employees.length > 0 && visible.length === 0 && <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>No matches.</div>}
        {visible.map(emp => {
          const on = selectedIds.includes(emp.id)
          return (
            <label
              key={emp.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.4rem',
                fontSize: '0.9rem', borderRadius: 6, cursor: 'pointer',
                fontWeight: on ? 600 : 400,
                background: on ? 'var(--color-primary-soft)' : 'transparent',
              }}
            >
              <input type="checkbox" checked={on} onChange={() => onToggle(emp.id)} />
              {emp.full_name}
            </label>
          )
        })}
      </div>
    </div>
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
