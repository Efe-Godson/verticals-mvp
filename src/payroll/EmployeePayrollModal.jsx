// The centre of the module (doc sections 23-25, 36, 51-53): one modal with
// the full breakdown for an employee's month, plus the actions that move the
// payment forward. Adding an entry here recalculates in place - no refresh.
import { useMemo, useState } from 'react'
import { useToast } from '../Toast'
import ConfirmDialog from '../ConfirmDialog'
import { PayrollModal, Field, TextInput, Select, money, monthLabel, friendlyError } from './ui'
import { calculateEmployeePayroll } from './calculatePayroll'
import { recalcEmployeeRecord, setRecordStatus, deleteEntry } from './payrollApi'
import AddEntryModal from './AddEntryModal'

const PAY_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
  { value: 'other', label: 'Other' },
]

// One payslip line: label left, amount right. Everything is explicit inline
// style - no shared CSS to leak a colour across rows.
function Row({ label, amount, color = 'var(--color-text)', amountColor, bold, small, indent, top, onRemove, disabled }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline',
      padding: small ? '0.12rem 0' : '0.4rem 0',
      paddingLeft: indent ? '1rem' : 0,
      marginTop: top ? '0.5rem' : 0,
      borderTop: top ? '1px solid var(--color-border)' : undefined,
      paddingTop: top ? '0.55rem' : undefined,
      fontSize: small ? '0.82rem' : '0.95rem',
      fontWeight: bold ? 700 : 400,
      color,
    }}>
      <span style={{ color: small ? 'var(--color-text)' : undefined }}>
        {label}
        {onRemove && <button className="secondary" onClick={onRemove} disabled={disabled} style={{ marginLeft: '0.4rem', padding: '0 0.35rem', fontSize: '0.7rem' }}>×</button>}
      </span>
      <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: amountColor }}>{amount}</span>
    </div>
  )
}

// "Late Arrival · Aug 12" / "Missed Day · Aug 6" - reason if there is one,
// else the entry-type label, plus the event date when `withDate` (the
// "Show entry dates" payroll setting).
function eventLabel(item, withDate) {
  const desc = (item.reason && item.reason.trim()) || item.label
  if (!withDate || !item.date) return desc
  const d = new Date(item.date)
  return isNaN(d) ? desc : `${desc} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
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
  const [payOpen, setPayOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null) // the entry pending removal
  const showDates = settings?.showEntryDates !== false
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
      showToast(friendlyError(err, "Couldn't refresh the breakdown."), 'error')
    }
  }

  async function removeEntry(id) {
    setBusy(true)
    try {
      await deleteEntry(formId, id)
      await refresh()
      showToast('Entry removed.', 'success')
    } catch (err) {
      showToast(friendlyError(err, "Couldn't remove that entry."), 'error')
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
      showToast(
        status === 'paid' ? `${employee.full_name} marked paid.` : `${employee.full_name} moved back to pending.`,
        'success',
      )
      // In the guided review, paying an employee advances to the next one.
      if (status === 'paid' && reviewPosition && onNext) { setPayOpen(false); onNext() }
    } catch (err) {
      showToast(friendlyError(err, "That didn't go through. Nothing was changed."), 'error')
    } finally {
      setBusy(false)
      setPayOpen(false)
    }
  }

  const isLastInReview = reviewPosition && reviewPosition.index >= reviewPosition.total

  return (
    <PayrollModal
      hideHeader
      onClose={onClose}
      wide
      footer={
        <>
          {reviewPosition && (
            <button className="secondary" onClick={onPrev} disabled={busy || reviewPosition.index <= 1} style={{ marginRight: 'auto' }}>← Back</button>
          )}
          {record.status === 'paid' ? (
            <>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Paid — record locked.</span>
              <button className="secondary" onClick={() => move('draft')} disabled={busy}>Mark pending</button>
            </>
          ) : locked ? (
            <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>This payroll is {record.status}.</span>
          ) : (
            <>
              <button className="secondary" onClick={() => setAddOpen(true)} disabled={busy}>+ Add Entry</button>
              <button onClick={() => setPayOpen(true)} disabled={busy}>Pay</button>
            </>
          )}
          {reviewPosition && (
            <button className="secondary" onClick={onNext} disabled={busy}>
              {isLastInReview ? 'Finish' : 'Next →'}
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

      {/* centred name, daily rate + month small underneath */}
      <div style={{ textAlign: 'center', marginBottom: '0.7rem' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.15, color: 'var(--color-text)' }}>{employee.full_name}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', marginTop: '0.15rem' }}>
          {money(breakdown.dailyRate, 2)} per day · {monthLabel(month)}
        </div>
      </div>

      <Row label="Base Pay" amount={money(breakdown.baseSalary)} bold />

      <div style={{ marginTop: '0.9rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--status-critical)' }}>
        Deductions
      </div>
      {deductions.map(item => (
        <Row key={item.id} small indent label={eventLabel(item, showDates)} amount={money(item.amount)}
          color="var(--status-critical)"
          onRemove={!locked ? () => setConfirmRemove(item) : undefined} disabled={busy} />
      ))}
      <Row top bold label="Total Deductions" amount={`- ${money(breakdown.totalDeductions)}`} color="var(--status-critical)" />

      <div style={{ marginTop: '0.9rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--status-good)' }}>
        Additions
      </div>
      {additions.map(item => (
        <Row key={item.id} small indent label={eventLabel(item, showDates)} amount={money(item.amount)}
          color="var(--status-good)"
          onRemove={!locked ? () => setConfirmRemove(item) : undefined} disabled={busy} />
      ))}
      <Row top bold label="Total Additions" amount={`+ ${money(breakdown.totalAdditions)}`} color="var(--status-good)" />

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        borderTop: '2px solid var(--color-text)', marginTop: '1rem', paddingTop: '0.8rem',
      }}>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text)' }}>Final Pay</span>
        <span style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
          {money(breakdown.finalAmount)}
        </span>
      </div>

      {record.status === 'paid' && (
        <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.6rem' }}>
          Paid {record.paid_at ? new Date(record.paid_at).toLocaleDateString('en-GB') : ''} · {PAY_METHODS.find(m => m.value === record.payment_method)?.label || record.payment_method || '—'}
          {record.payment_reference ? ` · ref ${record.payment_reference}` : ''}
        </p>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove this entry?"
          message={`"${eventLabel(confirmRemove, showDates)}" (${money(confirmRemove.amount)}) will be deleted and ${employee.full_name}'s payroll recalculated.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => { const id = confirmRemove.id; setConfirmRemove(null); removeEntry(id) }}
          onCancel={() => setConfirmRemove(null)}
        />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '0.9rem' }}>
            <span>Net Pay</span>
            <span style={{ fontSize: '1.1rem' }}>{money(breakdown.finalAmount)}</span>
          </div>
          <Field label="Payment Method">
            <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Reference (optional)">
            <TextInput value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Transfer / receipt reference" />
          </Field>
          {breakdown.finalAmount <= 0 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--status-serious)', margin: '0.2rem 0 0' }}>
              Net pay is {money(breakdown.finalAmount)} — double-check the deductions before marking this paid.
            </p>
          )}
          <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0.6rem 0 0' }}>
            Once paid, this month's record is locked. Corrections go through an adjustment in a later month.
          </p>
        </PayrollModal>
      )}
    </PayrollModal>
  )
}
