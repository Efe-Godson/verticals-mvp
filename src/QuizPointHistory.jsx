// Place at: src/QuizPointHistory.jsx
import { useEffect, useState } from 'react'
import { getQuizIdentityToken } from './quizIdentity'
import { invokeQuiz } from './quizApi'
import { LoadingState } from './LoadingState'

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function QuizPointHistory() {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    let cancelled = false
    invokeQuiz('get-player-quiz-history', { identity_token: getQuizIdentityToken() }).then(data => {
      if (!cancelled) setHistory(data)
    })
    return () => { cancelled = true }
  }, [])

  if (!history) return <LoadingState />

  return (
    <div className="page">
      <h1>Point History</h1>
      <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>Tracked on this device only.</p>

      <div className="toolbar-row" style={{ margin: '1.2rem 0' }}>
        <div className="card" style={{ padding: '1rem 1.3rem', flex: '1 1 140px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{history.total_points}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Total Points</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.3rem', flex: '1 1 140px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{history.quizzes_played}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Quizzes Played</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.3rem', flex: '1 1 140px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{Math.round(history.average_accuracy * 100)}%</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Average Accuracy</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.3rem', flex: '1 1 140px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{history.best_rank ?? '—'}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Best Rank</div>
        </div>
      </div>

      <h3 style={{ marginBottom: '0.6rem' }}>History</h3>
      {!history.history.length ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>No finished quizzes yet.</p>
      ) : (
        <div className="table-wrap table-bleed">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem' }}>Quiz</th>
                <th style={{ textAlign: 'right', padding: '0.6rem 0.9rem' }}>Points</th>
                <th style={{ textAlign: 'right', padding: '0.6rem 0.9rem' }}>Rank</th>
              </tr>
            </thead>
            <tbody>
              {history.history.map(h => (
                <tr key={h.room_id + h.date}>
                  <td style={{ padding: '0.6rem 0.9rem' }}>{formatDate(h.date)}</td>
                  <td style={{ padding: '0.6rem 0.9rem' }}>{h.name}</td>
                  <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{h.points}</td>
                  <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>#{h.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default QuizPointHistory
