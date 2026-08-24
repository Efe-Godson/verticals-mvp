// Place at: src/InvoiceModal.jsx
// Replaces receiptPrint.js's popup-window/window.print() flow: this renders
// an on-page invoice (business details from Settings > Invoice, itemized
// cart, order details) and turns it into a downloadable PDF via
// html2canvas + jsPDF instead of handing the person off to the browser's
// print dialog. Shared by the order confirmation screen and Records'
// per-order actions so there's one invoice layout everywhere.
//
// The visual layout is one of several interchangeable template components
// (src/invoiceTemplates/), tinted by one of a few curated palettes
// (src/invoicePalettes.js) - both chosen fresh each time someone opens this
// modal, not saved anywhere. Backdating the invoice date IS saved (see
// handleDateChange below), but only form owners/staff are allowed to do
// that - see the allowDateEdit prop.
import { useRef, useState } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { supabase } from './supabaseClient'
import { INVOICE_TEMPLATES, getInvoiceTemplate } from './invoiceTemplates'
import { INVOICE_PALETTES, getPalette } from './invoicePalettes'
import { LogoIcon } from './invoiceLogos'

function toDateInputValue(d) {
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${day}`
}

export function InvoiceModal({ form, submission, onClose, allowDateEdit = false }) {
  const invoiceRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const [templateKey, setTemplateKey] = useState(INVOICE_TEMPLATES[0].key)
  const [paletteKey, setPaletteKey] = useState(INVOICE_PALETTES[0].key)
  const palette = getPalette(paletteKey)
  const TemplateComponent = getInvoiceTemplate(templateKey).Component

  const [invoiceDateInput, setInvoiceDateInput] = useState(
    toDateInputValue(submission.invoice_date ? new Date(submission.invoice_date) : new Date(submission.created_at))
  )
  const [dateSaveStatus, setDateSaveStatus] = useState('') // '', 'saving', 'saved', 'error'

  const settings = form.settings || {}
  const cartFields = form.fields.filter(f => f.type === 'cart')
  const otherFields = form.fields.filter(f => f.type !== 'cart' && f.type !== 'section')

  const items = []
  let subtotal = 0
  let deliveryFee = 0
  cartFields.forEach(field => {
    const cartData = submission.data[field.id]
    if (cartData?.items?.length) {
      cartData.items.forEach(item => {
        subtotal += item.price * item.quantity
        items.push(item)
      })
      deliveryFee += Number(cartData.deliveryFee) || 0
    }
  })
  const total = subtotal + deliveryFee

  const details = otherFields
    .map(field => ({ field, value: submission.data[field.id] }))
    .filter(({ value }) => {
      if (value === undefined || value === null) return false
      return Array.isArray(value) ? value.length > 0 : value.toString().trim() !== ''
    })

  // Same fallback Records itself uses when a submission was built client-side
  // right at checkout, before the real order_number column is populated.
  const orderNumber = submission.order_number
    ? String(submission.order_number)
    : submission.id.replace(/-/g, '').slice(-12).toUpperCase()

  // invoiceDateInput (yyyy-mm-dd, local to this modal) is what actually
  // renders - it's seeded from invoice_date/created_at above and kept in
  // sync with the database by handleDateChange, so a reload shows the same
  // backdated date without needing to re-derive it here.
  const dateStr = new Date(invoiceDateInput + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const businessName = settings.companyName?.trim() || form.name
  const businessAddress = settings.companyAddress?.trim()
  const businessPhone = settings.companyPhone?.trim()

  const logoUrl = settings.logoUrl
  const logoIconKey = settings.logoIconKey
  const logoElement = logoUrl
    ? <img src={logoUrl} alt="" style={{ maxHeight: '48px', maxWidth: '160px', objectFit: 'contain' }} crossOrigin="anonymous" />
    : logoIconKey
      ? <LogoIcon iconKey={logoIconKey} color={palette.primary} size={40} />
      : null

  async function handleDateChange(value) {
    setInvoiceDateInput(value)
    setDateSaveStatus('saving')
    const { error } = await supabase
      .from('submissions')
      .update({ invoice_date: value })
      .eq('id', submission.id)
    setDateSaveStatus(error ? 'error' : 'saved')
    if (!error) setTimeout(() => setDateSaveStatus(''), 1500)
  }

  async function handleDownload() {
    if (!invoiceRef.current) return
    setDownloading(true)
    setDownloadError('')
    try {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // pdf.save() triggers a direct file download (blob + temporary
      // download-anchor) - deliberately NOT navigator.share() or a plain
      // link, so this always lands in the browser's Downloads folder rather
      // than opening a share sheet. (iOS Safari doesn't reliably honor
      // anchor `download` for blob URLs and may open the PDF inline instead
      // - that's a Safari platform limitation, not something fixable here.)
      pdf.save(`Invoice-${orderNumber}.pdf`)
    } catch {
      setDownloadError('Could not create the PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose() }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius)', width: '620px', maxWidth: '100%',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 18px 45px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap'
        }}>
          <h3 style={{ margin: 0 }}>Invoice</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={handleDownload} disabled={downloading}>
              {downloading ? 'Preparing...' : 'Download Invoice'}
            </button>
            <button type="button" className="secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        {downloadError && (
          <p style={{ color: 'var(--status-critical)', fontSize: '0.85rem', margin: '0.75rem 1.25rem 0' }}>{downloadError}</p>
        )}

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '1.2rem', alignItems: 'center',
          padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--color-border)'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>Style</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {INVOICE_TEMPLATES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  className={t.key === templateKey ? undefined : 'secondary'}
                  onClick={() => setTemplateKey(t.key)}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>Color</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {INVOICE_PALETTES.map(p => (
                <button
                  key={p.key}
                  type="button"
                  title={p.name}
                  onClick={() => setPaletteKey(p.key)}
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%', background: p.primary,
                    border: p.key === paletteKey ? '2px solid var(--color-text)' : '2px solid transparent',
                    padding: 0, cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </div>

          {allowDateEdit && (
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>Invoice Date</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="date"
                  value={invoiceDateInput}
                  onChange={(e) => handleDateChange(e.target.value)}
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                />
                {dateSaveStatus === 'saving' && <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Saving...</span>}
                {dateSaveStatus === 'saved' && <span style={{ fontSize: '0.75rem', color: 'var(--status-positive, #16a34a)' }}>Saved</span>}
                {dateSaveStatus === 'error' && <span style={{ fontSize: '0.75rem', color: 'var(--status-critical)' }}>Could not save</span>}
              </div>
            </div>
          )}
        </div>

        <div style={{ overflowY: 'auto', padding: '1.5rem', background: '#eef0f2' }}>
          {/* Explicit colors throughout (not theme vars) - html2canvas
              snapshots this element as-is, and the PDF must read the same
              regardless of the app's light/dark theme. */}
          <div ref={invoiceRef}>
            <TemplateComponent
              businessName={businessName}
              businessAddress={businessAddress}
              businessPhone={businessPhone}
              logoElement={logoElement}
              orderNumber={orderNumber}
              dateStr={dateStr}
              details={details}
              items={items}
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              total={total}
              palette={palette}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
