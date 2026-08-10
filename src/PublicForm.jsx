import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import PosSidePanel from './PosSidePanel'
import { supabase } from './supabaseClient'
import { submitForm, getSubmissionByToken, updateSubmissionByToken } from './lib/submissionsClient'
import { COUNTRIES, statesFor, citiesFor } from './lib/locationData'
import { printReceipt } from './receiptPrint'
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

function PublicForm() {
  const { id, token } = useParams()
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

  const pages = useMemo(() => buildPages(form?.fields || []), [form])
  const currentPage = pages[pageIndex] || pages[0]
  const hasCartOnPage = currentPage.fields.some(f => f.type === 'cart')
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

  // Recomputes any field configured to auto-fill from a cart field's
  // contents (see FieldTypeConfig's AutoFromCartConfig) whenever cart
  // quantities change: 1 distinct product selected → "Single", 2+ →
  // "Multiple", any package-type product → "Package".
  useEffect(() => {
    if (!form) return
    const autoFields = form.fields.filter(f => f.autoFromCartFieldId)
    if (autoFields.length === 0) return

    setAnswers(current => {
      let changed = false
      const next = { ...current }
      autoFields.forEach(field => {
        const cartField = form.fields.find(f => f.id === field.autoFromCartFieldId && f.type === 'cart')
        if (!cartField) return
        const active = (cartField.products || []).filter(p => Number((cartQuantities[cartField.id] || {})[p.id]) > 0)
        const computed = active.length === 0 ? '' : active.some(p => p.isPackage) ? 'Package' : active.length === 1 ? 'Single' : 'Multiple'
        if (computed && next[field.id] !== computed) {
          next[field.id] = computed
          changed = true
        }
      })
      return changed ? next : current
    })
  }, [cartQuantities, form])

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
    if (field.type === 'cart') return null

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

  // Validates just the fields on one page: used both for the Next button
  // (only that page's fields should block advancing) and, with the full
  // field list, for the final submit.
  function validatePageFields(pageFields) {
    const newErrors = {}
    pageFields.forEach(field => {
      if (field.type === 'section') return
      const err = validateField(field, answers[field.id])
      if (err) newErrors[field.id] = err
    })
    return newErrors
  }

  function goNext() {
    const pageErrors = validatePageFields(currentPage.fields)
    if (Object.keys(pageErrors).length > 0) {
      setErrors(current => ({ ...current, ...pageErrors }))
      setMessage('Please fix the errors below before continuing.')
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
      setMessage('Please fix the errors below before submitting.')
      return
    }
    setErrors({})

    const finalData = {}
    form.fields.forEach(field => {
      if (field.type === 'section') return
      if (field.type === 'cart') {
        const quantities = cartQuantities[field.id] || {}
        const items = (field.products || [])
          .map(p => ({ name: p.name, price: p.price, category: p.category || '', quantity: Number(quantities[p.id]) || 0 }))
          .filter(item => item.quantity > 0)
        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        finalData[field.id] = {
          items, total,
          payment: (paymentOverride && paymentOverride[field.id]) || cartPayment[field.id] || null,
          deliveryFee: Number(deliveryFee[field.id]) || 0,
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
        // The receipt should show the real, persisted order number (also
        // what Records searches/filters by) rather than the random one
        // generated client-side just to label the order while building it.
        if (result.order_number) realOrderNumber = result.order_number
      }

      // Orders go straight to a print preview of the receipt instead of the
      // generic "thanks for submitting" page, then the order screen resets
      // itself for the next customer, since this is a POS flow, not a
      // one-and-done form. Reuses the exact same popup-window renderer as
      // Records' "Print Receipt" button (see receiptPrint.js) instead of a
      // second, in-page implementation - that one only ever has the receipt
      // itself on the page, so there's no "rest of the page" to accidentally
      // print alongside it and nothing here has to fight print CSS for it.
      if (hasCartOnPage) {
        const cartField = currentPage.fields.find(f => f.type === 'cart')
        printReceipt(form, {
          id: submissionId,
          order_number: realOrderNumber,
          data: finalData,
          created_at: new Date().toISOString(),
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

      return (
        <div>
          {/* Order box - lives on its own at the top, above the menu */}
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
              <div style={{ color: '#999', fontSize: '0.9rem' }}>
                <p style={{ margin: 0 }}>No items added yet.</p>
                <p style={{ margin: '0.2rem 0 0' }}>Select items below to begin.</p>
              </div>
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
                      <button className="secondary" onClick={() => decrementCartItem(field.id, item.id)} style={{ padding: '0.1rem 0.5rem', fontSize: '0.8rem' }}>−</button>
                      <span style={{ minWidth: '1.2rem', textAlign: 'center' }}>{item.quantity}</span>
                      <button className="secondary" onClick={() => incrementCartItem(field.id, item.id)} style={{ padding: '0.1rem 0.5rem', fontSize: '0.8rem' }}>+</button>
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
                  background: 'white', border: '1px solid var(--color-primary)', borderRadius: '6px',
                  padding: '0.6rem 0.8rem', fontSize: '0.85rem'
                }}>
                  <span>✓ Paid via {payment.method}</span>
                  <span onClick={() => clearPayment(field.id)} style={{ color: 'var(--color-primary)', cursor: 'pointer' }}>Change</span>
                </div>
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

          {/* Catalogue box - search + categories stay pinned while the menu below scrolls */}
          <div className="card" style={{ padding: 0, background: 'var(--color-primary-soft)', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--color-primary-soft)', padding: '1rem 1rem 0' }}>
              <input
                type="text"
                value={cartSearch[field.id] || ''}
                onChange={(e) => setCartSearchText(field.id, e.target.value)}
                placeholder="Search menu..."
                style={{ width: '100%', padding: '0.6rem', marginBottom: '0.7rem' }}
              />

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
                style={{ background: 'white', padding: '1.5rem', width: '420px', maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto' }}
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
                style={{ background: 'white', padding: '1.5rem', width: '420px', maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto' }}
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
                      onClick={() => { setCheckoutMethod(method); setShowKeypad(false) }}
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
      const cityOptions = value.state ? citiesFor(country, value.state) : []

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

  if (loading) return <div className="page">Loading form...</div>

  if (!form) return <div className="page">{message}</div>

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

  return (
    <div className="page">
      {!token && (
        <div className="no-print">
          <PosSidePanel formId={form.id} hasCartField={form.fields.some(f => f.type === 'cart')} />
        </div>
      )}

      <h1 className="no-print">{form.name}</h1>
      {form.description && <p className="no-print">{form.description}</p>}

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

      {currentPage.fields.filter(field => field.type === 'cart' || !hasCartOnPage).map(field => (
        <div key={field.id} className={field.type === 'cart' ? '' : 'card'} style={field.type === 'cart' ? { marginBottom: '1rem' } : { padding: '1rem', marginBottom: '1rem' }}>
          {field.type !== 'cart' && (
            <label style={{ fontWeight: '600' }}>
              {field.label}{field.required && <span style={{ color: '#c0392b' }}> *</span>}
            </label>
          )}
          <div style={field.type === 'cart' ? {} : { marginTop: '0.5rem' }}>
            {field.autoFromCartFieldId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  padding: '0.4rem 0.8rem', borderRadius: '999px', background: '#f2f4f7',
                  fontSize: '0.9rem', fontWeight: 600, color: answers[field.id] ? 'inherit' : 'var(--color-muted)'
                }}>
                  {answers[field.id] || 'Add items to your cart to set this'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>(set automatically from your cart)</span>
              </div>
            ) : renderInput(field)}
          </div>
          {errors[field.id] && (
            <p style={{ color: '#c0392b', fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
              {errors[field.id]}
            </p>
          )}
        </div>
      ))}

      {!hasCartOnPage && (
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
        {pageIndex > 0 ? (
          <button className="secondary" onClick={goBack} style={{ padding: '0.7rem 1.5rem', fontSize: '1rem' }}>
            Back
          </button>
        ) : <span />}

        {isLastPage ? (
          <button onClick={() => submitAnswers()} disabled={submitting} style={{ padding: '0.7rem 1.5rem', fontSize: '1rem' }}>
            {submitting ? 'Submitting...' : (token ? 'Save Changes' : 'Submit')}
          </button>
        ) : (
          <button onClick={goNext} style={{ padding: '0.7rem 1.5rem', fontSize: '1rem' }}>
            Next
          </button>
        )}
      </div>
      )}

      {message && <p className="no-print" style={{ marginTop: '1rem', color: 'red' }}>{message}</p>}

      <p className="no-print" style={{ marginTop: '3rem', color: '#999', fontSize: '0.85rem' }}>
        Powered by Verticals
      </p>
    </div>
  )
}

export default PublicForm
