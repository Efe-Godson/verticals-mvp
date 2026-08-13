// Place at: src/QuizAdminDashboard.jsx
// Host controls + live analytics while a room is being played. Polls
// get-quiz-room-state every ~2s instead of subscribing to Realtime for its
// own data: it's a single viewer, and the per-option breakdown is answer-
// key-adjacent, so it has to stay behind requireQuizAdmin rather than going
// out over a channel every player's browser could listen to (see
// _shared/quiz.ts and the quiz_tables migration for why quiz_answers has no
// RLS policies at all).
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useToast } from './Toast'
import { invokeQuiz } from './quizApi'
import RoomCodeBadge from './quiz/RoomCodeBadge'
import HorizontalBarChart from './report/components/HorizontalBarChart'

const POLL_MS = 2000

function QuizAdminDashboard() {
  const { roomId } = useParams()
  const { showToast } = useToast()
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const data = await invokeQuiz('get-quiz-room-state', { room_id: roomId })
        if (!cancelled) { setState(data); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(pollRef.current) }
  }, [roomId])

  async function act(action) {
    setActing(true)
    try {
      await invokeQuiz('advance-quiz-room', { room_id: roomId, action })
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActing(false)
    }
  }

  if (error) return <div className="page"><p>{error}</p></div>
  if (!state) return <div className="page"><p style={{ color: 'var(--color-muted)' }}>Loading...</p></div>

  const { room, player_count, players, leader, current_question, option_counts } = state

  const chartData = current_question
    ? current_question.options.map((opt, i) => ({ label: opt, count: option_counts[i] || 0 }))
    : []

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.6rem' }}>
        <h1 style={{ margin: 0 }}>{room.name}</h1>
        <RoomCodeBadge code={room.code} />
      </div>
      <p style={{ color: 'var(--color-muted)' }}>
        {player_count} player{player_count === 1 ? '' : 's'} · {room.state === 'live' ? `Question ${room.current_question_index + 1}/${room.question_count}` : room.state}
        {room.is_paused && ' · Paused'}
      </p>

      <div className="toolbar-row" style={{ margin: '1rem 0 1.5rem' }}>
        {room.state === 'lobby' && <button onClick={() => act('start')} disabled={acting}>Start Quiz</button>}
        {room.state === 'live' && room.live_phase === 'question' && !room.is_paused && (
          <button className="secondary" onClick={() => act('pause')} disabled={acting}>Pause</button>
        )}
        {room.state === 'live' && room.live_phase === 'question' && room.is_paused && (
          <button onClick={() => act('resume')} disabled={acting}>Resume</button>
        )}
        {room.state === 'live' && room.live_phase === 'question' && (
          <button className="secondary" onClick={() => act('reveal')} disabled={acting}>Skip Question</button>
        )}
        {room.state === 'live' && room.live_phase === 'scoreboard' && (
          <button onClick={() => act('next')} disabled={acting}>
            {room.current_question_index + 1 >= room.question_count ? 'Finish Quiz' : 'Next Question'}
          </button>
        )}
        {room.state !== 'finished' && (
          <button className="secondary" onClick={() => act('end')} disabled={acting} style={{ color: '#c0392b' }}>End Quiz</button>
        )}
      </div>

      {leader && (
        <p style={{ marginBottom: '1.2rem' }}>
          Current Leader: <strong>{leader.avatar} {leader.nickname}</strong> ({leader.total_points} pts)
        </p>
      )}

      {current_question && (
        <div className="card" style={{ padding: '1.2rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.8rem', fontWeight: 600 }}>{current_question.prompt}</p>
          <HorizontalBarChart data={chartData} bare />
          <p style={{ marginTop: '0.8rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            {current_question.answer_count}/{player_count} answered
          </p>
        </div>
      )}

      <h3 style={{ marginBottom: '0.6rem' }}>Players</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {players.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.9rem', fontSize: '0.9rem' }}>
            <span>#{p.rank} {p.avatar} {p.nickname}</span>
            <span>{p.total_points} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default QuizAdminDashboard
