// Place at: src/report/ai/AIInsightCards.jsx
// Dashboard-facing summary only — no chat, no full analysis. Manual
// "Generate" button keeps free-tier usage predictable while still offering a
// richer, more practical analysis experience.
import { useEffect, useState } from 'react'
import { fetchAIAnalysis } from '../../lib/aiClient'

function getPriorityTone(priority) {
  if (priority === 'high') return { background: '#fef2f2', color: '#b91c1c' }
  if (priority === 'medium') return { background: '#fff7ed', color: '#c2410c' }
  return { background: '#f0fdf4', color: '#166534' }
}

function getImpactTone(impact) {
  if (impact === 'high') return { background: '#fef2f2', color: '#b91c1c' }
  if (impact === 'medium') return { background: '#eff6ff', color: '#1d4ed8' }
  return { background: '#f0fdf4', color: '#166534' }
}

function getSeverityTone(severity) {
  if (severity === 'high') return { background: '#fef2f2', color: '#b91c1c' }
  if (severity === 'medium') return { background: '#fff7ed', color: '#c2410c' }
  return { background: '#f3f4f6', color: '#374151' }
}

function formatTimestamp(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value))
}

function AIInsightCards({ formId, dateRangeLabel, submissionIds, hideExecutiveSummary = false }) {
  const [analysis, setAnalysis] = useState(null)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cached, setCached] = useState(false)

  useEffect(() => {
    setAnalysis(null)
    setGeneratedAt(null)
    setCached(false)
    try {
      const saved = JSON.parse(localStorage.getItem(`ai-insights:${formId}`) || 'null')
      if (saved?.analysis) {
        setAnalysis(saved.analysis)
        setGeneratedAt(saved.generatedAt)
        setCached(Boolean(saved.cached))
      }
    } catch {
      localStorage.removeItem(`ai-insights:${formId}`)
    }
  }, [formId])

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const result = await fetchAIAnalysis(formId, dateRangeLabel, submissionIds)
      const nextAnalysis = {
        executiveSummary: result.executiveSummary || '',
        keyInsights: (result.keyInsights || []).slice(0, 5),
        recommendations: (result.recommendations || []).slice(0, 3),
        anomalies: (result.anomalies || []).slice(0, 3),
        forecasts: (result.forecasts || []).slice(0, 3),
      }
      const nextGeneratedAt = result.generated_at || new Date().toISOString()
      setAnalysis(nextAnalysis)
      setGeneratedAt(nextGeneratedAt)
      setCached(Boolean(result.cached))
      localStorage.setItem(
        `ai-insights:${formId}`,
        JSON.stringify({ analysis: nextAnalysis, generatedAt: nextGeneratedAt, cached: Boolean(result.cached) })
      )
    } catch (err) {
      setError('Could not generate insights: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const hasAnalysis = Boolean(
    analysis?.executiveSummary ||
    analysis?.keyInsights?.length ||
    analysis?.recommendations?.length ||
    analysis?.anomalies?.length ||
    analysis?.forecasts?.length
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
            AI Insights
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
            Actionable summaries for the current view
          </div>
        </div>
        <button className="secondary" onClick={handleGenerate} disabled={loading || submissionIds.length === 0}>
          {loading ? 'Analyzing…' : hasAnalysis ? 'Regenerate' : 'Generate AI Insights'}
        </button>
      </div>

      {error && <p style={{ color: 'red', fontSize: '0.85rem' }}>{error}</p>}

      {!hasAnalysis && !loading && !error && (
        <div className="card" style={{ padding: '1.1rem 1.15rem', color: 'var(--color-muted)', lineHeight: 1.5 }}>
          Generate a short analysis to see a summary of what’s working, what needs attention, and the next best action.
        </div>
      )}

      {hasAnalysis && (
        <>
          {!hideExecutiveSummary && (
            <div className="card" style={{ padding: '1.1rem 1.2rem', marginBottom: '1rem', background: 'linear-gradient(135deg, #f8faff 0%, #f3f7ff 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Executive summary
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                  {submissionIds.length} response{submissionIds.length === 1 ? '' : 's'} · {dateRangeLabel || 'All time'}
                </div>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.45rem', lineHeight: 1.5 }}>
                {analysis.executiveSummary || 'This view shows a few clear opportunities to improve performance.'}
              </div>
              {generatedAt && (
                <div style={{ fontSize: '0.76rem', color: 'var(--color-muted)', marginTop: '0.55rem' }}>
                  {cached ? 'Cached result' : 'Fresh analysis'} · {formatTimestamp(generatedAt)}
                </div>
              )}
            </div>
          )}

          {analysis.recommendations?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
                Suggested actions
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
                {analysis.recommendations.map((recommendation, index) => (
                  <div key={index} className="card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center', marginBottom: '0.45rem' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{recommendation.title}</div>
                      <span style={{ ...getImpactTone(recommendation.impact), borderRadius: '999px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize' }}>
                        {recommendation.impact || 'medium'} impact
                      </span>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--color-muted)', lineHeight: 1.45 }}>{recommendation.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
            {analysis.keyInsights?.length > 0 && (
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
                  Key takeaways
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {analysis.keyInsights.map((insight, index) => (
                    <div key={index} style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: '0.7rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <div style={{ fontSize: '0.94rem', fontWeight: 700 }}>{insight.title}</div>
                        <span style={{ ...getPriorityTone(insight.priority), borderRadius: '999px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize' }}>
                          {insight.priority || 'medium'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--color-muted)', lineHeight: 1.45 }}>{insight.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.anomalies?.length > 0 && (
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
                  Notable patterns
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {analysis.anomalies.map((anomaly, index) => (
                    <div key={index} style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '0.7rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <div style={{ fontSize: '0.94rem', fontWeight: 700 }}>{anomaly.title}</div>
                        <span style={{ ...getSeverityTone(anomaly.severity), borderRadius: '999px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize' }}>
                          {anomaly.severity || 'medium'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--color-muted)', lineHeight: 1.45 }}>{anomaly.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.forecasts?.length > 0 && (
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
                  Short-term outlook
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {analysis.forecasts.map((forecast, index) => (
                    <div key={index} style={{ borderLeft: '3px solid #10b981', paddingLeft: '0.7rem' }}>
                      <div style={{ fontSize: '0.94rem', fontWeight: 700, marginBottom: '0.2rem' }}>{forecast.metric}</div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--color-muted)', lineHeight: 1.45 }}>{forecast.prediction}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                        {forecast.confidence} confidence · {forecast.horizon}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default AIInsightCards
