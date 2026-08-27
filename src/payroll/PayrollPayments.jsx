// Payments (doc sections 31-33): money movement, separate from the payroll
// calculation. Buckets approved records into Awaiting / Paid / Failed, shows
// the month's batch, and lets the owner mark rows paid without a payment API.
import { useEffect, useMemo, useState } from 'react'
import { usePayroll } from './PayrollShell'
import { useToast } from '../Toast'
import { LoadingState } from '../LoadingState'
import { ErrorState } from '../ErrorState'
import StatTile from '../report/components/StatTile'
import { MonthPicker, PayrollModal, Field, Select, TextInput, money, monthLabel, currentMonth } from './ui'
import {
  listEmployees, loadRecordsForMonth, listBatches, setRecordStatus, bulkSetRecordStatus,
} from './payrollApi'

const PAY_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
  { value: 'other', label: 'Other' },
]

function Bucket({ title, records, empById, children }) {
  return (
    <div className="card" style={{ padding: '1rem 1.1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '0.92rem' }}>{title}</strong>
        <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
          {records.length} · {money(records.reduce((s, r) => s + Number(r.final_amount || 0), 0))}
        </span>
      </div>
      {records.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>Nothing here.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {records.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', fontSize: '0.87rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.35rem' }}>
              <span>{empById[r.employee_id]?.full_name || '—'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <strong>{money(r.final_amount)}</strong>
                {children?.(r)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PayrollPayments() {
  const { formId } = usePayroll()
  const { showToast } = useToast()

  const [month, setMonth] = useState(currentMonth())
  const [employees, setEmployees] = useState([])
  const [records, setRecords] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payFor, setPayFor] = useState(null) // record being paid
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [emps, recs, bats] = await Promise.all([
        listEmployees(formId), loadRecordsForMonth(formId, month), listBatches(formId, month),
      ])
      setEmployees(emps)
      setRecords(recs)
      setBatches(bats)
    } catch (err) {
      setError(err.message || 'Could not load payments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [formId, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const empById = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  const awaiting = records.filter(r => r.status === 'approved')
  const paid = records.filter(r => r.status === 'paid')
  const failed = records.filter(r => r.status === 'failed')
  const onHold = records.filter(r => r.status === 'on_hold')

  async function confirmPay() {
    try {
      await setRecordStatus(formId, payFor, 'paid', { paymentMethod: method, paymentReference: reference })
      showToast('Marked as paid.', 'success')
      setPayFor(null)
      setReference('')
      load()
    } catch (err) {
      showToast('Could not mark paid: ' + err.message, 'error')
    }
  }

  async function payAllAwaiting() {
    if (!awaiting.length) return
    try {
      await bulkSetRecordStatus(formId, awaiting, 'paid', { paymentMethod: 'bank_transfer' })
      showToast(`${awaiting.length} payments marked paid.`, 'success')
      load()
    } catch (err) {
      showToast('Bulk pay failed: ' + err.message, 'error')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
        <MonthPicker value={month} onChange={setMonth} />
        {awaiting.length > 0 && <button onClick={payAllAwaiting}>Pay {awaiting.length} Employees</button>}
      </div>

      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
        <StatTile label="Awaiting Payment" value={money(awaiting.reduce((s, r) => s + Number(r.final_amount || 0), 0))} />
        <StatTile label="Paid" value={money(paid.reduce((s, r) => s + Number(r.final_amount || 0), 0))} />
        <StatTile label="On Hold" value={money(onHold.reduce((s, r) => s + Number(r.final_amount || 0), 0))} />
      </div>

      {batches.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.1rem', marginBottom: '1rem', background: 'var(--color-primary-soft)' }}>
          <strong style={{ fontSize: '0.92rem' }}>{monthLabel(month)} Payroll Batch</strong>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.3rem' }}>
            {batches[0].employee_count} employees · {money(batches[0].total_amount)} · {batches[0].status}
            {batches[0].approved_at ? ` · approved ${new Date(batches[0].approved_at).toLocaleDateString('en-GB')}` : ''}
          </div>
        </div>
      )}

      <Bucket title="Awaiting Payment" records={awaiting} empById={empById}>
        {(r) => <button className="secondary" style={{ padding: '0.2rem 0.55rem', fontSize: '0.78rem' }} onClick={() => setPayFor(r)}>Mark Paid</button>}
      </Bucket>
      <Bucket title="Paid" records={paid} empById={empById}>
        {(r) => <span style={{ fontSize: '0.76rem', color: 'var(--color-muted)' }}>{PAY_METHODS.find(m => m.value === r.payment_method)?.label || r.payment_method || ''}</span>}
      </Bucket>
      {failed.length > 0 && <Bucket title="Failed" records={failed} empById={empById} />}

      {payFor && (
        <PayrollModal
          title={`Mark ${empById[payFor.employee_id]?.full_name || 'employee'} paid`}
          onClose={() => setPayFor(null)}
          footer={<>
            <button className="secondary" onClick={() => setPayFor(null)}>Cancel</button>
            <button onClick={confirmPay}>Pay {money(payFor.final_amount)}</button>
          </>}
        >
          <Field label="Payment Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Reference (optional)">
            <TextInput value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </PayrollModal>
      )}
    </div>
  )
}
