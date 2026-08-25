// Place at: src/InvoiceModal.jsx
// Replaces receiptPrint.js's popup-window/window.print() flow: this renders
// an on-page invoice (business details from Settings > Invoice, itemized
// cart, order details) and turns it into a downloadable PDF via
// html2canvas + jsPDF instead of handing the person off to the browser's
// print dialog. Shared by the order confirmation screen and Records'
// per-order actions so there's one invoice layout everywhere. Retail-only -
// see isRetailTemplate at every call site.
//
// Two independent axes, both re-derived from the same submission/form data
// (never a second copy of it):
//   - "Style"/"Color": which of the 4 compact layouts (src/invoiceTemplates/)
//     and which palette (src/invoicePalettes.js) - chosen fresh each time
//     this modal opens, nothing saved.
//   - "Compact"/"A4": which overall document shape. Session-remembered (not
//     saved to the business) unless the business has set a default in Form
//     Settings, in which case that's the starting point for the session.
// Backdating the invoice date and the "Powered by Verticals" branding
// toggle both persist - see handleDateChange and the Branding checkbox.
import { useEffect, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { supabase } from './supabaseClient'
import { INVOICE_TEMPLATES, getInvoiceTemplate } from './invoiceTemplates'
import { A4Template } from './invoiceTemplates/A4Template'
import { INVOICE_PALETTES, getPalette } from './invoicePalettes'
import { LogoIcon } from './invoiceLogos'

const VIEW_SESSION_KEY = 'verticals_invoice_view_mode'
const A4_WIDTH_PX = 793.7 // 210mm at the standard 96dpi CSS uses for mm units

function toDateInputValue(d) {
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${day}`
}

export function InvoiceModal({ form, submission, onClose, allowDateEdit = false }) {
  const invoiceRef = useRef(null)
  const a4ExportRef = useRef(null)
  const previewWrapRef = useRef(null)

  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')

  const settings = form.settings || {}

  const [viewMode, setViewMode] = useState(
    () => sessionStorage.getItem(VIEW_SESSION_KEY) || settings.defaultInvoiceView || 'compact'
  )
  const [showBranding, setShowBranding] = useState(settings.showVerticalsBranding ?? true)

  const [templateKey, setTemplateKey] = useState(INVOICE_TEMPLATES[0].key)
  const [paletteKey, setPaletteKey] = useState(INVOICE_PALETTES[0].key)
  const palette = getPalette(paletteKey)
  const TemplateComponent = getInvoiceTemplate(templateKey).Component

  const [invoiceDateInput, setInvoiceDateInput] = useState(
    toDateInputValue(submission.invoice_date ? new Date(submission.invoice_date) : new Date(submission.created_at))
  )
  const [dateSaveStatus, setDateSaveStatus] = useState('') // '', 'saving', 'saved', 'error'

  const [a4NaturalHeight, setA4NaturalHeight] = useState(1123) // 297mm fallback, corrected once the hidden true-size copy paints
  const [a4Scale, setA4Scale] = useState(1)

  function setView(mode) {
    setViewMode(mode)
    sessionStorage.setItem(VIEW_SESSION_KEY, mode)
  }

  const cartFields = form.fields.filter(f => f.type === 'cart')
  const otherFields = form.fields.filter(f => f.type !== 'cart' && f.type !== 'section')

  const items = []
  let subtotal = 0
  let deliveryFee = 0
  let paymentMethod = null
  cartFields.forEach(field => {
    const cartData = submission.data[field.id]
    if (cartData?.items?.length) {
      cartData.items.forEach(item => {
        subtotal += item.price * item.quantity
        items.push(item)
      })
      deliveryFee += Number(cartData.deliveryFee) || 0
    }
    if (cartData?.payment?.method) paymentMethod = cartData.payment.method
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
  const businessEmail = settings.companyEmail?.trim()
  const paymentBankName = settings.paymentBankName?.trim()
  const paymentAccountNumber = settings.paymentAccountNumber?.trim()
  const paymentAccountName = settings.paymentAccountName?.trim()
  const invoiceNotes = settings.invoiceNotes?.trim()

  const logoUrl = settings.logoUrl
  const logoIconKey = settings.logoIconKey
  const logoElement = logoUrl
    ? <img src={logoUrl} alt="" style={{ maxHeight: '48px', maxWidth: '160px', objectFit: 'contain' }} crossOrigin="anonymous" />
    : logoIconKey
      ? <LogoIcon iconKey={logoIconKey} color={palette.primary} size={40} />
      : null

  const sharedTemplateProps = {
    businessName, businessAddress, businessPhone, businessEmail, logoElement,
    orderNumber, dateStr, details, items, subtotal, deliveryFee, total, palette, showBranding,
  }

  // The true-size A4 copy is the only thing ever captured/printed for A4 -
  // measure its real (unscaled) height so the on-screen scaled preview's
  // wrapper can reserve the right amount of space (transform:scale doesn't
  // shrink an element's contribution to normal document flow on its own).
  useEffect(() => {
    if (viewMode !== 'a4' || !a4ExportRef.current) return
    const el = a4ExportRef.current
    const update = () => setA4NaturalHeight(el.offsetHeight || 1123)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [viewMode, items.length, details.length])

  useEffect(() => {
    if (viewMode !== 'a4' || !previewWrapRef.current) return
    const el = previewWrapRef.current
    const update = () => setA4Scale(Math.min(1, (el.clientWidth - 4) / A4_WIDTH_PX))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [viewMode])

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

  async function buildPdf() {
    const captureEl = viewMode === 'a4' ? a4ExportRef.current : invoiceRef.current
    const canvas = await html2canvas(captureEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const totalPages = Math.max(1, Math.ceil(imgHeight / pageHeight))

    let heightLeft = imgHeight
    let position = 0
    let pageNum = 1
    const stampPageNumber = () => {
      if (totalPages <= 1) return
      pdf.setFontSize(9)
      pdf.setTextColor(150)
      pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    }

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    stampPageNumber()
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pageNum++
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      stampPageNumber()
      heightLeft -= pageHeight
    }

    return pdf
  }

  async function handleDownload() {
    setDownloading(true)
    setDownloadError('')
    try {
      const pdf = await buildPdf()
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

  async function handleShare() {
    setSharing(true)
    setShareError('')
    try {
      const pdf = await buildPdf()
      const blob = pdf.output('blob')
      const file = new File([blob], `Invoice-${orderNumber}.pdf`, { type: 'application/pdf' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${orderNumber}` })
      } else {
        setShareError('Sharing isn’t supported on this device/browser - use Download instead.')
      }
    } catch (err) {
      // AbortError just means the person closed the native share sheet.
      if (err?.name !== 'AbortError') setShareError('Could not share the invoice. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  function handlePrint() {
    window.print()
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
          background: 'var(--color-surface)', borderRadius: 'var(--radius)',
          width: viewMode === 'a4' ? 'min(94vw, 880px)' : '620px', maxWidth: '100%',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 18px 45px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap'
        }}>
          <h3 style={{ margin: 0 }}>Invoice</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="secondary" onClick={handlePrint}>Print</button>
            <button type="button" className="secondary" onClick={handleShare} disabled={sharing}>
              {sharing ? 'Preparing...' : 'Share'}
            </button>
            <button type="button" onClick={handleDownload} disabled={downloading}>
              {downloading ? 'Preparing...' : 'Download PDF'}
            </button>
            <button type="button" className="secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        {downloadError && (
          <p style={{ color: 'var(--status-critical)', fontSize: '0.85rem', margin: '0.75rem 1.25rem 0' }}>{downloadError}</p>
        )}
        {shareError && (
          <p style={{ color: 'var(--status-critical)', fontSize: '0.85rem', margin: '0.75rem 1.25rem 0' }}>{shareError}</p>
        )}

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '1.2rem', alignItems: 'center',
          padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--color-border)'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>View</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button type="button" className={viewMode === 'compact' ? undefined : 'secondary'} onClick={() => setView('compact')} style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}>
                Compact
              </button>
              <button type="button" className={viewMode === 'a4' ? undefined : 'secondary'} onClick={() => setView('a4')} style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}>
                A4
              </button>
            </div>
          </div>

          {viewMode === 'compact' && (
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
          )}

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

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>&nbsp;</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showBranding} onChange={(e) => setShowBranding(e.target.checked)} />
              Powered by Verticals
            </label>
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
          {viewMode === 'compact' ? (
            <div ref={invoiceRef} className="invoice-print-target">
              <TemplateComponent {...sharedTemplateProps} />
            </div>
          ) : (
            <>
              {/* On-screen only: a visually-scaled clone so a 210mm page fits
                  a phone/modal viewport. Never captured or printed - see the
                  true-size hidden copy below. */}
              <div ref={previewWrapRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: `${A4_WIDTH_PX * a4Scale}px`, height: `${a4NaturalHeight * a4Scale}px`, overflow: 'hidden' }}>
                  <div style={{ transform: `scale(${a4Scale})`, transformOrigin: 'top left', width: `${A4_WIDTH_PX}px`, boxShadow: '0 4px 18px rgba(0,0,0,0.15)' }}>
                    <A4Template
                      {...sharedTemplateProps}
                      paymentMethod={paymentMethod}
                      paymentBankName={paymentBankName}
                      paymentAccountNumber={paymentAccountNumber}
                      paymentAccountName={paymentAccountName}
                      invoiceNotes={invoiceNotes}
                    />
                  </div>
                </div>
              </div>

              {/* True-size, off-screen - the only thing html2canvas/print ever
                  use for A4. The offscreen positioning lives on this same
                  ref'd element (not a wrapper) so the print stylesheet's
                  .invoice-print-target override actually reaches it. */}
              <div ref={a4ExportRef} className="invoice-print-target" style={{ position: 'fixed', top: 0, left: '-10000px' }}>
                <A4Template
                  {...sharedTemplateProps}
                  paymentMethod={paymentMethod}
                  paymentBankName={paymentBankName}
                  paymentAccountNumber={paymentAccountNumber}
                  paymentAccountName={paymentAccountName}
                  invoiceNotes={invoiceNotes}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
