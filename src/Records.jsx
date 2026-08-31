import { useState, useEffect, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { exportRecordsToExcel, exportRecordsToCSV, exportRecordsToPDF, printRecordsTable, syncFormGoogleSheet } from './recordsExport'
import { downloadRecordsTemplate, parseRecordsFile, readWorkbookRows } from './recordsImport'
import { DATE_RANGE_OPTIONS, getDateRangeBounds, passesFilter } from './records/recordsUtils'
import { formatCell, FilterIcon, CubeIcon, overlayStyle, dropdownStyle, DropdownItem } from './records/recordsUiKit'
import { CartCell } from './records/CartCell'
import { FilterPopover } from './records/FilterPopover'
import { RecordDetail } from './records/RecordDetail'
import { RecycleBinDialog } from './records/RecycleBinDialog'
import { SavePresetDialog } from './records/SavePresetDialog'
import ConfirmDialog from './ConfirmDialog'
import Modal from './components/Modal'
import { useToast } from './Toast'
import PageSkeleton from './components/PageSkeleton'
import { useDeferredLoading } from './components/loadingHooks'
import { ErrorState } from './ErrorState'
import { usePageOptions } from './PageTitleContext'

const PAGE_SIZE = 10

// A field value counts as "present" for column-visibility purposes.
function hasValue(v) {
  if (v === null || v === undefined || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.values(v).some(x => x !== null && x !== undefined && x !== '')
  return String(v).trim() !== ''
}

const META_COLUMNS = [
  { id: '__orderId', label: 'Order ID' },
  { id: '__lastUpdate', label: 'Last Update Date' },
  { id: '__ip', label: 'IP' },
  { id: '__submissionId', label: 'Submission ID' },
]

function Records() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isFocusMode = searchParams.get('focus') === '1'
  const { showToast } = useToast()
  const [pendingConfirm, setPendingConfirm] = useState(null) // { type: 'deleteSelected' } | { type: 'permanentlyDelete', subId } | { type: 'emptyBin' }
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filters, setFilters] = useState({})
  const [openFilterId, setOpenFilterId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [openRecordEditing, setOpenRecordEditing] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [hiddenFieldIds, setHiddenFieldIds] = useState([])
  const [columnsExpanded, setColumnsExpanded] = useState(false)
  const [tilesRevealed, setTilesRevealed] = useState(false)
  const [showRevealHint, setShowRevealHint] = useState(true)

  function toggleTilesRevealed() {
    setTilesRevealed(current => !current)
    setShowRevealHint(false)
  }

  useEffect(() => {
    const hintTimeout = setTimeout(() => setShowRevealHint(false), 5000)
    return () => clearTimeout(hintTimeout)
  }, [])
  const [editIframeUrl, setEditIframeUrl] = useState(null)
  const [activeMenu, setActiveMenu] = useState(null) // null | 'download' | 'more'
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [openCartCellKey, setOpenCartCellKey] = useState(null)
  const [binCount, setBinCount] = useState(0)
  const [showBin, setShowBin] = useState(false)
  const [trashedSubmissions, setTrashedSubmissions] = useState([])
  const [loadingBin, setLoadingBin] = useState(false)
  const [hoveredHeaderId, setHoveredHeaderId] = useState(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const { data: formData, error: formError } = await supabase
        .from('forms').select('*').eq('id', id).single()

      if (formError) {
        setError('This form could not be found.')
        setLoading(false)
        return
      }
      setForm(formData)
      // POS/restaurant order forms start with the debugging-grade meta
      // columns hidden (still toggleable from Options > Columns), unless
      // the account has already customized column visibility before.
      const isCartForm = formData.fields.some(f => f.type === 'cart')
      const defaultHidden = isCartForm ? ['__orderId', '__lastUpdate', '__ip', '__submissionId'] : []
      const hasCustomizedColumns = formData.settings?.hiddenColumns != null
      setHiddenFieldIds(hasCustomizedColumns ? formData.settings.hiddenColumns : defaultHidden)
      // A POS/order form (Restaurant, Retail, ...) is almost always opened
      // to check today's sales, not the full history - other form types
      // (surveys, registrations, ...) keep the "All time" default.
      if (isCartForm) setDateRange('today')

      const { data: subsData, error: subsError } = await supabase
        .from('submissions').select('*').eq('form_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (subsError) {
        setError('Could not load records: ' + subsError.message)
        setLoading(false)
        return
      }
      setSubmissions(subsData)
      scheduleAutoSync()

      // Auto-hide columns that are ~90%+ empty across every record - a
      // one-time suggested default, not something recomputed on every load
      // (a column's fill rate shifts as more records come in, and silently
      // hiding/reappearing columns on their own would be confusing). Only
      // runs the first time this form is opened, before the account has
      // ever touched column visibility here; once it saves this as the
      // starting point, any later Options > Columns change is what
      // persists from then on, same as toggling one by hand.
      if (!hasCustomizedColumns && subsData.length > 0) {
        const sparseFieldIds = formData.fields
          .filter(f => f.type !== 'section' && f.type !== 'cart')
          .filter(f => {
            const answered = subsData.filter(s => {
              const v = s.data[f.id]
              if (f.type === 'multiplechoicegrid' || f.type === 'checkboxgrid') return v && typeof v === 'object' && Object.keys(v).length > 0
              if (f.type === 'checkbox') return Array.isArray(v) && v.length > 0
              return v !== undefined && v !== null && v.toString().trim() !== ''
            })
            return answered.length / subsData.length <= 0.1
          })
          .map(f => f.id)

        if (sparseFieldIds.length > 0) {
          const mergedHidden = [...new Set([...defaultHidden, ...sparseFieldIds])]
          setHiddenFieldIds(mergedHidden)
          const updatedSettings = { ...(formData.settings || {}), hiddenColumns: mergedHidden }
          // Persisted so this becomes the account's actual saved preference
          // from here on, not just a recomputed-every-visit guess - matches
          // how a manual column toggle already saves via updateFormSettings.
          // form state updated too so it doesn't sit stale on settings that
          // just changed underneath it (formRef.current, read by that same
          // updateFormSettings, would otherwise still point at the version
          // from before this write).
          await supabase.from('forms').update({ settings: updatedSettings }).eq('id', id)
          setForm({ ...formData, settings: updatedSettings })
        }
      }

      const { count } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('form_id', id)
        .not('deleted_at', 'is', null)
      setBinCount(count || 0)

      setLoading(false)
    }
    loadData()
  }, [id])

  const formRef = useRef(form)
  useEffect(() => { formRef.current = form }, [form])
  const submissionsRef = useRef(submissions)
  useEffect(() => { submissionsRef.current = submissions }, [submissions])

  // Once a Google Sheet is linked, keep it current automatically: any change
  // to this form's records (a new order, an edit, a delete - from here or a
  // customer placing an order elsewhere) schedules a debounced silent
  // re-push of the FULL record set. Never prompts / opens a tab.
  const autoSyncTimer = useRef(null)
  function scheduleAutoSync() {
    if (!formRef.current?.settings?.googleSheetId) return
    clearTimeout(autoSyncTimer.current)
    autoSyncTimer.current = setTimeout(async () => {
      try {
        const all = [...submissionsRef.current].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        await syncFormGoogleSheet(formRef.current, all, { silent: true })
      } catch { /* auto-sync is best-effort */ }
    }, 12000)
  }
  useEffect(() => () => clearTimeout(autoSyncTimer.current), [])

  // Live: pick up records inserted/updated/deleted for this form (e.g. a
  // customer order) without a manual refresh, and feed the auto-sync.
  // Realtime + a refresh whenever the tab is refocused, so a shop owner
  // watching orders come in gets both the table and the linked sheet kept
  // current on their own.
  useEffect(() => {
    const refresh = () => reloadSubmissions().then(scheduleAutoSync)
    const ch = supabase
      .channel(`records-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `form_id=eq.${id}` }, refresh)
      .subscribe()
    const onFocus = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      supabase.removeChannel(ch)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Shared read-modify-write for the settings JSONB bag, used by every
  // action on this page that persists a preference there (hidden columns,
  // saved presets, the linked Google Sheet id). Reads from a ref instead of
  // the `form` closure so two of these firing close together can't drop
  // each other's change, and always surfaces a failed write instead of
  // silently leaving the UI looking saved when it wasn't.
  async function updateFormSettings(patch) {
    const updatedSettings = { ...(formRef.current.settings || {}), ...patch }
    const { error } = await supabase.from('forms').update({ settings: updatedSettings }).eq('id', formRef.current.id)
    if (error) {
      showToast('Could not save: ' + error.message, 'error')
      return { error }
    }
    const updatedForm = { ...formRef.current, settings: updatedSettings }
    formRef.current = updatedForm
    setForm(updatedForm)
    return { error: null }
  }

  function handleRecordUpdated(updatedRecord) {
    setSubmissions(submissions.map(s => s.id === updatedRecord.id ? updatedRecord : s))
    setSelectedRecord(updatedRecord)
    scheduleAutoSync()
  }

  async function reloadSubmissions() {
    const { data } = await supabase
      .from('submissions').select('*').eq('form_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (data) setSubmissions(data)
  }

  // The Edit popup embeds the real order-entry screen in an iframe (the POS
  // catalogue/checkout flow, not just a quantity list) so a correction goes
  // through the same UI the order was placed in. It posts back here once
  // saved, since window.close() doesn't apply to something embedded on this page.
  useEffect(() => {
    function handleMessage(e) {
      if (e.origin !== window.location.origin) return
      if (e.data === 'verticals-order-saved') {
        setEditIframeUrl(null)
        reloadSubmissions()
        scheduleAutoSync()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [id])

  // Only shows the compact bar's "⋯" button once the records view itself
  // is up - not during the loading/error early returns just below, which
  // render before this page's own Options menu ever exists.
  usePageOptions(!loading && !error, () => setActiveMenu(current => current === 'options' ? null : 'options'))

  const showSkel = useDeferredLoading(loading)
  if (loading) return showSkel ? <PageSkeleton variant="table" /> : null
  if (error) return <ErrorState message={error} />

  const { start: rangeStart, end: rangeEnd } = getDateRangeBounds(dateRange, customStart, customEnd)

  let visible = submissions.filter(sub => {
    const created = new Date(sub.created_at)
    if (rangeStart && created < rangeStart) return false
    if (rangeEnd && created > rangeEnd) return false
    return true
  })

  visible = visible.filter(sub => {
    const search = searchText.trim().toLowerCase()
    if (search === '') return true
    if (sub.order_number && `#${sub.order_number}`.includes(search.replace('#', ''))) return true
    return form.fields.some(field => {
      const val = sub.data[field.id]
      if (field.type === 'cart') return false
      return val && val.toString().toLowerCase().includes(search)
    })
  })

  visible = visible.filter(sub => {
    return Object.keys(filters).every(fieldId => {
      const field = form.fields.find(f => f.id === fieldId)
      const filter = filters[fieldId]
      if (!filter || filter.cleared) return true
      return passesFilter(sub, field, filter)
    })
  })

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRows = visible.slice(startIndex, startIndex + PAGE_SIZE)

  // Columns that are completely empty across every record don't show at all
  // (common on template forms - restaurant orders rarely fill every optional
  // field). Reappears automatically once any record has a value there. Cart
  // is always kept. Skipped while there are no records yet.
  const populatedFieldIds = (() => {
    if (submissions.length === 0) return null // null = "keep everything"
    const seen = new Set()
    for (const sub of submissions) {
      for (const f of form.fields) {
        if (f.type === 'section' || f.type === 'cart' || seen.has(f.id)) continue
        if (hasValue(sub.data?.[f.id])) seen.add(f.id)
      }
    }
    return seen
  })()

  const isColumnPopulated = (fieldId) => !populatedFieldIds || populatedFieldIds.has(fieldId)

  const visibleFields = form.fields.filter(f =>
    f.type !== 'section' &&
    !hiddenFieldIds.includes(f.id) &&
    (f.type === 'cart' || isColumnPopulated(f.id)),
  )
  // POS/restaurant order forms keep the table lean - Last Update, IP, and
  // Submission ID are debugging-grade columns nobody's checking out orders needs.
  const cartField = form.fields.find(f => f.type === 'cart')
  const hasCartField = !!cartField

  // Order stats reflect whatever's currently filtered/searched (e.g. "Today"),
  // not the whole history, so the tiles stay meaningful as filters change.
  let revenue = 0, deliveryFeesTotal = 0
  if (hasCartField) {
    visible.forEach(sub => {
      const cartData = sub.data[cartField.id] || {}
      revenue += Number(cartData.total || 0) + Number(cartData.deliveryFee || 0)
      deliveryFeesTotal += Number(cartData.deliveryFee || 0)
    })
  }
  const orderCount = visible.length
  const avgOrder = orderCount > 0 ? revenue / orderCount : 0

  const dateHeaderCell = (
    <th
      onMouseEnter={() => setHoveredHeaderId('__submitted')}
      onMouseLeave={() => setHoveredHeaderId(null)}
      style={{
        textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
        position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap',
        background: hoveredHeaderId === '__submitted' ? 'var(--color-primary-soft)' : 'var(--color-bg)',
        transition: 'background 0.1s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span title="date">
          <CubeIcon color={hoveredHeaderId === '__submitted' ? 'var(--color-primary)' : 'var(--color-muted)'} />
        </span>
        <span>Date</span>
      </div>
    </th>
  )

  function dateCell(sub) {
    return (
      <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
        {new Date(sub.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
    )
  }

  const orderIdHeaderCell = (
    <th style={{
      textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
      position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)'
    }}>
      Order ID
    </th>
  )

  function orderIdCell(sub) {
    return (
      <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
        {sub.order_number ? `Order #${sub.order_number}` : '-'}
      </td>
    )
  }
  const presets = form.settings?.recordPresets || []

  function buildFilterSummary() {
    const parts = []
    if (searchText.trim() !== '') parts.push(`Search: "${searchText.trim()}"`)
    if (dateRange !== 'all') {
      const rangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label
      parts.push(
        dateRange === 'specific' ? `Date: ${customStart || '…'}`
        : dateRange === 'custom' ? (customEnd ? `Date: ${customStart || '…'} to ${customEnd}` : `Date: ${customStart || '…'}`)
        : rangeLabel
      )
    }
    const activeFilterCount = Object.keys(filters).length
    if (activeFilterCount > 0) parts.push(`${activeFilterCount} column filter${activeFilterCount !== 1 ? 's' : ''} applied`)
    return parts.join(' · ')
  }

  function handleExportExcel() {
    exportRecordsToExcel(form, visible)
  }

  function handleExportCSV() {
    exportRecordsToCSV(form, visible)
  }

  // linked_record fields need the other form's records to turn a typed
  // label back into a { recordId, label } value, fetched fresh each time
  // rather than cached, since the linked form's records can change anytime.
  async function loadLinkedFieldOptions() {
    const linkedFields = form.fields.filter(f => f.type === 'linked_record' && f.linkedFormId)
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
    return results
  }

  async function handleDownloadFillTemplate() {
    const linkedOptions = await loadLinkedFieldOptions()
    downloadRecordsTemplate(form, linkedOptions)
  }

  async function handleUploadFilledSheet(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return

    try {
      const [rows, linkedOptions] = await Promise.all([readWorkbookRows(file), loadLinkedFieldOptions()])
      const { submissions, warnings } = parseRecordsFile(rows, form, linkedOptions)

      if (submissions.length === 0) {
        showToast('No fillable rows found in that file.', 'error')
        return
      }

      const { data, error } = await supabase
        .from('submissions')
        .insert(submissions.map(s => ({ form_id: form.id, data: s.data })))
        .select()

      if (error) {
        showToast('Could not import: ' + error.message, 'error')
        return
      }

      setSubmissions(current => [...(data || []), ...current])
      scheduleAutoSync()
      const warningNote = warnings.length > 0 ? ` (${warnings.length} cell${warnings.length !== 1 ? 's' : ''} skipped: check values against field options)` : ''
      showToast(`Imported ${data.length} record${data.length !== 1 ? 's' : ''}.${warningNote}`, warnings.length > 0 ? 'error' : 'success')
    } catch (err) {
      showToast('Could not read that file: ' + err.message, 'error')
    }
  }

  async function handleSyncGoogleSheet() {
    try {
      // Always the full record set for this form - never the current
      // date-range / search / column filter view. Sorted oldest-first so
      // the sheet reads like an append-only log.
      const allRecords = [...submissions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      const result = await syncFormGoogleSheet(form, allRecords)
      // null means syncFormGoogleSheet just kicked off a Google consent
      // redirect (no scope yet, or the linked sheet needed re-auth), so the
      // browser is navigating away, so there's nothing to persist yet.
      if (!result) return

      if (result.created || result.spreadsheetId !== formRef.current.settings?.googleSheetId) {
        await updateFormSettings({ googleSheetId: result.spreadsheetId })
      }
    } catch (error) {
      console.error(error)
      showToast(error.message || 'Google Sheets could not be synced.', 'error')
    }
  }

  function handleExportPDF() {
    exportRecordsToPDF(form, visible, buildFilterSummary())
  }

  function handlePrintTable() {
    printRecordsTable(form, visible, buildFilterSummary())
  }

  async function toggleColumnVisibility(fieldId) {
    const previous = hiddenFieldIds
    const updated = hiddenFieldIds.includes(fieldId)
      ? hiddenFieldIds.filter(id => id !== fieldId)
      : [...hiddenFieldIds, fieldId]
    setHiddenFieldIds(updated)

    const { error } = await updateFormSettings({ hiddenColumns: updated })
    if (error) setHiddenFieldIds(previous) // revert the optimistic toggle - it never actually saved
  }

  function toggleSelectRow(subId) {
    setSelectedIds(selectedIds.includes(subId)
      ? selectedIds.filter(sid => sid !== subId)
      : [...selectedIds, subId])
  }

  function toggleSelectAllOnPage() {
    const pageIds = pageRows.map(r => r.id)
    const allSelected = pageIds.length > 0 && pageIds.every(pid => selectedIds.includes(pid))
    if (allSelected) {
      setSelectedIds(selectedIds.filter(sid => !pageIds.includes(sid)))
    } else {
      setSelectedIds([...new Set([...selectedIds, ...pageIds])])
    }
  }

  function clearAllFilters() {
    setSearchText('')
    setDateRange('all')
    setCustomStart('')
    setCustomEnd('')
    setFilters({})
    setOpenFilterId(null)
    setCurrentPage(1)
  }

  function deleteSelected() {
    if (selectedIds.length === 0) return
    setPendingConfirm({ type: 'deleteSelected' })
  }

  async function performDeleteSelected() {
    const { data, error } = await supabase
      .from('submissions')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', selectedIds)
      .select('id')

    if (error) {
      showToast('Could not delete records: ' + error.message, 'error')
      return
    }

    const deletedIds = (data || []).map(d => d.id)

    if (deletedIds.length < selectedIds.length) {
      showToast(
        `Only ${deletedIds.length} of ${selectedIds.length} record(s) were actually moved to the bin. A database permission may be missing.`,
        'error'
      )
    } else {
      showToast(`Moved ${deletedIds.length} record${deletedIds.length !== 1 ? 's' : ''} to the Recycle Bin.`, 'success')
    }

    setSubmissions(submissions.filter(s => !deletedIds.includes(s.id)))
    scheduleAutoSync()
    setSelectedIds(selectedIds.filter(sid => !deletedIds.includes(sid)))
    setBinCount(binCount + deletedIds.length)
  }

  async function openBin() {
    setShowBin(true)
    setLoadingBin(true)
    const { data, error } = await supabase
      .from('submissions').select('*').eq('form_id', id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (!error) setTrashedSubmissions(data)
    setLoadingBin(false)
  }

  async function restoreRecord(subId) {
    const { data, error } = await supabase
      .from('submissions')
      .update({ deleted_at: null })
      .eq('id', subId)
      .select()
      .single()

    if (error) {
      showToast('Could not restore record: ' + error.message, 'error')
      return
    }
    setTrashedSubmissions(trashedSubmissions.filter(s => s.id !== subId))
    setSubmissions([data, ...submissions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    scheduleAutoSync()
    setBinCount(Math.max(0, binCount - 1))
    showToast('Record restored.', 'success')
  }

  function permanentlyDeleteRecord(subId) {
    setPendingConfirm({ type: 'permanentlyDelete', subId })
  }

  async function performPermanentlyDelete(subId) {
    const { error } = await supabase.from('submissions').delete().eq('id', subId)
    if (error) {
      showToast('Could not permanently delete: ' + error.message, 'error')
      return
    }
    setTrashedSubmissions(trashedSubmissions.filter(s => s.id !== subId))
    setBinCount(Math.max(0, binCount - 1))
    showToast('Record permanently deleted.', 'success')
  }

  function emptyBin() {
    if (trashedSubmissions.length === 0) return
    setPendingConfirm({ type: 'emptyBin' })
  }

  async function performEmptyBin() {
    const ids = trashedSubmissions.map(s => s.id)
    const { error } = await supabase.from('submissions').delete().in('id', ids)
    if (error) {
      showToast('Could not empty the bin: ' + error.message, 'error')
      return
    }
    setTrashedSubmissions([])
    setBinCount(0)
    showToast('Recycle Bin emptied.', 'success')
  }

  function handleConfirm() {
    const confirm = pendingConfirm
    setPendingConfirm(null)
    if (!confirm) return
    if (confirm.type === 'deleteSelected') performDeleteSelected()
    else if (confirm.type === 'permanentlyDelete') performPermanentlyDelete(confirm.subId)
    else if (confirm.type === 'emptyBin') performEmptyBin()
  }

  async function savePreset(name) {
    const newPreset = { name: name.trim(), searchText, dateRange, customStart, customEnd, filters }
    const updatedPresets = [...presets, newPreset]
    const { error } = await updateFormSettings({ recordPresets: updatedPresets })
    if (!error) setShowSaveDialog(false)
  }

  function applyPreset(preset) {
    setSearchText(preset.searchText || '')
    setDateRange(preset.dateRange || 'all')
    setCustomStart(preset.customStart || '')
    setCustomEnd(preset.customEnd || '')
    setFilters(preset.filters || {})
    setCurrentPage(1)
    setActiveMenu(null)
  }

  async function deletePreset(index) {
    const updatedPresets = presets.filter((_, i) => i !== index)
    await updateFormSettings({ recordPresets: updatedPresets })
  }

  function applyFilter(fieldId, filterData) {
    setFilters({ ...filters, [fieldId]: filterData })
    setOpenFilterId(null)
    setCurrentPage(1)
  }

  function clearFilter(fieldId) {
    const updated = { ...filters }
    delete updated[fieldId]
    setFilters(updated)
    setOpenFilterId(null)
    setCurrentPage(1)
  }

  // Shared between the desktop-anchored dropdown and the mobile portal
  // version below, so the two don't drift out of sync with each other.
  const optionsMenuItems = (
    <>
      {!hasCartField && (
        <>
          <DropdownItem onClick={() => { handleDownloadFillTemplate(); setActiveMenu(null) }}>
            Download Fill-In Template (.xlsx)
          </DropdownItem>
          <label
            className="secondary"
            style={{
              display: 'block', width: '100%', textAlign: 'left', border: 'none',
              padding: '0.45rem 0.3rem', fontSize: '0.85rem', background: 'transparent', cursor: 'pointer'
            }}
          >
            Upload Filled Sheet (.xlsx)
            <input type="file" accept=".xlsx,.xls" onChange={(e) => { handleUploadFilledSheet(e); setActiveMenu(null) }} style={{ display: 'none' }} />
          </label>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0 0.5rem' }} />
        </>
      )}

      {visible.length > 0 && (
        <>
          <DropdownItem onClick={() => { handlePrintTable(); setActiveMenu(null) }}>Print</DropdownItem>
          <DropdownItem onClick={() => { handleExportExcel(); setActiveMenu(null) }}>Download Excel (.xlsx)</DropdownItem>
          <DropdownItem onClick={() => { handleExportPDF(); setActiveMenu(null) }}>Download PDF (.pdf)</DropdownItem>
          <DropdownItem onClick={() => { handleExportCSV(); setActiveMenu(null) }}>Download CSV (.csv)</DropdownItem>
          {form.settings?.googleSheetId && (
            <DropdownItem onClick={() => { window.open(`https://docs.google.com/spreadsheets/d/${form.settings.googleSheetId}`, '_blank', 'noopener,noreferrer'); setActiveMenu(null) }}>
              Open Google Sheet
            </DropdownItem>
          )}
          <DropdownItem onClick={() => { handleSyncGoogleSheet(); setActiveMenu(null) }}>
            {form.settings?.googleSheetId ? 'Sync to Google Sheet' : 'Connect to Google Sheets'}
          </DropdownItem>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0 0.5rem' }} />
        </>
      )}

      <div
        onClick={() => setColumnsExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
          fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-muted)',
          textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem'
        }}
      >
        <span>Columns</span>
        <span style={{ transform: columnsExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
      </div>
      {columnsExpanded && (
        <>
          {form.fields.filter(f => f.type !== 'section' && (f.type === 'cart' || isColumnPopulated(f.id))).map(field => (
            <label key={field.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!hiddenFieldIds.includes(field.id)}
                onChange={() => toggleColumnVisibility(field.id)}
              />
              {field.label}
            </label>
          ))}
          {META_COLUMNS.map(col => (
            <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!hiddenFieldIds.includes(col.id)}
                onChange={() => toggleColumnVisibility(col.id)}
              />
              {col.label}
            </label>
          ))}
        </>
      )}

      <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0 0.5rem' }} />

      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem' }}>
        Presets
      </div>
      {presets.length === 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: '0 0 0.5rem' }}>No saved presets yet.</p>
      )}
      {presets.map((preset, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.3rem 0' }}>
          <span onClick={() => { applyPreset(preset); setActiveMenu(null) }} style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
            {preset.name}
          </span>
          <span onClick={() => deletePreset(i)} style={{ cursor: 'pointer', color: '#c0392b', fontSize: '0.75rem' }}>
            Delete
          </span>
        </div>
      ))}
      <button
        className="secondary"
        onClick={() => { setActiveMenu(null); setShowSaveDialog(true) }}
        style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.8rem' }}
      >
        + Save current filters
      </button>

      <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0 0.5rem' }} />

      <button
        className="secondary"
        onClick={() => { setActiveMenu(null); openBin() }}
        style={{ width: '100%', fontSize: '0.8rem' }}
      >
        Recycle Bin{binCount > 0 ? ` (${binCount})` : ''}
      </button>
    </>
  )

  return (
    <div className="page" style={isFocusMode ? { paddingTop: '4rem' } : undefined}>
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(4px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        .records-search { flex: 1 1 auto; min-width: 0; max-width: 400px; }
        @media (max-width: 640px) {
          .records-search { max-width: none; }
        }
        .date-range-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
        .date-range-group { display: flex; align-items: center; gap: 0.4rem; flex: 1 1 240px; min-width: 0; }
        .date-range-group input[type="date"] { flex: 1; min-width: 0; }
        @media (max-width: 900px) {
          /* flex: 1 so this actually claims the row's remaining width next
             to the search button, instead of just sitting at its own
             content size with dead space trailing after it - the select's
             own width: 100% below only has something real to fill once
             its parent has grown to fill the row. */
          .date-range-row { flex: 1 1 200px; flex-direction: column; align-items: stretch; min-width: 0; }
          .date-range-row select { width: 100%; }
          /* .date-range-group's base rule sets flex: 1 1 240px for a
             horizontal row (240px starting *width*) - once the row above
             flips to flex-direction: column, that same flex-basis applies
             along the now-vertical main axis instead, reserving 240px of
             *height* it doesn't need and leaving a large empty gap before
             the date inputs. flex: none resets it to size by content. */
          .date-range-group { width: 100%; flex: none; }
        }
        .records-table th {
          background: var(--color-bg);
          border-bottom: 2px solid var(--color-border);
          font-size: 0.82rem;
          padding: 0.7rem 0.75rem;
          transition: background 0.16s ease, color 0.16s ease;
        }
        .records-table th:hover {
          background: var(--color-primary-soft);
        }
        .records-table td {
          padding: 0.7rem 0.75rem;
          vertical-align: top;
        }
        .records-table tbody tr:hover {
          background: var(--color-primary-soft);
        }
        .records-table tbody tr:nth-child(even) {
          background: var(--color-bg);
        }
        .records-table tbody tr:nth-child(even):hover {
          background: var(--color-primary-soft);
        }
        @media (max-width: 640px) {
          .date-range-row select { width: 100%; }
          .date-range-group { width: 100%; }
          .records-table th, .records-table td {
            padding: 0.6rem 0.55rem;
            font-size: 0.82rem;
          }
          .table-scroll {
            margin-left: -0.2rem;
            margin-right: -0.2rem;
          }
        }
        @media (max-width: 480px) {
          /* Revenue and Orders are the two numbers worth a glance on a
             phone - Avg Order and Delivery Fees stay one tap away on
             desktop instead of crowding four tiles onto a small screen. */
          .stat-tiles-grid > *:nth-child(n+3) { display: none; }
        }
      `}</style>
      {/* PosSidePanel's hamburger is position:fixed at top:1rem/left:1rem,
          42px square - reserve room above the title so it doesn't paint on
          top of the first few characters of the form name (see the same
          fix in PublicForm.jsx). A permanent left-padding reserve too (so a
          scrolled-past heading couldn't get clipped either) cost enough
          width on a narrow phone to clip real content on the right edge
          instead - worse than the momentary letter overlap it fixed, so
          just the top reserve stays. Only rendered/needed in focus mode,
          the same condition PosSidePanel itself renders under below. */}
      {hasCartField && (
        <div style={{ position: 'relative', margin: '1rem 0' }}>
          {showRevealHint && (
            <div style={{
              position: 'absolute', top: '-1.9rem', left: 0, fontSize: '0.78rem', color: 'var(--color-primary)',
              background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary)', borderRadius: '999px',
              padding: '0.25rem 0.75rem', animation: 'fadeInOut 5s ease forwards', pointerEvents: 'none',
              display: 'flex', alignItems: 'center', gap: '0.35rem'
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
              </svg>
              Click to reveal
            </div>
          )}
          <div className="stat-tiles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.7rem' }}>
            {[
              { label: 'Revenue', value: `₦${revenue.toLocaleString()}` },
              { label: 'Orders', value: orderCount.toLocaleString() },
              { label: 'Avg Order', value: `₦${avgOrder.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
              { label: 'Delivery Fees', value: `₦${deliveryFeesTotal.toLocaleString()}` },
            ].map(tile => (
              <div
                key={tile.label}
                className="card"
                onClick={toggleTilesRevealed}
                style={{ padding: '0.9rem 1rem', background: 'var(--color-primary-soft)', cursor: 'pointer', userSelect: 'none' }}
                title={tilesRevealed ? '' : 'Click to reveal'}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.3rem' }}>
                  {tile.label}
                </div>
                <div style={{
                  fontSize: '1.25rem', fontWeight: 700,
                  filter: tilesRevealed ? 'none' : 'blur(6px)', transition: 'filter 0.15s'
                }}>
                  {tilesRevealed ? tile.value : '₦••••'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and the date filter live in their own wrapping row; Options
          sits on its own line below instead of being one more thing that
          row can wrap - the date filter's own dropdown+input already wrap
          as a unit when space is tight, and Options jumping up onto that
          same line (ahead of a wrapped date input) read as misaligned. */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.8rem' }}>
        {/* Always visible now, no click-to-reveal icon step - same "🔍
            Search..." placeholder-as-icon convention ProductManager.jsx's
            catalogue search already uses, one less tap to get to it. */}
        <input
          type="text"
          className="records-search"
          placeholder="🔍 Search all records..."
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1) }}
          style={{ padding: '0.5rem' }}
        />

        <div className="date-range-row">
          <select
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value); setCurrentPage(1) }}
            style={{ padding: '0.5rem' }}
          >
            {DATE_RANGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {dateRange === 'specific' && (
            <div className="date-range-group">
              <input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setCurrentPage(1) }}
                style={{ padding: '0.5rem' }}
              />
            </div>
          )}

          {dateRange === 'custom' && (
            <div className="date-range-group">
              <input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setCurrentPage(1) }}
                style={{ padding: '0.5rem' }}
              />
              <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem', flexShrink: 0 }}>to</span>
              <input
                type="date"
                value={customEnd}
                title="Leave blank to filter to just the start date"
                onChange={(e) => { setCustomEnd(e.target.value); setCurrentPage(1) }}
                style={{ padding: '0.5rem' }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="options-menu-row" style={{ marginTop: '0.6rem' }}>
        {/* Desktop only (see .page-options-panel-desktop in index.css) - a
            dropdown anchored under this button. Below 768px this whole
            thing hides in favor of the portaled version further down (see
            the same reasoning in Report.jsx: escaping any ancestor
            transform/filter/backdrop-filter that would otherwise hijack a
            "fixed" panel's containing block, rather than chasing it with
            more CSS). */}
        <div className="options-menu-anchor page-options-panel-desktop" style={{ position: 'relative', flexShrink: 0, display: 'inline-block' }}>
          <button className="secondary options-menu-button page-options-trigger" onClick={() => setActiveMenu(activeMenu === 'options' ? null : 'options')}>
            Options ▾
          </button>
          {activeMenu === 'options' && (
            <>
              <div style={overlayStyle} onClick={() => setActiveMenu(null)} />
              {/* dropdownStyle defaults to right:0, meant for a trigger
                  sitting near the right edge (e.g. a table row's own "⋮"
                  menu). The Options button lives near the left edge of the
                  page instead - right:0 there anchored the panel to the
                  button's own (small, left-side) right edge and let it
                  expand leftward straight off the screen. left:0 expands it
                  rightward from the button instead, which actually stays
                  on screen. */}
              <div className="dropdown-panel" style={{ ...dropdownStyle, left: 0, right: 'auto', minWidth: '220px' }} onClick={(e) => e.stopPropagation()}>
                {optionsMenuItems}
              </div>
            </>
          )}
        </div>
      </div>

      {activeMenu === 'options' && createPortal(
        <div className="page-options-panel-mobile">
          <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setActiveMenu(null)} />
          <div className="dropdown-panel" style={{
            position: 'fixed', top: '4.2rem', right: '0.8rem',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 150, minWidth: '220px', padding: '0.6rem',
            overflow: 'hidden'
          }}>
            {optionsMenuItems}
          </div>
        </div>,
        document.body
      )}

      {selectedIds.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginTop: '0.8rem',
          padding: '0.6rem 1rem', background: 'var(--color-warning-soft)', borderRadius: 'var(--radius)'
        }}>
          <span style={{ fontSize: '0.9rem' }}>{selectedIds.length} selected</span>
          <button className="secondary" style={{ color: '#c0392b' }} onClick={deleteSelected}>Move to Bin</button>
          <button className="secondary" onClick={() => setSelectedIds([])}>Clear selection</button>
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="card" style={{ marginTop: '1.4rem', padding: '1.8rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.45rem' }}>No records yet</h3>
          <p style={{ margin: '0 0 0.9rem' }}>Once people submit this form, their responses will appear here with filters and export options ready to use.</p>
          <button onClick={() => window.history.back()}>Back to previous page</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="card" style={{ marginTop: '1.4rem', padding: '1.8rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.45rem' }}>No matches found</h3>
          <p style={{ margin: '0 0 0.9rem' }}>Try widening the date range or clearing a filter to see more records.</p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="secondary" onClick={clearAllFilters}>Clear filters</button>
            <button onClick={() => setSearchText('')}>Clear search</button>
          </div>
        </div>
      ) : (
        <>
          <div className="table-scroll table-breakout">
            <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
                    background: 'var(--color-bg)', position: 'sticky', top: 0, zIndex: 6, width: '36px'
                  }}>
                    <input
                      type="checkbox"
                      checked={pageRows.length > 0 && pageRows.every(r => selectedIds.includes(r.id))}
                      onChange={toggleSelectAllOnPage}
                    />
                  </th>
                  {hasCartField && dateHeaderCell}
                  {hasCartField && !hiddenFieldIds.includes('__orderId') && orderIdHeaderCell}
                  {!hasCartField && !hiddenFieldIds.includes('__orderId') && orderIdHeaderCell}
                  {visibleFields.map(field => {
                    const isHovered = hoveredHeaderId === field.id
                    return (
                    <Fragment key={field.id}>
                    <th
                      onMouseEnter={() => setHoveredHeaderId(field.id)}
                      onMouseLeave={() => setHoveredHeaderId(null)}
                      style={{
                        textAlign: 'left', borderBottom: '2px solid var(--color-border)',
                        padding: '0.75rem 0.9rem', position: 'sticky', top: 0, zIndex: 5,
                        whiteSpace: 'nowrap', minWidth: '140px',
                        background: isHovered ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                        transition: 'background 0.1s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.45rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                          <span title={field.type} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CubeIcon color={isHovered ? 'var(--color-primary)' : 'var(--color-muted)'} />
                          </span>

                          <span style={{ whiteSpace: 'nowrap' }}>
                            {field.type === 'cart' ? 'Items' : field.label}
                          </span>
                        </div>

                        {field.type !== 'cart' && (
                          <button
                            onClick={() => setOpenFilterId(openFilterId === field.id ? null : field.id)}
                            title="Filter"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '22px', height: '22px', padding: 0, borderRadius: '5px', flexShrink: 0,
                              background: filters[field.id] ? 'var(--color-primary)' : 'transparent',
                              border: filters[field.id] ? 'none' : '1px solid var(--color-border)'
                            }}
                          >
                            <FilterIcon color={filters[field.id] ? 'white' : (isHovered ? 'var(--color-primary)' : 'var(--color-muted)')} />
                          </button>
                        )}
                      </div>

                      {openFilterId === field.id && field.type !== 'cart' && (
                        <FilterPopover
                          field={field}
                          currentFilter={filters[field.id]}
                          onApply={(filterData) => applyFilter(field.id, filterData)}
                          onClear={() => clearFilter(field.id)}
                        />
                      )}
                    </th>
                    {field.type === 'cart' && hasCartField && (
                      <>
                        <th style={{
                          textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
                          position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)'
                        }}>
                          Grand Total
                        </th>
                        <th style={{
                          textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
                          position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)'
                        }}>
                          Total
                        </th>
                        <th style={{
                          textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
                          position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)'
                        }}>
                          Delivery
                        </th>
                      </>
                    )}
                    </Fragment>
                    )
                  })}
                  {!hasCartField && dateHeaderCell}
                  {!hiddenFieldIds.includes('__lastUpdate') && (
                    <th style={{
                      textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
                      position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)'
                    }}>
                      Last Update Date
                    </th>
                  )}
                  {!hiddenFieldIds.includes('__ip') && (
                    <th style={{
                      textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
                      position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)'
                    }}>
                      IP
                    </th>
                  )}
                  {!hiddenFieldIds.includes('__submissionId') && (
                    <th style={{
                      textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
                      position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)'
                    }}>
                      Submission ID
                    </th>
                  )}
                  <th style={{
                    textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
                    position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)'
                  }}>
                    Edit
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(sub => (
                  <tr
                    key={sub.id}
                    className="records-row"
                    onClick={() => setSelectedRecord(sub)}
                  >
                    <td
                      style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(sub.id)}
                        onChange={() => toggleSelectRow(sub.id)}
                      />
                    </td>
                    {hasCartField && dateCell(sub)}
                    {hasCartField && !hiddenFieldIds.includes('__orderId') && orderIdCell(sub)}
                    {!hasCartField && !hiddenFieldIds.includes('__orderId') && orderIdCell(sub)}
                    {visibleFields.map(field => (
                      <Fragment key={field.id}>
                      <td style={{
                        borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem',
                        textAlign: field.type === 'number' ? 'right' : 'left',
                        whiteSpace: 'normal',
                        maxWidth: field.type === 'cart' ? '300px' : undefined,
                        verticalAlign: 'top'
                      }}>
                        {field.type === 'cart' ? (
                          <CartCell
                            value={sub.data[field.id]}
                            cellKey={`${sub.id}-${field.id}`}
                            openCartCellKey={openCartCellKey}
                            setOpenCartCellKey={setOpenCartCellKey}
                            form={form}
                            submission={sub}
                          />
                        ) : (
                          formatCell(sub.data[field.id], field)
                        )}
                      </td>
                      {field.type === 'cart' && hasCartField && (
                        <>
                          <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', color: 'var(--color-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            ₦{(Number(sub.data[field.id]?.total || 0) + Number(sub.data[field.id]?.deliveryFee || 0)).toLocaleString()}
                          </td>
                          <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                            ₦{Number(sub.data[field.id]?.total || 0).toLocaleString()}
                          </td>
                          <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                            ₦{Number(sub.data[field.id]?.deliveryFee || 0).toLocaleString()}
                          </td>
                        </>
                      )}
                      </Fragment>
                    ))}
                    {!hasCartField && dateCell(sub)}
                    {!hiddenFieldIds.includes('__lastUpdate') && (
                      <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {sub.updated_at ? new Date(sub.updated_at).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        }) : '-'}
                      </td>
                    )}
                    {!hiddenFieldIds.includes('__ip') && (
                      <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {sub.ip_address || '-'}
                      </td>
                    )}
                    {!hiddenFieldIds.includes('__submissionId') && (
                      <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', color: 'var(--color-muted)', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {sub.id.slice(0, 8)}
                      </td>
                    )}
                    <td
                      style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', whiteSpace: 'nowrap' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        onClick={() => {
                          if (hasCartField && sub.edit_token) {
                            setEditIframeUrl(`/form/${form.id}/response/${sub.edit_token}`)
                          } else {
                            setSelectedRecord(sub)
                            setOpenRecordEditing(true)
                          }
                        }}
                        style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Edit
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
            <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
              Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, visible.length)} of {visible.length}
            </span>
            <button disabled={safePage === 1} onClick={() => setCurrentPage(safePage - 1)}>
              Previous
            </button>
            <span>Page {safePage} of {totalPages}</span>
            <button disabled={safePage === totalPages} onClick={() => setCurrentPage(safePage + 1)}>
              Next
            </button>
          </div>
        </>
      )}

      {selectedRecord && (
        <RecordDetail
          form={form}
          record={selectedRecord}
          fields={form.fields.filter(f => f.type !== 'section')}
          onClose={() => { setSelectedRecord(null); setOpenRecordEditing(false) }}
          onUpdated={handleRecordUpdated}
          initialEditing={openRecordEditing}
          hideEdit={hasCartField && !openRecordEditing}
        />
      )}

      {editIframeUrl && (
        <Modal size="full" onClose={() => setEditIframeUrl(null)} title="Correct Order" bodyStyle={{ padding: 0, display: 'flex' }}>
          <iframe
            src={editIframeUrl}
            title="Correct Order"
            style={{ flex: 1, border: 'none', width: '100%', minHeight: '70vh' }}
          />
        </Modal>
      )}

      {showSaveDialog && (
        <SavePresetDialog
          onSave={savePreset}
          onClose={() => setShowSaveDialog(false)}
        />
      )}

      {showBin && (
        <RecycleBinDialog
          form={form}
          submissions={trashedSubmissions}
          loading={loadingBin}
          onRestore={restoreRecord}
          onPermanentDelete={permanentlyDeleteRecord}
          onEmptyBin={emptyBin}
          onClose={() => setShowBin(false)}
        />
      )}

      {pendingConfirm && (
        <ConfirmDialog
          title={
            pendingConfirm.type === 'deleteSelected' ? 'Move to Recycle Bin?' :
            pendingConfirm.type === 'emptyBin' ? 'Empty Recycle Bin?' :
            'Permanently delete this record?'
          }
          message={
            pendingConfirm.type === 'deleteSelected'
              ? `Move ${selectedIds.length} selected record${selectedIds.length !== 1 ? 's' : ''} to the Recycle Bin?`
              : pendingConfirm.type === 'emptyBin'
              ? `Permanently delete all ${trashedSubmissions.length} record(s) in the bin? This cannot be undone.`
              : 'This cannot be undone.'
          }
          confirmLabel={pendingConfirm.type === 'deleteSelected' ? 'Move' : 'Delete'}
          danger={pendingConfirm.type !== 'deleteSelected'}
          onConfirm={handleConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  )
}

export default Records
