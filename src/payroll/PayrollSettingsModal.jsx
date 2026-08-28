// Payroll settings + Departments & Locations management, opened as a modal
// from the Staff page's gear button. Persisted into form.settings.payroll
// and the payroll_departments / payroll_locations tables.
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../Toast'
import ConfirmDialog from '../ConfirmDialog'
import { Field, Select, TextInput, PayrollModal } from './ui'
import { DEDUCTION_TYPES, ADDITION_TYPES, ENTRY_TYPE_LABELS } from './calculatePayroll'
import {
  payrollSettings, savePayrollSettings,
  listDepartments, createDepartment, updateDepartment, archiveDepartment,
  listLocations, createLocation, updateLocation, archiveLocation,
} from './payrollApi'

const ALL_TYPES = [...DEDUCTION_TYPES, ...ADDITION_TYPES]

export default function PayrollSettingsModal({ form, formId, reloadForm, onClose }) {
  const { showToast } = useToast()
  const initial = useMemo(() => payrollSettings(form), [form])

  const [daysMode, setDaysMode] = useState(initial.daysMode)
  const [workingDays, setWorkingDays] = useState(initial.workingDays)
  const [approvalRequired, setApprovalRequired] = useState(!!initial.approvalRequired)
  const [showEntryDates, setShowEntryDates] = useState(initial.showEntryDates !== false)
  const [enabled, setEnabled] = useState(initial.enabledEntryTypes || ALL_TYPES)
  const [saving, setSaving] = useState(false)

  const [departments, setDepartments] = useState([])
  const [locations, setLocations] = useState([])

  async function loadLists() {
    const [d, l] = await Promise.all([listDepartments(formId), listLocations(formId)])
    setDepartments(d)
    setLocations(l)
  }
  useEffect(() => { loadLists() }, [formId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleType(t) {
    setEnabled(cur => cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t])
  }

  async function saveRules() {
    setSaving(true)
    try {
      await savePayrollSettings(form, {
        daysMode,
        workingDays: Number(workingDays) || 30,
        approvalRequired,
        showEntryDates,
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
    <PayrollModal
      title="Payroll Settings"
      wide
      onClose={onClose}
      footer={<button className="secondary" onClick={onClose}>Done</button>}
    >
      <div className="card" style={{ padding: '1.3rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Payroll rules</h3>

        <Field label="Default currency"><TextInput value="NGN (₦)" disabled /></Field>
        <Field label="Payroll frequency"><TextInput value="Monthly" disabled /></Field>

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

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          <input type="checkbox" checked={showEntryDates} onChange={(e) => setShowEntryDates(e.target.checked)} />
          Show the date on each entry in the payroll breakdown
        </label>

        <div style={{ marginTop: '1rem' }}>
          <button onClick={saveRules} disabled={saving}>{saving ? 'Saving…' : 'Save Rules'}</button>
        </div>
      </div>

      <div className="card" style={{ padding: '1.3rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Entry types in use</h3>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.83rem', marginTop: 0 }}>
          Unchecked types are hidden from the Add Entry forms.
        </p>
        <div className="form-2col" style={{ rowGap: '0.35rem' }}>
          {ALL_TYPES.map(t => (
            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={enabled.includes(t)} onChange={() => toggleType(t)} />
              {ENTRY_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button onClick={saveRules} disabled={saving}>{saving ? 'Saving…' : 'Save Entry Types'}</button>
        </div>
      </div>

      <ManageList
        title="Departments"
        blurb="Departments employees can be assigned to."
        items={departments}
        onCreate={(name) => createDepartment(formId, name)}
        onRename={(id, name) => updateDepartment(id, { name })}
        onArchive={archiveDepartment}
        afterChange={loadLists}
      />

      <ManageList
        title="Business Locations"
        blurb="Branches / sites employees work at. Payroll can be viewed and run per location."
        items={locations}
        withCode
        onCreate={(name, extra) => createLocation(formId, { name, ...extra })}
        onRename={(id, name) => updateLocation(id, { name })}
        onArchive={archiveLocation}
        afterChange={loadLists}
      />
    </PayrollModal>
  )
}

function ManageList({ title, blurb, items, withCode, onCreate, onRename, onArchive, afterChange }) {
  const { showToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [confirmArchive, setConfirmArchive] = useState(null)
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await onCreate(name.trim(), withCode ? { code: code.trim() || null, city: city.trim() || null, state: state.trim() || null } : undefined)
      setName(''); setCode(''); setCity(''); setState('')
      setAddOpen(false)
      await afterChange()
      showToast(`${title.replace(/s$/, '')} added.`, 'success')
    } catch (err) {
      showToast('Could not add: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveRename(id) {
    if (!editName.trim()) { setEditingId(null); return }
    try {
      await onRename(id, editName.trim())
      setEditingId(null)
      await afterChange()
    } catch (err) {
      showToast('Could not rename: ' + err.message, 'error')
    }
  }

  async function doArchive(item) {
    setConfirmArchive(null)
    try {
      await onArchive(item.id)
      await afterChange()
      showToast(`${item.name} deactivated.`, 'success')
    } catch (err) {
      showToast('Could not deactivate: ' + err.message, 'error')
    }
  }

  return (
    <div className="card" style={{ padding: '1.3rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
        <button className="secondary" onClick={() => setAddOpen(true)}>+ Add</button>
      </div>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.83rem' }}>{blurb}</p>

      {items.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>None yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)' }}>
              {editingId === item.id ? (
                <>
                  <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} style={{ flex: 1 }} autoFocus onKeyDown={(e) => e.key === 'Enter' && saveRename(item.id)} />
                  <button onClick={() => saveRename(item.id)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}>Save</button>
                  <button className="secondary" onClick={() => setEditingId(null)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>
                    {item.name}
                    {item.code && <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}> · {item.code}</span>}
                  </span>
                  <button className="secondary" onClick={() => { setEditingId(item.id); setEditName(item.name) }} style={{ padding: '0.2rem 0.55rem', fontSize: '0.78rem' }}>Rename</button>
                  <button className="secondary" onClick={() => setConfirmArchive(item)} style={{ padding: '0.2rem 0.55rem', fontSize: '0.78rem' }}>Deactivate</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <PayrollModal
          title={`Add ${title.replace(/s$/, '')}`}
          onClose={() => setAddOpen(false)}
          footer={<>
            <button className="secondary" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</button>
            <button onClick={add} disabled={busy}>Add</button>
          </>}
        >
          <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          {withCode && (
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <div style={{ flex: 1 }}><Field label="Code (optional)"><TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. GRA" /></Field></div>
              <div style={{ flex: 1 }}><Field label="City (optional)"><TextInput value={city} onChange={(e) => setCity(e.target.value)} /></Field></div>
              <div style={{ flex: 1 }}><Field label="State (optional)"><TextInput value={state} onChange={(e) => setState(e.target.value)} /></Field></div>
            </div>
          )}
        </PayrollModal>
      )}

      {confirmArchive && (
        <ConfirmDialog
          title={`Deactivate ${confirmArchive.name}?`}
          message="It will no longer appear in the pickers. Existing employees keep their assignment."
          confirmLabel="Deactivate"
          danger
          onConfirm={() => doArchive(confirmArchive)}
          onCancel={() => setConfirmArchive(null)}
        />
      )}
    </div>
  )
}
