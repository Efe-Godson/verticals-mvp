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

// A ledger row: label in column 1, an optional line-item amount in column 2,
// and an optional running-total in column 3 (Base Pay / subtotals / Net Pay
// stack down that outer column so the arithmetic reads top to bottom).
function LRow({ label, sub, amount, total, amountColor, totalColor, strong, grand, indent, muted, top, onRemove, disabled }) {
  const bold = strong || grand
  return (
    <>
      <div className={`pr-lbl${indent ? ' i' : ''}${top ? ' t' : ''}${grand ? ' g' : ''}`}
        style={{ color: muted ? 'var(--color-muted)' : undefined, fontWeight: bold ? 700 : undefined, fontSize: grand ? '1.05rem' : undefined }}>
        {label}
        {onRemove && <button className="secondary" onClick={onRemove} disabled={disabled} style={{ marginLeft: '0.4rem', padding: '0 0.35rem', fontSize: '0.7rem' }}>×</button>}
        {sub && <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--color-muted)', fontWeight: 400 }}>{sub}</span>}
      </div>
      <div className={`pr-amt${top ? ' t' : ''}`} style={{ color: amountColor }}>{amount || ''}</div>
      <div className={`pr-amt${top ? ' t' : ''}${grand ? ' g' : ''}`}
        style={{ color: totalColor, fontWeight: bold ? 800 : undefined, fontSize: grand ? '1.2rem' : undefined }}>
        {total || ''}
      </div>
    </>
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
          {reviewPosition && (
            <button className="secondary" onClick={onPrev} disabled={busy || reviewPosition.index <= 1} style={{ marginRight: 'auto' }}>← Back</button>
          )}
          {locked ? (
            <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>This payroll is {record.status}.</span>
          ) : (
            <>
              <button className="secondary" onClick={() => setAddOpen(true)} disabled={busy}>+ Add Entry</button>
              {!reviewPosition && record.status !== 'on_hold' && <button className="secondary" onClick={() => setHoldOpen(true)} disabled={busy}>Hold</button>}
              <button onClick={() => setPayOpen(true)} disabled={busy}>Pay</button>
            </>
          )}
          {reviewPosition && (
            <button onClick={onNext} disabled={busy}>
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

      <style>{`
        .pr-ledger { display: grid; grid-template-columns: 1fr minmax(84px, auto) minmax(96px, auto);
          column-gap: 0.9rem; row-gap: 0.1rem; align-items: baseline; margin-top: 0.4rem; }
        .pr-ledger .pr-lbl { padding: 0.32rem 0; }
        .pr-ledger .pr-lbl.i { padding-left: 0.9rem; }
        .pr-ledger .pr-amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding: 0.32rem 0; }
        .pr-ledger .pr-sec { grid-column: 1 / -1; margin-top: 0.75rem; font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-muted); }
        .pr-ledger .t { border-bottom: 1px dotted var(--color-border); }
        .pr-ledger .g { border-top: 2px solid var(--color-border); margin-top: 0.35rem; padding-top: 0.55rem; }
      `}</style>

      {/* centred name, with the daily rate small above it */}
      <div style={{ textAlign: 'center', marginBottom: '0.4rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {money(breakdown.dailyRate, 2)} / day · {breakdown.daysInPeriod} days
        </div>
        <div style={{ fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.15, margin: '0.1rem 0 0.35rem' }}>
          {employee.full_name}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--color-muted)' }}>
          <span>{[employee.job_title, employee.department_name, employee.location_name].filter(Boolean).join(' · ')}</span>
          <RecordStatusBadge status={record.status} />
        </div>
      </div>

      <div className="pr-ledger">
        <LRow top label="Base Pay" total={money(breakdown.baseSalary)} />

        <div className="pr-sec">Deductions</div>
        {deductions.length === 0
          ? <LRow indent muted label="No deductions" />
          : deductions.map(item => (
            <LRow key={item.id} indent
              label={item.label} sub={item.reason}
              amount={`− ${money(item.amount, 2)}`} amountColor="var(--status-critical)"
              onRemove={!locked ? () => removeEntry(item.id) : undefined} disabled={busy}
            />
          ))}
        <LRow top label="Total Deductions" total={`− ${money(breakdown.totalDeductions)}`} totalColor="var(--status-critical)" strong />

        <div className="pr-sec">Additions</div>
        {additions.length === 0
          ? <LRow indent muted label="No additions" />
          : additions.map(item => (
            <LRow key={item.id} indent
              label={item.label} sub={item.reason}
              amount={`+ ${money(item.amount, 2)}`} amountColor="var(--status-good)"
              onRemove={!locked ? () => removeEntry(item.id) : undefined} disabled={busy}
            />
          ))}
        <LRow top label="Total Additions" total={`+ ${money(breakdown.totalAdditions)}`} totalColor="var(--status-good)" strong />

        <LRow grand label="Net Pay" total={money(breakdown.finalAmount)} />
      </div>

      {record.status === 'on_hold' && record.hold_reason && (
        <p style={{ fontSize: '0.82rem', color: 'var(--status-serious)', marginTop: '0.6rem' }}>On hold: {record.hold_reason}</p>
      )}
      {reviewPosition && !locked && record.status !== 'on_hold' && (
        <button className="secondary" onClick={() => setHoldOpen(true)} disabled={busy}
          style={{ marginTop: '0.8rem', fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}>
          Hold payment
        </button>
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
        </PayrollModal>
      )}
    </PayrollModal>
  )
}
