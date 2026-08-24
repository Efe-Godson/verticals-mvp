import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { InvoiceModal } from '../InvoiceModal'
import { printReceipt } from '../receiptPrint'
import { isRetailTemplate } from '../lib/templateFlags'
import { formatCell } from './recordsUiKit'
import { CartEditInput } from './CartEditInput'
import { RecordEditInput } from './RecordEditInput'
import { LoadingSpinner } from '../LoadingState'

export function RecordDetail({ form, record, fields, onClose, onUpdated, initialEditing = false, hideEdit = false }) {
  const { session } = useAuth()
  const hasCartField = fields.some(f => f.type === 'cart')
  const isRetail = isRetailTemplate(form)

  const [isEditing, setIsEditing] = useState(initialEditing)
  const [editedValues, setEditedValues] = useState(record.data)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [showHistory, setShowHistory] = useState(false)
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)

  function startEditing() {
    setEditedValues(record.data)
    setSaveError('')
    setIsEditing(true)
  }

  function cancelEditing() {
    setEditedValues(record.data)
    setIsEditing(false)
    setSaveError('')
  }

  async function saveEdits() {
    const changes = []

    fields.forEach(field => {
      const oldVal = record.data[field.id]
      const newVal = editedValues[field.id]

      if (field.type === 'cart') {
        const oldItems = oldVal?.items || []
        const newItems = newVal?.items || []
        const oldStr = oldItems.map(i => `${i.name} ×${i.quantity}`).join(', ') || '(empty cart)'
        const newStr = newItems.map(i => `${i.name} ×${i.quantity}`).join(', ') || '(empty cart)'
        if (oldStr !== newStr) {
          changes.push({
            submission_id: record.id,
            form_id: form.id,
            changed_by: session.user.id,
            changed_by_email: session.user.email,
            field_label: field.label,
            old_value: oldStr,
            new_value: newStr
          })
        }
        return
      }

      const oldStr = (oldVal === undefined || oldVal === null) ? '' : oldVal.toString()
      const newStr = (newVal === undefined || newVal === null) ? '' : newVal.toString()
      if (oldStr !== newStr) {
        changes.push({
          submission_id: record.id,
          form_id: form.id,
          changed_by: session.user.id,
          changed_by_email: session.user.email,
          field_label: field.label,
          old_value: oldStr,
          new_value: newStr
        })
      }
    })

    if (changes.length === 0) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    setSaveError('')

    const mergedData = { ...record.data, ...editedValues }

    const { error: updateError } = await supabase
      .from('submissions')
      .update({ data: mergedData })
      .eq('id', record.id)

    if (updateError) {
      setSaveError('Could not save changes: ' + updateError.message)
      setSaving(false)
      return
    }

    const { error: logError } = await supabase.from('submission_logs').insert(changes)
    if (logError) {
      // The edit itself succeeded, so logging failure shouldn't block the save,
      // but we surface it so it's not silently lost.
      setSaveError('Saved, but the change log failed to record: ' + logError.message)
    }

    setSaving(false)
    setIsEditing(false)
    onUpdated({ ...record, data: mergedData })
  }

  async function openHistory() {
    setShowHistory(true)
    setLoadingLogs(true)
    const { data, error } = await supabase
      .from('submission_logs')
      .select('*')
      .eq('submission_id', record.id)
      .order('created_at', { ascending: false })

    if (!error) setLogs(data)
    setLoadingLogs(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)', borderRadius: '12px', padding: '1.4rem 1.5rem',
          width: '520px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 18px 45px rgba(0,0,0,0.16)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>{showHistory ? 'Edit History' : 'Record Detail'}</h3>
            {!showHistory && (
              <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Submitted {new Date(record.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!showHistory && !isEditing && (
              <>
                {hasCartField && (
                  isRetail ? (
                    <button className="secondary" onClick={() => setShowInvoice(true)}>View Invoice</button>
                  ) : (
                    <button className="secondary" onClick={() => printReceipt(form, record)}>Print Receipt</button>
                  )
                )}
                <button className="secondary" onClick={openHistory}>History</button>
                {!hideEdit && (
                  <button className="secondary" onClick={startEditing}>Edit</button>
                )}
              </>
            )}
            {isEditing && (
              <>
                <button className="secondary" onClick={cancelEditing} disabled={saving}>Cancel</button>
                <button onClick={saveEdits} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </>
            )}
            {showHistory && (
              <button className="secondary" onClick={() => setShowHistory(false)}>Back</button>
            )}
            <button onClick={onClose}>Close</button>
          </div>
        </div>

        {saveError && <p style={{ color: '#c0392b', fontSize: '0.9rem', marginBottom: '1rem' }}>{saveError}</p>}

        {showHistory ? (
          loadingLogs ? (
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-muted)' }}><LoadingSpinner size={15} color="var(--color-muted)" /> Loading history...</p>
          ) : logs.length === 0 ? (
            <p style={{ color: 'var(--color-muted)' }}>No edits have been made to this record yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {logs.map(log => (
                <div key={log.id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.7rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{log.field_label}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
                    <span style={{ textDecoration: 'line-through', color: '#c0392b' }}>{log.old_value || '(empty)'}</span>
                    {' → '}
                    <span style={{ color: '#1a7f37' }}>{log.new_value || '(empty)'}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
                    {log.changed_by_email} · {new Date(log.created_at).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {fields.map(field => (
              <div key={field.id} style={{ marginBottom: '0.9rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>{field.label}</div>
                {isEditing && field.type === 'cart' ? (
                  <CartEditInput
                    field={field}
                    value={editedValues[field.id]}
                    onChange={(val) => setEditedValues({ ...editedValues, [field.id]: val })}
                  />
                ) : isEditing && field.type !== 'cart' ? (
                  <RecordEditInput
                    field={field}
                    value={editedValues[field.id]}
                    onChange={(val) => setEditedValues({ ...editedValues, [field.id]: val })}
                  />
                ) : (
                  <div style={{ fontSize: '1rem', padding: '0.55rem 0.7rem', borderRadius: '8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
                    {formatCell(record.data[field.id], field)}
                  </div>
                )}
              </div>
            ))}

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Submitted</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>
                {new Date(record.created_at).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {isRetail && showInvoice && (
        <InvoiceModal form={form} submission={record} onClose={() => setShowInvoice(false)} allowDateEdit />
      )}
    </div>
  )
}
