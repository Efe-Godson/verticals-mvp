// Place at: src/AIAnalystPage.jsx
// Route suggestion: <Route path="/forms/:id/ai-analyst" element={<AIAnalystPage />} />
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { fetchAIAnalysis, askAIQuestion } from './lib/aiClient'

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '3months', label: 'Last 3 months' },
]

// NOTE: duplicated (in reduced form) from Report.jsx's date-range logic.
// Worth extracting both into src/report/helpers/dateRange.js so the two
// pages can't drift out of sync — flagging rather than doing it silently
// since it touches a file you already have working.
function getDateRangeBounds(range) {
  if (range === 'all') return { start: null }
  const now = new Date()
  let start = null
  if (range === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  else if (range === '7days') { start = new Date(now); start.setDate(start.getDate() - 7) }
  else if (range === '30days') { start = new Date(now); start.setDate(start.getDate() - 30) }
  else if (range === '3months') { start = new Date(now); start.setMonth(start.getMonth() - 3) }
  return { start }
}

function SectionHeader({ children }) {
  return (
    <h3 style={{
      marginTop: '2.4rem', marginBottom: '1rem', fontSize: '0.8rem',
      color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700
    }}>
      {children}
    </h3>
  )
}

const BADGE_COLORS = { high: '#d92d20', medium: '#b54708', low: '#667085' }

function formatLastUpdated(timestamp) {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(timestamp))
}

function Badge({ label }) {
  if (!label) return null
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
      color: BADGE_COLORS[label] || '#667085', border: `1px solid ${BADGE_COLORS[label] || '#667085'}`,
      borderRadius: '4px', padding: '0.1rem 0.4rem', marginLeft: '0.5rem'
    }}>
      {label}
    </span>
  )
}

function AIAnalystPage() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [dateRange, setDateRange] = useState('all')
  const [loading, setLoading] = useState(true)

  const [analysis, setAnalysis] = useState(null)
  const [analysisMeta, setAnalysisMeta] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [languageStyle, setLanguageStyle] = useState('plain')

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: formData } = await supabase.from('forms').select('*').eq('id', id).single()
      setForm(formData)
      const { data: subsData } = await supabase
        .from('submissions').select('*').eq('form_id', id).order('created_at', { ascending: true })
      setSubmissions(subsData || [])
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    setAnalysis(null)
    setAnalysisMeta(null)
    try {
      const saved = localStorage.getItem(`ai-analysis:${id}`)
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (parsed.analysis && parsed.meta) {
        setAnalysis(parsed.analysis)
        setAnalysisMeta(parsed.meta)
        setLanguageStyle(parsed.meta.languageStyle || 'plain')
      }
    } catch {
      localStorage.removeItem(`ai-analysis:${id}`)
    }
  }, [id])

  if (loading) return <div className="page">Loading...</div>
  if (!form) return <div className="page">Form not found.</div>

  const { start } = getDateRangeBounds(dateRange)
  const filtered = submissions.filter(s => !start || new Date(s.created_at) >= start)
  const submissionIds = filtered.map(s => s.id)
  const dateRangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label

  async function handleGenerate() {
    setAnalyzing(true)
    setError('')
    try {
      const result = await fetchAIAnalysis(form.id, dateRangeLabel, submissionIds, languageStyle)
      setAnalysis(result)
      const meta = { generatedAt: result.generated_at || new Date().toISOString(), dateRangeLabel, languageStyle }
      setAnalysisMeta(meta)
      localStorage.setItem(`ai-analysis:${form.id}`, JSON.stringify({ analysis: result, meta }))
    } catch (err) {
      setError('Could not generate analysis: ' + err.message)
    }
    setAnalyzing(false)
  }

  async function handleAsk(e) {
    e.preventDefault()
    if (!question.trim()) return
    setAsking(true)
    setAskError('')
    setAnswer('')
    try {
      const result = await askAIQuestion(form.id, question, submissionIds, languageStyle)
      setAnswer(result)
    } catch (err) {
      setAskError('Could not get an answer: ' + err.message)
    }
    setAsking(false)
  }

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {form.name}
          </div>
          <h1 style={{ margin: '0.2rem 0 0', fontSize: '1.6rem' }}>AI Analyst</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: '0.5rem' }}>
            {DATE_RANGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={languageStyle} onChange={(e) => setLanguageStyle(e.target.value)} style={{ padding: '0.5rem' }} aria-label="Analysis language style">
            <option value="plain">Plain language</option>
            <option value="technical">Technical detail</option>
          </select>
          <button className="secondary" onClick={handleGenerate} disabled={analyzing || filtered.length === 0}>
            {analyzing ? (analysis ? 'Refreshing…' : 'Analyzing…') : analysis ? 'Refresh Analysis' : 'Generate Analysis'}
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <p style={{ color: '#999', marginTop: '2rem' }}>No responses in this date range.</p>
      )}

      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}

      {!analysis && !analyzing && filtered.length > 0 && (
        <p style={{ color: 'var(--color-muted)', marginTop: '2rem' }}>
          Click "Generate Analysis" for an executive summary, insights, recommendations, anomalies, and forecasts on this data.
        </p>
      )}

      {analysis && (
        <>
          <SectionHeader>Executive Summary</SectionHeader>
          <div className="card" style={{ padding: '1.5rem' }}>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{analysis.executiveSummary}</p>
          </div>

          {analysis.keyInsights?.length > 0 && (
            <>
              <SectionHeader>Key Insights</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {analysis.keyInsights.map((item, i) => (
                  <div key={i} className="card" style={{ padding: '1.2rem' }}>
                    <div style={{ fontWeight: 700 }}>{item.title}<Badge label={item.priority} /></div>
                    <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{item.detail}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {analysis.recommendations?.length > 0 && (
            <>
              <SectionHeader>Recommendations</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {analysis.recommendations.map((item, i) => (
                  <div key={i} className="card" style={{ padding: '1.2rem' }}>
                    <div style={{ fontWeight: 700 }}>{item.title}<Badge label={item.impact} /></div>
                    <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{item.detail}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {analysis.anomalies?.length > 0 && (
            <>
              <SectionHeader>Anomalies</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {analysis.anomalies.map((item, i) => (
                  <div key={i} className="card" style={{ padding: '1.2rem' }}>
                    <div style={{ fontWeight: 700 }}>{item.title}<Badge label={item.severity} /></div>
                    <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{item.detail}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {analysis.forecasts?.length > 0 && (
            <>
              <SectionHeader>Forecasts</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {analysis.forecasts.map((item, i) => (
                  <div key={i} className="card" style={{ padding: '1.2rem' }}>
                    <div style={{ fontWeight: 700 }}>{item.metric}<Badge label={item.confidence} /></div>
                    <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{item.prediction}</div>
                    <div style={{ color: 'var(--color-muted)', fontSize: '0.78rem', marginTop: '0.4rem' }}>Horizon: {item.horizon}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {analysisMeta && (
            <p style={{ color: 'var(--color-muted)', fontSize: '0.78rem', marginTop: '1.8rem', marginBottom: 0 }}>
              {analyzing ? 'Refreshing the report. The last generated report remains available.' : 'Last updated'}: {formatLastUpdated(analysisMeta.generatedAt)} · {analysisMeta.dateRangeLabel} · {analysisMeta.languageStyle === 'technical' ? 'Technical detail' : 'Plain language'}
            </p>
          )}

          <SectionHeader>Ask a Question</SectionHeader>
          <form onSubmit={handleAsk} style={{ display: 'flex', gap: '0.6rem' }}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which product should I restock first?"
              style={{ flex: 1, padding: '0.6rem 0.8rem' }}
            />
            <button className="secondary" type="submit" disabled={asking}>
              {asking ? 'Thinking…' : 'Ask'}
            </button>
          </form>
          {askError && <p style={{ color: 'red', marginTop: '0.6rem' }}>{askError}</p>}
          {answer && (
            <div className="card" style={{ padding: '1.2rem', marginTop: '0.8rem' }}>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{answer}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AIAnalystPage
