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
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
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
      <HeroSection form={form} submissions={filteredSubmissions} dateRangeLabel={dateRangeLabel} />

      <div data-html2canvas-ignore="true" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
        gap: '0.8rem', padding: '1rem 0', borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)', marginBottom: '2.2rem'
      }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: '0.5rem' }}>
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

      {filteredSubmissions.length === 0 ? (
        <p style={{ color: '#999', marginTop: '2rem' }}>No responses in this date range.</p>
      ) : (
        <>
          <SectionHeader>Key Insights</SectionHeader>
          <InsightsPanel form={form} submissions={filteredSubmissions} />

          <SectionHeader>Performance</SectionHeader>
          <KPIGrid form={form} submissions={filteredSubmissions} totalResponses={totalResponses} />

          {cartFields.length > 0 && (
            <>
              <SectionHeader>Catalogue</SectionHeader>
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
            </>
          )}

          {salesByCategoryPairs.length > 0 && (
            <>
              <SectionHeader>Sales by Category</SectionHeader>
              {salesByCategoryPairs.map(({ cartField, catField }) => (
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
              <SectionHeader>Category Breakdowns</SectionHeader>
              {categoryFields.map(field => {
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

          <CrossAnalysis fields={crossAnalysisFields} submissions={filteredSubmissions} />

          {detailFields.length > 0 && (
            <DetailedAnalysis
              fields={detailFields}
              submissions={filteredSubmissions}
              totalResponses={totalResponses}
            />
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
    </div>
  )
}

function SectionHeader({ children }) {
  return (
    <h3 style={{
      marginTop: '3rem', marginBottom: '1.1rem', fontSize: '0.8rem',
      color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700
    }}>
      {children}
    </h3>
  )
}

function HeroSection({ form, submissions, dateRangeLabel }) {
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

  return (
    <div style={{ padding: '1.8rem 0 1.6rem' }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
        {form.name}
      </div>
      <div style={{ fontSize: '0.95rem', color: 'var(--color-muted)', marginBottom: '1.3rem' }}>
        {dateRangeLabel}
      </div>

      {hasCartData ? (
        <>
          <div style={{ fontSize: '1.05rem', color: 'var(--color-muted)' }}>Your business generated</div>
          <div style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0.2rem 0' }}>
            {formatNaira(totalRevenue)}
          </div>
          <div style={{ fontSize: '0.95rem', color: 'var(--color-muted)' }}>during the selected period</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '1.05rem', color: 'var(--color-muted)' }}>You received</div>
          <div style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0.2rem 0' }}>
            {totalResponses.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.95rem', color: 'var(--color-muted)' }}>
            response{totalResponses !== 1 ? 's' : ''} during the selected period
          </div>
        </>
      )}
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

  const nonCartFields = form.fields.filter(f => f.type !== 'cart')
  if (nonCartFields.length > 0 && totalResponses > 0) {
    const rates = nonCartFields.map(f => {
      const answered = submissions.filter(s => {
        const v = s.data[f.id]
        if (f.type === 'multiplechoicegrid' || f.type === 'checkboxgrid') return v && typeof v === 'object' && Object.keys(v).length > 0
        if (f.type === 'checkbox') return Array.isArray(v) && v.length > 0
        return v !== undefined && v !== null && v.toString().trim() !== ''
      })
      return (answered.length / totalResponses) * 100
    })
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length
    kpis.push({ label: 'Avg. Completion', value: `${Math.round(avgRate)}%` })
  }

  if (numericField) {
    const values = submissions.map(s => Number(s.data[numericField.id])).filter(v => !isNaN(v))
    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      kpis.push({ label: `Average ${numericField.label}`, value: Math.round(avg).toLocaleString() })
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {insights.map((text, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-primary)', fontSize: '1.05rem', lineHeight: 1.4 }}>→</span>
            <span style={{ fontSize: '0.95rem', lineHeight: 1.4 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Report
