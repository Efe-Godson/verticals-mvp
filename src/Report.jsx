// Place at: src/Report.jsx
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { printReport, exportReportToPDF, exportReportToPPTX } from './reportExport'

import StatTile from './report/components/StatTile'
import { cartReportTiles } from './report/analysis/Cartreport'
import { cartCategoryTiles } from './report/analysis/components/CartCategoryChart'
import AIRecommendationsModal from './report/ai/AIRecommendationsModal'
import HorizontalBarChart from './report/components/HorizontalBarChart'
import PieChart from './report/components/PieChart'
import PivotTable from './report/components/PivotTable'
import PromotedVisuals from './report/PromotedVisuals'
import TrendLineChart from './report/components/TrendLineChart'
import Modal from './components/Modal'
import { LoadingSpinner } from './LoadingState'
import { getGroupableFields, getMeasureOptions, computePivot, toChartData } from './report/helpers/pivotEngine'
import { formatNaira, median } from './report/helpers/analysisUtils'
import { DATE_RANGE_OPTIONS, getDateRangeBounds, getDateRangeLabel } from './report/helpers/dateRange'
import PageSkeleton from './components/PageSkeleton'
import { useDeferredLoading } from './components/loadingHooks'
import useIsMobile from './hooks/useIsMobile'
import { ErrorState } from './ErrorState'
import { usePageOptions } from './PageTitleContext'

function getPreviousDateRangeBounds(range, customStart, customEnd) {
  if (range === 'all') return { start: null, end: null }

  const currentRange = getDateRangeBounds(range, customStart, customEnd)
  if (!currentRange.start) return { start: null, end: null }

  const duration = currentRange.end
    ? currentRange.end.getTime() - currentRange.start.getTime()
    : 24 * 60 * 60 * 1000

  const prevEnd = new Date(currentRange.start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - duration)

  return { start: prevStart, end: prevEnd }
}

function getCompletionRate(form, submissions) {
  const nonCartFields = form.fields.filter(f => f.type !== 'cart' && f.type !== 'section')
  if (nonCartFields.length === 0 || submissions.length === 0) return 0

  const rates = nonCartFields.map(f => {
    const answered = submissions.filter(s => {
      const v = s.data[f.id]
      if (f.type === 'multiplechoicegrid' || f.type === 'checkboxgrid') return v && typeof v === 'object' && Object.keys(v).length > 0
      if (f.type === 'checkbox') return Array.isArray(v) && v.length > 0
      return v !== undefined && v !== null && v.toString().trim() !== ''
    })
    return (answered.length / submissions.length) * 100
  })

  return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
}

const CATEGORICAL_TYPES = ['dropdown', 'multiplechoice', 'checkbox', 'autocomplete']
const NUMERIC_TYPES = ['number', 'rating', 'linearscale']
const DEMOGRAPHIC_TYPES = ['email', 'phone']

// Fields whose values are worth breaking cart revenue down by first,
// e.g. "Sales Rep", "Salesperson", or a "Name" field, before the rest.
function isPriorityCategoryField(field) {
  const label = (field.label || '').toLowerCase()
  return /\bname\b/.test(label) ||
    /sales\s*-?\s*rep/.test(label) ||
    /sales\s*-?\s*person/.test(label) ||
    /salesperson/.test(label) ||
    /\bemployee\b/.test(label) ||
    /\bstaff\b/.test(label)
}

// Fields that represent how a sale reached the customer, surfaced in their
// own "Sales Channel" section rather than lumped in with generic breakdowns.
function isChannelField(field) {
  const label = (field.label || '').toLowerCase()
  return /channel/.test(label) || /\bplatform\b/.test(label) || /\bsource\b/.test(label)
}

// A 'location' field stores { country, state, city } - collapse it to one
// readable grouping key (city + state, else state/country).
function locationLabel(v) {
  if (v && typeof v === 'object') {
    const parts = [v.city, v.state].filter(Boolean)
    return parts.join(', ') || v.country || ''
  }
  return typeof v === 'string' ? v.trim() : ''
}

// "Sales by <location>" + "Orders by <location>" tiles for a location field
// crossed with a cart field. Mirrors cartCategoryTiles but resolves the
// location object first.
function locationCartTiles({ locationField, cartField, submissions }) {
  const revenue = {}
  const orders = {}
  let totalRevenue = 0
  let totalOrders = 0
  submissions.forEach(s => {
    const cart = s.data[cartField.id]
    if (!cart || !cart.items || cart.items.length === 0) return
    const label = locationLabel(s.data[locationField.id])
    if (!label) return
    const grand = cart.total + (cart.deliveryFee || 0)
    totalRevenue += grand
    totalOrders += 1
    revenue[label] = (revenue[label] || 0) + grand
    orders[label] = (orders[label] || 0) + 1
  })
  const toRows = (obj, total) => Object.entries(obj)
    .map(([label, count]) => ({ label, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
  const rev = toRows(revenue, totalRevenue)
  if (rev.length === 0) return []
  const ord = toRows(orders, totalOrders)
  const base = `loc-${locationField.id}-${cartField.id}`
  return [
    { id: `${base}-rev`, title: `Sales by ${locationField.label}`, node: <HorizontalBarChart data={rev} formatValue={(v) => formatNaira(v)} bare /> },
    { id: `${base}-ord`, title: `Orders by ${locationField.label}`, node: <HorizontalBarChart data={ord} bare /> },
  ]
}

// Plain response-count breakdown by location, for forms with no cart field.
function locationCountTile({ locationField, submissions }) {
  const counts = {}
  let total = 0
  submissions.forEach(s => {
    const label = locationLabel(s.data[locationField.id])
    if (!label) return
    counts[label] = (counts[label] || 0) + 1
    total += 1
  })
  const rows = Object.entries(counts)
    .map(([label, count]) => ({ label, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
  if (rows.length === 0) return []
  return [{ id: `loc-${locationField.id}-count`, title: `Responses by ${locationField.label}`, node: <HorizontalBarChart data={rows} bare /> }]
}

function Report() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isFocusMode = searchParams.get('focus') === '1'
  const { staffFormId, session } = useAuth()
  // The owner always sees everything; a staff login sees at most whatever
  // range the owner capped Reports to in Settings (default "Today") - this
  // is a UI-level cap, not an RLS one, matching how the rest of this app's
  // settings work (staff already have full read access to this form's
  // submissions once they're scoped to it at all).
  const isStaffView = staffFormId === id
  const [form, setForm] = useState(null)
  // Someone the report was shared with (see FormSettings "Share the report"):
  // signed in, not the owner, not staff. Everything editable is hidden and
  // RLS only lets them read this form + its submissions anyway.
  const isSharedViewer = !!form && !!session && !isStaffView && form.user_id !== session.user.id
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dateRange, setDateRange] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [pdfProgress, setPdfProgress] = useState(null) // { done, total, label, variant, finished } | null
  const reportContentRef = useRef(null)

  // Chart-tile pairing: the owner can join a chart with the one after it into
  // a single side-by-side tile (desktop only - it stacks on mobile). Stored
  // as a list of "join with next" tile ids on the form.
  const isDesktop = !useIsMobile(1024)
  const canEditLayout = !isStaffView && !isSharedViewer && isDesktop
  const chartPairs = form?.settings?.reportChartPairs || []
  async function toggleChartPair(tileId) {
    const cur = form?.settings?.reportChartPairs || []
    const next = cur.includes(tileId) ? cur.filter(x => x !== tileId) : [...cur, tileId]
    const settings = { ...(form?.settings || {}), reportChartPairs: next }
    setForm(f => ({ ...f, settings }))
    const { error: saveErr } = await supabase.from('forms').update({ settings }).eq('id', id)
    if (saveErr && import.meta.env.DEV) console.error('Could not save chart layout:', saveErr)
  }

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
      if (staffFormId === id) {
        setDateRange(formData.settings?.staffReportRange || 'today')
      }

      const { data: subsData, error: subsError } = await supabase
        .from('submissions').select('*').eq('form_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (subsError) {
        setError('Could not load records: ' + subsError.message)
        setLoading(false)
        return
      }
      setSubmissions(subsData)
      setLoading(false)
    }
    loadData()
  }, [id, staffFormId])

  // Only shows the compact bar's "⋯" button once there's an actual report
  // (and Options menu) to open - not during loading/error/empty-state,
  // which render early below instead of the filter bar this menu lives in.
  usePageOptions(!loading && !error && submissions.length > 0, () => setOptionsMenuOpen(v => !v))

  const showSkel = useDeferredLoading(loading)
  if (loading) return showSkel ? <PageSkeleton variant="report" /> : null
  if (error) return <ErrorState message={error} />

  if (submissions.length === 0) {
    return (
      <div className="page">
        <h1>{form.name}: Report</h1>
        <p style={{ color: '#999', marginTop: '2rem' }}>
          No data yet. Once people submit this form, a report will appear here.
        </p>
      </div>
    )
  }

  // The "record date": a form date field the owner nominated in Settings
  // (so backdated / backlog entries count on the date actually set), falling
  // back to when the record was submitted.
  const reportDateField = form.fields.find(f => f.id === form.settings?.reportDateField && f.type === 'date')
  function recordDate(sub) {
    if (reportDateField) {
      const raw = sub.data[reportDateField.id]
      if (raw) {
        const d = new Date(raw)
        if (!isNaN(d.getTime())) return d
      }
    }
    return new Date(sub.created_at)
  }

  const { start: rangeStart, end: rangeEnd } = getDateRangeBounds(dateRange, customStart, customEnd)
  const filteredSubmissions = submissions.filter(s => {
    const when = recordDate(s)
    if (rangeStart && when < rangeStart) return false
    if (rangeEnd && when > rangeEnd) return false
    return true
  })

  const previousRange = getPreviousDateRangeBounds(dateRange, customStart, customEnd)
  const previousFilteredSubmissions = previousRange.start ? submissions.filter(s => {
    const when = recordDate(s)
    if (previousRange.start && when < previousRange.start) return false
    if (previousRange.end && when > previousRange.end) return false
    return true
  }) : []

  const totalResponses = filteredSubmissions.length
  const dateRangeLabel = getDateRangeLabel(dateRange, customStart, customEnd)

  const cartFields = form.fields.filter(f => f.type === 'cart')
  const categoryFields = form.fields.filter(f => CATEGORICAL_TYPES.includes(f.type))
  const locationFields = form.fields.filter(f => f.type === 'location')

  const salesByCategoryPairs = []
  cartFields.forEach(cartField => {
    categoryFields.forEach(catField => {
      salesByCategoryPairs.push({ cartField, catField, priority: isPriorityCategoryField(catField) })
    })
  })
  // "Operations" pairs (sales rep / staff / name) surface separately from
  // "Products" pairs (channel, other category breakdowns); see isPriorityCategoryField.
  const nonOperationsPairs = salesByCategoryPairs.filter(p => !p.priority)
  const channelCategoryPairs = nonOperationsPairs.filter(p => isChannelField(p.catField))
  const otherCategoryPairs = nonOperationsPairs.filter(p => !isChannelField(p.catField))
  const operationsCategoryPairs = salesByCategoryPairs.filter(p => p.priority)

  // Time series over the record date. Raw dated points are handed to
  // TrendLineChart, which buckets them by the granularity the D/W/M/Q/Y
  // toggle is set to. The default just picks something sensible for the span.
  const trendTiles = (() => {
    if (filteredSubmissions.length < 2) return []
    const times = filteredSubmissions.map(s => recordDate(s).getTime()).filter(t => !isNaN(t))
    if (times.length < 2) return []
    const spanDays = (Math.max(...times) - Math.min(...times)) / 86400000
    const defaultGran = spanDays <= 62 ? 'day' : spanDays <= 550 ? 'week' : spanDays <= 1500 ? 'month' : 'quarter'

    const orderPoints = []
    const revenuePoints = []
    filteredSubmissions.forEach(s => {
      const d = recordDate(s)
      orderPoints.push({ date: d, value: 1 })
      let rev = 0
      cartFields.forEach(cf => {
        const v = s.data[cf.id]
        if (v && v.items && v.items.length > 0) rev += v.total + (v.deliveryFee || 0)
      })
      if (rev > 0) revenuePoints.push({ date: d, value: rev })
    })

    const byLabel = reportDateField ? ` (by ${reportDateField.label})` : ''
    const tiles = [{
      id: 'trend-orders',
      title: `${cartFields.length > 0 ? 'Orders' : 'Responses'} over time${byLabel}`,
      node: <TrendLineChart points={orderPoints} defaultGranularity={defaultGran} />,
    }]
    if (revenuePoints.length > 0) {
      tiles.push({
        id: 'trend-revenue',
        title: `Revenue over time${byLabel}`,
        node: <TrendLineChart points={revenuePoints} defaultGranularity={defaultGran} formatValue={formatNaira} currency />,
      })
    }
    return tiles
  })()

  // One flat, ordered list of chart tiles - the unit the owner can pair up
  // (see toggleChartPair / ChartTileGrid). Each needs a stable id.
  const chartTiles = [
    ...trendTiles,
    ...cartFields.flatMap(field => {
      const answered = filteredSubmissions.filter(s => {
        const v = s.data[field.id]
        return v && v.items && v.items.length > 0
      })
      return cartReportTiles({ field, answered })
    }),
    ...[...channelCategoryPairs, ...operationsCategoryPairs, ...otherCategoryPairs].flatMap(({ cartField, catField }) =>
      cartCategoryTiles({ categoryField: catField, cartField, submissions: filteredSubmissions }),
    ),
    ...locationFields.flatMap(lf =>
      cartFields.length > 0
        ? cartFields.flatMap(cf => locationCartTiles({ locationField: lf, cartField: cf, submissions: filteredSubmissions }))
        : locationCountTile({ locationField: lf, submissions: filteredSubmissions }),
    ),
    ...(form.settings?.reportWidgets || []).map(widget => ({
      id: `widget-${widget.id}`,
      title: widget.title,
      node: <CustomReportWidget form={form} widget={widget} submissions={filteredSubmissions} />,
    })),
  ]

  // Apply the owner's saved tile order (reportChartOrder is a list of ids);
  // any tile not in the list keeps its natural position after the ranked ones.
  const orderRank = new Map((form?.settings?.reportChartOrder || []).map((tid, i) => [tid, i]))
  const orderedChartTiles = [...chartTiles].sort(
    (a, b) => (orderRank.has(a.id) ? orderRank.get(a.id) : 1e9) - (orderRank.has(b.id) ? orderRank.get(b.id) : 1e9),
  )

  function moveChartTile(tileId, where) {
    const ids = orderedChartTiles.map(t => t.id)
    const i = ids.indexOf(tileId)
    if (i < 0) return
    // Pairing is positional ("join with next"), so a joined tile has to move
    // together with its partner or the pairing re-attaches to a new neighbour.
    const pairedForward = new Set(form?.settings?.reportChartPairs || [])
    const blockLen = pairedForward.has(tileId) && i + 1 < ids.length ? 2 : 1
    const block = ids.slice(i, i + blockLen)
    const rest = [...ids.slice(0, i), ...ids.slice(i + blockLen)]
    const pos = where === 'top' ? 0
      : where === 'bottom' ? rest.length
      : where === 'up' ? Math.max(0, i - 1)
      : Math.min(rest.length, i + 1)
    rest.splice(pos, 0, ...block)
    const settings = { ...(form?.settings || {}), reportChartOrder: rest }
    setForm(f => ({ ...f, settings }))
    supabase.from('forms').update({ settings }).eq('id', id).then(({ error: e }) => {
      if (e && import.meta.env.DEV) console.error('Could not save chart order:', e)
    })
  }

  function buildFilterSummary() {
    return dateRange === 'all' ? '' : dateRangeLabel
  }

  function handlePrint() {
    printReport(form, filteredSubmissions, buildFilterSummary())
  }

  async function handleDownloadPDF(variant = 'standard') {
    const safeName = form.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'report'
    setPdfProgress({ done: 0, total: 0, label: 'Preparing…', variant })
    await new Promise(r => setTimeout(r, 60)) // let the modal paint
    try {
      await exportReportToPDF(reportContentRef.current, safeName, {
        variant,
        onProgress: (done, total, label) => setPdfProgress({ done, total, label, variant }),
      })
      setPdfProgress({ done: 1, total: 1, label: 'Downloaded', variant, finished: true })
      setTimeout(() => setPdfProgress(null), 1400)
    } catch (err) {
      if (import.meta.env.DEV) console.error('PDF export failed', err)
      setPdfProgress(null)
      alert("Couldn't build the PDF. Please try again.")
    }
  }

  function handleDownloadPPTX() {
    exportReportToPPTX(form, filteredSubmissions, buildFilterSummary())
  }

  // Shared between the desktop-anchored dropdown and the mobile portal
  // version below, so the two don't drift out of sync with each other.
  const optionsMenuItemStyle = { display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.45rem 0.3rem', fontSize: '0.85rem' }
  const optionsMenuItems = (
    <>
      <button className="secondary" onClick={() => { handlePrint(); setOptionsMenuOpen(false) }} style={optionsMenuItemStyle}>
        Print
      </button>
      {!isSharedViewer && (
        <button className="secondary" onClick={() => { setShowAIPanel(true); setOptionsMenuOpen(false) }} style={optionsMenuItemStyle}>
          AI recommendations
        </button>
      )}

      <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.3rem 0' }} />

      <button className="secondary" onClick={() => { setOptionsMenuOpen(false); handleDownloadPDF('standard') }} style={optionsMenuItemStyle}>
        Download PDF
      </button>
      <button className="secondary" onClick={() => { setOptionsMenuOpen(false); handleDownloadPDF('mobile') }} style={optionsMenuItemStyle}>
        Download PDF (mobile size)
      </button>
      <button className="secondary" onClick={() => { handleDownloadPPTX(); setOptionsMenuOpen(false) }} style={optionsMenuItemStyle}>
        Download PowerPoint
      </button>
      {!isSharedViewer && (
        <>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.3rem 0' }} />
          <button className="secondary" onClick={() => { setMoreMenuOpen(true); setOptionsMenuOpen(false) }} style={optionsMenuItemStyle}>
            + Add Metric
          </button>
        </>
      )}
      {!isStaffView && !isSharedViewer && (
        <>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.3rem 0' }} />
          <button
            className="secondary"
            onClick={() => { window.open(`/form/${id}/report/builder`, '_blank', 'noopener'); setOptionsMenuOpen(false) }}
            style={optionsMenuItemStyle}
          >
            Open Report Builder ↗
          </button>
        </>
      )}
    </>
  )

  return (
    <div
      className="page"
      style={{
        maxWidth: 'min(1600px, 100%)',
        // In focus mode keep the column clear of the fixed menu / back
        // buttons (each ~44px, 1rem from the edge). On mobile those buttons
        // sit at the bottom instead, so no side inset is needed there.
        ...(isFocusMode ? { paddingTop: '4rem' } : {}),
        ...(isFocusMode && isDesktop ? { paddingLeft: '4.25rem', paddingRight: '4.25rem' } : {}),
      }}
      ref={reportContentRef}
    >
      {/* Reserves room for PosSidePanel's fixed top-left hamburger so it
          doesn't paint over the page title - see the same fix in
          PublicForm.jsx/Records.jsx. A matching permanent left-padding
          reserve was tried too (so a scrolled-past card heading couldn't get
          clipped either), but on a narrow phone that ~4rem reserve ate
          enough width to start clipping real content on the right edge
          instead (e.g. a revenue figure) - a worse bug than the one it
          fixed. A momentary, partial letter overlap while scrolling past a
          floating button is normal FAB behavior (see Gmail/WhatsApp etc.),
          not worth trading real content width for. */}      <style>{`
        .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
        .kpi-add-tile { transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease; }
        .kpi-add-tile:hover { border-color: var(--color-primary); color: var(--color-primary); background: #f8fbff; }
        @media (min-width: 500px) {
          .kpi-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        }
        @media (max-width: 640px) {
          .report-filter-bar {
            position: sticky; top: 0.5rem; z-index: 30; background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px); border: 1px solid var(--color-border); border-radius: var(--radius);
            padding: 0.85rem; margin-bottom: 1rem;
          }
        }
      `}</style>

      <header className="report-header" data-html2canvas-ignore="true">
        <div>
          <h1 className="report-title">Sales Report</h1>
        </div>
      </header>

      <div className="report-filter-bar" data-html2canvas-ignore="true" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
        gap: '0.8rem', padding: '0.9rem 1rem', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', marginBottom: '1rem', background: 'rgba(255,255,255,0.95)'
      }}>
        <div className="report-filter-group" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="report-date-range">Date range</label>
          {isStaffView ? (
            <span
              title="Set by the owner in Settings > Staff Access"
              style={{
                padding: '0.5rem 0.8rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                fontSize: '0.9rem', color: 'var(--color-muted)', background: 'var(--color-bg)'
              }}
            >
              {getDateRangeLabel(dateRange, customStart, customEnd)}
            </span>
          ) : (
            <>
              <select id="report-date-range" value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: '0.5rem' }}>
                {DATE_RANGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {dateRange === 'specific' && (
                <div className="date-range-group">
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: '0.5rem' }} />
                </div>
              )}
              {dateRange === 'custom' && (
                <div className="date-range-group">
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: '0.5rem' }} />
                  <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>to</span>
                  <input
                    type="date" value={customEnd} title="Leave blank to filter to just the start date"
                    onChange={(e) => setCustomEnd(e.target.value)} style={{ padding: '0.5rem' }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Desktop only (see .page-options-panel-desktop in index.css) -
              a small dropdown anchored right under this button. Below 768px
              this whole thing hides in favor of the portaled version further
              down: this button lives inside .report-filter-bar, which gets
              backdrop-filter on mobile for its sticky-blur look, and an
              ancestor with backdrop-filter becomes a containing block for
              position:fixed descendants - so a "fixed" panel nested in here
              would end up positioned relative to this bar instead of the
              viewport. Portaling to document.body sidesteps that (and any
              other ancestor transform/filter) entirely rather than chasing
              it with more CSS. */}
          <div className="page-options-panel-desktop" style={{ position: 'relative', flexShrink: 0 }}>
            <button className="secondary page-options-trigger" onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}>
              Options ▾
            </button>
            {optionsMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 15 }}
                  onClick={() => setOptionsMenuOpen(false)}
                />
                <div className="dropdown-panel" style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '220px', padding: '0.6rem',
                  overflow: 'hidden'
                }}>
                  {optionsMenuItems}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {optionsMenuOpen && createPortal(
        <div className="page-options-panel-mobile">
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 149 }}
            onClick={() => setOptionsMenuOpen(false)}
          />
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

      {filteredSubmissions.length === 0 ? (
        <div className="card" style={{ padding: '1.8rem', marginBottom: '1.2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>No responses in this range yet</h3>
          <p style={{ color: 'var(--color-muted)', margin: '0 0 0.9rem' }}>
            Try a wider date range, or collect a few more submissions to unlock richer insights.
          </p>
          <button className="secondary" onClick={() => { setDateRange('all'); setCustomStart(''); setCustomEnd('') }}>Reset to all time</button>
        </div>
      ) : (
        <>
          <div id="report-overview" data-report-block>
            <OverviewCard form={form} submissions={filteredSubmissions} />
          </div>

          <div id="report-performance" data-report-block style={{ marginTop: '2rem' }}>
            <KPIGrid
              form={form}
              submissions={filteredSubmissions}
              previousSubmissions={previousFilteredSubmissions}
              totalResponses={totalResponses}
              moreMenuOpen={moreMenuOpen}
              setMoreMenuOpen={setMoreMenuOpen}
            />
          </div>

          {orderedChartTiles.length > 0 && (
            <div id="report-charts" style={{ marginTop: '2rem' }}>
              <ChartTileGrid
                tiles={orderedChartTiles}
                pairs={chartPairs}
                onTogglePair={toggleChartPair}
                onMove={moveChartTile}
                canEdit={canEditLayout}
              />
            </div>
          )}

          <div data-report-block style={{ marginTop: '2rem' }}>
            <PromotedVisuals form={form} submissions={filteredSubmissions} />
          </div>
        </>
      )}

      {showAIPanel && (
        <AIRecommendationsModal
          formId={form.id}
          dateRangeLabel={dateRangeLabel}
          submissionIds={filteredSubmissions.map(s => s.id)}
          onClose={() => setShowAIPanel(false)}
        />
      )}

      {pdfProgress && (() => {
        const { done, total, label, finished, variant } = pdfProgress
        const pct = total > 0 ? Math.round((done / total) * 100) : (finished ? 100 : 8)
        return (
          <Modal size="sm" onClose={() => {}} hideHeader>
            <div style={{ textAlign: 'center', padding: '0.6rem 0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
                {finished
                  ? <span style={{ color: 'var(--status-good)', fontSize: '1.2rem', fontWeight: 700 }}>✓</span>
                  : <LoadingSpinner size={18} color="var(--color-primary)" />}
                <strong>{finished ? 'PDF downloaded' : `Building PDF${variant === 'mobile' ? ' (mobile size)' : ''}…`}</strong>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--color-primary-soft)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.2s ease' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
                {finished
                  ? 'Check your downloads folder.'
                  : total > 0 ? `Rendering ${Math.min(done + 1, total)} of ${total}${label ? ` · ${label}` : ''}` : (label || 'Preparing…')}
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}

// Renders one promoted Report Builder widget (see ReportBuilder.jsx, which
// writes these into form.settings.reportWidgets - same computePivot engine
// it uses for its own live preview, so a promoted widget looks identical to
// what was previewed there). Fields referenced by a widget can be deleted
// from the form later (EditForm.jsx), so this resolves them defensively
// rather than assuming they still exist.
function CustomReportWidget({ form, widget, submissions }) {
  const groupableFields = getGroupableFields(form)
  const measureOptions = getMeasureOptions(form)
  const rowField = groupableFields.find(f => f.id === widget.rowFieldId)
  const colField = widget.colFieldId ? groupableFields.find(f => f.id === widget.colFieldId) : null
  const measure = measureOptions.find(m => m.id === widget.measureId)

  if (!rowField || !measure) {
    return <p style={{ color: 'var(--color-muted)' }}>One of this report's fields was removed from the form - edit or remove it in the Report Builder.</p>
  }

  const pivotResult = computePivot({ rowField, colField, measure, submissions })
  const formatValue = measure.kind === 'cartRevenue' ? formatNaira : (v) => v.toLocaleString()

  if (widget.chartType === 'table' || colField) return <PivotTable pivotResult={pivotResult} formatValue={formatValue} />
  if (widget.chartType === 'pie') return <PieChart data={toChartData(pivotResult)} />
  return <HorizontalBarChart data={toChartData(pivotResult)} formatValue={formatValue} />
}

// The chart-tile list. Each tile is its own card; the owner can join a tile
// with the one after it (desktop only) into a side-by-side pair
// (toggleChartPair) and reorder it (moveChartTile) - both stored on the form.
const pairToggleStyle = { fontSize: '0.72rem', padding: '0.2rem 0.55rem', flexShrink: 0 }

function ChartTileBody({ title, node }) {
  return (
    <>
      {title && <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.9rem' }}>{title}</div>}
      {node}
    </>
  )
}

// Flat four-way "move from any angle" icon (matches ArrowLeftIcon's style).
function MoveIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l3 3" />
    </svg>
  )
}

// The move button + its little dropdown (Up / Down / Top / Bottom).
function MoveControl({ tileId, onMove, isFirst, isLast, label = 'Move' }) {
  const [open, setOpen] = useState(false)
  const items = [
    { label: 'Move up', where: 'up', disabled: isFirst },
    { label: 'Move down', where: 'down', disabled: isLast },
    { label: 'Move to top', where: 'top', disabled: isFirst },
    { label: 'Move to bottom', where: 'bottom', disabled: isLast },
  ]
  return (
    <div style={{ position: 'relative', flexShrink: 0 }} data-html2canvas-ignore="true">
      <button
        className="secondary"
        style={{ ...pairToggleStyle, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
        onClick={() => setOpen(o => !o)}
        title={label}
        aria-label={label}
      >
        <MoveIcon /> {label}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 0.3rem)', zIndex: 41, minWidth: 160,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.16)', padding: '0.3rem', display: 'flex', flexDirection: 'column',
          }}>
            {items.map(it => (
              <button
                key={it.where}
                className="secondary"
                disabled={it.disabled}
                onClick={() => { setOpen(false); onMove(tileId, it.where) }}
                style={{ border: 'none', background: 'transparent', textAlign: 'left', justifyContent: 'flex-start', padding: '0.45rem 0.55rem', fontSize: '0.82rem' }}
              >
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ChartTileGrid({ tiles, pairs, onTogglePair, onMove, canEdit }) {
  const joined = new Set(pairs || [])
  const out = []
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]
    const next = tiles[i + 1]
    const isFirst = i === 0
    const isLast = i === tiles.length - 1
    if (joined.has(t.id) && next) {
      // A joined pair is already two charts wide - span the whole row.
      out.push(
        <div key={t.id} data-report-block className="report-tile-wide">
          <div className="report-chart-pair">
            <div className="card" style={{ padding: '1.5rem' }}><ChartTileBody {...t} /></div>
            <div className="card" style={{ padding: '1.5rem' }}><ChartTileBody {...next} /></div>
          </div>
          {canEdit && (
            <div className="report-tile-control" data-html2canvas-ignore="true" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.35rem' }}>
              <MoveControl tileId={t.id} onMove={onMove} isFirst={isFirst} isLast={i + 2 >= tiles.length} label="Move pair" />
              <button className="secondary" style={pairToggleStyle} onClick={() => onTogglePair(t.id)}>⤢ Unpair</button>
            </div>
          )}
        </div>,
      )
      i++ // consumed `next`
    } else {
      const showHeader = !!t.title || canEdit
      out.push(
        <div key={t.id} data-report-block className="card" style={{ padding: '1.75rem' }}>
          {showHeader && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.9rem' }}>
              {t.title ? <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{t.title}</div> : <span />}
              {canEdit && (
                <div className="report-tile-control" data-html2canvas-ignore="true" style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <MoveControl tileId={t.id} onMove={onMove} isFirst={isFirst} isLast={isLast} />
                  {next && (
                    <button className="secondary" style={pairToggleStyle} onClick={() => onTogglePair(t.id)}>
                      ⧉ Pair with next
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {t.node}
        </div>,
      )
    }
  }
  // Two tiles per row on a wide screen (each still its own independent card);
  // a joined pair spans both columns.
  return <div className="report-tile-list">{out}</div>
}

function OverviewCard({ form, submissions }) {
  const cartFields = form.fields.filter(f => f.type === 'cart')
  let totalRevenue = 0
  let hasCartData = false

  cartFields.forEach(field => {
    submissions.forEach(s => {
      const v = s.data[field.id]
      if (v && v.items && v.items.length > 0) {
        hasCartData = true
        totalRevenue += v.total + (v.deliveryFee || 0)
      }
    })
  })

  const totalResponses = submissions.length
  // Keep this concise: a briefing, not a list of everything the data could
  // say - revenue and salesperson lines only, capped at 4.
  const insights = computeInsights(form, submissions).slice(0, 4)

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.2rem', background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-primary-soft) 100%)' }}>
      {hasCartData ? (
        <div style={{ fontSize: '1.15rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
          Your business generated{' '}
          <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
            {formatNaira(totalRevenue)}
          </span>{' '}
          during this period.
        </div>
      ) : (
        <div style={{ fontSize: '1.15rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
          You received{' '}
          <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
            {totalResponses.toLocaleString()}
          </span>{' '}
          response{totalResponses !== 1 ? 's' : ''} during this period.
        </div>
      )}

      {insights.length > 0 && (
        <div style={{ marginTop: '1.1rem', paddingTop: '1rem', borderTop: '1px solid rgba(15,23,42,0.08)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
            Key highlights
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {insights.map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--color-primary)', fontSize: '1rem', lineHeight: 1.4, fontWeight: 700 }}>•</span>
                <span style={{ fontSize: '0.92rem', lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Aggregates the numbers a trend comparison needs from a set of submissions,
// shared between the current and previous period so the two are computed
// identically.
function computeCartTotals(cartFields, submissions) {
  let totalRevenue = 0
  let totalOrders = 0
  let totalItems = 0
  const orderTotals = []

  cartFields.forEach(field => {
    submissions.forEach(s => {
      const v = s.data[field.id]
      if (v && v.items && v.items.length > 0) {
        const grandTotal = v.total + (v.deliveryFee || 0)
        totalRevenue += grandTotal
        totalOrders += 1
        orderTotals.push(grandTotal)
        totalItems += v.items.reduce((sum, item) => sum + item.quantity, 0)
      }
    })
  })

  return { totalRevenue, totalOrders, totalItems, orderTotals }
}

// Returns undefined (not shown) when there's no previous-period value to
// compare against, rather than a misleading 0% / flat trend.
function computeTrend(current, previous) {
  if (previous === undefined || previous === null || previous === 0) return undefined
  const percent = Math.round(((current - previous) / previous) * 100)
  return { direction: current >= previous ? 'up' : 'down', percent }
}

function KPIGrid({ form, submissions, previousSubmissions = [], totalResponses, moreMenuOpen, setMoreMenuOpen }) {
  const [selectedMore, setSelectedMore] = useState([])
  const [metricSearch, setMetricSearch] = useState('')
  const cartFields = form.fields.filter(f => f.type === 'cart')
  const numericFields = form.fields.filter(f => NUMERIC_TYPES.includes(f.type))
  const categoryFields = form.fields.filter(f => CATEGORICAL_TYPES.includes(f.type))
  const demographicFields = form.fields.filter(f => DEMOGRAPHIC_TYPES.includes(f.type))
  const dateFields = form.fields.filter(f => f.type === 'date')
  const hasPreviousPeriod = previousSubmissions.length > 0

  const primaryKpis = []
  // Every other computed metric lives behind "More metrics" so the grid above
  // never gets crowded, add new KPI computations here as the report grows,
  // and they show up in the checklist automatically.
  const moreKpis = []

  // ---- Cart / revenue metrics ----
  const { totalRevenue, totalOrders, totalItems, orderTotals } = computeCartTotals(cartFields, submissions)
  const previousCart = hasPreviousPeriod ? computeCartTotals(cartFields, previousSubmissions) : null
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  if (cartFields.length > 0) {
    primaryKpis.push({
      label: 'Revenue', value: formatNaira(totalRevenue),
      trend: computeTrend(totalRevenue, previousCart?.totalRevenue)
    })
    primaryKpis.push({
      label: 'Orders', value: totalOrders.toLocaleString(),
      trend: computeTrend(totalOrders, previousCart?.totalOrders)
    })
    primaryKpis.push({
      label: 'Average Order Value', value: formatNaira(avgOrderValue),
      trend: computeTrend(avgOrderValue, previousCart?.totalOrders > 0 ? previousCart.totalRevenue / previousCart.totalOrders : undefined)
    })

    moreKpis.push({
      label: 'Median Order Value',
      value: formatNaira(median(orderTotals))
    })
    moreKpis.push({
      label: 'Highest Order Value',
      value: formatNaira(orderTotals.length > 0 ? Math.max(...orderTotals) : 0)
    })
    moreKpis.push({ label: 'Total Items Sold', value: totalItems.toLocaleString() })
    moreKpis.push({
      label: 'Average Items per Order',
      value: totalOrders > 0 ? (totalItems / totalOrders).toFixed(1) : '0'
    })
  }

  moreKpis.push({
    label: 'Total Responses', value: totalResponses.toLocaleString(),
    trend: computeTrend(totalResponses, hasPreviousPeriod ? previousSubmissions.length : undefined)
  })

  // ---- Completion & pacing ----
  const completionRate = getCompletionRate(form, submissions)
  if (completionRate > 0) {
    moreKpis.push({ label: 'Avg. Completion', value: `${completionRate}%` })
  }

  if (submissions.length > 1) {
    const timestamps = submissions.map(s => new Date(s.created_at).getTime()).filter(t => !isNaN(t))
    if (timestamps.length > 1) {
      const spanDays = Math.max(1, (Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24))
      moreKpis.push({ label: 'Responses per Day', value: (totalResponses / spanDays).toFixed(1) })
    }
  }

  // ---- Numeric fields (one set of stats per field) ----
  numericFields.forEach(field => {
    const values = submissions.map(s => Number(s.data[field.id])).filter(v => !isNaN(v))
    if (values.length === 0) return
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    moreKpis.push({ label: `Average ${field.label}`, value: Math.round(avg).toLocaleString() })
    moreKpis.push({ label: `Median ${field.label}`, value: median(values).toLocaleString() })
    moreKpis.push({ label: `Highest ${field.label}`, value: Math.max(...values).toLocaleString() })
    moreKpis.push({ label: `Lowest ${field.label}`, value: Math.min(...values).toLocaleString() })
  })

  // ---- Category fields (top value + variety) ----
  categoryFields.forEach(field => {
    const answered = submissions.filter(s => {
      const v = s.data[field.id]
      return field.type === 'checkbox' ? Array.isArray(v) && v.length > 0 : v !== undefined && v !== null && v !== ''
    })
    if (answered.length === 0) return
    const countMap = {}
    answered.forEach(s => {
      const v = s.data[field.id]
      const vals = Array.isArray(v) ? v : [v]
      vals.forEach(val => { countMap[val] = (countMap[val] || 0) + 1 })
    })
    const entries = Object.entries(countMap)
    const top = entries.sort((a, b) => b[1] - a[1])[0]
    if (top) {
      const percent = Math.round((top[1] / answered.length) * 100)
      moreKpis.push({ label: `Top ${field.label}`, value: `${top[0]} (${percent}%)` })
    }
    moreKpis.push({ label: `Distinct ${field.label} values`, value: entries.length.toLocaleString() })
  })

  // ---- Demographic coverage ----
  demographicFields.forEach(field => {
    const answered = submissions.filter(s => {
      const v = s.data[field.id]
      return v !== undefined && v !== null && v.toString().trim() !== ''
    })
    if (submissions.length === 0) return
    const percent = Math.round((answered.length / submissions.length) * 100)
    moreKpis.push({ label: `${field.label} Provided`, value: `${percent}%` })
  })

  // ---- Date fields ----
  dateFields.forEach(field => {
    const answered = submissions.filter(s => s.data[field.id])
    if (answered.length === 0) return
    const dayCounts = {}
    answered.forEach(s => {
      const d = new Date(s.data[field.id])
      if (isNaN(d)) return
      const dn = d.toLocaleDateString('en-GB', { weekday: 'long' })
      dayCounts[dn] = (dayCounts[dn] || 0) + 1
    })
    const top = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]
    if (top) moreKpis.push({ label: `Busiest Day (${field.label})`, value: top[0] })
  })

  const visibleMoreKpis = moreKpis.filter(k => selectedMore.includes(k.label))
  const filteredMoreKpis = moreKpis.filter(k => k.label.toLowerCase().includes(metricSearch.toLowerCase()))

  function toggleMore(label) {
    setSelectedMore(current => current.includes(label)
      ? current.filter(l => l !== label)
      : [...current, label])
  }

  return (
    <>
      <div className="kpi-grid">
        {primaryKpis.map(k => <StatTile key={k.label} label={k.label} value={k.value} trend={k.trend} />)}
        {visibleMoreKpis.map(k => <StatTile key={k.label} label={k.label} value={k.value} />)}
      </div>

      {moreMenuOpen && (
        <Modal size="sm" onClose={() => setMoreMenuOpen(false)} title="Add Metric">
          <div>
            <input
              type="text"
              autoFocus
              placeholder="Search metrics..."
              value={metricSearch}
              onChange={(e) => setMetricSearch(e.target.value)}
              style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.82rem', marginBottom: '0.4rem' }}
            />
            <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
              {moreKpis.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', padding: '0.4rem 0.3rem', margin: 0 }}>
                  No more metrics available for this data yet.
                </p>
              ) : filteredMoreKpis.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', padding: '0.4rem 0.3rem', margin: 0 }}>
                  No metrics match "{metricSearch}".
                </p>
              ) : filteredMoreKpis.map(k => (
                <label key={k.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedMore.includes(k.label)}
                    onChange={() => toggleMore(k.label)}
                  />
                  {k.label}
                </label>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// "Key highlights" is deliberately narrow: what sold (revenue items) and who
// sold it (staff / salesperson / rep). Category fields like payment method,
// gender, channel, etc. don't belong in this briefing.
function isSalespersonField(label = '') {
  return /\b(staff|sales\s?person|salesperson|sales\s?rep|sales\s?agent|rep|representative|cashier|agent|attendant|server|waiter|waitress|employee|seller|clerk|consultant|team\s?member)\b|sold\s?by|served\s?by|handled\s?by/i.test(label)
}

function computeInsights(form, submissions) {
  const insights = []
  // Dynamic on purpose: aggregates across every cart field on the form, not
  // just the first one, a form can use the cart feature more than once.
  const cartFields = form.fields.filter(f => f.type === 'cart')
  const categoryFields = form.fields
    .filter(f => CATEGORICAL_TYPES.includes(f.type))
    .filter(f => isSalespersonField(f.label))

  if (cartFields.length > 0) {
    const itemQty = {}
    const itemRevenue = {}
    const revenueByField = {} // fieldId -> { value -> revenue }
    let totalRevenue = 0
    let hasCartData = false

    cartFields.forEach(cartField => {
      submissions.forEach(s => {
        const v = s.data[cartField.id]
        if (!v || !v.items || v.items.length === 0) return
        hasCartData = true
        const grandTotal = v.total + (v.deliveryFee || 0)
        totalRevenue += grandTotal
        v.items.forEach(item => {
          itemQty[item.name] = (itemQty[item.name] || 0) + item.quantity
          itemRevenue[item.name] = (itemRevenue[item.name] || 0) + item.price * item.quantity
        })

        categoryFields.forEach(field => {
          const val = s.data[field.id]
          if (val === undefined || val === null || val === '') return
          const vals = Array.isArray(val) ? val : [val]
          revenueByField[field.id] = revenueByField[field.id] || {}
          vals.forEach(vv => {
            revenueByField[field.id][vv] = (revenueByField[field.id][vv] || 0) + grandTotal
          })
        })
      })
    })

    if (hasCartData) {
      const topQty = Object.entries(itemQty).sort((a, b) => b[1] - a[1])[0]
      const topRev = Object.entries(itemRevenue).sort((a, b) => b[1] - a[1])[0]
      if (topQty) insights.push(`${topQty[0]} is your best-selling product, with ${topQty[1]} units sold.`)
      if (topRev) {
        const percent = totalRevenue > 0 ? Math.round((topRev[1] / totalRevenue) * 100) : 0
        insights.push(`${topRev[0]} generated the highest revenue (${formatNaira(topRev[1])}, ${percent}% of total).`)
      }

      // Revenue-weighted breakdown per category field (e.g. sales channel, rep,
      // gender), this is the number that actually matters to a business
      // owner, versus a plain count of responses.
      categoryFields.forEach(field => {
        const map = revenueByField[field.id]
        if (!map) return
        const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0]
        if (top && totalRevenue > 0) {
          const percent = Math.round((top[1] / totalRevenue) * 100)
          insights.push(`${top[0]} contributed ${percent}% of revenue by ${field.label.toLowerCase()}.`)
        }
      })
    }
  } else {
    // No cart data: fall back to plain response-count share per category field.
    categoryFields.forEach(field => {
      const answered = submissions.filter(s => s.data[field.id])
      if (answered.length === 0) return
      const countMap = {}
      answered.forEach(s => {
        const v = s.data[field.id]
        const vals = Array.isArray(v) ? v : [v]
        vals.forEach(val => { countMap[val] = (countMap[val] || 0) + 1 })
      })
      const top = Object.entries(countMap).sort((a, b) => b[1] - a[1])[0]
      if (top) {
        const percent = Math.round((top[1] / answered.length) * 100)
        insights.push(`${top[0]} is the most common ${field.label.toLowerCase()}, at ${percent}% of responses.`)
      }
    })
  }

  if (insights.length === 0) {
    insights.push('Collect a few more responses to start seeing insights here.')
  }

  return insights
}

export default Report
