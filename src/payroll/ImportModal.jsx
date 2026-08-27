// Guided Excel import for Employees and Entries. Download template -> fill ->
// upload -> preview + validate -> import. Nothing is written until the user
// presses Import; bad rows never enter the database.
import { useMemo, useRef, useState } from 'react'
import { useToast } from '../Toast'
import { PayrollModal, Select } from './ui'
import { readWorkbookRows } from '../recordsImport'
import { downloadEmployeeTemplate, downloadEntryTemplate } from './importer/templates'
import { parseEmployees, parseEntries } from './importer/parse'
import {
  createDepartment, createLocation, importEmployees, importEntries,
} from './payrollApi'

const th = { textAlign: 'left', padding: '0.4rem 0.6rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.76rem', color: 'var(--color-muted)', position: 'sticky', top: 0, background: 'var(--color-surface)' }
const td = { padding: '0.35rem 0.6rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.83rem' }

function StatusCell({ ready, text }) {
  return (
    <span style={{ color: ready ? 'var(--status-good)' : 'var(--status-serious)', fontSize: '0.8rem' }}>
      {ready ? '✓ Ready' : `⚠ ${text}`}
    </span>
  )
}

export default function ImportModal({ mode, formId, settings, departments = [], locations = [], employees = [], onClose, onSaved }) {
  const { showToast } = useToast()
  const isEmployees = mode === 'employees'
  const fileRef = useRef(null)

  const [step, setStep] = useState('intro')
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState(null)
  const [deptRes, setDeptRes] = useState({}) // { name: { action, mapTo } }
  const [locRes, setLocRes] = useState({})
  const [importing, setImporting] = useState(false)

  const employeesById = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees])

  function downloadTemplate() {
    if (isEmployees) downloadEmployeeTemplate(departments, locations)
    else downloadEntryTemplate(employees)
  }

  async function handleFile(file) {
    if (!file) return
    setFileName(file.name)
    try {
      const rows = await readWorkbookRows(file)
      const parsed = isEmployees
        ? parseEmployees(rows, { departments, locations })
        : parseEntries(rows, { employees })
      setResult(parsed)
      if (isEmployees) {
        setDeptRes(Object.fromEntries(parsed.newDepartments.map(n => [n, { action: 'create', mapTo: '' }])))
        setLocRes(Object.fromEntries(parsed.newLocations.map(n => [n, { action: 'create', mapTo: '' }])))
      }
      setStep('preview')
    } catch (err) {
      showToast('Could not read that file: ' + err.message, 'error')
    }
  }

  // A row is importable when it has no hard problems and (employees only) any
  // unknown dept/location it references is being created or mapped, not skipped.
  const importableRows = useMemo(() => {
    if (!result) return []
    return result.parsed.filter(row => {
      if (row.problems.length > 0) return false
      if (!isEmployees) return true
      if (row.needsDept && deptRes[row.deptName]?.action === 'skip') return false
      if (row.needsLoc && locRes[row.locName]?.action === 'skip') return false
      if (row.needsDept && deptRes[row.deptName]?.action === 'map' && !deptRes[row.deptName]?.mapTo) return false
      if (row.needsLoc && locRes[row.locName]?.action === 'map' && !locRes[row.locName]?.mapTo) return false
      return true
    })
  }, [result, deptRes, locRes, isEmployees])

  async function runImport() {
    setImporting(true)
    try {
      if (isEmployees) {
        const deptIdByName = {}
        const locIdByName = {}
        for (const [name, r] of Object.entries(deptRes)) {
          if (r.action === 'create') deptIdByName[name] = (await createDepartment(formId, name)).id
          else if (r.action === 'map') deptIdByName[name] = r.mapTo
        }
        for (const [name, r] of Object.entries(locRes)) {
          if (r.action === 'create') locIdByName[name] = (await createLocation(formId, { name })).id
          else if (r.action === 'map') locIdByName[name] = r.mapTo
        }
        const payload = importableRows.map(row => ({
          ...row.values,
          department_id: row.departmentId || deptIdByName[row.deptName] || null,
          primary_location_id: row.locationId || locIdByName[row.locName] || null,
        }))
        await importEmployees(formId, payload, settings)
        showToast(`Imported ${payload.length} employees.`, 'success')
      } else {
        const payload = importableRows.map(row => row.values)
        await importEntries(formId, payload, employeesById, settings)
        showToast(`Imported ${payload.length} entries.`, 'success')
      }
      onSaved?.()
      onClose()
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  const title = isEmployees ? 'Import Employees' : 'Import Payroll Entries'

  return (
    <PayrollModal
      title={title}
      onClose={onClose}
      wide
      maxWidth={step === 'preview' ? '760px' : undefined}
      footer={step === 'preview' ? (
        <>
          <button className="secondary" onClick={() => { setStep('intro'); setResult(null) }} disabled={importing}>Back</button>
          <button onClick={runImport} disabled={importing || importableRows.length === 0}>
            {importing ? 'Importing…' : `Import ${importableRows.length} ${isEmployees ? 'valid employees' : 'valid entries'}`}
          </button>
        </>
      ) : (
        <button className="secondary" onClick={onClose}>Cancel</button>
      )}
    >
      {step === 'intro' && (
        <>
          <p style={{ marginTop: 0, color: 'var(--color-muted)', fontSize: '0.9rem' }}>
            {isEmployees
              ? 'Add multiple employees from our Excel template.'
              : 'Record multiple fines, missed days, extra days and other adjustments from our Excel template.'}
          </p>
          <ol style={{ color: 'var(--color-muted)', fontSize: '0.86rem', paddingLeft: '1.1rem', lineHeight: 1.7 }}>
            <li>Download the template</li>
            <li>Fill in your {isEmployees ? 'employee information' : 'entries'}</li>
            <li>Upload the completed file — you'll see a preview before anything is saved</li>
          </ol>

          <button className="secondary" onClick={downloadTemplate} style={{ margin: '0.4rem 0 1.1rem' }}>↓ Download Excel Template</button>

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
            style={{ border: '1.5px dashed var(--color-border)', borderRadius: 'var(--radius)', padding: '1.6rem', textAlign: 'center', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '0.88rem' }}
          >
            Drag and drop your completed file here, or <span style={{ color: 'var(--color-primary)' }}>choose a file</span>
            <div style={{ fontSize: '0.76rem', marginTop: '0.3rem' }}>Accepted: .xlsx</div>
            {fileName && <div style={{ marginTop: '0.4rem', color: 'var(--color-text)' }}>{fileName}</div>}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
        </>
      )}

      {step === 'preview' && result && (
        <>
          <div style={{ fontSize: '0.9rem', marginBottom: '0.8rem' }}>
            <strong>{result.totalRows}</strong> rows detected ·{' '}
            <span style={{ color: 'var(--status-good)' }}>✓ {importableRows.length} ready</span>
            {result.totalRows - importableRows.length > 0 && (
              <span style={{ color: 'var(--status-serious)' }}> · ⚠ {result.totalRows - importableRows.length} need attention</span>
            )}
          </div>

          {isEmployees && (result.newDepartments.length > 0 || result.newLocations.length > 0) && (
            <div style={{ background: 'var(--color-warning-soft)', borderRadius: 'var(--radius)', padding: '0.7rem 0.9rem', marginBottom: '0.9rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>Some names don't exist yet</div>
              {result.newDepartments.map(name => (
                <Resolver
                  key={'d' + name} kind="department" name={name} options={departments}
                  value={deptRes[name]} onChange={(v) => setDeptRes(c => ({ ...c, [name]: v }))}
                />
              ))}
              {result.newLocations.map(name => (
                <Resolver
                  key={'l' + name} kind="location" name={name} options={locations}
                  value={locRes[name]} onChange={(v) => setLocRes(c => ({ ...c, [name]: v }))}
                />
              ))}
            </div>
          )}

          <div style={{ maxHeight: '340px', overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>Row</th>
                  {isEmployees
                    ? <><th style={th}>Employee</th><th style={th}>Department</th><th style={th}>Location</th><th style={th}>Salary</th></>
                    : <><th style={th}>Employee</th><th style={th}>Type</th><th style={th}>Reason</th><th style={th}>Qty/Amount</th></>}
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.parsed.map(row => {
                  const ready = importableRows.includes(row)
                  return (
                    <tr key={row.rowNum}>
                      <td style={td}>{row.rowNum}</td>
                      {isEmployees ? (
                        <>
                          <td style={td}>{row.values.full_name || '—'}</td>
                          <td style={td}>{row.deptName || '—'}</td>
                          <td style={td}>{row.locName || '—'}</td>
                          <td style={td}>{row.values.monthly_salary ? row.values.monthly_salary.toLocaleString() : '—'}</td>
                        </>
                      ) : (
                        <>
                          <td style={td}>{row.employeeName || '—'}</td>
                          <td style={td}>{row.typeLabel || '—'}</td>
                          <td style={td}>{row.values.reason || '—'}</td>
                          <td style={td}>{row.values.quantity != null ? `${row.values.quantity} d` : (row.values.amount ? row.values.amount.toLocaleString() : '—')}</td>
                        </>
                      )}
                      <td style={td}><StatusCell ready={ready} text={row.problems[0] || (isEmployees ? 'unresolved name' : 'skipped')} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PayrollModal>
  )
}

function Resolver({ kind, name, options, value = { action: 'create', mapTo: '' }, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem', padding: '0.2rem 0' }}>
      <span style={{ minWidth: '120px' }}><strong>{name}</strong> <span style={{ color: 'var(--color-muted)' }}>({kind})</span></span>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <input type="radio" checked={value.action === 'create'} onChange={() => onChange({ ...value, action: 'create' })} /> Create
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <input type="radio" checked={value.action === 'map'} onChange={() => onChange({ ...value, action: 'map' })} /> Map to
      </label>
      {value.action === 'map' && (
        <Select value={value.mapTo || ''} onChange={(e) => onChange({ ...value, mapTo: e.target.value })} style={{ width: 'auto' }}>
          <option value="">— pick —</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <input type="radio" checked={value.action === 'skip'} onChange={() => onChange({ ...value, action: 'skip' })} /> Skip rows
      </label>
    </div>
  )
}
