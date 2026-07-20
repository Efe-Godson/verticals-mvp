import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

function FormSettings() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [allowMultipleResponses, setAllowMultipleResponses] = useState(true)
  const [collectEmail, setCollectEmail] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')

  useEffect(() => {
    async function loadForm() {
      const { data, error } = await supabase.from('forms').select('*').eq('id', id).single()
      if (error) {
        setError('This form could not be found.')
      } else {
        setForm(data)
        setAllowMultipleResponses(data.settings?.allowMultipleResponses ?? true)
        setCollectEmail(data.settings?.collectEmail ?? false)
        setCompanyName(data.settings?.companyName ?? '')
        setCompanyPhone(data.settings?.companyPhone ?? '')
        setCompanyAddress(data.settings?.companyAddress ?? '')
      }
      setLoading(false)
    }
    loadForm()
  }, [id])

  async function saveSettings() {
    setSaving(true)
    setSaved(false)

    const newSettings = { allowMultipleResponses, collectEmail, companyName, companyPhone, companyAddress }

    const { error } = await supabase
      .from('forms')
      .update({ settings: newSettings })
      .eq('id', id)

    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  if (loading) return <div className="page">Loading settings...</div>
  if (error) return <div className="page" style={{ color: 'red' }}>{error}</div>

  return (
    <div className="page">
      <h1>{form.name} — Settings</h1>

      <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Responses</h3>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={allowMultipleResponses}
            onChange={(e) => setAllowMultipleResponses(e.target.checked)}
          />
          <span>
            Allow respondents to submit another response
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
              Shows a "Submit another response" option after someone submits the form.
            </div>
          </span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={collectEmail}
            onChange={(e) => setCollectEmail(e.target.checked)}
          />
          <span>
            Automatically collect respondent email addresses
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
              Adds a required email field at the top of the form, separate from your custom fields.
            </div>
          </span>
        </label>
      </div>

      <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Receipt Details</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          Shown on printed receipts for records with a Product Cart. Leave blank to just use the form name.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Business Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Efe's Market"
            style={{ padding: '0.5rem', width: '100%', marginTop: '0.3rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Phone Number</label>
          <input
            type="text"
            value={companyPhone}
            onChange={(e) => setCompanyPhone(e.target.value)}
            placeholder="e.g. 0803 123 4567"
            style={{ padding: '0.5rem', width: '100%', marginTop: '0.3rem' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Address</label>
          <input
            type="text"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            placeholder="e.g. 12 Airport Road, Benin City"
            style={{ padding: '0.5rem', width: '100%', marginTop: '0.3rem' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span style={{ color: '#1a7f37', fontSize: '0.9rem' }}>Saved</span>}
        <Link to={`/form/${id}`} style={{ marginLeft: 'auto', fontSize: '0.9rem', color: 'var(--color-primary)' }}>
          View public form →
        </Link>
      </div>
    </div>
  )
}

export default FormSettings