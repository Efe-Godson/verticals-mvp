// Place at: src/expenses/QuickAddExpense.jsx
// The fast path: Amount + Category + Save is a valid expense. Everything
// else is optional under "+ Add details". Opened as a Modal from
// ExpenseOverview (and from PosSidePanel's "Add Expense" link).
import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import Modal from '../components/Modal'
import { formatNaira } from '../report/helpers/analysisUtils'
import { visibleExpenseFields, QUICK_FIELD_IDS, fieldById } from './expenseFields'

const todayISO = () => new Date().toISOString().slice(0, 10)

function DetailInput({ field, value, onChange }) {
  const common = { value: value ?? '', onChange: (e) => onChange(e.target.value), style: { width: '100%' } }
  if (field.type === 'longtext') return <textarea rows={3} {...common} />
  if (field.type === 'dropdown') {
    return (
      <select {...common}>
        <option value="">Select…</option>
        {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (field.type === 'date') return <input type="date" {...common} />
  if (field.type === 'time') return <input type="time" {...common} />
  if (field.type === 'number') return <input type="number" inputMode="decimal" {...common} />
  if (field.type === 'fileupload') return <ReceiptInput field={field} value={value} onChange={onChange} />
  return <input type="text" {...common} />
}

function ReceiptInput({ field, value, onChange }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `receipts/${Date.now()}-${safe}`
    const { error } = await supabase.storage.from('form-uploads').upload(path, file)
    setBusy(false)
    if (error) { showToast('Could not upload the receipt: ' + error.message, 'error'); return }
    const { data } = supabase.storage.from('form-uploads').getPublicUrl(path)
    onChange({ url: data.publicUrl, name: file.name })
  }
  return (
    <div>
      <input type="file" accept={field.acceptTypes || 'image/*,.pdf'} onChange={pick} disabled={busy} />
      {busy && <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginLeft: '0.5rem' }}>Uploading…</span>}
      {value?.name && !busy && <span style={{ fontSize: '0.8rem', color: 'var(--status-good)', marginLeft: '0.5rem' }}>✓ {value.name}</span>}
    </div>
  )
}

export default function QuickAddExpense({ form, onClose, onSaved }) {
  const { showToast } = useToast()
  const categoryField = fieldById(form, 'category')
  const detailFields = visibleExpenseFields(form).filter(f => !QUICK_FIELD_IDS.includes(f.id))

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [details, setDetails] = useState({})
  const [saving, setSaving] = useState(false)

  const amountNum = Number(amount)
  const canSave = amountNum > 0 && !!category && !saving

  function setDetail(id, v) {
    setDetails(d => ({ ...d, [id]: v }))
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    const data = { amount: amountNum, category }
    for (const f of detailFields) {
      const v = details[f.id]
      if (v !== undefined && v !== '' && v !== null) data[f.id] = v
    }
    if (!data.date) data.date = todayISO()

    const { error } = await supabase.from('submissions').insert([{ form_id: form.id, data }])
    setSaving(false)
    if (error) { showToast('Could not save: ' + error.message, 'error'); return }
    showToast(`Expense recorded - ${formatNaira(amountNum)}`, 'success')
    onSaved?.()
    onClose?.()
  }

  return (
    <Modal size="sm" onClose={onClose} title="Add expense">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <div>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>How much did you spend?</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-muted)' }}>₦</span>
            <input
              type="number" inputMode="decimal" autoFocus placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              style={{ flex: 1, fontSize: '1.6rem', fontWeight: 700, padding: '0.5rem 0.6rem' }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>What was it for?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {(categoryField?.options || []).map(opt => {
              const active = category === opt
              return (
                <button
                  key={opt} type="button" onClick={() => setCategory(opt)}
                  className={active ? '' : 'secondary'}
                  style={{ padding: '0.4rem 0.7rem', fontSize: '0.85rem' }}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>

        {showDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            {detailFields.map(f => (
              <div key={f.id}>
                <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' }}>{f.label}</label>
                <DetailInput field={f} value={details[f.id]} onChange={(v) => setDetail(f.id, v)} />
              </div>
            ))}
          </div>
        )}

        {!showDetails && (
          <button type="button" className="secondary" onClick={() => setShowDetails(true)} style={{ alignSelf: 'flex-start', fontSize: '0.85rem' }}>
            + Add details
          </button>
        )}

        <button type="button" onClick={save} disabled={!canSave} style={{ width: '100%', minHeight: 48, fontSize: '1rem' }}>
          {saving ? 'Saving…' : 'Save expense'}
        </button>
      </div>
    </Modal>
  )
}
