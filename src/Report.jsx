import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { printReport, exportReportToPDF, exportReportToPPTX } from './reportExport'

const CHART_COLORS = ['#0070f3', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

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

function getFieldValues(sub, field) {
  const val = sub.data[field.id]
  if (field.type === 'checkbox') return Array.isArray(val) ? val : []
  if (val === undefined || val === null || val === '') return []
  return [val]
}

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
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
  const detailFields = form.fields.filter(f => f.type !== 'cart' && !CATEGORICAL_TYPES.includes(f.type))

  function buildFilterSummary() {
    return dateRange === 'all' ? '' : dateRangeLabel
  }

  function handlePrint() {
    printReport(form, filteredSubmissions, buildFilterSummary())
  }

  function handleDownloadPDF() {
    setDownloadMenuOpen(false)
    // Small delay lets the dropdown actually close in the DOM before we
    // screenshot the page — otherwise it can get captured mid-close.
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

      {/* Toolbar — three groups: date range (left), print (center), download (right).
          data-html2canvas-ignore excludes this from the PDF screenshot, since the
          Print/Download buttons and open dropdown menu shouldn't appear in the export. */}
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
          <KPIGrid form={form} submissions={filteredSubmissions} totalResponses={totalResponses} />

          {cartFields.length > 0 && (
            <>
              <SectionHeader>Primary Charts</SectionHeader>
              {cartFields.map(field => {
                const answered = filteredSubmissions.filter(s => {
                  const v = s.data[field.id]
                  return v && v.items && v.items.length > 0
                })
                return (
                  <div key={field.id} className="card" style={{ padding: '1.75rem', marginBottom: '1.2rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '0.3rem' }}>{field.label}</h3>
                    <CartReport field={field} answered={answered} showStats={false} />
                  </div>
                )
              })}
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

          <SectionHeader>Key Insights</SectionHeader>
          <InsightsPanel form={form} submissions={filteredSubmissions} />

          {detailFields.length > 0 && (
            <>
              <SectionHeader>Detailed Analysis</SectionHeader>
              {detailFields.map(field => (
                <FieldReport key={field.id} field={field} submissions={filteredSubmissions} totalResponses={totalResponses} />
              ))}
            </>
          )}

          <SectionHeader>Cross-Column Analysis</SectionHeader>
          <CrossColumnAnalysis form={form} submissions={filteredSubmissions} />
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
            {totalRevenue.toLocaleString()}
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
    kpis.push({ label: 'Revenue', value: totalRevenue.toLocaleString() })
    kpis.push({ label: 'Orders', value: totalOrders.toLocaleString() })
    kpis.push({
      label: 'Average Order Value',
      value: totalOrders > 0 ? (totalRevenue / totalOrders).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'
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
      kpis.push({ label: `Average ${numericField.label}`, value: avg.toLocaleString(undefined, { maximumFractionDigits: 2 }) })
    }
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '1rem', marginBottom: '2.8rem'
    }}>
      {kpis.map(k => <Card key={k.label} label={k.label} value={k.value} />)}
    </div>
  )
}

// Simple rule-based insights for now. Deliberately just an array of plain
// sentences going into InsightsPanel — an AI-generated version could replace
// computeInsights() later with zero changes needed to the panel itself.
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
      if (topRev) insights.push(`${topRev[0]} generates the most revenue, at ${topRev[1].toLocaleString()}.`)
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

function CrossColumnAnalysis({ form, submissions }) {
  const groupableFields = form.fields.filter(f => CATEGORICAL_TYPES.includes(f.type))
  const valueFields = form.fields.filter(f =>
    CATEGORICAL_TYPES.includes(f.type) || NUMERIC_TYPES.includes(f.type) || f.type === 'cart'
  )

  const [fieldAId, setFieldAId] = useState(groupableFields[0]?.id || '')
  const [fieldBId, setFieldBId] = useState('')

  if (groupableFields.length === 0) {
    return (
      <div className="card" style={{ padding: '1.5rem' }}>
        <p style={{ color: '#999', margin: 0 }}>
          Cross-column analysis needs at least one Dropdown, Multiple Choice, or Checkbox field to group by.
        </p>
      </div>
    )
  }

  const fieldA = form.fields.find(f => f.id === fieldAId)
  const fieldB = form.fields.find(f => f.id === fieldBId)
  const fieldBOptions = valueFields.filter(f => f.id !== fieldAId)

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.2rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' }}>
            Group by
          </label>
          <select
            value={fieldAId}
            onChange={(e) => { setFieldAId(e.target.value); setFieldBId('') }}
            style={{ padding: '0.5rem' }}
          >
            {groupableFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' }}>
            Compare against
          </label>
          <select
            value={fieldBId}
            onChange={(e) => setFieldBId(e.target.value)}
            style={{ padding: '0.5rem' }}
          >
            <option value="">Select a field...</option>
            {fieldBOptions.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {!fieldB ? (
        <p style={{ color: '#999' }}>Pick a field to compare against "{fieldA?.label}".</p>
      ) : NUMERIC_TYPES.includes(fieldB.type) ? (
        <NumericCrossTab fieldA={fieldA} fieldB={fieldB} submissions={submissions} />
      ) : fieldB.type === 'cart' ? (
        <CartCrossTab fieldA={fieldA} fieldB={fieldB} submissions={submissions} />
      ) : (
        <CategoricalCrossTab fieldA={fieldA} fieldB={fieldB} submissions={submissions} />
      )}
    </div>
  )
}

function CategoricalCrossTab({ fieldA, fieldB, submissions }) {
  const rowLabels = fieldA.options || []
  const colLabels = fieldB.options || []

  const matrix = {}
  rowLabels.forEach(r => { matrix[r] = {}; colLabels.forEach(c => { matrix[r][c] = 0 }) })

  let grandTotal = 0
  submissions.forEach(sub => {
    const aVals = getFieldValues(sub, fieldA)
    const bVals = getFieldValues(sub, fieldB)
    aVals.forEach(a => {
      bVals.forEach(b => {
        if (matrix[a] && matrix[a][b] !== undefined) {
          matrix[a][b] += 1
          grandTotal += 1
        }
      })
    })
  })

  if (grandTotal === 0) return <p style={{ color: '#999' }}>Not enough data yet for this combination.</p>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>{fieldA.label} \ {fieldB.label}</th>
            {colLabels.map(c => <th key={c} style={{ ...thStyle, textAlign: 'right' }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map(r => (
            <tr key={r}>
              <td style={tdStyle}>{r}</td>
              {colLabels.map(c => {
                const count = matrix[r][c]
                const percent = grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0
                return (
                  <td key={c} style={{ ...tdStyle, textAlign: 'right' }}>
                    {count} <span style={{ color: '#999', fontSize: '0.8rem' }}>({percent}%)</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NumericCrossTab({ fieldA, fieldB, submissions }) {
  const groups = {}

  submissions.forEach(sub => {
    const numB = Number(sub.data[fieldB.id])
    if (isNaN(numB)) return
    getFieldValues(sub, fieldA).forEach(a => {
      if (!groups[a]) groups[a] = { count: 0, sum: 0 }
      groups[a].count += 1
      groups[a].sum += numB
    })
  })

  const rows = Object.entries(groups)
    .map(([label, g]) => ({ label, count: g.count, total: g.sum, average: g.sum / g.count }))
    .sort((a, b) => b.total - a.total)

  if (rows.length === 0) return <p style={{ color: '#999' }}>Not enough data yet for this combination.</p>

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>{fieldA.label}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Count</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Total {fieldB.label}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Average</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>% of Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td style={tdStyle}>{r.label}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.count}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.total.toLocaleString()}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.average.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                {grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CartCrossTab({ fieldA, fieldB, submissions }) {
  const groups = {}
  let totalRevenue = 0
  let totalTransactions = 0

  submissions.forEach(sub => {
    const cartVal = sub.data[fieldB.id]
    if (!cartVal || !cartVal.items || cartVal.items.length === 0) return
    totalTransactions += 1
    totalRevenue += cartVal.total

    getFieldValues(sub, fieldA).forEach(a => {
      if (!groups[a]) groups[a] = { revenue: 0, transactions: 0 }
      groups[a].revenue += cartVal.total
      groups[a].transactions += 1
    })
  })

  const rows = Object.entries(groups)
    .map(([label, g]) => ({
      label,
      revenue: g.revenue,
      transactions: g.transactions,
      revenuePercent: totalRevenue > 0 ? Math.round((g.revenue / totalRevenue) * 100) : 0,
      transactionPercent: totalTransactions > 0 ? Math.round((g.transactions / totalTransactions) * 100) : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)

  if (rows.length === 0) return <p style={{ color: '#999' }}>Not enough data yet for this combination.</p>

  const top = rows[0]
  const gap = top.revenuePercent - top.transactionPercent
  const insight = Math.abs(gap) >= 10
    ? `${top.label} drives ${top.revenuePercent}% of revenue from just ${top.transactionPercent}% of orders.`
    : null

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>{fieldA.label}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>% of Revenue</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Orders</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>% of Orders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td style={tdStyle}>{r.label}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.revenue.toLocaleString()}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.revenuePercent}%</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.transactions}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.transactionPercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {insight && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '1rem' }}>{insight}</p>
      )}
    </div>
  )
}

function FieldReport({ field, submissions, totalResponses }) {
  const answered = submissions.filter(s => {
    const v = s.data[field.id]
    if (field.type === 'cart') {
      return v && v.items && v.items.length > 0
    }
    if (field.type === 'multiplechoicegrid' || field.type === 'checkboxgrid') {
      return v && typeof v === 'object' && Object.keys(v).length > 0
    }
    return v !== undefined && v !== null && v.toString().trim() !== ''
  })
  const completionRate = Math.round((answered.length / totalResponses) * 100)

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.2rem' }}>
      <h3 style={{ marginTop: 0 }}>{field.label}</h3>

      {(field.type === 'number' || field.type === 'rating' || field.type === 'linearscale') && (
        <NumberReport field={field} answered={answered} />
      )}
      {(field.type === 'checkbox') && (
        <CategoryReport field={field} answered={answered} totalResponses={totalResponses} multi />
      )}
      {(field.type === 'multiplechoicegrid' || field.type === 'checkboxgrid' || field.type === 'fileupload' || field.type === 'time') && (
        <TextReport field={field} answered={answered} completionRate={completionRate} totalResponses={totalResponses} skipList />
      )}
      {(field.type === 'dropdown' || field.type === 'multiplechoice') && (
        <CategoryReport field={field} answered={answered} totalResponses={totalResponses} />
      )}
      {(field.type === 'date') && <DateReport field={field} answered={answered} />}
      {(field.type === 'cart') && <CartReport field={field} answered={answered} />}
      {(field.type === 'text' || field.type === 'longtext' || field.type === 'email' || field.type === 'phone') && (
        <TextReport field={field} answered={answered} completionRate={completionRate} totalResponses={totalResponses} />
      )}
    </div>
  )
}

// Real vertical bar chart — height proportional to value, data label (percent)
// above each bar, value + name below. Scrolls horizontally past ~10 bars so
// labels never crowd or overlap, rather than shrinking to illegibility.
function VerticalBarChart({ data, maxBars = 10 }) {
  const shown = data.slice(0, maxBars)
  const maxValue = Math.max(...shown.map(d => d.count), 1)
  const manyBars = shown.length > 8

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '190px',
      marginTop: '1rem', overflowX: manyBars ? 'auto' : 'visible', paddingBottom: '0.3rem'
    }}>
      {shown.map(d => (
        <div key={d.label} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          minWidth: '64px', flex: manyBars ? '0 0 auto' : 1
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', whiteSpace: 'nowrap' }}>
            {d.percent}%
          </div>
          <div
            title={`${d.label}: ${d.count.toLocaleString()} (${d.percent}%)`}
            style={{
              width: '100%', maxWidth: '46px',
              height: `${Math.max((d.count / maxValue) * 130, 4)}px`,
              background: d.color, borderRadius: '4px 4px 0 0'
            }}
          />
          <div style={{
            fontSize: '0.72rem', color: '#666', marginTop: '0.4rem', textAlign: 'center',
            maxWidth: '80px', wordBreak: 'break-word', lineHeight: 1.25
          }}>
            {d.label}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#999', marginTop: '0.1rem' }}>
            {d.count.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

// Shows the first `limit` items, with a "Show all" toggle to reveal the rest —
// keeps long lists (text responses) from dominating the card.
function ExpandableList({ items, limit = 5, renderItem }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, limit)

  return (
    <>
      {visible.map((item, i) => renderItem(item, i))}
      {items.length > limit && (
        <span
          onClick={() => setExpanded(!expanded)}
          style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-primary)', cursor: 'pointer' }}
        >
          {expanded ? 'Show less' : `Show all ${items.length}`}
        </span>
      )}
    </>
  )
}

function CartReport({ field, answered, showStats = true }) {
  if (answered.length === 0) return <p style={{ color: '#999' }}>No orders yet.</p>

  const totals = answered.map(s => s.data[field.id].total)
  const totalRevenue = totals.reduce((a, b) => a + b, 0)
  const avgOrder = totalRevenue / totals.length

  const itemQty = {}
  const itemRevenue = {}
  let totalQtySold = 0

  answered.forEach(s => {
    s.data[field.id].items.forEach(item => {
      itemQty[item.name] = (itemQty[item.name] || 0) + item.quantity
      itemRevenue[item.name] = (itemRevenue[item.name] || 0) + item.price * item.quantity
      totalQtySold += item.quantity
    })
  })

  const topByQty = Object.entries(itemQty)
    .map(([name, qty], i) => ({
      label: name, count: qty,
      percent: totalQtySold > 0 ? Math.round((qty / totalQtySold) * 100) : 0,
      color: CHART_COLORS[i % CHART_COLORS.length]
    }))
    .sort((a, b) => b.count - a.count)

  const topByRevenue = Object.entries(itemRevenue)
    .map(([name, revenue], i) => ({
      label: name, count: revenue,
      percent: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
      color: CHART_COLORS[i % CHART_COLORS.length]
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div style={{ marginTop: showStats ? '0.8rem' : 0 }}>
      {showStats && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Card label="Total Revenue" value={totalRevenue.toLocaleString()} />
          <Card label="Orders" value={answered.length.toLocaleString()} />
          <Card label="Average Order" value={avgOrder.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        </div>
      )}

      {topByQty.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
            Quantity Sold by Product{topByQty.length > 10 ? ' (top 10)' : ''}
          </div>
          <VerticalBarChart data={topByQty} />
        </div>
      )}

      {topByRevenue.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
            Revenue by Product{topByRevenue.length > 10 ? ' (top 10)' : ''}
          </div>
          <VerticalBarChart data={topByRevenue} />
        </div>
      )}

      <CartLineItemsTable field={field} answered={answered} />
    </div>
  )
}

const thStyle = {
  textAlign: 'left', padding: '0.5rem 0.7rem', background: '#fafafa',
  borderBottom: '1px solid #eee', position: 'sticky', top: 0
}
const tdStyle = { padding: '0.5rem 0.7rem', borderBottom: '1px solid #f5f5f5' }

function CartLineItemsTable({ field, answered }) {
  const rows = []
  answered.forEach(s => {
    const items = s.data[field.id].items || []
    items.forEach(item => {
      rows.push({
        date: s.created_at,
        name: item.name,
        category: item.category || '',
        quantity: item.quantity,
        price: item.price,
        lineTotal: item.price * item.quantity
      })
    })
  })

  rows.sort((a, b) => new Date(b.date) - new Date(a.date))

  if (rows.length === 0) return null

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
        Line Items ({rows.length})
      </div>
      <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Unit Price</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={tdStyle}>
                  {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={tdStyle}>{row.name}</td>
                <td style={tdStyle}>{row.category || '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{row.quantity}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{row.price.toLocaleString()}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>{row.lineTotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NumberReport({ field, answered }) {
  const values = answered.map(s => Number(s.data[field.id])).filter(v => !isNaN(v))
  if (values.length === 0) return <p style={{ color: '#999' }}>No numeric responses yet.</p>

  const total = values.reduce((a, b) => a + b, 0)
  const avg = total / values.length
  const med = median(values)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
      <Card label="Total" value={total.toLocaleString()} />
      <Card label="Average" value={avg.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
      <Card label="Median" value={med.toLocaleString()} />
      <Card label="Min" value={min.toLocaleString()} />
      <Card label="Max" value={max.toLocaleString()} />
    </div>
  )
}

function CategoryReport({ field, answered, totalResponses, multi }) {
  if (answered.length === 0) return <p style={{ color: '#999' }}>No responses yet.</p>

  const countMap = {}
  answered.forEach(s => {
    const val = s.data[field.id]
    if (multi) {
      (Array.isArray(val) ? val : []).forEach(opt => {
        countMap[opt] = (countMap[opt] || 0) + 1
      })
    } else if (val) {
      countMap[val] = (countMap[val] || 0) + 1
    }
  })

  const breakdown = Object.entries(countMap)
    .map(([label, count], i) => ({
      label,
      count,
      percent: Math.round((count / totalResponses) * 100),
      color: CHART_COLORS[i % CHART_COLORS.length]
    }))
    .sort((a, b) => b.count - a.count)

  return <VerticalBarChart data={breakdown} />
}

function DateReport({ field, answered }) {
  if (answered.length === 0) return <p style={{ color: '#999' }}>No responses yet.</p>

  const dayCounts = {}
  const monthCounts = {}

  answered.forEach(s => {
    const raw = s.data[field.id]
    const d = new Date(raw)
    if (isNaN(d)) return
    const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' })
    const monthName = d.toLocaleDateString('en-GB', { month: 'long' })
    dayCounts[dayName] = (dayCounts[dayName] || 0) + 1
    monthCounts[monthName] = (monthCounts[monthName] || 0) + 1
  })

  const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]
  const peakMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const dayBreakdown = dayOrder
    .filter(d => dayCounts[d])
    .map((d, i) => ({
      label: d,
      count: dayCounts[d],
      percent: Math.round((dayCounts[d] / answered.length) * 100),
      color: CHART_COLORS[i % CHART_COLORS.length]
    }))

  return (
    <div style={{ marginTop: '0.8rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
        <Card label="Peak Day" value={peakDay ? peakDay[0] : '—'} />
        <Card label="Peak Month" value={peakMonth ? peakMonth[0] : '—'} />
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
        By day of week
      </div>
      <VerticalBarChart data={dayBreakdown} />
    </div>
  )
}

function TextReport({ field, answered, completionRate, totalResponses, skipList }) {
  return (
    <div style={{ marginTop: '0.8rem' }}>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        {answered.length} of {totalResponses} responses ({completionRate}% completion rate)
      </p>
      {skipList ? null : answered.length === 0 ? (
        <p style={{ color: '#999' }}>No responses yet.</p>
      ) : (
        <div style={{ border: '1px solid #eee', borderRadius: '6px', padding: '0.8rem', marginTop: '0.5rem' }}>
          <ExpandableList
            items={answered}
            renderItem={(s, i) => (
              <div key={s.id} style={{
                padding: '0.5rem 0',
                borderBottom: '1px solid #f0f0f0'
              }}>
                {s.data[field.id]}
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}

function Card({ label, value }) {
  return (
    <div style={{
      border: '1px solid #eee', borderRadius: '10px', padding: '1.1rem 1.4rem',
      minWidth: '140px', background: '#fafafa'
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: '#999', marginTop: '0.25rem' }}>{label}</div>
    </div>
  )
}

export default Report
