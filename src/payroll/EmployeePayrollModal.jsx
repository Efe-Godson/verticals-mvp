// The centre of the module (doc sections 23-25, 36, 51-53): one modal with
// the full breakdown for an employee's month, plus the actions that move the
// payment forward. Adding an entry here recalculates in place - no refresh.
import { useMemo, useState } from 'react'
import { useToast } from '../Toast'
import { PayrollModal, Field, TextInput, Select, money, monthLabel, RecordStatusBadge } from './ui'
import { calculateEmployeePayroll } from './calculatePayroll'
import { recalcEmployeeRecord, setRecordStatus, deleteEntry } from './payrollApi'
import AddEntryModal from './AddEntryModal'

const PAY_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
  { value: 'other', label: 'Other' },
]

function LineRow({ label, sub, value, strong, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.35rem 0', fontWeight: strong ? 700 : 400 }}>
      <span style={{ color: color || 'inherit' }}>
        {label}
        {sub && <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--color-muted)', fontWeight: 400 }}>{sub}</span>}
      </span>
      <span style={{ color: color || 'inherit', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

export default function EmployeePayrollModal({
  formId, form, month, employee, record: initialRecord, entries: initialEntries, settings,
  onClose, onChanged, reviewPosition, onNext, onPrev,
}) {
  const { showToast } = useToast()
  const [record, setRecord] = useState(initialRecord)
  const [entries, setEntries] = useState(initialEntries || [])
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [holdOpen, setHoldOpen] = useState(false)
  const [holdReason, setHoldReason] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [payMethod, setPayMethod] = useState('bank_transfer')
  const [payRef, setPayRef] = useState('')

  const locked = record.status === 'paid' || record.status === 'cancelled'

  const breakdown = useMemo(
    () => calculateEmployeePayroll({ employee, entries: entries.filter(e => e.status !== 'rejected'), payrollMonth: month, settings }),
    [employee, entries, month, settings]
  )

  const additions = breakdown.lineItems.filter(i => i.category === 'addition')
  const deductions = breakdown.lineItems.filter(i => i.category === 'deduction')

  async function refresh() {
    try {
      const { record: r, entries: e } = await recalcEmployeeRecord(formId, employee, month, form)
      setRecord(r)
      setEntries(e)
      onChanged?.()
    } catch (err) {
      showToast('Could not refresh: ' + err.message, 'error')
    }
  }

  async function removeEntry(id) {
    setBusy(true)
    try {
      await deleteEntry(formId, id)
      await refresh()
      showToast('Entry removed.', 'success')
    } catch (err) {
      showToast('Could not remove: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function move(status, meta) {
    setBusy(true)
    try {
      const updated = await setRecordStatus(formId, record, status, meta)
      setRecord(updated)
      onChanged?.()
      showToast(`Marked ${status.replace('_', ' ')}.`, 'success')
      // In the guided review, acting on this employee advances to the next one.
      if (reviewPosition && onNext) { setHoldOpen(false); setPayOpen(false); onNext() }
    } catch (err) {
      showToast('Could not update: ' + err.message, 'error')
    } finally {
      setBusy(false)
      setHoldOpen(false)
      setPayOpen(false)
    }
  }

  const isLastInReview = reviewPosition && reviewPosition.index >= reviewPosition.total

  return (
    <PayrollModal
      title={`${employee.full_name} — ${monthLabel(month)}${reviewPosition ? `  (${reviewPosition.index} of ${reviewPosition.total})` : ''}`}
      onClose={onClose}
      wide
      footer={
        <>
          {reviewPosition && onPrev && reviewPosition.index > 1 && (
            <button className="secondary" onClick={onPrev} disabled={busy} style={{ marginRight: 'auto' }}>← Back</button>
          )}
          {locked ? (
            <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
              This payroll is {record.status}.
            </span>
          ) : (
            <>
              <button className="secondary" onClick={() => setAddOpen(true)} disabled={busy}>+ Add Entry</button>
              {record.status !== 'on_hold' && <button className="secondary" onClick={() => setHoldOpen(true)} disabled={busy}>Hold</button>}
              {record.status !== 'approved' && <button className="secondary" onClick={() => move('approved')} disabled={busy}>Approve</button>}
              <button onClick={() => setPayOpen(true)} disabled={busy}>Pay</button>
            </>
          )}
          {reviewPosition && (
            <button className="secondary" onClick={onNext} disabled={busy}>
              {isLastInReview ? 'Finish' : (locked ? 'Next →' : 'Skip →')}
            </button>
          )}
        </>
      }
    >
      {reviewPosition && (
        <div style={{ marginBottom: '0.7rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>
            Reviewing {reviewPosition.index} of {reviewPosition.total}
          </div>
          <div style={{ height: 5, borderRadius: 999, background: 'var(--color-primary-soft)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((reviewPosition.index / reviewPosition.total) * 100)}%`, height: '100%', background: 'var(--color-primary)' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          {[employee.job_title, employee.department_name, employee.location_name].filter(Boolean).join(' · ')}
        </span>
        <RecordStatusBadge status={record.status} />
      </div>

      <LineRow label="Base Salary" sub={`Daily rate ${money(breakdown.dailyRate, 2)} · ${breakdown.daysInPeriod} days`} value={money(breakdown.baseSalary)} strong />

      <div style={{ marginTop: '0.9rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-muted)' }}>ADDITIONS</div>
      {additions.length === 0 && <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem', padding: '0.35rem 0' }}>No additions</div>}
      {additions.map(item => (
        <LineRow
          key={item.id}
          label={<>{item.label}{!locked && <button className="secondary" onClick={() => removeEntry(item.id)} style={{ marginLeft: '0.5rem', padding: '0 0.4rem', fontSize: '0.72rem' }} disabled={busy}>×</button>}</>}
          sub={item.reason}
          value={`+${money(item.amount, 2)}`}
          color="var(--status-good)"
        />
      ))}
      <LineRow label="Total Additions" value={`+${money(breakdown.totalAdditions)}`} strong color="var(--status-good)" />

      <div style={{ marginTop: '0.9rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-muted)' }}>DEDUCTIONS</div>
      {deductions.length === 0 && <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem', padding: '0.35rem 0' }}>No deductions</div>}
      {deductions.map(item => (
        <LineRow
          key={item.id}
          label={<>{item.label}{!locked && <button className="secondary" onClick={() => removeEntry(item.id)} style={{ marginLeft: '0.5rem', padding: '0 0.4rem', fontSize: '0.72rem' }} disabled={busy}>×</button>}</>}
          sub={item.reason}
          value={`-${money(item.amount, 2)}`}
          color="var(--status-critical)"
        />
      ))}
      <LineRow label="Total Deductions" value={`-${money(breakdown.totalDeductions)}`} strong color="var(--status-critical)" />

      <div style={{ borderTop: '2px solid var(--color-border)', marginTop: '0.9rem', paddingTop: '0.6rem' }}>
        <LineRow
          label={<span style={{ fontSize: '1.05rem' }}>Final Amount</span>}
          sub={`${money(breakdown.baseSalary)} + ${money(breakdown.totalAdditions)} − ${money(breakdown.totalDeductions)}`}
          value={<span style={{ fontSize: '1.15rem' }}>{money(breakdown.finalAmount)}</span>}
          strong
        />
      </div>

      {record.status === 'on_hold' && record.hold_reason && (
        <p style={{ fontSize: '0.82rem', color: 'var(--status-serious)', marginTop: '0.6rem' }}>On hold: {record.hold_reason}</p>
      )}
      {record.status === 'paid' && (
        <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.6rem' }}>
          Paid {record.paid_at ? new Date(record.paid_at).toLocaleDateString('en-GB') : ''} · {PAY_METHODS.find(m => m.value === record.payment_method)?.label || record.payment_method || '—'}
          {record.payment_reference ? ` · ref ${record.payment_reference}` : ''}
        </p>
      )}

      {addOpen && (
        <AddEntryModal
          formId={formId}
          settings={settings}
          employees={[employee]}
          presetEmployeeId={employee.id}
          onClose={() => setAddOpen(false)}
          onSaved={refresh}
        />
      )}

      {holdOpen && (
        <PayrollModal
          title="Hold Payment"
          onClose={() => setHoldOpen(false)}
          footer={<>
            <button className="secondary" onClick={() => setHoldOpen(false)}>Cancel</button>
            <button onClick={() => move('on_hold', { holdReason })} disabled={busy}>Hold Payment</button>
          </>}
        >
          <Field label="Reason (optional)" hint="The employee stays in payroll but is excluded from bulk payment.">
            <TextInput value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="e.g. Awaiting management review" />
          </Field>
        </PayrollModal>
      )}

      {payOpen && (
        <PayrollModal
          title={`Pay ${employee.full_name}`}
          onClose={() => setPayOpen(false)}
          footer={<>
            <button className="secondary" onClick={() => setPayOpen(false)}>Cancel</button>
            <button onClick={() => move('paid', { paymentMethod: payMethod, paymentReference: payRef })} disabled={busy}>
              Pay {money(breakdown.finalAmount)}
            </button>
          </>}
        >
          <LineRow label="Final Amount" value={<span style={{ fontSize: '1.1rem' }}>{money(breakdown.finalAmount)}</span>} strong />
          <Field label="Payment Method">
            <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Reference (optional)">
            <TextInput value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Transfer / receipt reference" />
          </Field>
        </PayrollModal>
      )}
    </PayrollModal>
  )
}
