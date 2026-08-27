// Payroll settings (doc sections 59, 62). Persisted into form.settings.payroll.
import { useMemo, useState } from 'react'
import { usePayroll } from './PayrollShell'
import { useToast } from '../Toast'
import { Field, Select, TextInput } from './ui'
import { DEDUCTION_TYPES, ADDITION_TYPES, ENTRY_TYPE_LABELS } from './calculatePayroll'
import { payrollSettings, savePayrollSettings } from './payrollApi'

const ALL_TYPES = [...DEDUCTION_TYPES, ...ADDITION_TYPES]

export default function PayrollSettings() {
  const { form, reloadForm } = usePayroll()
  const { showToast } = useToast()
  const initial = useMemo(() => payrollSettings(form), [form])

  const [daysMode, setDaysMode] = useState(initial.daysMode)
  const [workingDays, setWorkingDays] = useState(initial.workingDays)
  const [approvalRequired, setApprovalRequired] = useState(!!initial.approvalRequired)
  const [enabled, setEnabled] = useState(initial.enabledEntryTypes || ALL_TYPES)
  const [saving, setSaving] = useState(false)

  function toggleType(t) {
    setEnabled(cur => cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t])
  }

  async function save() {
    setSaving(true)
    try {
      await savePayrollSettings(form, {
        daysMode,
        workingDays: Number(workingDays) || 30,
        approvalRequired,
        enabledEntryTypes: enabled.length === ALL_TYPES.length ? null : enabled,
        currency: 'NGN',
      })
      await reloadForm()
      showToast('Settings saved.', 'success')
    } catch (err) {
      showToast('Could not save: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div className="card" style={{ padding: '1.3rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Payroll rules</h3>

        <Field label="Default currency">
          <TextInput value="NGN (₦)" disabled />
        </Field>

        <Field label="Payroll frequency">
          <TextInput value="Monthly" disabled />
        </Field>

        <Field label="Daily rate calculation" hint="How a monthly salary is divided into a daily rate for missed / extra days.">
          <Select value={daysMode} onChange={(e) => setDaysMode(e.target.value)}>
            <option value="calendar_days">Calendar days in the month</option>
            <option value="fixed_working_days">Fixed number of working days</option>
          </Select>
        </Field>

        {daysMode === 'fixed_working_days' && (
          <Field label="Working days per month">
            <TextInput type="number" min="1" max="31" value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} />
          </Field>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          <input type="checkbox" checked={approvalRequired} onChange={(e) => setApprovalRequired(e.target.checked)} />
          Require payroll approval before payment
        </label>
      </div>

      <div className="card" style={{ padding: '1.3rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Entry types in use</h3>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.83rem', marginTop: 0 }}>
          Unchecked types are hidden from the Add Entry forms.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem 1rem' }}>
          {ALL_TYPES.map(t => (
            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={enabled.includes(t)} onChange={() => toggleType(t)} />
              {ENTRY_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
    </div>
  )
}
