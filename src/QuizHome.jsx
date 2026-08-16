// Place at: src/QuizHome.jsx
// Entry point for the Quiz feature (Lab-only, see AdminOnlyRoute in
// App.jsx). Two things live side by side here even though only the admin
// account can reach this page today: hosting (Recent Rooms, Create) and
// playing (Join, My Quiz History) - because decision #2 in the Quiz plan
// gates the *whole* feature behind the Lab for this MVP, the admin account
// is currently the only one who can do either.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { getQuizIdentityToken } from './quizIdentity'
import { LoadingSpinner } from './LoadingState'
import { invokeQuiz } from './quizApi'

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function QuizHome() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [recentRooms, setRecentRooms] = useState([])
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data: rooms }, historyData] = await Promise.all([
        supabase
          .from('quiz_rooms').select('id, code, name, state, created_at')
          .eq('admin_user_id', session.user.id).is('deleted_at', null)
          .order('created_at', { ascending: false }).limit(5),
        invokeQuiz('get-player-quiz-history', { identity_token: getQuizIdentityToken() }).catch(() => null),
      ])
      if (cancelled) return
      setRecentRooms(rooms || [])
      setHistory(historyData)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [session.user.id])

  return (
    <div className="page">
      <h1 style={{ marginBottom: '0.2rem' }}>Quiz</h1>
      <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>Create, host, and play live AI-powered quizzes.</p>

      <div className="toolbar-row" style={{ margin: '1.2rem 0 2rem' }}>
        <button onClick={() => navigate('/lab/quiz/join')}>Join a Room</button>
        <button className="secondary" onClick={() => navigate('/lab/quiz/create')}>Create Quiz Room</button>
      </div>

      {!loading && history && (
        <div className="toolbar-row" style={{ marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1rem 1.3rem', flex: '1 1 140px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{history.total_points}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Overall Points</div>
          </div>
          <div className="card" style={{ padding: '1rem 1.3rem', flex: '1 1 140px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{history.best_rank ?? '—'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>My Best Rank</div>
          </div>
          <div className="card" style={{ padding: '1rem 1.3rem', flex: '1 1 140px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{history.quizzes_played}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Quizzes Played</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
        <h3 style={{ margin: 0 }}>My Quiz History</h3>
        {history?.history?.length > 0 && <Link to="/lab/quiz/history" style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>View all →</Link>}
      </div>
      {loading ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-muted)' }}><LoadingSpinner size={15} color="var(--color-muted)" /> Loading...</p>
      ) : !history?.history?.length ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>You haven't finished a quiz on this device yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '2rem' }}>
          {history.history.slice(0, 5).map(h => (
            <div key={h.room_id + h.date} className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.9rem', fontSize: '0.9rem' }}>
              <span>{h.name}</span>
              <span style={{ color: 'var(--color-muted)' }}>{formatDate(h.date)} · {h.points} pts · #{h.rank}</span>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginBottom: '0.6rem' }}>Recent Rooms</h3>
      {loading ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-muted)' }}><LoadingSpinner size={15} color="var(--color-muted)" /> Loading...</p>
      ) : !recentRooms.length ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>No rooms created yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {recentRooms.map(room => (
            <Link
              key={room.id}
              to={room.state === 'finished' ? `/lab/quiz/room/${room.id}/admin` : `/lab/quiz/room/${room.id}/admin`}
              className="card"
              style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.9rem', fontSize: '0.9rem' }}
            >
              <span>{room.name} <span style={{ color: 'var(--color-muted)', fontFamily: 'monospace' }}>{room.code}</span></span>
              <span style={{ color: 'var(--color-muted)', textTransform: 'capitalize' }}>{room.state}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default QuizHome
