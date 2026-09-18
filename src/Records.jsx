import AdaptivePageHeader from './components/AdaptivePageHeader'
import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { exportRecordsToExcel, exportRecordsToCSV, exportRecordsToPDF, printRecordsTable, syncFormGoogleSheet } from './recordsExport'
import { downloadRecordsTemplate, parseRecordsFile, readWorkbookRows } from './recordsImport'
import { DATE_RANGE_OPTIONS, getDateRangeBounds, passesFilter, makeSortComparator, valueDisplayString, isBlankValue } from './records/recordsUtils'
import { formatCell, FilterIcon, CubeIcon, overlayStyle, dropdownStyle, DropdownItem } from './records/recordsUiKit'
import { CartCell } from './records/CartCell'
import { ColumnHeaderMenu } from './records/ColumnHeaderMenu'
import { RecordDetail } from './records/RecordDetail'
import { RecycleBinDialog } from './records/RecycleBinDialog'
import { SavePresetDialog } from './records/SavePresetDialog'
import ConfirmDialog from './ConfirmDialog'
import Modal from './components/Modal'
import { useToast } from './Toast'
import PageSkeleton from './components/PageSkeleton'
import { useDeferredLoading } from './components/loadingHooks'
import { ErrorState } from './ErrorState'
import { usePageOptions, usePageBack, useDesktopHeader } from './PageTitleContext'
import { getPageCache, setPageCache } from './hooks/pageCache'
import { RefreshingIndicator } from './components/InlineLoader'
import EmptyState, { SearchOffIcon } from './components/EmptyState'
import useIsMobile from './hooks/useIsMobile'
import { DataCard, DataCardList } from './components/DataCards'
import MobileOptionsPanel from './components/MobileOptionsPanel'
import { getEntryNoun } from './report/helpers/analysisUtils'

const PAGE_SIZE = 10

// A field value counts as "present" for column-visibility purposes.
function hasValue(v) {
  if (v === null || v === undefined || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.values(v).some(x => x !== null && x !== undefined && x !== '')
  return String(v).trim() !== ''
}

// The date range filter, Daily Tally, and the weekday charts all need "what
// date does this record fall on" - by default the submission timestamp, but
// a form can opt (see the Filter Date Field setting) to use one of its own
// date-type fields instead (e.g. a Delivery Date that's already its own
// column, rather than when the order was entered). Returns null when there's
// no usable value, so callers can exclude rather than mis-bucket a record.
function resolveRecordDate(sub, dateFieldId) {
  const raw = dateFieldId ? sub.data?.[dateFieldId] : sub.created_at
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d) ? null : d
}

const META_COLUMNS = [
  { id: '__orderId', label: 'Order ID' },
  { id: '__lastUpdate', label: 'Last Update Date' },
  { id: '__ip', label: 'IP' },
  { id: '__submissionId', label: 'Submission ID' },
]

function Records({ formId: formIdProp, defaultToAllTime = false, extraSubmissions = [], justAddedId = null } = {}) {
  const params = useParams()
  const id = formIdProp || params.id
  const [searchParams] = useSearchParams()
  const isFocusMode = searchParams.get('focus') === '1'
  const { showToast } = useToast()
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const { desktopHeaderTarget } = useDesktopHeader()
  const useTopBar = !isMobile && !!desktopHeaderTarget && !formIdProp
  const [pendingConfirm, setPendingConfirm] = useState(null) // { type: 'deleteSelected' } | { type: 'permanentlyDelete', subId } | { type: 'emptyBin' }
  const [form, setForm] = useState(null)
  // RLS is the real enforcement boundary for a Viewer collaborator's write
  // attempts (see the collaborator_shares migration) - this is only a UX
  // pass so the most prominent write affordances (editing a record, bulk
  // delete, sheet import, the Recycle Bin) aren't dangled in front of
  // someone whose click would just bounce off a permission error. null =
  // not a collaborator (owns the form, or ownership hasn't resolved yet).
  const [collaboratorRole, setCollaboratorRole] = useState(null)
  const isViewer = collaboratorRole === 'viewer'
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchText, setSearchText] = useState('')
  // The actual filter pipeline reads this instead of searchText directly, so
  // a fast typist doesn't re-run the filter/sort over every record on every
  // keystroke - only once typing pauses for a beat. searchText itself still
  // drives the input's own value and the filter-summary text, so what's
  // shown as typed never lags.
  const [debouncedSearchText, setDebouncedSearchText] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchText(searchText), 200)
    return () => clearTimeout(t)
  }, [searchText])
  const [dateRange, setDateRange] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filters, setFilters] = useState({})
  const [sortConfig, setSortConfig] = useState(null) // { fieldId, dir: 'asc' | 'desc' }
  const [openFilterId, setOpenFilterId] = useState(null)
  // The currently-open column's "Sort & filter" trigger button - ColumnHeaderMenu
  // measures its position from this to render as a fixed-position portal
  // instead of getting clipped by the table's own horizontal scroll container.
  const openFilterTriggerRef = useRef(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [openRecordEditing, setOpenRecordEditing] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [hiddenFieldIds, setHiddenFieldIds] = useState([])
  // Mobile only - the table used to be desktop-exclusive there (cards
  // instead), but the table itself scrolls fine on a phone and some people
  // just want it, so it's a toggle now, defaulting to table.
  const [mobileViewMode, setMobileViewMode] = useState('table')
  // 'table' = the normal records list, 'tally' = the per-day Orders/Amount/
  // Summary rollup (cart forms only - see dailyTally below). Selecting a day
  // there switches back to 'table' with the date range pinned to that day.
  const [view, setView] = useState('table')
  // Only true once Daily Tally has actually been opened from Options this
  // visit - the quick "back to it" button on the table (below) stays hidden
  // until then, instead of cluttering the table for accounts that never use it.
  const [tallyActivated, setTallyActivated] = useState(false)
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
  // Revisiting a form you've already opened this session paints from the
  // last known data instantly instead of blanking to a skeleton, while a
  // fresh copy loads silently behind it (see src/hooks/pageCache.js).
  const [refreshing, setRefreshing] = useState(false)
  const cacheKey = `records:${id}`

  useEffect(() => {
    if (!form || !session?.user?.id) return
    if (form.user_id === session.user.id) { setCollaboratorRole(null); return }
    let cancelled = false
    supabase.rpc('get_share_role', { p_form_id: form.id }).then(({ data }) => {
      if (!cancelled) setCollaboratorRole(data || null)
    })
    return () => { cancelled = true }
  }, [form, session?.user?.id])

  useEffect(() => {
    async function loadData(silent) {
      if (!silent) setLoading(true)
      const { data: formData, error: formError } = await supabase
        .from('forms').select('*').eq('id', id).single()

      if (formError) {
        if (!silent) { setError('This form could not be found.'); setLoading(false) }
        setRefreshing(false)
        return
      }
      setForm(formData)
      // POS/restaurant order forms start with the debugging-grade meta
      // columns hidden (still toggleable from Options > Columns), unless
      // the account has already customized column visibility before.
      const isCartForm = formData.fields.some(f => f.type === 'cart')
      const defaultHidden = isCartForm ? ['__orderId', '__lastUpdate', '__ip', '__submissionId'] : []
      const hasCustomizedColumns = formData.settings?.hiddenColumns != null
      let effectiveHidden = hasCustomizedColumns ? formData.settings.hiddenColumns : defaultHidden
      setHiddenFieldIds(effectiveHidden)
      // A POS/order form (Restaurant, Retail, ...) is almost always opened
      // to check today's sales, not the full history - other form types
      // (surveys, registrations, ...) keep the "All time" default. Seeded
      // demo/preview data has fixed historical dates rather than today's,
      // so callers showing it to a visitor (see defaultToAllTime) skip this.
      if (isCartForm && !defaultToAllTime) setDateRange('today')

      const { data: subsData, error: subsError } = await supabase
        .from('submissions').select('*').eq('form_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (subsError) {
        if (!silent) { setError('Could not load records: ' + subsError.message); setLoading(false) }
        setRefreshing(false)
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
          effectiveHidden = mergedHidden
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

      setPageCache(cacheKey, { form: formData, submissions: subsData, binCount: count || 0, hiddenFieldIds: effectiveHidden })
      if (!silent) setLoading(false)
      setRefreshing(false)
    }

    const cached = getPageCache(cacheKey)
    if (cached) {
      setForm(cached.form)
      setSubmissions(cached.submissions)
      setBinCount(cached.binCount)
      if (cached.hiddenFieldIds) setHiddenFieldIds(cached.hiddenFieldIds)
      setLoading(false)
      setRefreshing(true)
      loadData(true)
    } else {
      loadData(false)
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Demo "Build" tab only (see PublicDemoExperience.jsx): folds in session-
  // only records created through Launch, additively, without touching the
  // Supabase-backed fetch/cache above - they never leave this browser tab.
  // Also re-runs whenever `submissions` itself changes: the fetch above is
  // async and can resolve (or silently refresh) after this has already run
  // once, overwriting `submissions` wholesale and dropping the merged-in
  // extras - re-applying on every `submissions` change re-adds them, and is
  // a no-op (same array reference, no re-render) once they're already in.
  useEffect(() => {
    if (!extraSubmissions.length) return
    setSubmissions(current => {
      const have = new Set(current.map(s => s.id))
      const fresh = extraSubmissions.filter(s => !have.has(s.id))
      return fresh.length ? [...fresh, ...current] : current
    })
  }, [extraSubmissions, submissions])

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

  const handleRecordUpdated = useCallback((updatedRecord) => {
    setSubmissions(current => current.map(s => s.id === updatedRecord.id ? updatedRecord : s))
    setSelectedRecord(updatedRecord)
    scheduleAutoSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  usePageBack('/', 'Home')

  // The filter/sort/pagination pipeline below (and the two summaries that
  // key off it) all scan the full submissions array, so each is memoized -
  // without it, every keystroke, hover, or menu toggle elsewhere on the page
  // would re-run the whole thing from scratch. These have to sit above the
  // loading/error early returns since hooks can't run conditionally; each
  // guards for `form`/`submissions` not being ready yet instead.
  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getDateRangeBounds(dateRange, customStart, customEnd),
    [dateRange, customStart, customEnd]
  )

  // null = filter by submission timestamp (the default). Set via the
  // "Filter Date Field" option below - a per-form, persisted choice (saved
  // to form.settings, same as hiddenColumns) so it's a one-time, repeatable
  // setup step rather than something re-picked every visit.
  const dateFilterFieldId = form?.settings?.dateFilterFieldId || null

  // The date-range + keyword view, before any per-column filter. The column
  // menu's value list is built from this, so unticking a value in one column
  // never makes the other values vanish from its own list (Excel behaviour).
  const searchScoped = useMemo(() => {
    if (!form) return []
    const dateFiltered = submissions.filter(sub => {
      if (!rangeStart && !rangeEnd) return true
      const created = resolveRecordDate(sub, dateFilterFieldId)
      if (!created) return false
      if (rangeStart && created < rangeStart) return false
      if (rangeEnd && created > rangeEnd) return false
      return true
    })
    const search = debouncedSearchText.trim().toLowerCase()
    if (search === '') return dateFiltered
    return dateFiltered.filter(sub => {
      if (sub.order_number && `#${sub.order_number}`.includes(search.replace('#', ''))) return true
      return form.fields.some(field => {
        const val = sub.data[field.id]
        if (field.type === 'cart') return false
        return val && val.toString().toLowerCase().includes(search)
      })
    })
  }, [form, submissions, rangeStart, rangeEnd, debouncedSearchText, dateFilterFieldId])

  const visible = useMemo(() => {
    if (!form) return []
    let result = searchScoped.filter(sub => {
      return Object.keys(filters).every(fieldId => {
        const field = form.fields.find(f => f.id === fieldId)
        const filter = filters[fieldId]
        if (!filter || filter.cleared) return true
        return passesFilter(sub, field, filter)
      })
    })
    if (sortConfig) {
      const sortField = form.fields.find(f => f.id === sortConfig.fieldId)
      if (sortField) result = [...result].sort(makeSortComparator(sortField, sortConfig.dir))
    }
    return result
  }, [form, searchScoped, filters, sortConfig])

  // Distinct values (+ blank tally) for whichever column's filter menu is
  // currently open, from searchScoped. Only one column menu can be open at
  // once, so this only ever needs to summarize a single field per render
  // instead of every column.
  const openColumnValueSummary = useMemo(() => {
    const empty = { values: [], hasBlanks: false, blankCount: 0 }
    if (!form || !openFilterId) return empty
    const field = form.fields.find(f => f.id === openFilterId)
    if (!field) return empty
    const counts = new Map()
    let blankCount = 0
    for (const sub of searchScoped) {
      const raw = sub.data?.[openFilterId]
      if (isBlankValue(raw)) { blankCount++; continue }
      const disp = valueDisplayString(raw, field)
      counts.set(disp, (counts.get(disp) || 0) + 1)
    }
    let values = [...counts.entries()].map(([v, count]) => ({ v, count }))
    if (field.type === 'number') {
      values.sort((a, b) => Number(String(a.v).replace(/,/g, '')) - Number(String(b.v).replace(/,/g, '')))
    } else if (field.type === 'date') {
      values.sort((a, b) => new Date(a.v) - new Date(b.v))
    } else {
      values.sort((a, b) => a.v.localeCompare(b.v))
    }
    return { values, hasBlanks: blankCount > 0, blankCount }
  }, [form, openFilterId, searchScoped])

  // Columns that are completely empty across every record don't show at all
  // (common on template forms - restaurant orders rarely fill every optional
  // field). Reappears automatically once any record has a value there. Cart
  // is always kept. Skipped while there are no records yet.
  const populatedFieldIds = useMemo(() => {
    if (!form || submissions.length === 0) return null // null = "keep everything"
    const seen = new Set()
    for (const sub of submissions) {
      for (const f of form.fields) {
        if (f.type === 'section' || f.type === 'cart' || seen.has(f.id)) continue
        if (hasValue(sub.data?.[f.id])) seen.add(f.id)
      }
    }
    return seen
  }, [form, submissions])

  // Daily Tally source data - one row per calendar day (local time) across
  // `visible`, the same filtered/searched/sorted set the records table
  // itself shows, not the full unfiltered history. The date-range filter (and
  // search, and any column filters) is the one thing setting the scope for
  // the whole page - it drives the tally, not the other way around. Drilling
  // into a tally day still narrows further from there by switching the date
  // range to that one specific day (see the row onClick below). Cart forms
  // only (orders/amount only mean something there); empty otherwise. Grouped
  // by whichever date the Filter Date Field setting points at, same as the
  // main date-range filter above, so drilling into a tally day and the day
  // it actually groups records under always agree.
  const dailyTally = useMemo(() => {
    if (!form) return []
    const tallyCartField = form.fields.find(f => f.type === 'cart')
    if (!tallyCartField) return []
    const reconciledDates = form.settings?.reconciledDates || {}
    const groups = new Map() // 'YYYY-MM-DD' -> { dateKey, date, orders, amount, itemCounts }
    for (const sub of visible) {
      const d = resolveRecordDate(sub, dateFilterFieldId)
      if (!d) continue
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      let group = groups.get(dateKey)
      if (!group) {
        group = { dateKey, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), orders: 0, amount: 0, itemCounts: new Map() }
        groups.set(dateKey, group)
      }
      group.orders += 1
      const cart = sub.data[tallyCartField.id] || {}
      group.amount += Number(cart.total || 0) + Number(cart.deliveryFee || 0)
      for (const item of cart.items || []) {
        group.itemCounts.set(item.name, (group.itemCounts.get(item.name) || 0) + Number(item.quantity || 0))
      }
    }
    return [...groups.values()]
      .map(g => {
        const items = [...g.itemCounts.entries()].sort((a, b) => b[1] - a[1])
        const shown = items.slice(0, 4).map(([name, qty]) => `${name} ×${qty}`).join(', ')
        const summary = items.length > 4 ? `${shown}, +${items.length - 4} more` : (shown || '—')
        return {
          dateKey: g.dateKey, date: g.date, orders: g.orders, amount: g.amount, summary,
          reconciled: !!reconciledDates[g.dateKey],
        }
      })
      .sort((a, b) => b.date - a.date)
  }, [form, visible, dateFilterFieldId])


  const showSkel = useDeferredLoading(loading)
  if (loading) return showSkel ? <PageSkeleton variant="table" /> : null
  if (error) return <ErrorState message={error} />

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRows = visible.slice(startIndex, startIndex + PAGE_SIZE)

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
  const entryNoun = getEntryNoun(form, hasCartField)

  // When a custom date field is chosen as the filter date (dateFilterFieldId,
  // set via Options > Filter Date Field), it's the meaningful date for this
  // business (e.g. Delivery Date) - lead the table with its column instead
  // of leaving it wherever it falls in form order, and push the raw
  // submission timestamp to the end instead (see submissionDateAtEnd below,
  // read by both the header and body rows further down).
  const customDateField = hasCartField && dateFilterFieldId ? visibleFields.find(f => f.id === dateFilterFieldId) : null
  if (customDateField) {
    visibleFields.splice(visibleFields.indexOf(customDateField), 1)
    visibleFields.unshift(customDateField)
  }
  const submissionDateAtEnd = !!customDateField

  // Phone card view (see the isMobile branch in the render): a wide row of
  // columns becomes a short stack showing only what's worth a glance, tap for
  // the rest via RecordDetail. cardFields = the non-cart fields eligible to
  // appear on a card, in form order.
  const cardFields = form.fields.filter(f =>
    f.type !== 'section' && f.type !== 'cart' &&
    !hiddenFieldIds.includes(f.id) && isColumnPopulated(f.id),
  )
  function recordCardTitle(sub) {
    if (sub.order_number) return `Order #${sub.order_number}`
    const first = cardFields.find(f => hasValue(sub.data[f.id]))
    if (first) return formatCell(sub.data[first.id], first)
    return `Record ${sub.id.slice(0, 8)}`
  }
  function recordCardRows(sub) {
    if (hasCartField) {
      const c = sub.data[cartField.id] || {}
      const grand = Number(c.total || 0) + Number(c.deliveryFee || 0)
      const items = Array.isArray(c.items) ? c.items.length : 0
      return (
        <>
          <DataCard.Row label="Total" value={`₦${grand.toLocaleString()}`} strong />
          <DataCard.Row label="Items" value={`${items} item${items === 1 ? '' : 's'}`} muted />
          {Number(c.deliveryFee || 0) > 0 && (
            <DataCard.Row label="Delivery" value={`₦${Number(c.deliveryFee).toLocaleString()}`} muted />
          )}
        </>
      )
    }
    const titleField = sub.order_number ? null : cardFields.find(f => hasValue(sub.data[f.id]))
    const rows = cardFields
      .filter(f => f.id !== titleField?.id && hasValue(sub.data[f.id]))
      .slice(0, 3)
    return rows.map(f => (
      <DataCard.Row key={f.id} label={f.label} value={formatCell(sub.data[f.id], f)} align="left" />
    ))
  }

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
    const submittedAt = new Date(sub.created_at)
    return (
      <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
        {submittedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        {', '}
        {submittedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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

  // Per-sale Reconciled leads the table (right after the row checkbox)
  // whenever you've drilled into one specific day from Daily Tally - that's
  // exactly the "go through this day's orders and tick each one off" moment
  // - and otherwise sits in its usual spot near Edit, out of the way.
  const reconciledFirst = hasCartField && dateRange === 'specific'
  const reconciledHeaderCell = (
    <th style={{
      textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem',
      position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)'
    }}>
      Reconciled
    </th>
  )

  function reconciledCell(sub) {
    return (
      <td
        style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', whiteSpace: 'nowrap' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={!!sub.reconciled_at}
          disabled={isViewer}
          onChange={() => toggleRecordReconciled(sub)}
          title={sub.reconciled_at ? `Reconciled by ${sub.reconciled_by || 'someone'}` : 'Mark as reconciled'}
        />
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
        .insert(submissions.map(s => ({ form_id: form.id, data: s.data, created_via: 'import' })))
        .select()

      if (error) {
        showToast(
          error.message?.startsWith('ENTRY_LIMIT_REACHED')
            ? "This import would go past your monthly entry limit, so none of it was added - upgrade your plan or wait until your allowance resets."
            : 'Could not import: ' + error.message,
          'error'
        )
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

  // Reconciliation: a plain per-day checked/unchecked mark (e.g. "matched
  // against the bank statement for this day"), not tied to any one record -
  // saved the same way as every other Records preference (form.settings),
  // so it's shared across whoever opens Daily Tally for this form.
  async function toggleReconciled(dateKey) {
    const current = form.settings?.reconciledDates || {}
    const updated = { ...current }
    if (updated[dateKey]) delete updated[dateKey]
    else updated[dateKey] = { at: new Date().toISOString(), by: session?.user?.email || null }
    await updateFormSettings({ reconciledDates: updated })
  }

  // Per-sale reconciliation - independent of the day-level mark above (see
  // its comment): a plain reconciled_at/reconciled_by pair on the submission
  // row itself (submissions.reconciled_at), same shape as the day-level
  // mark but scoped to one record, for checking off individual sales rather
  // than a whole day at once.
  async function toggleRecordReconciled(sub) {
    const patch = sub.reconciled_at
      ? { reconciled_at: null, reconciled_by: null }
      : { reconciled_at: new Date().toISOString(), reconciled_by: session?.user?.email || null }
    const { data, error } = await supabase.from('submissions').update(patch).eq('id', sub.id).select().single()
    if (error) {
      showToast('Could not update reconciliation: ' + error.message, 'error')
      return
    }
    setSubmissions(current => current.map(s => s.id === data.id ? data : s))
    setSelectedRecord(current => current?.id === data.id ? data : current)
  }

  // Bulk version of the above, for the drilled-into-one-day view (dateRange
  // 'specific' - see the Daily Tally row onClick above): reconciles (or, if
  // every currently visible record is already reconciled, un-reconciles)
  // every record in `visible` at once, rather than ticking each one by hand.
  async function toggleReconcileAllVisible() {
    const ids = visible.map(s => s.id)
    if (ids.length === 0) return
    const allReconciled = visible.every(s => !!s.reconciled_at)
    const patch = allReconciled
      ? { reconciled_at: null, reconciled_by: null }
      : { reconciled_at: new Date().toISOString(), reconciled_by: session?.user?.email || null }
    const { data, error } = await supabase.from('submissions').update(patch).in('id', ids).select()
    if (error) {
      showToast('Could not update reconciliation: ' + error.message, 'error')
      return
    }
    const byId = new Map(data.map(d => [d.id, d]))
    setSubmissions(current => current.map(s => byId.get(s.id) || s))
    setSelectedRecord(current => current && byId.has(current.id) ? byId.get(current.id) : current)
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
    setSortConfig(null)
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
      {hasCartField && (
        <>
          <DropdownItem onClick={() => { setView(v => v === 'tally' ? 'table' : 'tally'); setTallyActivated(true); setActiveMenu(null) }}>
            {view === 'tally' ? 'Back to Records Table' : 'Daily Tally'}
          </DropdownItem>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0 0.5rem' }} />
        </>
      )}

      {!hasCartField && !isViewer && (
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

      {form.fields.some(f => f.type === 'date') && (
        <>
          <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem' }}>
            Filter Date Field
          </div>
          {/* Which date the date-range dropdown (and Daily Tally's grouping)
              go by - submission time by default, or a date field already on
              this form (e.g. Delivery Date), already its own column here. A
              one-time, saved choice (form.settings), not re-picked per visit. */}
          <select
            value={dateFilterFieldId || '__submitted'}
            onChange={(e) => updateFormSettings({ dateFilterFieldId: e.target.value === '__submitted' ? null : e.target.value })}
            style={{ width: '100%', padding: '0.4rem', marginBottom: '0.7rem' }}
          >
            <option value="__submitted">Submission date</option>
            {form.fields.filter(f => f.type === 'date').map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0 0.5rem' }} />
        </>
      )}

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

      {!isViewer && (
        <>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0 0.5rem' }} />

          <button
            className="secondary"
            onClick={() => { setActiveMenu(null); openBin() }}
            style={{ width: '100%', fontSize: '0.8rem' }}
          >
            Recycle Bin{binCount > 0 ? ` (${binCount})` : ''}
          </button>
        </>
      )}
    </>
  )

  const recordsFilters = (<>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: isMobile ? '100%' : 'auto' }}>
            {isMobile && (
              <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setMobileViewMode('table')}
                  className={mobileViewMode === 'table' ? '' : 'secondary'}
                  title="Table view"
                  style={{ padding: '0.4rem 0.55rem', borderRadius: 0, border: 'none' }}
                >
                  ☰
                </button>
                <button
                  type="button"
                  onClick={() => setMobileViewMode('cards')}
                  className={mobileViewMode === 'cards' ? '' : 'secondary'}
                  title="Card view"
                  style={{ padding: '0.4rem 0.55rem', borderRadius: 0, border: 'none' }}
                >
                  ▦
                </button>
              </div>
            )}
            <select
              aria-label="Date range"
              value={dateRange}
              onChange={(e) => { setDateRange(e.target.value); setCurrentPage(1) }}
              style={{ padding: '0.5rem', flex: 1, minWidth: 0, width: 'auto' }}
            >
              {DATE_RANGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

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
  </>)

  const recordsToolbar = (
      <div className="records-topbar-controls" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginTop: useTopBar ? 0 : '0.5rem' }}>
        {useTopBar && <h1 style={{ margin: 0, fontSize: '1.3rem', overflowWrap: 'anywhere' }}>{form.name} Records</h1>}
        <RefreshingIndicator show={refreshing} />
        {recordsFilters}

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
              <div className="dropdown-panel" style={{ ...dropdownStyle, left: useTopBar ? 'auto' : 0, right: useTopBar ? 0 : 'auto', minWidth: '220px' }} onClick={(e) => e.stopPropagation()}>
                {optionsMenuItems}
              </div>
            </>
          )}
        </div>
      </div>
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
        .records-table tbody tr.is-reconciled {
          background: var(--color-success-soft);
        }
        .records-table tbody tr.is-reconciled:hover {
          background: var(--color-success-soft);
          filter: brightness(0.96);
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
        <div style={{ position: 'relative', margin: '1rem 0 0.4rem' }}>
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

      {useTopBar ? createPortal(<AdaptivePageHeader title={form.name + ' Records'} filters={recordsFilters} minimumFilterWidth={dateRange === 'custom' ? 580 : dateRange === 'specific' ? 440 : 300} filterWidth={dateRange === 'custom' ? 720 : dateRange === 'specific' ? 560 : 420} open={activeMenu === 'options'} onOpenChange={open => setActiveMenu(open ? 'options' : null)}>{optionsMenuItems}</AdaptivePageHeader>, desktopHeaderTarget) : recordsToolbar}

      <MobileOptionsPanel
        open={activeMenu === 'options'}
        className="page-options-panel-mobile"
        title="Records options"
        onClose={() => setActiveMenu(null)}
      >
        {optionsMenuItems}
      </MobileOptionsPanel>

      {/* Visible on the table itself (not just buried in Options) once Daily
          Tally has actually been opened this visit - the way back after
          drilling into a day needs to be obvious, not something you have to
          go hunting for in a dropdown. */}
      {hasCartField && view === 'table' && tallyActivated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginTop: '0.8rem' }}>
          <button className="secondary" onClick={() => setView('tally')} style={{ fontSize: '0.85rem' }}>
            Daily Tally
          </button>
          {/* A quick total for whatever's currently filtered/shown below -
              e.g. today's count/amount - without having to open Daily Tally
              just to see it. */}
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            {orderCount.toLocaleString()} order{orderCount === 1 ? '' : 's'} · ₦{revenue.toLocaleString()}
          </span>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginTop: '0.8rem',
          padding: '0.6rem 1rem', background: 'var(--color-warning-soft)', borderRadius: 'var(--radius)'
        }}>
          <span style={{ fontSize: '0.9rem' }}>{selectedIds.length} selected</span>
          {!isViewer && (
            <button className="secondary" style={{ color: '#c0392b' }} onClick={deleteSelected}>Move to Bin</button>
          )}
          <button className="secondary" onClick={() => setSelectedIds([])}>Clear selection</button>
        </div>
      )}

      {view === 'tally' ? (
        <div style={{ marginTop: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Daily Tally</h2>
            <button className="secondary" onClick={() => setView('table')}>Back to Records Table</button>
          </div>
          {/* The Sales/Orders by Day of Week breakdown that used to live here
              now has its own Sum/Average/Count picker and lives on the main
              Report page instead, alongside the other charts. */}
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: '0 0 1rem' }}>
            Looking for the day-of-week breakdown? See{' '}
            <Link to={`/form/${id}/report`} style={{ color: 'var(--color-primary)' }}>Reports</Link>.
          </p>
          {dailyTally.length === 0 ? (
            <EmptyState
              title={submissions.length === 0 ? 'No orders yet' : 'No orders in this range'}
              message={submissions.length === 0
                ? "Once orders come in, they'll be tallied here by day."
                : 'The date range filter above is scoping the tally too - widen it to see more days.'}
            />
          ) : (
            <>
              {/* Reconciliation - a plain "checked this day against another
                  source (bank statement, till roll, ...)" mark per day, not
                  tied to any single record. Saved to form.settings so the
                  mark is shared with anyone else who opens this form. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-muted)', fontWeight: 600 }}>Reconciliation</h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                  {dailyTally.filter(g => g.reconciled).length} of {dailyTally.length} days reconciled
                </span>
              </div>

              <div className="table-scroll table-breakout">
                <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem', position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)' }}>Date</th>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem', position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)' }}>Total Orders</th>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem', position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)' }}>Total Amount</th>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem', position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)' }}>Order Summary</th>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)', padding: '0.75rem 0.9rem', position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap', background: 'var(--color-bg)' }}>Reconciled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyTally.map(g => (
                      <tr
                        key={g.dateKey}
                        className="records-row"
                        style={{ cursor: 'pointer' }}
                        title="View this day's records"
                        onClick={() => {
                          setDateRange('specific')
                          setCustomStart(g.dateKey)
                          setCurrentPage(1)
                          setView('table')
                        }}
                      >
                        <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {g.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', whiteSpace: 'nowrap' }}>
                          {g.orders.toLocaleString()}
                        </td>
                        <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', whiteSpace: 'nowrap', color: 'var(--color-primary)', fontWeight: 700 }}>
                          ₦{g.amount.toLocaleString()}
                        </td>
                        <td style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', color: 'var(--color-muted)' }}>
                          {g.summary}
                        </td>
                        <td
                          style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', whiteSpace: 'nowrap' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: isViewer ? 'default' : 'pointer', fontSize: '0.85rem' }}>
                            <input
                              type="checkbox"
                              checked={g.reconciled}
                              disabled={isViewer}
                              onChange={() => toggleReconciled(g.dateKey)}
                            />
                            {g.reconciled ? 'Reviewed' : ''}
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : submissions.length === 0 ? (
        <EmptyState
          style={{ marginTop: '1.4rem' }}
          title="No records yet"
          message={`Once people submit this form, their ${entryNoun.plural.toLowerCase()} will appear here with filters and export options ready to use.`}
          action={<button onClick={() => window.history.back()}>Back to previous page</button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          style={{ marginTop: '1.4rem' }}
          icon={<SearchOffIcon />}
          title="No matches found"
          message="Try widening the date range or clearing a filter to see more records."
          action={
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="secondary" onClick={clearAllFilters}>Clear filters</button>
              <button onClick={() => setSearchText('')}>Clear search</button>
            </div>
          }
        />
      ) : isMobile && mobileViewMode === 'cards' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', margin: '0.9rem 0 0.6rem', fontSize: '0.82rem', color: 'var(--color-muted)' }}>
            <button
              type="button"
              className="secondary"
              onClick={toggleSelectAllOnPage}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
            >
              {pageRows.length > 0 && pageRows.every(r => selectedIds.includes(r.id)) ? 'Clear page' : 'Select page'}
            </button>
            <span>{startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, visible.length)} of {visible.length}</span>
          </div>
          <DataCardList>
            {pageRows.map(sub => (
              <DataCard
                key={sub.id}
                title={recordCardTitle(sub)}
                subtitle={new Date(sub.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                status={sub.id === justAddedId ? <span className="just-added-pill">JUST ADDED</span> : undefined}
                selected={selectedIds.includes(sub.id)}
                onToggle={() => toggleSelectRow(sub.id)}
                onOpen={() => setSelectedRecord(sub)}
              >
                {recordCardRows(sub)}
              </DataCard>
            ))}
          </DataCardList>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
            <button disabled={safePage === 1} onClick={() => setCurrentPage(safePage - 1)}>Previous</button>
            <span style={{ fontSize: '0.9rem' }}>Page {safePage} of {totalPages}</span>
            <button disabled={safePage === totalPages} onClick={() => setCurrentPage(safePage + 1)}>Next</button>
          </div>
        </>
      ) : (
        <>
          {reconciledFirst && !isViewer && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', margin: '0.8rem 0 0.4rem' }}>
              <button className="secondary" onClick={toggleReconcileAllVisible} style={{ fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}>
                {visible.length > 0 && visible.every(s => !!s.reconciled_at) ? 'Unreconcile All' : 'Reconcile All'}
              </button>
            </div>
          )}
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
                  {reconciledFirst && reconciledHeaderCell}
                  {hasCartField && !submissionDateAtEnd && dateHeaderCell}
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
                          {sortConfig?.fieldId === field.id && (
                            <span style={{ color: 'var(--color-primary)', fontSize: '0.7rem', flexShrink: 0 }}>
                              {sortConfig.dir === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>

                        {field.type !== 'cart' && (() => {
                          const active = !!filters[field.id] || sortConfig?.fieldId === field.id
                          return (
                            <button
                              ref={(el) => { if (field.id === openFilterId) openFilterTriggerRef.current = el }}
                              onClick={() => setOpenFilterId(openFilterId === field.id ? null : field.id)}
                              title="Sort & filter"
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '22px', height: '22px', padding: 0, borderRadius: '5px', flexShrink: 0,
                                background: active ? 'var(--color-primary)' : 'transparent',
                                border: active ? 'none' : '1px solid var(--color-border)'
                              }}
                            >
                              <FilterIcon color={active ? 'white' : (isHovered ? 'var(--color-primary)' : 'var(--color-muted)')} />
                            </button>
                          )
                        })()}
                      </div>

                      {openFilterId === field.id && field.type !== 'cart' && (
                        <>
                          <div style={overlayStyle} onClick={() => setOpenFilterId(null)} />
                          <ColumnHeaderMenu
                            field={field}
                            valueSummary={openColumnValueSummary}
                            currentFilter={filters[field.id]}
                            currentSort={sortConfig?.fieldId === field.id ? sortConfig.dir : null}
                            onSort={(dir) => { setSortConfig(dir ? { fieldId: field.id, dir } : null); setCurrentPage(1) }}
                            onApply={(filterData) => applyFilter(field.id, filterData)}
                            onClear={() => clearFilter(field.id)}
                            onClose={() => setOpenFilterId(null)}
                            anchorRef={openFilterTriggerRef}
                          />
                        </>
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
                  {(!hasCartField || submissionDateAtEnd) && dateHeaderCell}
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
                  {hasCartField && !reconciledFirst && reconciledHeaderCell}
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
                    className={[
                      'records-row',
                      sub.id === justAddedId && 'is-just-added',
                      hasCartField && sub.reconciled_at && 'is-reconciled',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setSelectedRecord(sub)}
                  >
                    <td
                      style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(sub.id)}
                          onChange={() => toggleSelectRow(sub.id)}
                        />
                        {sub.id === justAddedId && <span className="just-added-pill">JUST ADDED</span>}
                      </div>
                    </td>
                    {reconciledFirst && reconciledCell(sub)}
                    {hasCartField && !submissionDateAtEnd && dateCell(sub)}
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
                    {(!hasCartField || submissionDateAtEnd) && dateCell(sub)}
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
                    {hasCartField && !reconciledFirst && reconciledCell(sub)}
                    <td
                      style={{ borderBottom: '1px solid var(--color-border)', padding: '0.75rem 0.9rem', whiteSpace: 'nowrap' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!isViewer && (
                        <span
                          onClick={() => {
                            if (hasCartField && sub.edit_token) {
                              // Carries the admin's own email through to the
                              // embedded "Correct Order" screen (an
                              // otherwise-unauthenticated public route, see
                              // manage-submission/index.ts) purely so the
                              // resulting edit gets attributed properly in
                              // Edit History instead of showing up as an
                              // anonymous "Customer" edit.
                              const editorEmail = session?.user?.email ? `?editorEmail=${encodeURIComponent(session.user.email)}` : ''
                              setEditIframeUrl(`/form/${form.id}/response/${sub.edit_token}${editorEmail}`)
                            } else {
                              setSelectedRecord(sub)
                              setOpenRecordEditing(true)
                            }
                          }}
                          style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Edit
                        </span>
                      )}
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
          hideEdit={isViewer || (hasCartField && !openRecordEditing)}
          onToggleReconciled={hasCartField && !isViewer ? () => toggleRecordReconciled(selectedRecord) : null}
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
