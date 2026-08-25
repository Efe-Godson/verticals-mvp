import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import PosSidePanel from './PosSidePanel'
import { LoadingState } from './LoadingState'
import { ErrorState } from './ErrorState'
import { isRetailTemplate } from './lib/templateFlags'
import { LOGO_ICONS, LogoIcon } from './invoiceLogos'

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
  const [companyEmail, setCompanyEmail] = useState('')
  const [receiptPaperWidth, setReceiptPaperWidth] = useState(80)
  const [staffReportRange, setStaffReportRange] = useState('today')
  const [aiFillRules, setAiFillRules] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoIconKey, setLogoIconKey] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [showVerticalsBranding, setShowVerticalsBranding] = useState(true)
  const [defaultInvoiceView, setDefaultInvoiceView] = useState('compact')
  const [paymentBankName, setPaymentBankName] = useState('')
  const [paymentAccountNumber, setPaymentAccountNumber] = useState('')
  const [paymentAccountName, setPaymentAccountName] = useState('')
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [invoiceAuthorizedBy, setInvoiceAuthorizedBy] = useState('')
  const [invoiceAuthorizedDesignation, setInvoiceAuthorizedDesignation] = useState('')

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
        setCompanyEmail(data.settings?.companyEmail ?? '')
        setReceiptPaperWidth(data.settings?.receiptPaperWidth ?? 80)
        setStaffReportRange(data.settings?.staffReportRange ?? 'today')
        setAiFillRules(data.settings?.aiFillRules ?? '')
        setLogoUrl(data.settings?.logoUrl ?? '')
        setLogoIconKey(data.settings?.logoIconKey ?? '')
        setShowVerticalsBranding(data.settings?.showVerticalsBranding ?? true)
        setDefaultInvoiceView(data.settings?.defaultInvoiceView ?? 'compact')
        setPaymentBankName(data.settings?.paymentBankName ?? '')
        setPaymentAccountNumber(data.settings?.paymentAccountNumber ?? '')
        setPaymentAccountName(data.settings?.paymentAccountName ?? '')
        setInvoiceNotes(data.settings?.invoiceNotes ?? '')
        setInvoiceAuthorizedBy(data.settings?.invoiceAuthorizedBy ?? '')
        setInvoiceAuthorizedDesignation(data.settings?.invoiceAuthorizedDesignation ?? '')
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
      allowMultipleResponses, collectEmail, companyName, companyPhone, companyAddress, companyEmail, receiptPaperWidth,
      staffReportRange, aiFillRules, logoUrl, logoIconKey,
      showVerticalsBranding, defaultInvoiceView, paymentBankName, paymentAccountNumber, paymentAccountName, invoiceNotes,
      invoiceAuthorizedBy, invoiceAuthorizedDesignation,
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

  // Uploads immediately (same convention as TemplateLocations.jsx's
  // handleLogoChange - Storage upload can't wait on the page's "Save
  // Settings" button), but the resulting URL is only local state until
  // Save Settings is clicked, same as companyName/companyAddress above.
  async function handleLogoChange(file) {
    setLogoError('')
    if (file.type !== 'image/png') {
      setLogoError('Only PNG logos are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo must be under 5MB.')
      return
    }

    setUploadingLogo(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `logos/${id}/${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from('form-uploads').upload(path, file)
    if (uploadError) {
      setUploadingLogo(false)
      setLogoError('Could not upload the logo: ' + uploadError.message)
      return
    }

    const { data } = supabase.storage.from('form-uploads').getPublicUrl(path)
    setLogoUrl(data.publicUrl)
    setLogoIconKey('')
    setUploadingLogo(false)
  }

  if (loading) return <LoadingState label="Loading settings..." />
  if (error) return <ErrorState message={error} />

  const hasCartField = form.fields?.some(f => f.type === 'cart')
  // The downloadable Invoice is Retail-only - Restaurant and every other
  // template/custom cart form keep the original thermal-receipt settings.
  const isRetail = isRetailTemplate(form)

  return (
    <div className="page" style={isFocusMode ? { paddingTop: '4rem' } : undefined}>
      {/* Reserves room for PosSidePanel's fixed top-left hamburger - see the
          same fix in PublicForm.jsx/Records.jsx. */}
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
        <h3 style={{ marginTop: 0 }}>{isRetail ? 'Invoice Details' : 'Receipt Details'}</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          {isRetail
            ? 'Shown on the downloadable invoice for records with a Product Cart. Leave blank to just use the form name.'
            : 'Shown on printed receipts for records with a Product Cart. Leave blank to just use the form name.'}
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

        {isRetail && (
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Email</label>
            <input
              type="text"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              placeholder="e.g. hello@efesmarket.com"
              style={{ padding: '0.5rem', width: '100%', marginTop: '0.3rem' }}
            />
          </div>
        )}

        {isRetail && (
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.5rem' }}>Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <label className="secondary" style={{ display: 'inline-block', cursor: 'pointer', fontSize: '0.85rem' }}>
                {uploadingLogo ? 'Uploading...' : 'Upload PNG logo'}
                <input
                  type="file"
                  accept="image/png"
                  disabled={uploadingLogo}
                  onChange={(e) => { if (e.target.files[0]) handleLogoChange(e.target.files[0]); e.target.value = '' }}
                  style={{ display: 'none' }}
                />
              </label>
              {(logoUrl || logoIconKey) && (
                <button
                  type="button"
                  className="secondary"
                  style={{ fontSize: '0.85rem' }}
                  onClick={() => { setLogoUrl(''); setLogoIconKey('') }}
                >
                  Remove logo
                </button>
              )}
            </div>
            {logoError && <p style={{ color: '#c0392b', fontSize: '0.8rem', marginTop: '-0.4rem' }}>{logoError}</p>}

            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>Or pick a default icon:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {LOGO_ICONS.map(icon => (
                <button
                  key={icon.key}
                  type="button"
                  title={icon.label}
                  onClick={() => { setLogoIconKey(icon.key); setLogoUrl('') }}
                  style={{
                    width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: icon.key === logoIconKey ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)', background: 'var(--color-surface)', cursor: 'pointer', padding: 0,
                  }}
                >
                  <LogoIcon iconKey={icon.key} color="#444" size={24} />
                </button>
              ))}
            </div>
          </div>
        )}

        {!isRetail && (
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
        )}

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.5rem' }}>
            Preview
          </label>
          {isRetail ? (
            <div style={{ background: '#eef0f2', padding: '1.2rem', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'center' }}>
              <div style={{
                fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', color: '#111',
                width: '100%', maxWidth: '360px', background: 'white', padding: '1.2rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.12)'
              }}>
                {(logoUrl || logoIconKey) && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                    {logoUrl
                      ? <img src={logoUrl} alt="" style={{ maxHeight: '36px', maxWidth: '120px', objectFit: 'contain' }} />
                      : <LogoIcon iconKey={logoIconKey} color="#111" size={30} />}
                  </div>
                )}
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', letterSpacing: '0.5px', marginBottom: '3px', textTransform: 'uppercase' }}>
                  {companyName.trim() || form.name}
                </div>
                {companyAddress.trim() && <div style={{ textAlign: 'center', fontSize: '10px', color: '#444' }}>{companyAddress}</div>}
                {companyPhone.trim() && <div style={{ textAlign: 'center', fontSize: '10px', color: '#444' }}>{companyPhone}</div>}
                {companyEmail.trim() && <div style={{ textAlign: 'center', fontSize: '10px', color: '#444' }}>{companyEmail}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111', borderBottom: '2px solid #111', padding: '0.4rem 0', margin: '0.6rem 0' }}>
                  <span>Invoice #4821</span>
                  <span>10 Aug 2026</span>
                </div>
                {[{ n: 'Grilled Chicken', q: 2, p: 12.99 }, { n: 'Soft Drink', q: 1, p: 2.50 }].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', margin: '4px 0' }}>
                    <span>{item.n} ×{item.q}</span>
                    <span>{(item.p * item.q).toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '2px solid #111', marginTop: '0.4rem', paddingTop: '0.4rem' }}>
                  <span>Total</span>
                  <span>28.48</span>
                </div>
                {showVerticalsBranding && <div style={{ textAlign: 'center', fontSize: '9px', color: '#999', marginTop: '1rem' }}>Powered by Verticals</div>}
              </div>
            </div>
          ) : (
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
          )}
        </div>
      </div>

      {isRetail && (
        <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Invoice & Receipt Settings</h3>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showVerticalsBranding}
                onChange={(e) => setShowVerticalsBranding(e.target.checked)}
              />
              <span>
                VerticalS Branding
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                  Show "Powered by Verticals" on invoices and receipts. Turn this off to send invoices using only your
                  business branding - can still be switched back on for any single invoice from its own toolbar.
                </div>
              </span>
            </label>
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Default Invoice View</label>
            <select
              value={defaultInvoiceView}
              onChange={(e) => setDefaultInvoiceView(e.target.value)}
              style={{ padding: '0.5rem', width: '100%', marginTop: '0.3rem' }}
            >
              <option value="compact">Compact (best for mobile/WhatsApp)</option>
              <option value="a4">A4 (full-page document)</option>
            </select>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.3rem' }}>
              Can still be switched per-invoice from the invoice toolbar.
            </div>
          </div>

          <div style={{ marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            Payment Details
            <div style={{ fontSize: '0.8rem', marginTop: '-0.1rem' }}>Shown on the A4 invoice only when at least one of these is filled in.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.8rem', marginBottom: '1.2rem' }}>
            <input
              type="text"
              value={paymentBankName}
              onChange={(e) => setPaymentBankName(e.target.value)}
              placeholder="Bank Name"
              style={{ padding: '0.5rem' }}
            />
            <input
              type="text"
              value={paymentAccountNumber}
              onChange={(e) => setPaymentAccountNumber(e.target.value)}
              placeholder="Account Number"
              style={{ padding: '0.5rem' }}
            />
            <input
              type="text"
              value={paymentAccountName}
              onChange={(e) => setPaymentAccountName(e.target.value)}
              placeholder="Account Name"
              style={{ padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Invoice Notes / Footer</label>
            <textarea
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder={'e.g.\nThank you for your purchase.\nGoods sold in good condition are subject to the store\'s return policy.'}
              rows={3}
              style={{ padding: '0.5rem', width: '100%', marginTop: '0.3rem' }}
            />
          </div>

          <div style={{ marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            Authorized By
            <div style={{ fontSize: '0.8rem', marginTop: '-0.1rem' }}>Used by the Formal invoice style's signature block.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.8rem' }}>
            <input
              type="text"
              value={invoiceAuthorizedBy}
              onChange={(e) => setInvoiceAuthorizedBy(e.target.value)}
              placeholder="Name, e.g. Dr. Charles Akhimien"
              style={{ padding: '0.5rem' }}
            />
            <input
              type="text"
              value={invoiceAuthorizedDesignation}
              onChange={(e) => setInvoiceAuthorizedDesignation(e.target.value)}
              placeholder="Designation, e.g. Co-founder/Co-CEO"
              style={{ padding: '0.5rem' }}
            />
          </div>
        </div>
      )}

      {hasCartField && (
        <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>AI Order-Fill Rules</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Extra guidance for the order screen's "Fill from Text" AI helper (see the ✨ button there) - things it should
            do when a pasted message implies them without saying them outright. One rule per line works well. These are
            suggestions the AI weighs, not guarantees - it still only ever picks from your actual products/field options.
          </p>
          <textarea
            value={aiFillRules}
            onChange={(e) => setAiFillRules(e.target.value)}
            placeholder={'e.g.\nIf the message says "urgent" or "ASAP", set Delivery Type to Express.\nDefault Payment Method to Cash unless another method is mentioned.\nIf someone orders "a dozen", treat that as 12.'}
            rows={5}
            style={{ padding: '0.5rem', width: '100%' }}
          />
        </div>
      )}

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