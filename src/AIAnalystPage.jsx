// Place at: src/AIAnalystPage.jsx
// Route suggestion: <Route path="/forms/:id/ai-analyst" element={<AIAnalystPage />} />
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { fetchAIAnalysis, askAIQuestion } from './lib/aiClient'
import { DATE_RANGE_OPTIONS, getDateRangeBounds, getDateRangeLabel } from './report/helpers/dateRange'

const EXAMPLE_QUESTIONS = [
  'Which product should I restock first?',
  'What changed compared to last period?',
  'Who are my top performing sales reps?',
  'What days are busiest?',
]

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

// Maps the model's high/medium/low labels onto the app's reserved status
// palette (see index.css) instead of one-off hex values, so severity here
// reads consistently with status colors used elsewhere in the app.
const BADGE_TONE = {
  high: 'var(--status-critical)',
  medium: 'var(--status-warning)',
  low: 'var(--status-good)',
}

function formatLastUpdated(timestamp) {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(timestamp))
}

function Badge({ label }) {
  if (!label) return null
  const color = BADGE_TONE[label] || 'var(--color-muted)'
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
      color, border: `1px solid ${color}`,
      borderRadius: '4px', padding: '0.1rem 0.4rem', marginLeft: '0.5rem'
    }}>
      {label}
    </span>
  )
}

// A handful of skeleton cards while the model is thinking, instead of just a
// button label change — makes a multi-second wait feel like something is
// actually happening.
function AnalysisSkeleton() {
  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.2rem' }}>
        <div className="ai-skeleton-line" style={{ width: '90%' }} />
        <div className="ai-skeleton-line" style={{ width: '75%' }} />
        <div className="ai-skeleton-line" style={{ width: '60%' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="card" style={{ padding: '1.2rem' }}>
            <div className="ai-skeleton-line" style={{ width: '40%' }} />
            <div className="ai-skeleton-line" style={{ width: '85%' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function AIAnalystPage() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [dateRange, setDateRange] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)

  const [analysis, setAnalysis] = useState(null)
  const [analysisMeta, setAnalysisMeta] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [languageStyle, setLanguageStyle] = useState('plain')

  const [question, setQuestion] = useState('')
  const [qaHistory, setQaHistory] = useState([])
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

  const { start, end } = getDateRangeBounds(dateRange, customStart, customEnd)
  const filtered = submissions.filter(s => {
    const created = new Date(s.created_at)
    if (start && created < start) return false
    if (end && created > end) return false
    return true
  })
  const submissionIds = filtered.map(s => s.id)
  const dateRangeLabel = getDateRangeLabel(dateRange, customStart, customEnd)

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

  async function submitQuestion(text) {
    const trimmed = text.trim()
    if (!trimmed || asking) return
    setAsking(true)
    setAskError('')
    try {
      const result = await askAIQuestion(form.id, trimmed, submissionIds, languageStyle)
      setQaHistory(current => [{ question: trimmed, answer: result }, ...current])
      setQuestion('')
    } catch (err) {
      setAskError('Could not get an answer: ' + err.message)
    }
    setAsking(false)
  }

  function handleAsk(e) {
    e.preventDefault()
    submitQuestion(question)
  }

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <style>{`
        .ai-skeleton-line {
          height: 0.85rem; margin-bottom: 0.6rem; border-radius: 4px;
          background: linear-gradient(90deg, #eef1f5 25%, #f7f8fa 37%, #eef1f5 63%);
          background-size: 400% 100%; animation: ai-skeleton-shimmer 1.4s ease infinite;
        }
        .ai-skeleton-line:last-child { margin-bottom: 0; }
        @keyframes ai-skeleton-shimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0 50%; }
        }
        .ai-example-chip {
          font-size: 0.82rem; padding: 0.4rem 0.75rem; border-radius: 999px;
          border: 1px solid var(--color-border); background: white; color: var(--color-muted);
          cursor: pointer; transition: border-color 0.15s ease, color 0.15s ease;
        }
        .ai-example-chip:hover { border-color: var(--color-primary); color: var(--color-primary); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem' }}>
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
          {dateRange === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: '0.5rem' }} />
              <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ padding: '0.5rem' }} />
            </>
          )}
          <select value={languageStyle} onChange={(e) => setLanguageStyle(e.target.value)} style={{ padding: '0.5rem' }} aria-label="Analysis language style">
            <option value="plain">Plain language</option>
            <option value="technical">Technical detail</option>
          </select>
          <button className="secondary" onClick={handleGenerate} disabled={analyzing || filtered.length === 0}>
            {analyzing ? (analysis ? 'Refreshing…' : 'Analyzing…') : analysis ? 'Refresh Analysis' : 'Generate Analysis'}
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '0.6rem' }}>
        {filtered.length.toLocaleString()} response{filtered.length !== 1 ? 's' : ''} in this view
      </p>

      {filtered.length === 0 && (
        <p style={{ color: '#999', marginTop: '1.5rem' }}>No responses in this date range.</p>
      )}

      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}

      {!analysis && !analyzing && filtered.length > 0 && (
        <p style={{ color: 'var(--color-muted)', marginTop: '2rem' }}>
          Click "Generate Analysis" for an executive summary, insights, recommendations, anomalies, and forecasts on this data.
        </p>
      )}

      {analyzing && !analysis && <AnalysisSkeleton />}

      {analysis && (
        <>
          {analyzing && (
            <p style={{ color: 'var(--color-primary)', fontSize: '0.85rem', marginTop: '1rem' }}>
              Refreshing the report — the version below stays visible until the new one is ready.
            </p>
          )}

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
              Last updated: {formatLastUpdated(analysisMeta.generatedAt)} · {analysisMeta.dateRangeLabel} · {analysisMeta.languageStyle === 'technical' ? 'Technical detail' : 'Plain language'}
            </p>
          )}
        </>
      )}

      {filtered.length > 0 && (
        <>
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

          {qaHistory.length === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.8rem' }}>
              {EXAMPLE_QUESTIONS.map(q => (
                <button key={q} type="button" className="ai-example-chip" onClick={() => submitQuestion(q)} disabled={asking}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {askError && <p style={{ color: 'red', marginTop: '0.6rem' }}>{askError}</p>}

          {qaHistory.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.8rem' }}>
              {qaHistory.map((qa, i) => (
                <div key={i} className="card" style={{ padding: '1.2rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.4rem' }}>{qa.question}</div>
                  <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-muted)' }}>{qa.answer}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AIAnalystPage
