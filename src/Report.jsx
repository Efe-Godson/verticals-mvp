// Place at: src/Report.jsx
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { printReport, exportReportToPDF, exportReportToPPTX } from './reportExport'

import StatTile from './report/components/StatTile'
import CartReport from './report/analysis/Cartreport'
import CategoryReport from './report/analysis/Categoryreport'
import CartCategoryChart from './report/analysis/components/CartCategoryChart'
import DetailedAnalysis from './report/DetailedAnalysis'
import CrossAnalysis from './report/analysis/CrossAnalysis'
import AIInsightCards from './report/ai/AIInsightCards'
import { formatNaira } from './report/helpers/analysisUtils'

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

function formatDelta(value) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value}`
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

function Report() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dateRange, setDateRange] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [comparePrevious, setComparePrevious] = useState(true)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({
    overview: false,
    performance: false,
    ai: false,
    breakdowns: false,
    details: false,
  })
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
  const previousFilteredSubmissions = submissions.filter(s => {
    const created = new Date(s.created_at)
    if (previousRange.start && created < previousRange.start) return false
    if (previousRange.end && created > previousRange.end) return false
    return true
  })

  const totalResponses = filteredSubmissions.length
  const dateRangeLabel = getDateRangeLabel(dateRange, customStart, customEnd)

  const cartFields = form.fields.filter(f => f.type === 'cart')
  const categoryFields = form.fields.filter(f => CATEGORICAL_TYPES.includes(f.type))
  const demographicFields = form.fields.filter(f => DEMOGRAPHIC_TYPES.includes(f.type))
  const detailFields = form.fields.filter(f =>
    f.type !== 'cart' &&
    !CATEGORICAL_TYPES.includes(f.type) &&
    !DEMOGRAPHIC_TYPES.includes(f.type)
  )

  const crossAnalysisFields = form.fields.filter(f =>
    CATEGORICAL_TYPES.includes(f.type) || NUMERIC_TYPES.includes(f.type)
  )

  const salesByCategoryPairs = []
  cartFields.forEach(cartField => {
    categoryFields.forEach(catField => {
      salesByCategoryPairs.push({ cartField, catField, priority: isPriorityCategoryField(catField) })
    })
  })
  salesByCategoryPairs.sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0))

  function buildFilterSummary() {
    return dateRange === 'all' ? '' : dateRangeLabel
  }

  function toggleSection(section) {
    setCollapsedSections(current => ({ ...current, [section]: !current[section] }))
  }

  function handlePrint() {
    printReport(form, filteredSubmissions, buildFilterSummary())
  }

  function handleDownloadPDF() {
    setDownloadMenuOpen(false)
    setTimeout(() => {
      const safeName = form.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'report'
      exportReportToPDF(reportContentRef.current, safeName)
    }, 50)
  }

  function handleDownloadPPTX() {
    exportReportToPPTX(form, filteredSubmissions, buildFilterSummary())
    setDownloadMenuOpen(false)
  }

  return (
    <div className="page" style={{ maxWidth: '960px' }} ref={reportContentRef}>
      <style>{`
        .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
        .report-section-nav { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0 1.2rem; }
        .report-section-nav a {
          text-decoration: none; color: var(--color-muted); font-size: 0.84rem; font-weight: 600;
          padding: 0.45rem 0.7rem; border-radius: 999px; border: 1px solid var(--color-border);
          background: #fff; transition: all 0.15s ease;
        }
        .report-section-nav a:hover { color: var(--color-primary); border-color: var(--color-primary); }
        @media (min-width: 500px) {
          .kpi-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        }
        @media (max-width: 640px) {
          .report-filter-bar {
            position: sticky; top: 0.5rem; z-index: 30; background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px); border: 1px solid var(--color-border); border-radius: var(--radius);
            padding: 0.85rem; margin-bottom: 1rem;
          }
          .report-section-nav a { flex: 1 1 calc(50% - 0.25rem); justify-content: center; text-align: center; }
        }
      `}</style>

      <header className="report-header" data-html2canvas-ignore="true">
        <div>
          <div className="report-eyebrow">{form.name}</div>
          <h1 className="report-title">Reports</h1>
          <p className="report-subtitle">{totalResponses.toLocaleString()} response{totalResponses !== 1 ? 's' : ''} · {dateRangeLabel}</p>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.86rem', color: 'var(--color-muted)' }}>
            <input type="checkbox" checked={comparePrevious} onChange={(e) => setComparePrevious(e.target.checked)} />
            Compare previous period
          </label>
          <button className="secondary" onClick={handlePrint}>Print</button>
          <div style={{ position: 'relative' }}>
            <button className="secondary" onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}>
              Download ▾
            </button>
            {downloadMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 15 }}
                  onClick={() => setDownloadMenuOpen(false)}
                />
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
                  background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '170px', overflow: 'hidden'
                }}>
                  <button
                    className="secondary"
                    onClick={handleDownloadPDF}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.6rem 0.9rem', borderRadius: 0 }}
                  >
                    Download PDF
                  </button>
                  <button
                    className="secondary"
                    onClick={handleDownloadPPTX}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.6rem 0.9rem', borderRadius: 0 }}
                  >
                    Download PowerPoint
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ExecutiveSummaryCard
        form={form}
        submissions={filteredSubmissions}
        previousSubmissions={previousFilteredSubmissions}
        dateRangeLabel={dateRangeLabel}
        comparePrevious={comparePrevious}
      />
      <HeroSection
        form={form}
        submissions={filteredSubmissions}
        previousSubmissions={previousFilteredSubmissions}
        dateRangeLabel={dateRangeLabel}
        comparePrevious={comparePrevious}
      />
      <nav className="report-section-nav" data-html2canvas-ignore="true" aria-label="Report sections">
        <a href="#report-overview">Overview</a>
        <a href="#report-performance">Performance</a>
        <a href="#report-ai">AI recommendations</a>
        <a href="#report-breakdowns">Breakdowns</a>
        <a href="#report-details">Details</a>
      </nav>

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
          <SectionHeader id="report-overview" collapsed={collapsedSections.overview} onToggle={() => toggleSection('overview')} subtitle="The strongest signals from this view">Highlights from your data</SectionHeader>
          {!collapsedSections.overview && <InsightsPanel form={form} submissions={filteredSubmissions} />}

          <SectionHeader id="report-performance" collapsed={collapsedSections.performance} onToggle={() => toggleSection('performance')} subtitle="Key measures and completion quality">Performance</SectionHeader>
          {!collapsedSections.performance && <KPIGrid form={form} submissions={filteredSubmissions} totalResponses={totalResponses} />}

          <SectionHeader id="report-ai" collapsed={collapsedSections.ai} onToggle={() => toggleSection('ai')} subtitle="A practical view of what changed and what to do next">AI recommendations</SectionHeader>
          {!collapsedSections.ai && (
            <AIInsightCards
              formId={form.id}
              dateRangeLabel={dateRangeLabel}
              submissionIds={filteredSubmissions.map(s => s.id)}
            />
          )}

          {cartFields.length > 0 && (
            <>
              <SectionHeader id="report-breakdowns" collapsed={collapsedSections.breakdowns} onToggle={() => toggleSection('breakdowns')} subtitle="Where demand is strongest and where attention is needed">Catalogue</SectionHeader>
              {!collapsedSections.breakdowns && cartFields.map(field => {
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
            </>
          )}

          {salesByCategoryPairs.length > 0 && (
            <>
              <SectionHeader collapsed={collapsedSections.breakdowns} onToggle={() => toggleSection('breakdowns')} subtitle="Category patterns that are driving revenue">Sales by Category</SectionHeader>
              {!collapsedSections.breakdowns && salesByCategoryPairs.map(({ cartField, catField }) => (
                <div key={`${catField.id}-${cartField.id}`} className="card" style={{ padding: '1.75rem', marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.9rem' }}>
                    Sales by {catField.label}
                  </div>
                  <CartCategoryChart categoryField={catField} cartField={cartField} submissions={filteredSubmissions} />
                </div>
              ))}
            </>
          )}

          {categoryFields.length > 0 && (
            <>
              <SectionHeader collapsed={collapsedSections.breakdowns} onToggle={() => toggleSection('breakdowns')} subtitle="How responses are distributed across your categories">Category Breakdowns</SectionHeader>
              {!collapsedSections.breakdowns && categoryFields.map(field => {
                const answered = filteredSubmissions.filter(s => {
                  const v = s.data[field.id]
                  if (field.type === 'checkbox') return Array.isArray(v) && v.length > 0
                  return v !== undefined && v !== null && v.toString().trim() !== ''
                })
                return (
                  <div key={field.id} className="card" style={{ padding: '1.75rem', marginBottom: '1.2rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '0.3rem' }}>{field.label}</h3>
                    <CategoryReport field={field} answered={answered} totalResponses={totalResponses} multi={field.type === 'checkbox'} />
                  </div>
                )
              })}
            </>
          )}

          <SectionHeader id="report-details" collapsed={collapsedSections.details} onToggle={() => toggleSection('details')} subtitle="Field-level detail for deeper follow-up">Detailed analysis</SectionHeader>
          {!collapsedSections.details && (
            <>
              <CrossAnalysis fields={crossAnalysisFields} submissions={filteredSubmissions} />

              {detailFields.length > 0 && (
                <div id="report-details">
                  <DetailedAnalysis
                    fields={detailFields}
                    submissions={filteredSubmissions}
                    totalResponses={totalResponses}
                  />
                </div>
              )}

              {demographicFields.length > 0 && (
                <DetailedAnalysis
                  fields={demographicFields}
                  submissions={filteredSubmissions}
                  totalResponses={totalResponses}
                  title="Demographics"
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function SectionHeader({ children, id, collapsed, onToggle, subtitle }) {
  return (
    <div id={id} style={{
      marginTop: '2.4rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.7rem'
    }}>
      <div>
        <h3 style={{
          margin: 0, fontSize: '0.8rem', color: 'var(--color-muted)',
          textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700
        }}>
          {children}
        </h3>
        {subtitle && (
          <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: 'var(--color-muted)', lineHeight: 1.4 }}>
            {subtitle}
          </div>
        )}
      </div>
      {onToggle && (
        <button className="secondary" onClick={onToggle} style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      )}
    </div>
  )
}

function ExecutiveSummaryCard({ form, submissions, previousSubmissions, dateRangeLabel, comparePrevious }) {
  const cartFields = form.fields.filter(f => f.type === 'cart')
  let totalRevenue = 0
  let previousRevenue = 0
  let totalOrders = 0
  let previousOrders = 0
  let hasCartData = false

  cartFields.forEach(field => {
    submissions.forEach(s => {
      const v = s.data[field.id]
      if (v && v.items && v.items.length > 0) {
        hasCartData = true
        totalRevenue += v.total
        totalOrders += 1
      }
    })

    previousSubmissions.forEach(s => {
      const v = s.data[field.id]
      if (v && v.items && v.items.length > 0) {
        previousRevenue += v.total
        previousOrders += 1
      }
    })
  })

  const totalResponses = submissions.length
  const previousResponses = previousSubmissions.length
  const responseDelta = totalResponses - previousResponses
  const responseDeltaPercent = previousResponses > 0 ? Math.round((responseDelta / previousResponses) * 100) : null
  const revenueDelta = totalRevenue - previousRevenue
  const insights = computeInsights(form, submissions)
  const topInsight = insights[0] || 'Collect a few more responses to start seeing stronger patterns.'
  const comparisonText = comparePrevious && previousResponses > 0
    ? `${responseDelta >= 0 ? '+' : ''}${responseDelta} responses (${responseDeltaPercent >= 0 ? '+' : ''}${responseDeltaPercent}%) vs previous period`
    : comparePrevious
      ? 'No previous period to compare against yet'
      : 'Comparison is currently paused'

  return (
    <div className="card" style={{ padding: '1.2rem 1.25rem', marginBottom: '1rem', background: 'linear-gradient(135deg, #f8fbff 0%, #f3f7ff 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Executive summary
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          {dateRangeLabel}
        </div>
      </div>
      <div style={{ display: 'grid', gap: '0.8rem', marginTop: '0.75rem' }}>
        <div style={{ fontSize: '1.04rem', fontWeight: 700, lineHeight: 1.45 }}>
          {hasCartData
            ? `Revenue is ${revenueDelta >= 0 ? 'up' : 'down'} ${comparePrevious ? `by ${formatNaira(Math.abs(revenueDelta))}` : ''} in this view, and the strongest signal is: ${topInsight}`
            : `You’ve collected ${totalResponses.toLocaleString()} responses in this view, and the strongest signal is: ${topInsight}`}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.3rem 0.6rem', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
            {hasCartData ? `${formatNaira(totalRevenue)} total revenue` : `${totalResponses.toLocaleString()} responses`}
          </span>
          <span style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.3rem 0.6rem', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
            {hasCartData ? `${totalOrders.toLocaleString()} orders` : 'response volume'}
          </span>
          <span style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.3rem 0.6rem', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
            {comparisonText}
          </span>
        </div>
      </div>
    </div>
  )
}

function HeroSection({ form, submissions, dateRangeLabel, previousSubmissions, comparePrevious }) {
  const cartFields = form.fields.filter(f => f.type === 'cart')
  let totalRevenue = 0
  let previousRevenue = 0
  let totalOrders = 0
  let previousOrders = 0
  let hasCartData = false

  cartFields.forEach(field => {
    submissions.forEach(s => {
      const v = s.data[field.id]
      if (v && v.items && v.items.length > 0) {
        hasCartData = true
        totalRevenue += v.total
        totalOrders += 1
      }
    })

    previousSubmissions.forEach(s => {
      const v = s.data[field.id]
      if (v && v.items && v.items.length > 0) {
        previousRevenue += v.total
        previousOrders += 1
      }
    })
  })

  const totalResponses = submissions.length
  const previousResponses = previousSubmissions.length
  const responseDelta = totalResponses - previousResponses
  const responseDeltaPercent = previousResponses > 0 ? Math.round((responseDelta / previousResponses) * 100) : null
  const revenueDelta = totalRevenue - previousRevenue
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const completionRate = getCompletionRate(form, submissions)

  const responseDeltaText = comparePrevious && previousResponses > 0
    ? `${responseDelta >= 0 ? '+' : ''}${responseDelta} (${responseDeltaPercent >= 0 ? '+' : ''}${responseDeltaPercent}%)`
    : comparePrevious
      ? 'No prior period'
      : 'Comparison disabled'

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.2rem', background: 'linear-gradient(135deg, #fbfdff 0%, #f5f8ff 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            {form.name}
          </div>
          <div style={{ fontSize: '0.95rem', color: 'var(--color-muted)', marginBottom: '0.8rem' }}>
            {dateRangeLabel}
          </div>
          {hasCartData ? (
            <div style={{ fontSize: '1.15rem', color: '#000', lineHeight: 1.5 }}>
              Your business generated{' '}
              <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                {formatNaira(totalRevenue)}
              </span>{' '}
              for this period.
            </div>
          ) : (
            <div style={{ fontSize: '1.15rem', color: '#000', lineHeight: 1.5 }}>
              You received{' '}
              <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                {totalResponses.toLocaleString()}
              </span>{' '}
              response{totalResponses !== 1 ? 's' : ''} in this range.
            </div>
          )}
        </div>

        <div style={{ minWidth: '220px', display: 'grid', gap: '0.6rem' }}>
          <div className="card" style={{ padding: '0.8rem 0.95rem', background: 'white' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Responses</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{totalResponses.toLocaleString()}</div>
            <div style={{ fontSize: '0.8rem', color: comparePrevious && responseDelta >= 0 ? '#1f9d5b' : comparePrevious ? '#c0392b' : 'var(--color-muted)' }}>{responseDeltaText}</div>
          </div>
          {hasCartData && (
            <div className="card" style={{ padding: '0.8rem 0.95rem', background: 'white' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revenue trend</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{formatNaira(totalRevenue)}</div>
              <div style={{ fontSize: '0.8rem', color: comparePrevious && revenueDelta >= 0 ? '#1f9d5b' : comparePrevious ? '#c0392b' : 'var(--color-muted)' }}>
                {comparePrevious ? `${revenueDelta >= 0 ? '+' : ''}${formatNaira(revenueDelta)} vs previous period` : 'Comparison disabled'}
              </div>
            </div>
          )}
          <div className="card" style={{ padding: '0.8rem 0.95rem', background: 'white' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completion</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{completionRate}%</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{hasCartData ? `${formatNaira(avgOrderValue)} avg. order` : 'Completion rate across form fields'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KPIGrid({ form, submissions, totalResponses }) {
  const cartFields = form.fields.filter(f => f.type === 'cart')
  const numericField = form.fields.find(f => NUMERIC_TYPES.includes(f.type))
  const kpis = []

  if (cartFields.length > 0) {
    let totalRevenue = 0
    let totalOrders = 0
    cartFields.forEach(field => {
      submissions.forEach(s => {
        const v = s.data[field.id]
        if (v && v.items && v.items.length > 0) {
          totalRevenue += v.total
          totalOrders += 1
        }
      })
    })
    kpis.push({ label: 'Revenue', value: formatNaira(totalRevenue) })
    kpis.push({ label: 'Orders', value: totalOrders.toLocaleString() })
    kpis.push({
      label: 'Average Order Value',
      value: totalOrders > 0 ? formatNaira(totalRevenue / totalOrders) : formatNaira(0)
    })
  }

  kpis.push({ label: 'Total Responses', value: totalResponses.toLocaleString() })

  const completionRate = getCompletionRate(form, submissions)
  if (completionRate > 0) {
    kpis.push({ label: 'Avg. Completion', value: `${completionRate}%` })
  }

  if (numericField) {
    const values = submissions.map(s => Number(s.data[numericField.id])).filter(v => !isNaN(v))
    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      kpis.push({ label: `Average ${numericField.label}`, value: Math.round(avg).toLocaleString() })
    }
  }

  return (
    <div className="kpi-grid">
      {kpis.map(k => <StatTile key={k.label} label={k.label} value={k.value} />)}
    </div>
  )
}

function computeInsights(form, submissions) {
  const insights = []

  const cartField = form.fields.find(f => f.type === 'cart')
  if (cartField) {
    const answered = submissions.filter(s => {
      const v = s.data[cartField.id]
      return v && v.items && v.items.length > 0
    })
    if (answered.length > 0) {
      const itemQty = {}
      const itemRevenue = {}
      answered.forEach(s => {
        s.data[cartField.id].items.forEach(item => {
          itemQty[item.name] = (itemQty[item.name] || 0) + item.quantity
          itemRevenue[item.name] = (itemRevenue[item.name] || 0) + item.price * item.quantity
        })
      })
      const topQty = Object.entries(itemQty).sort((a, b) => b[1] - a[1])[0]
      const topRev = Object.entries(itemRevenue).sort((a, b) => b[1] - a[1])[0]
      if (topQty) insights.push(`${topQty[0]} is your best-selling product, with ${topQty[1]} units sold.`)
      if (topRev) insights.push(`${topRev[0]} generates the most revenue, at ${formatNaira(topRev[1])}.`)
    }
  }

  const categoryField = form.fields.find(f => f.type === 'dropdown' || f.type === 'multiplechoice')
  if (categoryField) {
    const answered = submissions.filter(s => s.data[categoryField.id])
    if (answered.length > 0) {
      const countMap = {}
      answered.forEach(s => {
        const v = s.data[categoryField.id]
        countMap[v] = (countMap[v] || 0) + 1
      })
      const top = Object.entries(countMap).sort((a, b) => b[1] - a[1])[0]
      if (top) {
        const percent = Math.round((top[1] / answered.length) * 100)
        insights.push(`${top[0]} is the most common ${categoryField.label.toLowerCase()}, at ${percent}% of responses.`)
      }
    }
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

function InsightsPanel({ form, submissions }) {
  const insights = computeInsights(form, submissions)
  return (
    <div className="card" style={{ padding: '1.75rem', marginBottom: '1.2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700 }}>What stands out right now</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Updated from the current filter</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {insights.map((text, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', background: '#f8f9fc', border: '1px solid #eef2f7', borderRadius: '0.7rem', padding: '0.8rem 0.95rem' }}>
            <span style={{ color: 'var(--color-primary)', fontSize: '1rem', lineHeight: 1.4, fontWeight: 700 }}>•</span>
            <span style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Report
