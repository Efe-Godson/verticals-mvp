// Place at: src/Report.jsx
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { printReport, exportReportToPDF, exportReportToPPTX } from './reportExport'

import StatTile from './report/components/StatTile'
import CartReport from './report/analysis/Cartreport'
import CartCategoryChart from './report/analysis/components/CartCategoryChart'
import DetailedAnalysis from './report/DetailedAnalysis'
import CrossAnalysis from './report/analysis/CrossAnalysis'
import AIRecommendationsModal from './report/ai/AIRecommendationsModal'
import { formatNaira, median } from './report/helpers/analysisUtils'

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '3months', label: 'Last 3 months' },
  { value: '6months', label: 'Last 6 months' },
  { value: '12months', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
]

function getDateRangeBounds(range, customStart, customEnd) {
  if (range === 'all') return { start: null, end: null }

  const now = new Date()
  let start = null

  if (range === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (range === '7days') {
    start = new Date(now); start.setDate(start.getDate() - 7)
  } else if (range === '30days') {
    start = new Date(now); start.setDate(start.getDate() - 30)
  } else if (range === '3months') {
    start = new Date(now); start.setMonth(start.getMonth() - 3)
  } else if (range === '6months') {
    start = new Date(now); start.setMonth(start.getMonth() - 6)
  } else if (range === '12months') {
    start = new Date(now); start.setFullYear(start.getFullYear() - 1)
  } else if (range === 'custom') {
    return {
      start: customStart ? new Date(customStart) : null,
      end: customEnd ? new Date(customEnd + 'T23:59:59') : null
    }
  }

  return { start, end: null }
}

function getDateRangeLabel(dateRange, customStart, customEnd) {
  if (dateRange === 'all') return 'All time'
  if (dateRange === 'custom') return `${customStart || '…'} to ${customEnd || '…'}`
  return DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || ''
}

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
  const nonCartFields = form.fields.filter(f => f.type !== 'cart')
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

const CATEGORICAL_TYPES = ['dropdown', 'multiplechoice', 'checkbox']
const NUMERIC_TYPES = ['number', 'rating', 'linearscale']
const DEMOGRAPHIC_TYPES = ['email', 'phone']

// Fields whose values are worth breaking cart revenue down by first —
// e.g. "Sales Rep", "Salesperson", or a "Name" field — before the rest.
function isPriorityCategoryField(field) {
  const label = (field.label || '').toLowerCase()
  return /\bname\b/.test(label) ||
    /sales\s*-?\s*rep/.test(label) ||
    /sales\s*-?\s*person/.test(label) ||
    /salesperson/.test(label) ||
    /\bemployee\b/.test(label) ||
    /\bstaff\b/.test(label)
}

// Fields that represent how a sale reached the customer — surfaced in their
// own "Sales Channel" section rather than lumped in with generic breakdowns.
function isChannelField(field) {
  const label = (field.label || '').toLowerCase()
  return /channel/.test(label) || /\bplatform\b/.test(label) || /\bsource\b/.test(label)
}

function Report() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dateRange, setDateRange] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const reportContentRef = useRef(null)

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

      const { data: subsData, error: subsError } = await supabase
        .from('submissions').select('*').eq('form_id', id)
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
  }, [id])

  if (loading) return <div className="page">Loading report...</div>
  if (error) return <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: 'red' }}>{error}</div>

  if (submissions.length === 0) {
    return (
      <div className="page">
        <h1>{form.name} — Report</h1>
        <p style={{ color: '#999', marginTop: '2rem' }}>
          No data yet. Once people submit this form, a report will appear here.
        </p>
      </div>
    )
  }

  const { start: rangeStart, end: rangeEnd } = getDateRangeBounds(dateRange, customStart, customEnd)
  const filteredSubmissions = submissions.filter(s => {
    const created = new Date(s.created_at)
    if (rangeStart && created < rangeStart) return false
    if (rangeEnd && created > rangeEnd) return false
    return true
  })

  const previousRange = getPreviousDateRangeBounds(dateRange, customStart, customEnd)
  const previousFilteredSubmissions = previousRange.start ? submissions.filter(s => {
    const created = new Date(s.created_at)
    if (previousRange.start && created < previousRange.start) return false
    if (previousRange.end && created > previousRange.end) return false
    return true
  }) : []

  const totalResponses = filteredSubmissions.length
  const dateRangeLabel = getDateRangeLabel(dateRange, customStart, customEnd)

  const cartFields = form.fields.filter(f => f.type === 'cart')
  const categoryFields = form.fields.filter(f => CATEGORICAL_TYPES.includes(f.type))
  const demographicFields = form.fields.filter(f => DEMOGRAPHIC_TYPES.includes(f.type))

  const crossAnalysisFields = form.fields.filter(f =>
    CATEGORICAL_TYPES.includes(f.type) || NUMERIC_TYPES.includes(f.type)
  )

  const salesByCategoryPairs = []
  cartFields.forEach(cartField => {
    categoryFields.forEach(catField => {
      salesByCategoryPairs.push({ cartField, catField, priority: isPriorityCategoryField(catField) })
    })
  })
  // "Operations" pairs (sales rep / staff / name) surface separately from
  // "Products" pairs (channel, other category breakdowns) — see isPriorityCategoryField.
  const nonOperationsPairs = salesByCategoryPairs.filter(p => !p.priority)
  const channelCategoryPairs = nonOperationsPairs.filter(p => isChannelField(p.catField))
  const otherCategoryPairs = nonOperationsPairs.filter(p => !isChannelField(p.catField))
  const operationsCategoryPairs = salesByCategoryPairs.filter(p => p.priority)

  function buildFilterSummary() {
    return dateRange === 'all' ? '' : dateRangeLabel
  }

  function handlePrint() {
    printReport(form, filteredSubmissions, buildFilterSummary())
  }

  function handleDownloadPDF() {
    setTimeout(() => {
      const safeName = form.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'report'
      exportReportToPDF(reportContentRef.current, safeName)
    }, 50)
  }

  function handleDownloadPPTX() {
    exportReportToPPTX(form, filteredSubmissions, buildFilterSummary())
  }

  return (
    <div className="page" style={{ maxWidth: '960px' }} ref={reportContentRef}>
      <style>{`
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
          <select id="report-date-range" value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: '0.5rem' }}>
            {DATE_RANGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {dateRange === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: '0.5rem' }} />
              <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ padding: '0.5rem' }} />
            </>
          )}
        </div>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button className="secondary" onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}>
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
                background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '220px', padding: '0.6rem',
                overflow: 'hidden'
              }}>
                <button
                  className="secondary"
                  onClick={() => { handlePrint(); setOptionsMenuOpen(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.45rem 0.3rem', fontSize: '0.85rem' }}
                >
                  Print
                </button>
                <button
                  className="secondary"
                  onClick={() => { setShowAIPanel(true); setOptionsMenuOpen(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.45rem 0.3rem', fontSize: '0.85rem' }}
                >
                  AI recommendations
                </button>

                <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.3rem 0' }} />

                <button
                  className="secondary"
                  onClick={() => { handleDownloadPDF(); setOptionsMenuOpen(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.45rem 0.3rem', fontSize: '0.85rem' }}
                >
                  Download PDF
                </button>
                <button
                  className="secondary"
                  onClick={() => { handleDownloadPPTX(); setOptionsMenuOpen(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.45rem 0.3rem', fontSize: '0.85rem' }}
                >
                  Download PowerPoint
                </button>
              </div>
            </>
          )}
        </div>
      </div>

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
          <div id="report-overview">
            <OverviewCard form={form} submissions={filteredSubmissions} />
          </div>

          <div id="report-performance" style={{ marginTop: '2rem' }}>
            <SectionTitle subtitle="Key measures for this view, compared to the previous period">Performance</SectionTitle>
            <KPIGrid
              form={form}
              submissions={filteredSubmissions}
              previousSubmissions={previousFilteredSubmissions}
              totalResponses={totalResponses}
            />
          </div>

          {cartFields.length > 0 && (
            <div id="report-product-distribution" style={{ marginTop: '2rem' }}>
              <SectionTitle subtitle="What's selling, by units and by revenue">Product Distribution</SectionTitle>
              {cartFields.map(field => {
                const answered = filteredSubmissions.filter(s => {
                  const v = s.data[field.id]
                  return v && v.items && v.items.length > 0
                })
                return (
                  <div key={field.id} className="card" style={{ padding: '1.75rem', marginBottom: '1.2rem' }}>
                    <CartReport field={field} answered={answered} showStats={false} />
                  </div>
                )
              })}
            </div>
          )}

          {channelCategoryPairs.length > 0 && (
            <div id="report-sales-channel" style={{ marginTop: '2rem' }}>
              <SectionTitle subtitle="Where your sales are coming from">Sales Channel</SectionTitle>
              {channelCategoryPairs.map(({ cartField, catField }) => (
                <div key={`${catField.id}-${cartField.id}`} className="card" style={{ padding: '1.75rem', marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.9rem' }}>
                    Sales by {catField.label}
                  </div>
                  <CartCategoryChart categoryField={catField} cartField={cartField} submissions={filteredSubmissions} />
                </div>
              ))}
            </div>
          )}

          {operationsCategoryPairs.length > 0 && (
            <div id="report-operations" style={{ marginTop: '2rem' }}>
              <SectionTitle subtitle="How your team is performing">Operations</SectionTitle>
              {operationsCategoryPairs.map(({ cartField, catField }) => (
                <div key={`${catField.id}-${cartField.id}`} className="card" style={{ padding: '1.75rem', marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.9rem' }}>
                    Sales by {catField.label}
                  </div>
                  <CartCategoryChart categoryField={catField} cartField={cartField} submissions={filteredSubmissions} />
                </div>
              ))}
            </div>
          )}

          {otherCategoryPairs.length > 0 && (
            <div id="report-other-data" style={{ marginTop: '2rem' }}>
              <SectionTitle subtitle="Other patterns in the data — e.g. gender, state of origin">Other Data</SectionTitle>
              {otherCategoryPairs.map(({ cartField, catField }) => (
                <div key={`${catField.id}-${cartField.id}`} className="card" style={{ padding: '1.75rem', marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.9rem' }}>
                    Sales by {catField.label}
                  </div>
                  <CartCategoryChart categoryField={catField} cartField={cartField} submissions={filteredSubmissions} />
                </div>
              ))}
            </div>
          )}

          {demographicFields.length > 0 && (
            <div id="report-customers" style={{ marginTop: '2rem' }}>
              <SectionTitle subtitle="Who you're hearing from">Customers</SectionTitle>
              <DetailedAnalysis
                fields={demographicFields}
                submissions={filteredSubmissions}
                totalResponses={totalResponses}
                title="Demographics"
              />
            </div>
          )}

          <div id="report-cross-analysis" style={{ marginTop: '2rem' }}>
            <SectionTitle subtitle="Compare any two columns freely — including cart totals or item counts">Cross Analysis</SectionTitle>
            <CrossAnalysis fields={crossAnalysisFields} cartFields={cartFields} submissions={filteredSubmissions} />
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
    </div>
  )
}

function SectionTitle({ children, subtitle }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h2 style={{
        margin: 0, fontSize: '0.8rem', color: 'var(--color-muted)',
        textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700
      }}>
        {children}
      </h2>
      {subtitle && (
        <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: 'var(--color-muted)', lineHeight: 1.4 }}>
          {subtitle}
        </div>
      )}
    </div>
  )
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
        totalRevenue += v.total
      }
    })
  })

  const totalResponses = submissions.length
  // Keep this concise — a briefing, not a list of everything the data could say.
  const insights = computeInsights(form, submissions).slice(0, 6)

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.2rem', background: 'linear-gradient(135deg, #fbfdff 0%, #f5f8ff 100%)' }}>
      {hasCartData ? (
        <div style={{ fontSize: '1.15rem', color: '#000', lineHeight: 1.5 }}>
          Your business generated{' '}
          <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
            {formatNaira(totalRevenue)}
          </span>{' '}
          during this period.
        </div>
      ) : (
        <div style={{ fontSize: '1.15rem', color: '#000', lineHeight: 1.5 }}>
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
        totalRevenue += v.total
        totalOrders += 1
        orderTotals.push(v.total)
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

function KPIGrid({ form, submissions, previousSubmissions = [], totalResponses }) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
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
  // never gets crowded — add new KPI computations here as the report grows,
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

  primaryKpis.push({
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
    <div className="kpi-grid">
      {primaryKpis.map(k => <StatTile key={k.label} label={k.label} value={k.value} trend={k.trend} />)}
      {visibleMoreKpis.map(k => <StatTile key={k.label} label={k.label} value={k.value} />)}

      {moreKpis.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            aria-label="Add metric"
            className="kpi-add-tile"
            style={{
              width: '100%', minWidth: '150px', minHeight: '68px', padding: '1rem 1.25rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
              background: 'transparent', border: '1.5px dashed var(--color-border)', borderRadius: 'var(--radius)',
              color: 'var(--color-muted)', cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '1.1rem', lineHeight: 1, fontWeight: 700 }}>+</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Add metric</span>
          </button>

          {moreMenuOpen && (
            <>
              <div
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 15 }}
                onClick={() => setMoreMenuOpen(false)}
              />
              <div className="dropdown-panel" style={{
                position: 'absolute', top: '100%', left: 0, marginTop: '0.3rem',
                background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                boxShadow: '0 8px 24px rgba(15,23,42,0.14)', zIndex: 20, minWidth: '240px', maxWidth: '280px',
                padding: '0.5rem'
              }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Search metrics..."
                  value={metricSearch}
                  onChange={(e) => setMetricSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.82rem', marginBottom: '0.4rem' }}
                />
                <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  {filteredMoreKpis.length === 0 ? (
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
            </>
          )}
        </div>
      )}
    </div>
  )
}

function computeInsights(form, submissions) {
  const insights = []
  // Dynamic on purpose: aggregates across every cart field on the form, not
  // just the first one — a form can use the cart feature more than once.
  const cartFields = form.fields.filter(f => f.type === 'cart')
  const categoryFields = form.fields.filter(f => CATEGORICAL_TYPES.includes(f.type))

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
        totalRevenue += v.total
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
            revenueByField[field.id][vv] = (revenueByField[field.id][vv] || 0) + v.total
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
      // gender) — this is the number that actually matters to a business
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
    // No cart data — fall back to plain response-count share per category field.
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

  const dateField = form.fields.find(f => f.type === 'date')
  if (dateField) {
    const answered = submissions.filter(s => s.data[dateField.id])
    if (answered.length > 0) {
      const dayCounts = {}
      answered.forEach(s => {
        const d = new Date(s.data[dateField.id])
        if (isNaN(d)) return
        const dn = d.toLocaleDateString('en-GB', { weekday: 'long' })
        dayCounts[dn] = (dayCounts[dn] || 0) + 1
      })
      const top = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]
      if (top) insights.push(`${top[0]} is your most active day.`)
    }
  }

  if (insights.length === 0) {
    insights.push('Collect a few more responses to start seeing insights here.')
  }

  return insights
}

export default Report
