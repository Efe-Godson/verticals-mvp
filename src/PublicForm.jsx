import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import PosSidePanel from './PosSidePanel'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'
import SparkleIcon from './SparkleIcon'
import { LoadingState, ExtractingOverlay } from './LoadingState'
import { ErrorState } from './ErrorState'
import { InvoiceModal } from './InvoiceModal'
import { printReceipt } from './receiptPrint'
import { isRetailTemplate, isRestaurantTemplate } from './lib/templateFlags'
import { submitForm, getSubmissionByToken, updateSubmissionByToken } from './lib/submissionsClient'
import { extractOrderFromText, describeAIError } from './lib/aiClient'
import { COUNTRIES, statesFor, citiesForField } from './lib/locationData'
const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Split']
const TOP_CATEGORY_COUNT = 6 // category pills shown before collapsing the rest behind "+N more"

// Splits fields into pages at each 'section' marker, Google-Forms style:
// fields before the first section (if any) form an unheaded first page,
// then every section starts a new page containing its own fields. A form
// with no sections is just one page, so this is a no-op for most forms.
function buildPages(fields) {
  const pages = []
  let current = null
  fields.forEach(field => {
    if (field.type === 'section') {
      if (current) pages.push(current)
      current = { section: field, fields: [] }
    } else {
      if (!current) current = { section: null, fields: [] }
      current.fields.push(field)
    }
  })
  if (current) pages.push(current)
  if (pages.length === 0) pages.push({ section: null, fields: [] })
  return pages
}

// The model returns a location as free text ("City, State, Country" - see
// extract-order-ai's prompt, best-effort and not always in that order or
// complete). This is the client-side half of matching it against the real
// dataset (locationData.js, plus this field's own extraCities) into the
// {country, state, city} shape the Location field actually stores - the
// edge function can't do this itself without bundling that whole dataset
// into the Deno function too. Requires at least a state or city hit to
// count; a country-only "match" is just the fallback default, not
// something the text actually confirmed.
function matchLocationAnswer(field, rawValue) {
  const parts = rawValue.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) return null

  const matchedCountry = parts.find(p => COUNTRIES.some(c => c.toLowerCase() === p.toLowerCase()))
  const country = matchedCountry
    ? COUNTRIES.find(c => c.toLowerCase() === matchedCountry.toLowerCase())
    : (field.defaultCountry || COUNTRIES[0])

  const stateOptions = statesFor(country)
  const matchedState = parts.find(p => stateOptions.some(s => s.toLowerCase() === p.toLowerCase()))
  const state = matchedState ? stateOptions.find(s => s.toLowerCase() === matchedState.toLowerCase()) : ''

  let city = ''
  if (state) {
    const cityOptions = citiesForField(field, country, state)
    const matchedCity = parts.find(p => cityOptions.some(c => c.toLowerCase() === p.toLowerCase()))
    city = matchedCity ? cityOptions.find(c => c.toLowerCase() === matchedCity.toLowerCase()) : ''
  }

  if (!state && !city) return null
  return { country, state, city }
}

// Edits settings.aiFillRules without leaving the order screen - stacks on
// top of AiFillModal (higher zIndex) rather than navigating to Settings,
// which would abandon whatever's already in the cart/pasted text behind it.
function AiRulesModal({ rules, onSave, onClose }) {
  const [value, setValue] = useState(rules || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(value)
    setSaving(false)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 450, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ background: 'var(--color-surface)', padding: '1.5rem', width: '480px', maxWidth: '100%' }}
      >
        <h3 style={{ margin: '0 0 0.3rem' }}>AI Order-Fill Rules</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: '0 0 0.8rem' }}>
          Extra guidance for how "Fill from Text" should read a pasted order - one rule per line works well. These are
          suggestions it weighs, not guarantees - it still only ever picks from your actual products/field options.
        </p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={'e.g.\nIf the message says "urgent" or "ASAP", set Delivery Type to Express.\nDefault Payment Method to Cash unless another method is mentioned.'}
          rows={6}
          style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.8rem' }}>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="button" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save Rules'}</button>
        </div>
      </div>
    </div>
  )
}

// Paste a customer's order (WhatsApp message, SMS, whatever) -> AI matches
// it against this form's own catalogue and fields -> reviewed/edited here ->
// only then applied to the order screen. Mirrors ProductManager.jsx's
// AiImportModal (paste -> extract -> review -> commit), filling in an order
// instead of a catalogue - nothing on the real order screen changes until
// "Apply" is clicked.
function AiFillModal({ cartField, fields, rules, showRulesButton, onSaveRules, onClose, onApply }) {
  const [showRulesEditor, setShowRulesEditor] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [draftItems, setDraftItems] = useState(null) // null while pasting, else [{ productId, name, price, quantity }]
  const [draftAnswers, setDraftAnswers] = useState(null) // null while pasting, else [{ fieldId, label, value, type }] - value is {country,state,city} for a location field, a plain string otherwise

  async function handleExtract() {
    if (!pastedText.trim()) return
    setExtracting(true)
    setExtractError('')
    try {
      const products = (cartField?.products || []).map(p => ({ id: p.id, name: p.name }))
      const fieldMeta = fields.map(f => ({ id: f.id, label: f.label, type: f.type, options: f.options }))
      const result = await extractOrderFromText(pastedText, products, fieldMeta, rules)

      const items = (result.items || []).map(item => {
        const product = (cartField?.products || []).find(p => p.id === item.productId)
        return product ? { productId: item.productId, name: product.name, price: product.price, quantity: item.quantity } : null
      }).filter(Boolean)

      const answers = (result.answers || []).map(a => {
        const field = fields.find(f => f.id === a.fieldId)
        if (!field) return null
        if (field.type === 'location') {
          const matched = matchLocationAnswer(field, a.value)
          return matched ? { fieldId: a.fieldId, label: field.label, value: matched, type: 'location' } : null
        }
        return { fieldId: a.fieldId, label: field.label, value: a.value, type: field.type }
      }).filter(Boolean)

      if (items.length === 0 && answers.length === 0) {
        setExtractError("Couldn't match anything in that text to your catalogue or fields - try pasting more of it.")
        return
      }
      setDraftItems(items)
      setDraftAnswers(answers)
    } catch (err) {
      setExtractError(await describeAIError(err, "Couldn't read that text right now - please try again in a moment."))
    } finally {
      setExtracting(false)
    }
  }

  const isReviewing = draftItems !== null

  return (
    <>
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ background: 'var(--color-surface)', padding: '1.5rem', width: '520px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: '0 0 0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <SparkleIcon size={18} /> Fill from Text
        </h3>

        {!isReviewing ? (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: '0 0 0.8rem' }}>
              Paste a customer's order - a WhatsApp message, an SMS, anything - and AI will match it to your catalogue and fields for you to review before it's applied.
            </p>
            <div style={{ position: 'relative' }}>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={'e.g.\n2 t-shirts and a cap for John, 08012345678, deliver to Lekki, paying cash'}
                rows={8}
                disabled={extracting}
                style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem' }}
              />
              {extracting && <ExtractingOverlay label="Reading your text..." />}
            </div>
            {extractError && <p style={{ color: '#c0392b', fontSize: '0.85rem', marginTop: '0.5rem' }}>{extractError}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: showRulesButton ? 'space-between' : 'flex-end', marginTop: '0.8rem' }}>
              {showRulesButton ? (
                <button type="button" className="secondary" onClick={() => setShowRulesEditor(true)} style={{ fontSize: '0.8rem' }}>
                  Set Extraction Rules
                </button>
              ) : <span />}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="secondary" onClick={onClose}>Cancel</button>
                <button type="button" disabled={!pastedText.trim() || extracting} onClick={handleExtract}>
                  {extracting ? 'Reading...' : 'Extract'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: '0 0 0.8rem' }}>
              Review before applying - nothing on the order screen changes until you confirm.
            </p>

            {draftItems.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem' }}>
                  Items
                </div>
                {draftItems.map(item => (
                  <div key={item.productId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ flex: 1 }}>{item.name}</span>
                    <input
                      type="number" min="1" value={item.quantity}
                      onChange={(e) => setDraftItems(current => current.map(i => i.productId === item.productId ? { ...i, quantity: e.target.value } : i))}
                      style={{ width: '60px', padding: '0.3rem' }}
                    />
                    <span
                      onClick={() => setDraftItems(current => current.filter(i => i.productId !== item.productId))}
                      style={{ color: '#c0392b', cursor: 'pointer', padding: '0 0.2rem' }}
                    >
                      🗑
                    </span>
                  </div>
                ))}
              </div>
            )}

            {draftAnswers.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem' }}>
                  Other fields
                </div>
                {draftAnswers.map(a => (
                  <div key={a.fieldId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ flex: '0 0 40%', color: 'var(--color-muted)', fontSize: '0.85rem' }}>{a.label}</span>
                    {a.type === 'location' ? (
                      // Read-only summary rather than an editable input - a
                      // real correction here needs the same cascading
                      // country/state/city selects the order screen itself
                      // uses, not a free-text box that'd just go back
                      // through matchLocationAnswer's own guesswork.
                      <span style={{ flex: 1, fontSize: '0.9rem' }}>
                        {[a.value.city, a.value.state, a.value.country].filter(Boolean).join(', ')}
                      </span>
                    ) : (
                      <input
                        type={a.type === 'date' ? 'date' : 'text'} value={a.value}
                        onChange={(e) => setDraftAnswers(current => current.map(x => x.fieldId === a.fieldId ? { ...x, value: e.target.value } : x))}
                        style={{ flex: 1, padding: '0.3rem' }}
                      />
                    )}
                    <span
                      onClick={() => setDraftAnswers(current => current.filter(x => x.fieldId !== a.fieldId))}
                      style={{ color: '#c0392b', cursor: 'pointer', padding: '0 0.2rem' }}
                    >
                      🗑
                    </span>
                  </div>
                ))}
              </div>
            )}

            {draftItems.length === 0 && draftAnswers.length === 0 && (
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Nothing left to apply - remove everything and try again, or cancel.</p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="secondary" onClick={() => { setDraftItems(null); setDraftAnswers(null) }}>Back</button>
              <button
                type="button"
                disabled={draftItems.length === 0 && draftAnswers.length === 0}
                onClick={() => onApply(draftItems, draftAnswers)}
              >
                Apply
              </button>
            </div>
          </>
        )}
      </div>
    </div>

    {showRulesEditor && (
      <AiRulesModal
        rules={rules}
        onSave={(newRules) => onSaveRules(newRules)}
        onClose={() => setShowRulesEditor(false)}
      />
    )}
    </>
  )
}

function CheckIcon({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--status-good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  )
}

// Replaces the old "jump straight to a print-preview popup" behavior (see
// submitAnswers) - plain in-page confirmation that always shows regardless
// of the browser's popup blocker, with the invoice/receipt as an explicit
// opt-in click instead of something forced on every single order. The
// downloadable Invoice is Retail-only (see lib/templateFlags.js) - every
// other template, including Restaurant, keeps the original printReceipt()
// popup unchanged.
function OrderConfirmationModal({ form, submission, onClose }) {
  const [showInvoice, setShowInvoice] = useState(false)
  const isRetail = isRetailTemplate(form)
  const cartField = form.fields.find(f => f.type === 'cart')
  const cartData = cartField ? submission.data[cartField.id] : null
  const itemCount = cartData ? cartData.items.reduce((sum, i) => sum + i.quantity, 0) : 0
  const grandTotal = cartData ? cartData.total + (Number(cartData.deliveryFee) || 0) : 0

  if (isRetail && showInvoice) {
    return <InvoiceModal form={form} submission={submission} onClose={() => setShowInvoice(false)} />
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '1rem'
    }}>
      <div className="card" style={{ background: 'var(--color-surface)', padding: '1.75rem', width: '380px', maxWidth: '100%', textAlign: 'center' }}>
        <CheckIcon />
        <h3 style={{ margin: '0.8rem 0 0.2rem' }}>Order Placed</h3>
        <p style={{ color: 'var(--color-muted)', margin: '0 0 1.2rem' }}>
          {submission.order_number ? `Order #${submission.order_number}` : 'Order recorded'}
          {itemCount > 0 ? ` · ${itemCount} item${itemCount !== 1 ? 's' : ''}` : ''}
        </p>
        {cartData && (
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.3rem' }}>
            ₦{grandTotal.toLocaleString()}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isRetail ? (
            <button type="button" className="secondary" onClick={() => setShowInvoice(true)} style={{ flex: 1 }}>
              View Invoice
            </button>
          ) : (
            <button type="button" className="secondary" onClick={() => printReceipt(form, submission)} style={{ flex: 1 }}>
              Print Receipt
            </button>
          )}
          <button type="button" onClick={onClose} style={{ flex: 1 }}>
            New Order
          </button>
        </div>
      </div>
    </div>
  )
}

function PublicForm() {
  const { id, token } = useParams()
  const { session, staffFormId } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState(null)
  const [answers, setAnswers] = useState({})
  const [cartQuantities, setCartQuantities] = useState({})
  const [cartSearch, setCartSearch] = useState({})
  const [cartCategory, setCartCategory] = useState({})
  const [expandedCategories, setExpandedCategories] = useState({}) // { [fieldId]: true } - reveals the rest of the category pills past the top few
  const [cartPayment, setCartPayment] = useState({}) // { [fieldId]: { method } } - confirmed payment
  const [checkoutFieldId, setCheckoutFieldId] = useState(null) // which cart field's checkout modal is open
  const [showMoreCheckoutFields, setShowMoreCheckoutFields] = useState(false) // reveals fields flagged collapsedInCheckout
  const [checkoutMethod, setCheckoutMethod] = useState(null) // method chosen inside the open checkout modal
  const [deliveryFee, setDeliveryFee] = useState({}) // { [fieldId]: string } - only asked when the order is Takeout
  const [splitDraft, setSplitDraft] = useState([{ method: 'Cash', amount: '' }, { method: 'Card', amount: '' }])
  const [orderNumber, setOrderNumber] = useState(() => Math.floor(1000 + Math.random() * 9000))
  const [addedFlash, setAddedFlash] = useState({}) // { [productId]: true } - briefly shows "Added" after tapping Add
  const [heldOrders, setHeldOrders] = useState({}) // { [fieldId]: [{ id, orderNumber, quantities, answers, itemCount, total, createdAt }] }
  const [heldPanelFieldId, setHeldPanelFieldId] = useState(null) // which cart field's held-orders panel is open
  const [respondentEmail, setRespondentEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false) // guards against a double-click/slow-network duplicate order
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState({})
  const [uploading, setUploading] = useState({})
  const [editLink, setEditLink] = useState(null)
  const [linkedOptions, setLinkedOptions] = useState({}) // { [fieldId]: [{ recordId, label }] }
  const [pageIndex, setPageIndex] = useState(0)
  // Same isMobile-via-resize pattern as HorizontalBarChart.jsx: the product
  // catalogue swaps from a 2-column card grid (fine on a tablet/desktop
  // width) to a single-column list of slim rows on a phone, where a grid of
  // padded cards burns too much vertical space per item to browse quickly.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [showAiFill, setShowAiFill] = useState(false)
  const [orderConfirmation, setOrderConfirmation] = useState(null) // snapshot of the just-placed order, or null

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const pages = useMemo(() => buildPages(form?.fields || []), [form])
  const currentPage = pages[pageIndex] || pages[0]
  const hasCartOnPage = currentPage.fields.some(f => f.type === 'cart')
  // Retail-style forms (deferCheckout on the cart field) skip the embedded
  // checkout modal entirely: the cart is just one field among others, and
  // the whole page (cart + everything else) submits together via the
  // normal Back/Next/Submit row at the bottom, same as a cart-less form.
  const cartDefersCheckout = currentPage.fields.some(f => f.type === 'cart' && f.deferCheckout)
  // Mobile-first: on a deferCheckout page, the Submit button lives in a bar
  // pinned to the bottom of the viewport instead of at the end of a long
  // scroll (catalogue + customer fields) - it needs the running total from
  // here, at page level, since renderFieldRow's own cart branch computes its
  // total in a scope this bar can't reach.
  // Any field the builder flagged addToTotal (see FieldTypeConfig's Number
  // config - "delivery" is just the common case, not the only one) gets
  // summed in on top of the cart itself - no dedicated Delivery Fee input
  // of its own, a Retail form's own Number field (Delivery, Service Charge,
  // whatever it's labeled) already is that input.
  const deferCheckoutExtraTotal = useMemo(() => {
    if (!cartDefersCheckout) return 0
    return currentPage.fields
      .filter(f => f.addToTotal)
      .reduce((sum, f) => sum + (Number(answers[f.id]) || 0), 0)
  }, [cartDefersCheckout, currentPage.fields, answers])

  const deferCheckoutCartTotal = useMemo(() => {
    if (!cartDefersCheckout) return 0
    const itemsTotal = currentPage.fields
      .filter(f => f.type === 'cart' && f.deferCheckout)
      .reduce((sum, f) => {
        const quantities = cartQuantities[f.id] || {}
        return sum + (f.products || []).reduce((s, p) => s + (Number(quantities[p.id]) || 0) * Number(p.price), 0)
      }, 0)
    return itemsTotal + deferCheckoutExtraTotal
  }, [cartDefersCheckout, currentPage.fields, cartQuantities, deferCheckoutExtraTotal])
  const isLastPage = pageIndex === pages.length - 1

  // Prefills the builder state from a saved submission: the inverse of the
  // { items, total } / plain-value shape submitAnswers() writes out.
  function loadAnswersFromData(fields, data) {
    const nextAnswers = {}
    const nextCartQuantities = {}
    const nextCartPayment = {}
    const nextDeliveryFee = {}
    fields.forEach(field => {
      if (field.type === 'section') return
      if (field.type === 'cart') {
        const quantities = {}
        ;(data[field.id]?.items || []).forEach(item => {
          const product = (field.products || []).find(p => p.name === item.name)
          if (product) quantities[product.id] = item.quantity
        })
        nextCartQuantities[field.id] = quantities
        if (data[field.id]?.payment) nextCartPayment[field.id] = data[field.id].payment
        if (data[field.id]?.deliveryFee) nextDeliveryFee[field.id] = String(data[field.id].deliveryFee)
      } else {
        nextAnswers[field.id] = data[field.id]
      }
    })
    setAnswers(nextAnswers)
    setCartQuantities(nextCartQuantities)
    setCartPayment(nextCartPayment)
    setDeliveryFee(nextDeliveryFee)
    if (data._respondent_email) setRespondentEmail(data._respondent_email)
  }

  useEffect(() => {
    setPageIndex(0)

    async function loadForEdit() {
      try {
        const { submission, form: formData } = await getSubmissionByToken(token)
        setForm(formData)
        loadAnswersFromData(formData.fields, submission.data)
      } catch (err) {
        setMessage(err.message || 'This response link is no longer valid.')
      }
      setLoading(false)
    }

    async function loadForm() {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        setMessage('This form could not be found.')
      } else if (data.status === 'paused') {
        setMessage('This form is temporarily paused and is not accepting responses right now.')
      } else if (data.status === 'archived') {
        setMessage('This form has been archived and is no longer accepting responses.')
      } else if (data.status !== 'published') {
        setMessage('This form is not live yet.')
      } else {
        setForm(data)
      }
      setLoading(false)
    }

    if (token) loadForEdit()
    else loadForm()
  }, [id, token])

  // Held orders (POS "park this table, start another") persist per-device in
  // localStorage, keyed by form id - there's no backend table for these,
  // they're a cashier convenience, not a record worth syncing across devices.
  useEffect(() => {
    if (!form) return
    try {
      const raw = localStorage.getItem(`verticals_held_orders_${form.id}`)
      if (raw) setHeldOrders(JSON.parse(raw))
    } catch {}
  }, [form?.id])

  function saveHeldOrders(next) {
    setHeldOrders(next)
    try {
      localStorage.setItem(`verticals_held_orders_${form.id}`, JSON.stringify(next))
    } catch {}
  }

  function holdOrder(fieldId) {
    const field = form.fields.find(f => f.id === fieldId)
    const quantities = cartQuantities[fieldId] || {}
    const items = (field.products || [])
      .map(p => ({ ...p, quantity: Number(quantities[p.id]) || 0 }))
      .filter(p => p.quantity > 0)
    if (items.length === 0) return
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
    const snapshot = {
      id: 'held-' + Date.now(), orderNumber, quantities, answers: { ...answers },
      itemCount, total, createdAt: Date.now(),
    }
    saveHeldOrders({ ...heldOrders, [fieldId]: [...(heldOrders[fieldId] || []), snapshot] })
    setCartQuantities(current => ({ ...current, [fieldId]: {} }))
    setOrderNumber(Math.floor(1000 + Math.random() * 9000))
  }

  function resumeHeldOrder(fieldId, heldId) {
    const held = (heldOrders[fieldId] || []).find(h => h.id === heldId)
    if (!held) return
    setCartQuantities(current => ({ ...current, [fieldId]: held.quantities }))
    setAnswers(current => ({ ...current, ...held.answers }))
    setOrderNumber(held.orderNumber)
    saveHeldOrders({ ...heldOrders, [fieldId]: (heldOrders[fieldId] || []).filter(h => h.id !== heldId) })
    setHeldPanelFieldId(null)
  }

  function discardHeldOrder(fieldId, heldId) {
    saveHeldOrders({ ...heldOrders, [fieldId]: (heldOrders[fieldId] || []).filter(h => h.id !== heldId) })
  }

  // Retail (deferCheckout) has no Hold button - accidentally navigating
  // away mid-sale (a wrong "back" tap, a browser gesture) had nothing to
  // catch it. Same per-device localStorage convention as heldOrders above,
  // just autosaved continuously instead of needing a deliberate tap, and
  // restored once on arrival instead of picked from a list. Skipped
  // entirely for a token edit link (a saved response has its own real data
  // to load, see loadAnswersFromData, not a draft to resume) and for any
  // non-deferCheckout form (Restaurant's Held orders already cover this).
  useEffect(() => {
    if (!form || token || !cartDefersCheckout) return
    try {
      const raw = localStorage.getItem(`verticals_draft_${form.id}`)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft.cartQuantities) setCartQuantities(draft.cartQuantities)
      if (draft.answers) setAnswers(current => ({ ...current, ...draft.answers }))
      if (draft.deliveryFee) setDeliveryFee(draft.deliveryFee)
    } catch {}
    // Runs once per form landed on, not on every keystroke - see the
    // deliberately narrow dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id, token, cartDefersCheckout])

  useEffect(() => {
    if (!form || token || !cartDefersCheckout) return
    const hasItems = Object.values(cartQuantities).some(qtys => Object.values(qtys || {}).some(q => Number(q) > 0))
    const hasAnswers = Object.values(answers).some(v => v !== undefined && v !== null && v !== '')
    try {
      if (!hasItems && !hasAnswers) {
        localStorage.removeItem(`verticals_draft_${form.id}`)
      } else {
        localStorage.setItem(`verticals_draft_${form.id}`, JSON.stringify({ cartQuantities, answers, deliveryFee }))
      }
    } catch {}
  }, [form, token, cartDefersCheckout, cartQuantities, answers, deliveryFee])

  // Linked-record dropdowns pull their options from another form's records.
  // Only readable when the person filling this in is authenticated as that
  // linked form's owner (RLS scopes submission reads to the owner), so for an
  // anonymous public respondent, this quietly resolves to an empty list
  // rather than erroring, since most linked-record use cases (like Salary
  // Events → Employees) are filled in by the account owner, not the public.
  useEffect(() => {
    async function loadLinkedOptions() {
      const linkedFields = (form?.fields || []).filter(f => f.type === 'linked_record' && f.linkedFormId)
      if (linkedFields.length === 0) return

      const results = {}
      await Promise.all(linkedFields.map(async (field) => {
        const { data } = await supabase
          .from('submissions').select('id, data')
          .eq('form_id', field.linkedFormId)
          .is('deleted_at', null)
        results[field.id] = (data || []).map(sub => ({
          recordId: sub.id,
          label: field.linkedDisplayFieldId ? (sub.data[field.linkedDisplayFieldId] ?? sub.id) : sub.id,
        }))
      }))
      setLinkedOptions(results)
    }
    if (form) loadLinkedOptions()
  }, [form])

  function updateAnswer(fieldId, value) {
    setAnswers({ ...answers, [fieldId]: value })
    if (errors[fieldId]) {
      const newErrors = { ...errors }
      delete newErrors[fieldId]
      setErrors(newErrors)
    }
  }

  function updateCartQuantity(fieldId, productId, qty) {
    setCartQuantities({
      ...cartQuantities,
      [fieldId]: {
        ...(cartQuantities[fieldId] || {}),
        [productId]: qty
      }
    })
  }

  function setCartSearchText(fieldId, text) {
    setCartSearch({ ...cartSearch, [fieldId]: text })
  }

  function setCartCategoryFilter(fieldId, category) {
    setCartCategory({ ...cartCategory, [fieldId]: category })
  }

  function incrementCartItem(fieldId, productId) {
    const current = Number((cartQuantities[fieldId] || {})[productId]) || 0
    updateCartQuantity(fieldId, productId, current + 1)
  }

  function addToCart(fieldId, productId) {
    incrementCartItem(fieldId, productId)
    setAddedFlash(current => ({ ...current, [productId]: true }))
    setTimeout(() => setAddedFlash(current => ({ ...current, [productId]: false })), 500)
  }

  function decrementCartItem(fieldId, productId) {
    const current = Number((cartQuantities[fieldId] || {})[productId]) || 0
    updateCartQuantity(fieldId, productId, Math.max(0, current - 1))
  }

  function setCartItemQuantity(fieldId, productId, rawValue) {
    const num = Math.max(0, Math.floor(Number(rawValue)) || 0)
    updateCartQuantity(fieldId, productId, num)
  }

  function removeCartItem(fieldId, productId) {
    updateCartQuantity(fieldId, productId, 0)
  }

  function clearCart(fieldId) {
    setCartQuantities(current => ({ ...current, [fieldId]: {} }))
  }

  function openCheckout(fieldId) {
    setCheckoutMethod(null)
    setSplitDraft([{ method: 'Cash', amount: '' }, { method: 'Card', amount: '' }])
    setShowMoreCheckoutFields(false)
    setCheckoutFieldId(fieldId)
  }

  function closeCheckout() {
    setCheckoutFieldId(null)
  }

  async function completePayment(fieldId, total) {
    if (submitting) return // guards the brief window before the modal actually closes
    let finalPayment
    if (checkoutMethod === 'Split') {
      const splits = splitDraft
        .filter(s => s.method && Number(s.amount) > 0)
        .map(s => ({ method: s.method, amount: Number(s.amount) }))
      const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0)
      if (splitTotal !== total || splits.length < 2) return
      finalPayment = { method: 'Split', splits }
    } else {
      finalPayment = { method: checkoutMethod }
    }
    setCartPayment(current => ({ ...current, [fieldId]: finalPayment }))
    setCheckoutFieldId(null)
    // Paying finalizes the order - submit it right here instead of relying
    // on the page's own Back/Next/Submit row, which this POS flow hides.
    await submitAnswers({ [fieldId]: finalPayment })
  }

  function clearPayment(fieldId) {
    setCartPayment(current => {
      const next = { ...current }
      delete next[fieldId]
      return next
    })
  }

  async function handleFileSelect(fieldId, event) {
    const file = event.target.files[0]
    if (!file) return

    const field = form.fields.find(f => f.id === fieldId)
    const maxSizeMB = field?.maxSizeMB ?? 5

    if (file.size > maxSizeMB * 1024 * 1024) {
      setErrors({ ...errors, [fieldId]: `File must be under ${maxSizeMB}MB.` })
      event.target.value = ''
      return
    }

    setUploading({ ...uploading, [fieldId]: true })
    if (errors[fieldId]) {
      const newErrors = { ...errors }
      delete newErrors[fieldId]
      setErrors(newErrors)
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${form.id}/${fieldId}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage.from('form-uploads').upload(path, file)

    if (error) {
      setUploading({ ...uploading, [fieldId]: false })
      setErrors({ ...errors, [fieldId]: 'Upload failed: ' + error.message })
      event.target.value = ''
      return
    }

    const { data } = supabase.storage.from('form-uploads').getPublicUrl(path)
    updateAnswer(fieldId, data.publicUrl)
    setUploading({ ...uploading, [fieldId]: false })
  }

  function validateField(field, value) {
    // value is a pre-computed item count for a cart field (see
    // validatePageFields) rather than answers[field.id] - a cart field
    // never writes into `answers`, its data only gets assembled at submit
    // time from cartQuantities, so `required` here used to be a total
    // no-op and an order with zero items would submit as a blank record.
    if (field.type === 'cart') {
      if (field.required && (!value || value <= 0)) {
        return field.errorMessage || `Add at least one item before submitting.`
      }
      return null
    }

    if (field.type === 'linked_record') {
      if (field.required && !value?.recordId) {
        return field.errorMessage || `${field.label} is required.`
      }
      return null
    }

    if (field.type === 'location') {
      if (field.required && !(value?.country && value?.state && value?.city)) {
        return field.errorMessage || `${field.label} is required.`
      }
      return null
    }

    if (field.type === 'checkbox') {
      const arr = Array.isArray(value) ? value : []
      if (field.required && arr.length === 0) {
        return field.errorMessage || `${field.label} is required.`
      }
      if (field.minSelect !== undefined && arr.length > 0 && arr.length < field.minSelect) {
        return field.errorMessage || `Select at least ${field.minSelect} option(s) for ${field.label}.`
      }
      if (field.maxSelect !== undefined && arr.length > field.maxSelect) {
        return field.errorMessage || `Select at most ${field.maxSelect} option(s) for ${field.label}.`
      }
      return null
    }

    if (field.type === 'multiplechoicegrid') {
      const rows = field.rows || []
      const answeredRows = rows.filter(row => value && value[row]).length
      if (field.required && answeredRows < rows.length) {
        return field.errorMessage || `Please answer every row of ${field.label}.`
      }
      return null
    }

    if (field.type === 'checkboxgrid') {
      const rows = field.rows || []
      const answeredRows = rows.filter(row => value && value[row] && value[row].length > 0).length
      if (field.required && answeredRows < rows.length) {
        return field.errorMessage || `Please answer every row of ${field.label}.`
      }
      return null
    }

    if (field.type === 'linearscale' || field.type === 'rating') {
      if (field.required && (value === undefined || value === null || value === '')) {
        return field.errorMessage || `${field.label} is required.`
      }
      return null
    }

    const strVal = (value ?? '').toString().trim()

    if (field.required && strVal === '') {
      return field.errorMessage || `${field.label} is required.`
    }
    if (strVal === '') return null // not required and left blank, nothing further to check

    if (field.type === 'text' || field.type === 'longtext') {
      if (field.minLength !== undefined && strVal.length < field.minLength) {
        return field.errorMessage || `${field.label} must be at least ${field.minLength} characters.`
      }
      if (field.maxLength !== undefined && strVal.length > field.maxLength) {
        return field.errorMessage || `${field.label} must be at most ${field.maxLength} characters.`
      }
    }

    if (field.type === 'number') {
      const num = Number(strVal)
      if (isNaN(num)) {
        return field.errorMessage || `${field.label} must be a number.`
      }
      if (field.min !== undefined && num < field.min) {
        return field.errorMessage || `${field.label} must be at least ${field.min}.`
      }
      if (field.max !== undefined && num > field.max) {
        return field.errorMessage || `${field.label} must be at most ${field.max}.`
      }
    }

    if (field.type === 'date') {
      if (field.minDate && strVal < field.minDate) {
        return field.errorMessage || `${field.label} must be on or after ${field.minDate}.`
      }
      if (field.maxDate && strVal > field.maxDate) {
        return field.errorMessage || `${field.label} must be on or before ${field.maxDate}.`
      }
    }

    if (field.type === 'time') {
      if (field.minTime && strVal < field.minTime) {
        return field.errorMessage || `${field.label} must be at or after ${field.minTime}.`
      }
      if (field.maxTime && strVal > field.maxTime) {
        return field.errorMessage || `${field.label} must be at or before ${field.maxTime}.`
      }
    }

    if (field.type === 'email') {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailPattern.test(strVal)) {
        return field.errorMessage || `${field.label} must be a valid email address.`
      }
    }

    return null
  }

  function cartItemCount(field) {
    const quantities = cartQuantities[field.id] || {}
    return (field.products || []).reduce((sum, p) => sum + (Number(quantities[p.id]) || 0), 0)
  }

  // Validates just the fields on one page: used both for the Next button
  // (only that page's fields should block advancing) and, with the full
  // field list, for the final submit.
  function validatePageFields(pageFields) {
    const newErrors = {}
    pageFields.forEach(field => {
      if (field.type === 'section') return
      // A deferCheckout order screen never renders a collapsedInCheckout
      // field at all (see primaryFields above) - required or not, there's
      // no way to fill it in from here, so it can't be allowed to block
      // submission either. Restaurant's checkout modal still lets you
      // expand and fill a collapsed field before submitting, so this only
      // applies to deferCheckout.
      if (cartDefersCheckout && field.collapsedInCheckout) return
      const value = field.type === 'cart' ? cartItemCount(field) : answers[field.id]
      const err = validateField(field, value)
      if (err) newErrors[field.id] = err
    })
    return newErrors
  }

  // "Please fix the errors below" was no help when the erroring field was a
  // Manage Details field that isn't even rendered on a deferCheckout order
  // screen - naming the actual field(s) means there's always something to
  // act on, whether or not it's currently visible.
  function describeErrorFields(fieldErrors, pageFields) {
    return Object.keys(fieldErrors)
      .map(fieldId => fieldId === '_respondent_email' ? 'Email' : (pageFields.find(f => f.id === fieldId)?.label || 'a field'))
      .join(', ')
  }

  function goNext() {
    const pageErrors = validatePageFields(currentPage.fields)
    if (Object.keys(pageErrors).length > 0) {
      setErrors(current => ({ ...current, ...pageErrors }))
      setMessage(`Please fix: ${describeErrorFields(pageErrors, currentPage.fields)}.`)
      return
    }
    setMessage('')
    setPageIndex(i => Math.min(i + 1, pages.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    setPageIndex(i => Math.max(i - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitAnswers(paymentOverride) {
    if (submitting) return // already in flight - a double-click/slow network shouldn't create a second order
    if (Object.values(uploading).some(v => v)) {
      setMessage('Please wait for the file upload to finish.')
      return
    }

    const newErrors = validatePageFields(form.fields)

    if (form.settings?.collectEmail && (!respondentEmail || respondentEmail.trim() === '')) {
      newErrors._respondent_email = 'Please enter your email before submitting.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setMessage(`Please fix: ${describeErrorFields(newErrors, form.fields)}.`)
      return
    }
    setErrors({})

    const finalData = {}
    form.fields.forEach(field => {
      if (field.type === 'section') return
      if (field.type === 'cart') {
        const quantities = cartQuantities[field.id] || {}
        const items = (field.products || [])
          .map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category || '', quantity: Number(quantities[p.id]) || 0 }))
          .filter(item => item.quantity > 0)
        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        finalData[field.id] = {
          items, total,
          payment: (paymentOverride && paymentOverride[field.id]) || cartPayment[field.id] || null,
          deliveryFee: field.deferCheckout ? deferCheckoutExtraTotal : (Number(deliveryFee[field.id]) || 0),
        }
      } else {
        finalData[field.id] = answers[field.id]
      }
    })

    if (form.settings?.collectEmail) {
      finalData._respondent_email = respondentEmail
    }

    setSubmitting(true)
    try {
      let submissionId = null
      let realOrderNumber = orderNumber
      if (token) {
        await updateSubmissionByToken(token, finalData)
        // Opened from the Records "Edit" link (either as a popup tab or,
        // for POS orders, embedded in an iframe) to make a quick correction.
        // Report back to whoever opened this and stop - the POS
        // receipt/reset flow below is for taking a new order, not this.
        if (window.opener) {
          window.close()
          return
        }
        if (window.self !== window.top) {
          window.parent.postMessage('verticals-order-saved', window.location.origin)
          return
        }
      } else {
        const result = await submitForm(form.id, finalData)
        setEditLink(`${window.location.origin}/form/${form.id}/response/${result.edit_token}`)
        submissionId = result.id
        // The invoice should show the real, persisted order number (also
        // what Records searches/filters by) rather than the random one
        // generated client-side just to label the order while building it.
        if (result.order_number) realOrderNumber = result.order_number
      }

      // An order used to jump straight to a print-preview popup, which
      // browsers routinely block when it's triggered from inside an async
      // submit chain rather than a direct click - the respondent just saw a
      // "please allow pop-ups" browser nag instead of any confirmation their
      // order actually went through. A plain in-page confirmation always
      // shows regardless of popup settings; viewing the invoice (still the
      // same InvoiceModal Records' own invoice action uses) is an explicit
      // click from inside that confirmation instead.
      if (hasCartOnPage) {
        // Order actually went through - the in-progress draft (see the
        // autosave effect above) would otherwise still be sitting in
        // localStorage and get restored on the next visit as if this sale
        // never happened.
        if (cartDefersCheckout) {
          try { localStorage.removeItem(`verticals_draft_${form.id}`) } catch {}
        }
        const cartField = currentPage.fields.find(f => f.type === 'cart')
        setOrderConfirmation({
          form,
          submission: {
            id: submissionId,
            order_number: realOrderNumber,
            data: finalData,
            created_at: new Date().toISOString(),
          },
        })

        setCartQuantities(current => ({ ...current, [cartField.id]: {} }))
        setCartPayment(current => {
          const next = { ...current }
          delete next[cartField.id]
          return next
        })
        setDeliveryFee(current => ({ ...current, [cartField.id]: '' }))
        currentPage.fields.forEach(f => {
          if (f.id !== cartField.id && f.type !== 'section') {
            setAnswers(current => {
              const next = { ...current }
              delete next[f.id]
              return next
            })
          }
        })
        setOrderNumber(Math.floor(1000 + Math.random() * 9000))
      } else {
        setSubmitted(true)
      }
    } catch (err) {
      setMessage('Error submitting: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function renderInput(field) {
    if (field.type === 'longtext') {
      return (
        <textarea
          value={answers[field.id] || ''}
          onChange={(e) => updateAnswer(field.id, e.target.value)}
          style={{ padding: '0.5rem', width: '100%', minHeight: '80px' }}
        />
      )
    }

    if (field.type === 'dropdown') {
      return (
        <select
          value={answers[field.id] || ''}
          onChange={(e) => updateAnswer(field.id, e.target.value)}
          style={{ padding: '0.5rem', width: '100%' }}
        >
          <option value="">Select an option</option>
          {field.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    if (field.type === 'multiplechoice') {
      return (
        <div>
          {field.options?.map(opt => (
            <label key={opt} style={{ display: 'block', marginBottom: '0.3rem' }}>
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={answers[field.id] === opt}
                onChange={(e) => updateAnswer(field.id, e.target.value)}
              />
              {' '}{opt}
            </label>
          ))}
        </div>
      )
    }

    if (field.type === 'cart') {
      const quantities = cartQuantities[field.id] || {}
      const search = (cartSearch[field.id] || '').toLowerCase()
      const activeCategory = cartCategory[field.id] || 'All'
      const allProducts = field.products || []

      const categoryNames = Array.from(new Set(
        allProducts.map(p => p.category).filter(c => c && c.trim() !== '')
      ))
      const categoryCounts = { All: allProducts.length }
      categoryNames.forEach(cat => { categoryCounts[cat] = allProducts.filter(p => p.category === cat).length })

      // A menu with a dozen-plus categories turns the filter row into its
      // own wall of pills to wade through before even reaching the search
      // box. Lead with the biggest ones and tuck the long tail behind
      // "+N more" instead of showing every category at once.
      const sortedCategoryNames = [...categoryNames].sort((a, b) => categoryCounts[b] - categoryCounts[a])
      const isCategoryFilterExpanded = expandedCategories[field.id]
      let visibleCategoryNames = isCategoryFilterExpanded ? sortedCategoryNames : sortedCategoryNames.slice(0, TOP_CATEGORY_COUNT)
      // Whatever's currently selected always gets a visible pill, even
      // collapsed - otherwise picking a "tail" category makes its own
      // filter pill disappear the moment something else re-renders.
      if (activeCategory !== 'All' && !visibleCategoryNames.includes(activeCategory)) {
        visibleCategoryNames = [...visibleCategoryNames, activeCategory]
      }
      const hiddenCategoryCount = sortedCategoryNames.length - visibleCategoryNames.length
      const categories = ['All', ...visibleCategoryNames]

      const filteredProducts = allProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search)
        const matchesCategory = activeCategory === 'All' || p.category === activeCategory
        return matchesSearch && matchesCategory
      })

      const cartItems = allProducts
        .map(p => ({ ...p, quantity: Number(quantities[p.id]) || 0 }))
        .filter(p => p.quantity > 0)

      const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const deliveryFeeAmount = Number(deliveryFee[field.id]) || 0
      const grandTotal = total + deliveryFeeAmount
      const payment = cartPayment[field.id]
      const splitTotal = splitDraft.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
      // Non-cart questions on this page (e.g. Dine-in/Takeout) move into the
      // checkout modal instead of the main order screen, since this page is
      // the POS order flow and those answers belong to checkout, not the menu.
      const checkoutQuestions = currentPage.fields.filter(f => f.id !== field.id && f.type !== 'section')
      // Retail-only: the full pale-green order box (Held/item list/Total+
      // button) only earns its place once there's actually something to
      // summarize - before that it just pushes the real catalogue further
      // down the screen. Restaurant (and anything else) keeps the box
      // always-expanded exactly as before, "No items yet" text included.
      const showCompactOrderBox = isRetail && cartItems.length === 0

      return (
        <div>
          {showCompactOrderBox && (
            <div className="card" style={{
              padding: '0.7rem 1rem', marginBottom: '1rem', background: 'var(--color-primary-soft)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem',
            }}>
              <span>Current Order · #{orderNumber}</span>
              <span style={{ fontWeight: 700 }}>₦{total.toLocaleString()}</span>
            </div>
          )}
          {/* Order box - lives on its own at the top, above the menu */}
          {!showCompactOrderBox && (
          <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--color-primary-soft)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
              <div style={{ fontWeight: '600' }}>Current Order</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                {(heldOrders[field.id] || []).length > 0 && (
                  <span
                    onClick={() => setHeldPanelFieldId(field.id)}
                    style={{ fontSize: '0.8rem', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Held ({heldOrders[field.id].length})
                  </span>
                )}
                <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Order #{orderNumber}</span>
              </div>
            </div>

            {cartItems.length === 0 ? (
              // Compact on purpose: an empty cart shouldn't claim as much
              // vertical space as a full order summary, since it just pushes
              // the actual catalogue further down the screen before a
              // shopper has added anything.
              <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>No items yet - select items below to begin.</p>
            ) : (
              <div style={{ marginBottom: '0.3rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
                  {cartItems.reduce((sum, i) => sum + i.quantity, 0)} Item{cartItems.reduce((sum, i) => sum + i.quantity, 0) !== 1 ? 's' : ''}
                </div>
                {cartItems.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem',
                    padding: '0.45rem 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '0.85rem'
                  }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                      <button className="secondary" onClick={() => decrementCartItem(field.id, item.id)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.9rem', minWidth: '34px' }}>−</button>
                      <span style={{ minWidth: '1.2rem', textAlign: 'center' }}>{item.quantity}</span>
                      <button className="secondary" onClick={() => incrementCartItem(field.id, item.id)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.9rem', minWidth: '34px' }}>+</button>
                    </div>
                    <span style={{ width: '72px', textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>
                      ₦{(item.price * item.quantity).toLocaleString()}
                    </span>
                    <span
                      onClick={() => removeCartItem(field.id, item.id)}
                      title="Remove"
                      style={{ color: '#c0392b', cursor: 'pointer', fontSize: '0.85rem', flexShrink: 0 }}
                    >
                      🗑
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '0.9rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.05rem', whiteSpace: 'nowrap', transition: 'color 0.2s' }}>
                Total <span style={{ marginLeft: '0.5rem' }}>₦{total.toLocaleString()}</span>
              </div>

              {payment && !token ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flex: 1,
                  background: 'var(--color-surface)', border: '1px solid var(--color-primary)', borderRadius: '6px',
                  padding: '0.6rem 0.8rem', fontSize: '0.85rem'
                }}>
                  <span>✓ Paid via {payment.method}</span>
                  <span onClick={() => clearPayment(field.id)} style={{ color: 'var(--color-primary)', cursor: 'pointer' }}>Change</span>
                </div>
              ) : field.deferCheckout ? (
                // No separate checkout step - items just sit in the cart
                // until the page's own Submit button (below every field,
                // same as a cart-less form) sends the whole thing at once.
                // Hold doesn't apply either: resuming a held order would
                // only restore the cart, not whatever else was filled in
                // below it on the same page.
                cartItems.length > 0 && (
                  <button type="button" className="secondary" onClick={() => clearCart(field.id)} style={{ padding: '0.8rem 1rem' }}>
                    Clear
                  </button>
                )
              ) : (
                <>
                  {cartItems.length > 0 && (
                    <button type="button" className="secondary" onClick={() => holdOrder(field.id)} style={{ padding: '0.8rem 1rem' }}>
                      Hold
                    </button>
                  )}
                  {cartItems.length > 0 && (
                    <button type="button" className="secondary" onClick={() => clearCart(field.id)} style={{ padding: '0.8rem 1rem' }}>
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={total === 0}
                    onClick={() => openCheckout(field.id)}
                    style={{ flex: 1, padding: '0.8rem', fontSize: '1rem', fontWeight: 600 }}
                  >
                    Checkout{total > 0 ? ` • ₦${total.toLocaleString()}` : ''}
                  </button>
                </>
              )}
            </div>
          </div>
          )}

          {/* Catalogue box - search + categories stay pinned while the menu below scrolls */}
          <div className="card" style={{ padding: 0, background: 'var(--color-primary-soft)', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--color-primary-soft)', padding: '1rem 1rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.7rem' }}>
                <input
                  type="text"
                  value={cartSearch[field.id] || ''}
                  onChange={(e) => setCartSearchText(field.id, e.target.value)}
                  placeholder="Search menu..."
                  style={{ flex: 1, padding: '0.6rem' }}
                />
                {/* Retail only - moved down here from the page header so it
                    sits at the edge of the row it actually acts on, instead
                    of floating alone up top. See the header block above for
                    the rest of the AI-fill gating (session/token/etc). */}
                {isRetail && hasCartOnPage && session && !token && (
                  <button
                    type="button"
                    onClick={() => setShowAiFill(true)}
                    aria-label="Fill from Text"
                    title="Fill from Text"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '38px', height: '38px', padding: 0, flexShrink: 0,
                      background: 'transparent', border: 'none', color: 'var(--color-primary)',
                    }}
                  >
                    <SparkleIcon size={22} />
                  </button>
                )}
              </div>

              {categories.length > 1 && (
                <div
                  className="category-scroll"
                  style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.9rem' }}
                >
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCartCategoryFilter(field.id, cat)}
                      className={activeCategory === cat ? '' : 'secondary'}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {cat} ({categoryCounts[cat] || 0})
                    </button>
                  ))}
                  {hiddenCategoryCount > 0 && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setExpandedCategories(current => ({ ...current, [field.id]: true }))}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      +{hiddenCategoryCount} more
                    </button>
                  )}
                  {isCategoryFilterExpanded && sortedCategoryNames.length > TOP_CATEGORY_COUNT && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setExpandedCategories(current => ({ ...current, [field.id]: false }))}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      Show less
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: '0 1rem 1rem' }}>
              {filteredProducts.length === 0 ? (
                <p style={{ color: '#999', margin: '1rem 0' }}>No items match your search.</p>
              ) : isMobile ? (
                // Tiles sized to content, 2 per row, in a grid capped to
                // roughly two rows with its own internal scroll - no "show
                // all" prompt needed, the rest of the catalogue is just a
                // scroll away inside this same box, same as any normal
                // scrollable list. Wider tiles than a 3-per-row grid would
                // give, so names truncate less on a phone-width screen.
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem',
                  maxHeight: '180px', overflowY: 'auto', paddingRight: '0.15rem',
                }}>
                  {filteredProducts.map(p => {
                    const qty = Number(quantities[p.id]) || 0
                    return (
                      <div key={p.id} className="card" style={{
                        // A fixed aspectRatio here used to be tuned for the
                        // old 3-per-row grid - at 2 per row each tile is
                        // ~1.5x wider, and the same ratio made it ~1.5x
                        // taller too, leaving a big empty gap between the
                        // price and the Add button. Sizing to content
                        // (padding + a small gap) instead of a forced ratio
                        // means it stays right regardless of column count.
                        padding: isRetail ? '0.4rem' : '0.5rem', gap: isRetail ? '0.3rem' : '0.4rem', background: 'var(--color-surface)',
                        display: 'flex', flexDirection: 'column',
                        // Grid items default to min-width: auto, meaning
                        // they won't shrink below their content's intrinsic
                        // size - the nowrap product name below would force
                        // this tile's column wider than its 1fr share
                        // (dragging the whole grid, and the page, wider than
                        // the phone screen) without this override.
                        minWidth: 0,
                      }}>
                        <div style={{ minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
                          <div style={{
                            fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.15,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                            ₦{Number(p.price).toLocaleString()}
                          </div>
                        </div>

                        {qty === 0 ? (
                          <button
                            onClick={() => addToCart(field.id, p.id)}
                            style={{ fontSize: '0.65rem', padding: '0.25rem', width: '100%' }}
                          >
                            {addedFlash[p.id] ? '✓' : 'Add'}
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <button className="secondary" onClick={() => decrementCartItem(field.id, p.id)} style={{ padding: '0.1rem 0.35rem', fontSize: '0.72rem' }}>−</button>
                            <span style={{ fontSize: '0.7rem' }}>{qty}</span>
                            <button className="secondary" onClick={() => incrementCartItem(field.id, p.id)} style={{ padding: '0.1rem 0.35rem', fontSize: '0.72rem' }}>+</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '0.6rem',
                }}>
                  {filteredProducts.map(p => {
                    const qty = Number(quantities[p.id]) || 0
                    return (
                      <div key={p.id} className="card" style={{
                        padding: '0.7rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        background: 'var(--color-surface)'
                      }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '600', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {p.name}
                          {p.isPackage && (
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-primary)',
                              border: '1px solid var(--color-primary)', borderRadius: '999px', padding: '0.05rem 0.4rem'
                            }}>
                              PACKAGE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.95rem', color: 'var(--color-primary)', fontWeight: '700' }}>
                          ₦{Number(p.price).toLocaleString()}
                        </div>
                        {p.category && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{p.category}</div>
                        )}

                        {qty === 0 ? (
                          <button
                            onClick={() => addToCart(field.id, p.id)}
                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.5rem', marginTop: '0.2rem' }}
                          >
                            {addedFlash[p.id] ? '✓ Added' : 'Add'}
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                            <button className="secondary" onClick={() => decrementCartItem(field.id, p.id)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}>−</button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={qty}
                              onChange={(e) => setCartItemQuantity(field.id, p.id, e.target.value)}
                              style={{
                                width: '40px', padding: '0.2rem', fontSize: '0.85rem',
                                textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: '4px'
                              }}
                            />
                            <button className="secondary" onClick={() => incrementCartItem(field.id, p.id)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}>+</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Held orders panel */}
          {heldPanelFieldId === field.id && (
            <div
              onClick={() => setHeldPanelFieldId(null)}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="card"
                style={{ background: 'var(--color-surface)', padding: '1.5rem', width: '420px', maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto' }}
              >
                <h3 style={{ margin: '0 0 1rem' }}>Held Orders</h3>

                {(heldOrders[field.id] || []).length === 0 ? (
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>No held orders right now.</p>
                ) : (
                  (heldOrders[field.id] || []).map(held => (
                    <div key={held.id} style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.8rem', marginBottom: '0.7rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 600 }}>Order #{held.orderNumber}</span>
                        <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{held.itemCount} item{held.itemCount !== 1 ? 's' : ''} · ₦{held.total.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="secondary"
                          style={{ color: '#c0392b' }}
                          onClick={() => discardHeldOrder(field.id, held.id)}
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          disabled={cartItems.length > 0}
                          title={cartItems.length > 0 ? 'Hold or clear the current order first' : ''}
                          onClick={() => resumeHeldOrder(field.id, held.id)}
                        >
                          Resume
                        </button>
                      </div>
                    </div>
                  ))
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" className="secondary" onClick={() => setHeldPanelFieldId(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Checkout modal */}
          {checkoutFieldId === field.id && (
            <div
              onClick={closeCheckout}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="card"
                style={{ background: 'var(--color-surface)', padding: '1.5rem', width: '420px', maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>Checkout</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Order #{orderNumber}</span>
                </div>

                {/* Order summary - always visible, at the top */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.8rem', marginBottom: '1rem', background: 'var(--color-primary-soft)' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.5rem' }}>Order Summary ({cartItems.length})</div>
                  {cartItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.3rem 0' }}>
                      <span>{item.name} × {item.quantity}</span>
                      <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {checkoutQuestions.length > 0 && (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.8rem', marginBottom: '1rem', background: 'var(--color-primary-soft)' }}>
                    {checkoutQuestions.filter(q => !q.collapsedInCheckout).map(q => (
                      <div key={q.id} style={{ marginBottom: '0.7rem' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {q.label}{q.required && <span style={{ color: '#c0392b' }}> *</span>}
                        </label>
                        <div style={{ marginTop: '0.4rem' }}>{renderInput(q)}</div>
                      </div>
                    ))}

                    {checkoutQuestions.some(q => q.collapsedInCheckout) && (
                      <div style={{ marginBottom: showMoreCheckoutFields ? '0.7rem' : 0 }}>
                        <span
                          onClick={() => setShowMoreCheckoutFields(v => !v)}
                          style={{ fontSize: '0.82rem', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
                        >
                          {showMoreCheckoutFields ? '− Fewer details' : '+ More details'}
                        </span>
                      </div>
                    )}

                    {showMoreCheckoutFields && checkoutQuestions.filter(q => q.collapsedInCheckout).map(q => (
                      <div key={q.id} style={{ marginBottom: '0.7rem' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {q.label}{q.required && <span style={{ color: '#c0392b' }}> *</span>}
                        </label>
                        <div style={{ marginTop: '0.4rem' }}>{renderInput(q)}</div>
                      </div>
                    ))}

                    {checkoutQuestions.some(q => answers[q.id] === 'Delivery') && (
                      <div>
                        <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Delivery Fee</label>
                        <input
                          type="number"
                          min="0"
                          value={deliveryFee[field.id] || ''}
                          onChange={(e) => setDeliveryFee(current => ({ ...current, [field.id]: e.target.value }))}
                          placeholder="0"
                          style={{ width: '100%', padding: '0.5rem', marginTop: '0.4rem' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {deliveryFeeAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
                    <span>Delivery Fee</span>
                    <span>₦{deliveryFeeAmount.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '1rem' }}>
                  <span>Total Due</span>
                  <span>₦{grandTotal.toLocaleString()}</span>
                </div>

                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Payment Method</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                  {PAYMENT_METHODS.map(method => (
                    <button
                      key={method}
                      type="button"
                      className={checkoutMethod === method ? '' : 'secondary'}
                      onClick={() => setCheckoutMethod(method)}
                      style={{ padding: '0.7rem 0.5rem' }}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                {checkoutMethod === 'Split' && (
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.9rem', marginBottom: '0.9rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Split between methods</div>
                    {splitDraft.map((row, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        <select
                          value={row.method}
                          onChange={(e) => setSplitDraft(current => current.map((r, ri) => ri === i ? { ...r, method: e.target.value } : r))}
                          style={{ flex: 1, padding: '0.4rem' }}
                        >
                          {PAYMENT_METHODS.filter(m => m !== 'Split').map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input
                          type="number"
                          min="0"
                          placeholder="Amount"
                          value={row.amount}
                          onChange={(e) => setSplitDraft(current => current.map((r, ri) => ri === i ? { ...r, amount: e.target.value } : r))}
                          style={{ width: '110px', padding: '0.4rem' }}
                        />
                        <button
                          type="button"
                          className="secondary"
                          style={{ color: '#c0392b', padding: '0.4rem 0.6rem' }}
                          disabled={splitDraft.length <= 1}
                          onClick={() => setSplitDraft(current => current.filter((_, ri) => ri !== i))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setSplitDraft(current => [...current, { method: 'Cash', amount: '' }])}
                      style={{ marginBottom: '0.7rem' }}
                    >
                      + Add payment method
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: splitTotal === total ? 'inherit' : '#c0392b' }}>
                      <span>Remaining</span>
                      <span>₦{Math.max(total - splitTotal, 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {checkoutMethod && checkoutMethod !== 'Split' && (
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '0.9rem' }}>
                    Collect payment via {checkoutMethod}, then complete the order below.
                  </p>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="secondary" onClick={closeCheckout}>Cancel</button>
                  <button
                    type="button"
                    disabled={
                      submitting ||
                      !checkoutMethod ||
                      (checkoutMethod === 'Split' && (splitTotal !== grandTotal || splitDraft.filter(s => Number(s.amount) > 0).length < 2)) ||
                      checkoutQuestions.some(q => q.required && !answers[q.id])
                    }
                    onClick={() => completePayment(field.id, grandTotal)}
                  >
                    {submitting ? 'Submitting...' : 'Checkout'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    }

    if (field.type === 'checkbox') {
      const selected = answers[field.id] || []

      function toggleOption(opt) {
        const newSelected = selected.includes(opt)
          ? selected.filter(o => o !== opt)
          : [...selected, opt]
        updateAnswer(field.id, newSelected)
      }

      return (
        <div>
          {field.options?.map(opt => (
            <label key={opt} style={{ display: 'block', marginBottom: '0.3rem' }}>
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggleOption(opt)}
              />
              {' '}{opt}
            </label>
          ))}
        </div>
      )
    }

    if (field.type === 'linearscale') {
      const scaleMin = field.scaleMin ?? 1
      const scaleMax = field.scaleMax ?? 5
      const scaleValues = []
      for (let i = scaleMin; i <= scaleMax; i++) scaleValues.push(i)
      const selected = answers[field.id]

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {field.minLabel && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{field.minLabel}</span>
          )}
          {scaleValues.map(val => (
            <button
              key={val}
              type="button"
              onClick={() => updateAnswer(field.id, val)}
              className={selected === val ? '' : 'secondary'}
              style={{ padding: '0.5rem 0.9rem', minWidth: '40px' }}
            >
              {val}
            </button>
          ))}
          {field.maxLabel && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{field.maxLabel}</span>
          )}
        </div>
      )
    }

    if (field.type === 'rating') {
      const maxStars = field.maxStars ?? 5
      const selected = Number(answers[field.id]) || 0

      return (
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {Array.from({ length: maxStars }, (_, i) => i + 1).map(star => (
            <span
              key={star}
              onClick={() => updateAnswer(field.id, star)}
              style={{
                cursor: 'pointer', fontSize: '1.6rem', lineHeight: 1,
                color: star <= selected ? '#f5b400' : '#ddd'
              }}
            >
              ★
            </span>
          ))}
        </div>
      )
    }

    if (field.type === 'multiplechoicegrid') {
      const gridAnswers = answers[field.id] || {}

      function setRowAnswer(row, col) {
        updateAnswer(field.id, { ...gridAnswers, [row]: col })
      }

      return (
        <div className="table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th></th>
                {field.columns?.map(col => (
                  <th key={col} style={{ fontSize: '0.8rem', fontWeight: '500', padding: '0.4rem', textAlign: 'center' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {field.rows?.map(row => (
                <tr key={row}>
                  <td style={{ fontSize: '0.85rem', padding: '0.4rem' }}>{row}</td>
                  {field.columns?.map(col => (
                    <td key={col} style={{ textAlign: 'center', padding: '0.4rem' }}>
                      <input
                        type="radio"
                        name={`${field.id}-${row}`}
                        checked={gridAnswers[row] === col}
                        onChange={() => setRowAnswer(row, col)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (field.type === 'checkboxgrid') {
      const gridAnswers = answers[field.id] || {}

      function toggleCell(row, col) {
        const current = gridAnswers[row] || []
        const updated = current.includes(col) ? current.filter(c => c !== col) : [...current, col]
        updateAnswer(field.id, { ...gridAnswers, [row]: updated })
      }

      return (
        <div className="table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th></th>
                {field.columns?.map(col => (
                  <th key={col} style={{ fontSize: '0.8rem', fontWeight: '500', padding: '0.4rem', textAlign: 'center' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {field.rows?.map(row => (
                <tr key={row}>
                  <td style={{ fontSize: '0.85rem', padding: '0.4rem' }}>{row}</td>
                  {field.columns?.map(col => (
                    <td key={col} style={{ textAlign: 'center', padding: '0.4rem' }}>
                      <input
                        type="checkbox"
                        checked={(gridAnswers[row] || []).includes(col)}
                        onChange={() => toggleCell(row, col)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (field.type === 'fileupload') {
      const uploaded = answers[field.id]
      const isUploading = !!uploading[field.id]

      return (
        <div>
          <input
            type="file"
            accept={field.acceptTypes || undefined}
            onChange={(e) => handleFileSelect(field.id, e)}
            disabled={isUploading}
          />
          {isUploading && (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.4rem' }}>Uploading…</p>
          )}
          {uploaded && !isUploading && (
            <p style={{ fontSize: '0.8rem', color: '#1a7f37', marginTop: '0.4rem' }}>
              Uploaded: <a href={uploaded} target="_blank" rel="noreferrer">view file</a>
            </p>
          )}
        </div>
      )
    }

    if (field.type === 'linked_record') {
      const options = linkedOptions[field.id] || []
      const current = answers[field.id]
      return (
        <select
          value={current?.recordId || ''}
          onChange={(e) => {
            const option = options.find(o => o.recordId === e.target.value)
            updateAnswer(field.id, option ? { recordId: option.recordId, label: option.label } : undefined)
          }}
          style={{ padding: '0.5rem', width: '100%' }}
        >
          <option value="">{options.length === 0 ? 'No records available' : 'Select...'}</option>
          {options.map(o => <option key={o.recordId} value={o.recordId}>{o.label}</option>)}
        </select>
      )
    }

    if (field.type === 'autocomplete') {
      return (
        <>
          <input
            type="text"
            list={`autocomplete-${field.id}`}
            value={answers[field.id] || ''}
            onChange={(e) => updateAnswer(field.id, e.target.value)}
            style={{ padding: '0.5rem', width: '100%' }}
          />
          <datalist id={`autocomplete-${field.id}`}>
            {field.options?.map(opt => <option key={opt} value={opt} />)}
          </datalist>
        </>
      )
    }

    if (field.type === 'location') {
      const value = answers[field.id] || {}
      const country = value.country || field.defaultCountry || COUNTRIES[0]
      const stateOptions = statesFor(country)
      const cityOptions = value.state ? citiesForField(field, country, value.state) : []

      function setLocationPart(patch) {
        updateAnswer(field.id, { country, ...value, ...patch })
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <select value={country} onChange={(e) => setLocationPart({ country: e.target.value, state: '', city: '' })} style={{ padding: '0.5rem' }}>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={value.state || ''} onChange={(e) => setLocationPart({ state: e.target.value, city: '' })} style={{ padding: '0.5rem' }}>
            <option value="">Select state...</option>
            {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={value.city || ''} onChange={(e) => setLocationPart({ city: e.target.value })} style={{ padding: '0.5rem' }} disabled={!value.state}>
            <option value="">Select city...</option>
            {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )
    }

    const inputType =
      field.type === 'number' ? 'number' :
      field.type === 'email' ? 'email' :
      field.type === 'phone' ? 'tel' :
      field.type === 'date' ? 'date' :
      field.type === 'time' ? 'time' :
      'text'

    return (
      <input
        type={inputType}
        value={answers[field.id] || ''}
        onChange={(e) => updateAnswer(field.id, e.target.value)}
        style={{ padding: '0.5rem', width: '100%' }}
      />
    )
  }

  if (loading) return <LoadingState label="Loading form..." />

  if (!form) return <ErrorState message={message} />

  // Retail-only order-screen tweaks (compact empty cart box, "Place Order"
  // label, tighter tiles, subtler footer) all read this - declared here,
  // not reused from OrderConfirmationModal's own same-named const above
  // (a completely different component/closure, form isn't even the same
  // object there - that one's a submission's snapshot).
  const isRetail = isRetailTemplate(form)

  if (submitted) {
    return (
      <div className="page">
        <h2>{token ? 'Response updated successfully.' : 'Response submitted successfully.'}</h2>
        <p>Thank you.</p>
        {editLink && (
          <div className="card" style={{ padding: '1rem', marginTop: '1rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
              Save this link if you need to come back and edit your response:
            </p>
            <input
              readOnly
              value={editLink}
              onFocus={(e) => e.target.select()}
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
            />
          </div>
        )}
        {form.settings?.allowMultipleResponses && (
          <button
            onClick={() => {
              setAnswers({})
              setCartQuantities({})
              setCartSearch({})
              setCartCategory({})
              setRespondentEmail('')
              setSubmitted(false)
              setMessage('')
              setErrors({})
              setUploading({})
              setPageIndex(0)
            }}
            style={{ marginTop: '1rem' }}
          >
            Submit another response
          </button>
        )}
        <p style={{ marginTop: '3rem', color: '#999', fontSize: '0.85rem' }}>
          Powered by Verticals
        </p>
      </div>
    )
  }

  // Merges the AI-reviewed draft into the real order-screen state - additive
  // on cart quantities (a cashier may have already added a few items by
  // hand before pasting the rest of the message) rather than wiping
  // anything not mentioned in the pasted text.
  function applyAiFillResult(cartField, items, answers) {
    if (cartField && items.length > 0) {
      setCartQuantities(current => ({
        ...current,
        [cartField.id]: {
          ...(current[cartField.id] || {}),
          ...Object.fromEntries(items.map(i => [i.productId, Number(i.quantity) || 0])),
        },
      }))
    }
    if (answers.length > 0) {
      setAnswers(current => ({ ...current, ...Object.fromEntries(answers.map(a => [a.fieldId, a.value])) }))
    }
    setShowAiFill(false)
    showToast('Filled in from your paste - check everything before submitting.', 'success')
  }

  async function saveAiFillRules(newRules) {
    const newSettings = { ...(form.settings || {}), aiFillRules: newRules }
    const { error } = await supabase.from('forms').update({ settings: newSettings }).eq('id', form.id)
    if (error) {
      showToast('Could not save AI rules: ' + error.message, 'error')
      return
    }
    setForm(current => ({ ...current, settings: newSettings }))
    showToast('AI rules saved.', 'success')
  }

  // One field's normal (non-checkout-modal) row: the cart itself, or any
  // plain field. Pulled out of the page's field list so it can be called
  // for the "primary" and "more details" groups separately on a
  // deferCheckout form, instead of one flat .map() over every field.
  function renderFieldRow(field) {
    // Matches the Current Order/Catalogue boxes' pale-green shade above,
    // instead of these fields being the only plain-white cards on the
    // page - deferCheckout only (Retail's inline "cart + fields + one
    // Submit" flow), not a cart-less form's fields, which have no matching
    // shaded boxes elsewhere on their page to stay consistent with.
    const fieldCardStyle = field.type === 'cart'
      ? { marginBottom: '1rem' }
      : { padding: '1rem', marginBottom: '1rem', ...(cartDefersCheckout ? { background: 'var(--color-primary-soft)' } : {}) }
    return (
      <div key={field.id} className={field.type === 'cart' ? '' : 'card'} style={fieldCardStyle}>
        {field.type !== 'cart' && (
          <label style={{ fontWeight: '600' }}>
            {field.label}{field.required && <span style={{ color: '#c0392b' }}> *</span>}
          </label>
        )}
        <div style={field.type === 'cart' ? {} : { marginTop: '0.5rem' }}>
          {renderInput(field)}
        </div>
        {errors[field.id] && (
          <p style={{ color: '#c0392b', fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
            {errors[field.id]}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="page" style={{
      // PosSidePanel's hamburger button is position:fixed at top:1rem/
      // left:1rem, 42px square - with no reserved space it sits directly on
      // top of the title below (the button is a later paint layer, so it
      // wins visually and clips the first few characters of the form name).
      // A permanent left-padding reserve too (so a scrolled-past
      // heading/section couldn't get clipped either) cost enough width on a
      // narrow phone to clip real content on the right edge instead - worse
      // than the momentary letter overlap it fixed, so just the top reserve
      // stays. Only needed when the panel actually renders (a saved-response
      // edit link, `token`, skips it entirely).
      ...(!token ? { paddingTop: '4rem' } : {}),
      ...(cartDefersCheckout ? { paddingBottom: 'calc(7.5rem + env(safe-area-inset-bottom))' } : {}),
    }}>
      {!token && (
        <div className="no-print">
          <PosSidePanel formId={form.id} hasCartField={form.fields.some(f => f.type === 'cart')} bottomBarPresent={cartDefersCheckout} />
        </div>
      )}

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}>
        <div>
          {/* Retail-only: the form name is redundant chrome on a phone
              screen - the hamburger/back buttons already establish where
              you are, and cutting it saves real vertical space above the
              catalogue. Restaurant (and anything else) keeps it. */}
          {!isRetail && <h1 style={{ margin: 0 }}>{form.name}</h1>}
          {form.description && <p style={{ margin: '0.3rem 0 0' }}>{form.description}</p>}
        </div>
        {/* Staff/owner convenience only (session gated) - a customer filling
            this out themselves via a shared link (see PosSidePanel's Share
            Link) has nothing to paste from, and letting an anonymous visitor
            call the AI endpoint isn't something this needs to support.
            Skipped entirely when editing an existing response (token) -
            there's nothing to "paste an order" into at that point. Same
            SparkleIcon + solid-button styling as ProductManager's "Use AI to
            add new products" - keep new AI entry points matching this.
            Restaurant doesn't get this at all (see lib/templateFlags.js) -
            back to exactly how it worked before AI fill existed. Retail
            moves this button down next to the search bar instead of
            showing it up here - see the catalogue's search row below. */}
        {hasCartOnPage && session && !token && !isRestaurantTemplate(form) && !isRetail && (
          <button
            type="button"
            onClick={() => setShowAiFill(true)}
            aria-label="Fill from Text"
            title="Fill from Text"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '38px', height: '38px', padding: 0, flexShrink: 0,
              background: 'transparent', border: 'none', color: 'var(--color-primary)',
            }}
          >
            <SparkleIcon size={26} />
          </button>
        )}
      </div>

      {pages.length > 1 && (
        <div className="no-print" style={{ margin: '0.8rem 0 1.2rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
            Page {pageIndex + 1} of {pages.length}
          </div>
          <div style={{ height: '4px', background: '#eee', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${((pageIndex + 1) / pages.length) * 100}%`,
              background: 'var(--color-primary)', transition: 'width 0.2s ease'
            }} />
          </div>
        </div>
      )}

      {pageIndex === 0 && form.settings?.collectEmail && (
        <div className="card no-print" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <label>Your Email</label><br />
          <input
            type="email"
            value={respondentEmail}
            onChange={(e) => {
              setRespondentEmail(e.target.value)
              if (errors._respondent_email) {
                const newErrors = { ...errors }
                delete newErrors._respondent_email
                setErrors(newErrors)
              }
            }}
            style={{ padding: '0.5rem', width: '100%', marginTop: '0.4rem' }}
          />
          {errors._respondent_email && (
            <p style={{ color: '#c0392b', fontSize: '0.8rem', marginTop: '0.4rem' }}>{errors._respondent_email}</p>
          )}
        </div>
      )}

      {currentPage.section && (
        <div className="no-print" style={{ marginBottom: '1.2rem' }}>
          <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.25rem' }}>{currentPage.section.title || 'Untitled Section'}</h2>
          {currentPage.section.description && (
            <p style={{ margin: 0, color: 'var(--color-muted)' }}>{currentPage.section.description}</p>
          )}
        </div>
      )}

      {(() => {
        const visibleFields = currentPage.fields.filter(field => field.type === 'cart' || !hasCartOnPage || cartDefersCheckout)
        const cartField = visibleFields.find(f => f.type === 'cart')
        const otherFields = visibleFields.filter(f => f.type !== 'cart')
        // On a plain (no-cart) form or a normal embedded-checkout cart form,
        // collapsedInCheckout has nowhere to apply here - every field is
        // "primary". On a deferCheckout cart, which fields the order screen
        // shows is decided entirely up front in the builder (see
        // MoreDetailsManager) - a collapsedInCheckout field just isn't part
        // of this screen at all, there's no "+ More details" reveal here
        // anymore for whoever's taking the order to second-guess that call.
        const primaryFields = cartDefersCheckout ? otherFields.filter(f => !f.collapsedInCheckout) : otherFields

        return (
          <>
            {cartField && renderFieldRow(cartField)}
            {primaryFields.map(renderFieldRow)}
          </>
        )
      })()}

      {(!hasCartOnPage || cartDefersCheckout) && (
      <div
        className="no-print"
        style={cartDefersCheckout ? {
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
          background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
        } : undefined}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem',
          maxWidth: cartDefersCheckout ? '800px' : undefined,
          margin: cartDefersCheckout ? '0 auto' : undefined,
          padding: cartDefersCheckout ? '0.8rem 1.5rem 0.3rem' : undefined,
        }}>
          {/* Mobile-first: this bar is what makes Retail's "cart + fields +
              one Submit at the end" flow actually usable one-handed - the
              running total and the Submit button stay reachable without
              scrolling back down past the whole catalogue and customer
              fields every time. Only shown for deferCheckout forms; a
              normal embedded-checkout cart (Restaurant) never reaches this
              row at all (hasCartOnPage suppresses it, same as before). */}
          {cartDefersCheckout && (
            <div style={{ whiteSpace: 'nowrap' }}>
              {deferCheckoutExtraTotal > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                  Subtotal ₦{(deferCheckoutCartTotal - deferCheckoutExtraTotal).toLocaleString()} + Additional ₦{deferCheckoutExtraTotal.toLocaleString()}
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                Total <span style={{ marginLeft: '0.4rem', color: 'var(--color-primary)' }}>₦{deferCheckoutCartTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          {pageIndex > 0 ? (
            <button className="secondary" onClick={goBack} style={{ padding: '0.7rem 1.5rem', fontSize: '1rem' }}>
              Back
            </button>
          ) : cartDefersCheckout ? null : <span />}

          {isLastPage ? (
            <button
              onClick={() => submitAnswers()}
              disabled={submitting}
              style={{ padding: '0.7rem 1.5rem', fontSize: '1rem', flex: cartDefersCheckout ? '1 1 auto' : undefined }}
            >
              {submitting ? 'Submitting...' : (token ? 'Save Changes' : (isRetail ? 'Place Order' : 'Submit'))}
            </button>
          ) : (
            <button
              onClick={goNext}
              style={{ padding: '0.7rem 1.5rem', fontSize: '1rem', flex: cartDefersCheckout ? '1 1 auto' : undefined }}
            >
              Next
            </button>
          )}
        </div>

        {/* This fixed bar IS the bottom of the screen on a deferCheckout
            form - "Powered by Verticals" belongs here, as its own last
            line, not stranded earlier in the scrollable content above a
            bar that visually covers whatever would normally follow it.
            The safe-area padding that used to sit on the button row above
            moves down to here instead, since this is now the true last
            thing on screen, closest to an iPhone's home-indicator strip. */}
        {cartDefersCheckout && (
          <p style={{
            textAlign: 'center', fontStyle: 'italic', color: '#999',
            fontSize: isRetail ? '0.68rem' : '0.75rem', opacity: isRetail ? 0.7 : 1,
            margin: 0, padding: '0 0 calc(0.5rem + env(safe-area-inset-bottom))',
          }}>
            Powered by Verticals
          </p>
        )}
      </div>
      )}

      {message && <p className="no-print" style={{ marginTop: '1rem', color: 'red' }}>{message}</p>}

      {showAiFill && (() => {
        const cartField = currentPage.fields.find(f => f.type === 'cart')
        const candidateFields = currentPage.fields.filter(f => f.type !== 'cart' && f.type !== 'section')
        // Only the fields actually pinned to this order screen - same split
        // the visibleFields block above already uses. A field tucked into
        // Manage Details isn't shown here at all for a deferCheckout form,
        // so letting the AI helper fill it anyway would silently write an
        // answer into something nobody's looking at.
        const otherFields = cartDefersCheckout ? candidateFields.filter(f => !f.collapsedInCheckout) : candidateFields
        return (
          <AiFillModal
            cartField={cartField}
            fields={otherFields}
            rules={form.settings?.aiFillRules}
            showRulesButton={!staffFormId}
            onSaveRules={saveAiFillRules}
            onClose={() => setShowAiFill(false)}
            onApply={(items, answers) => applyAiFillResult(cartField, items, answers)}
          />
        )
      })()}

      {orderConfirmation && (
        <OrderConfirmationModal
          form={orderConfirmation.form}
          submission={orderConfirmation.submission}
          onClose={() => {
            setOrderConfirmation(null)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}

      {!cartDefersCheckout && (
        <p className="no-print" style={{ marginTop: '3rem', color: '#999', fontSize: '0.85rem' }}>
          Powered by Verticals
        </p>
      )}
    </div>
  )
}

export default PublicForm
