import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import PosSidePanel from './PosSidePanel'

function FormSettings() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isFocusMode = searchParams.get('focus') === '1'
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [allowMultipleResponses, setAllowMultipleResponses] = useState(true)
  const [collectEmail, setCollectEmail] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [receiptPaperWidth, setReceiptPaperWidth] = useState(80)
  const [staffReportRange, setStaffReportRange] = useState('today')

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
        setReceiptPaperWidth(data.settings?.receiptPaperWidth ?? 80)
        setStaffReportRange(data.settings?.staffReportRange ?? 'today')
      }
      setLoading(false)
    }
    loadForm()
  }, [id])

  async function saveSettings() {
    setSaving(true)
    setSaved(false)
    setSaveError('')

    // `settings` is a shared JSONB bag - other pages stash their own keys in
    // it (templateSlug/locationName from locations.js, primaryFormId/
    // payrollRole from Templates.jsx, hiddenColumns/recordPresets from
    // Records.jsx, payroll from PayrollPage.jsx...). Replacing it outright
    // used to silently delete all of those the moment this page saved.
    const newSettings = {
      ...form.settings,
      allowMultipleResponses, collectEmail, companyName, companyPhone, companyAddress, receiptPaperWidth,
      staffReportRange,
    }

    const { error } = await supabase
      .from('forms')
      .update({ settings: newSettings })
      .eq('id', id)

    setSaving(false)
    if (error) {
      setSaveError('Could not save: ' + error.message)
      return
    }
    setForm(current => ({ ...current, settings: newSettings }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="page">Loading settings...</div>
  if (error) return <div className="page" style={{ color: 'red' }}>{error}</div>

  const hasCartField = form.fields?.some(f => f.type === 'cart')

  return (
    <div className="page">
      {isFocusMode && <PosSidePanel formId={form.id} hasCartField={hasCartField} />}
      <h1>{form.name}: Settings</h1>

      {/* "Submit another response" and email collection are about a public
          respondent filling this form out themselves - meaningless for a
          POS/restaurant-style form, where orders are entered by staff via
          the order screen, not submitted by the customer. */}
      {!hasCartField && (
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
      )}

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

        <div style={{ marginBottom: '1.2rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Address</label>
          <input
            type="text"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            placeholder="e.g. 12 Airport Road, Benin City"
            style={{ padding: '0.5rem', width: '100%', marginTop: '0.3rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.2rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Printer Width</label>
          <select
            value={receiptPaperWidth}
            onChange={(e) => setReceiptPaperWidth(Number(e.target.value))}
            style={{ padding: '0.5rem', width: '100%', marginTop: '0.3rem' }}
          >
            <option value={58}>58mm (small thermal printers)</option>
            <option value={80}>80mm (standard thermal printers)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.5rem' }}>
            Preview
          </label>
          <div style={{ background: '#eef0f2', padding: '1.2rem', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              fontFamily: "'Courier New', monospace", fontSize: '12px', color: '#000',
              width: `${receiptPaperWidth}mm`, background: 'white', padding: '5mm 4mm',
              boxShadow: '0 2px 10px rgba(0,0,0,0.12)'
            }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '17px', letterSpacing: '0.5px', marginBottom: '4px', textTransform: 'uppercase' }}>
                {companyName.trim() || form.name}
              </div>
              {companyAddress.trim() && <div style={{ textAlign: 'center', fontSize: '10px', color: '#333' }}>{companyAddress}</div>}
              {companyPhone.trim() && <div style={{ textAlign: 'center', fontSize: '10px', color: '#333' }}>{companyPhone}</div>}
              <div style={{ textAlign: 'center', fontSize: '10px', margin: '8px 0 4px' }}>Sat 10/08/2026 · 7:45 PM</div>
              <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
              {[{ n: 'Grilled Chicken', q: 2, p: 12.99 }, { n: 'Soft Drink', q: 1, p: 2.50 }].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', margin: '4px 0' }}>
                  <span>{i + 1}. {item.n} ×{item.q}</span>
                  <span>{(item.p * item.q).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px', margin: '4px 0' }}>
                <span>TOTAL</span>
                <span>28.48</span>
              </div>
              <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', marginTop: '10px' }}>Thank you for coming!</div>
              <div style={{ textAlign: 'center', fontSize: '9px', letterSpacing: '1px', marginTop: '6px' }}>#ABC123456789#</div>
              <div style={{ textAlign: 'center', fontSize: '9px', color: '#999', marginTop: '4px' }}>Powered by Verticals</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Staff Access</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          Staff logins can now open Reports for this form - this caps how far back they're allowed to look. You (the owner) always see everything regardless of this setting.
        </p>
        <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Staff Report Range</label>
        <select
          value={staffReportRange}
          onChange={(e) => setStaffReportRange(e.target.value)}
          style={{ padding: '0.5rem', width: '100%', marginTop: '0.3rem' }}
        >
          <option value="today">Today</option>
          <option value="7days">Last 7 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span style={{ color: '#1a7f37', fontSize: '0.9rem' }}>Saved</span>}
        {saveError && <span style={{ color: '#c0392b', fontSize: '0.9rem' }}>{saveError}</span>}
        <Link to={`/form/${id}`} style={{ marginLeft: 'auto', fontSize: '0.9rem', color: 'var(--color-primary)' }}>
          View public form →
        </Link>
      </div>
    </div>
  )
}

export default FormSettings