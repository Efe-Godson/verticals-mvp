// Place at: src/quiz/QuizFinalResultsView.jsx
import { Link } from 'react-router-dom'
import Leaderboard from './Leaderboard'

function QuizFinalResultsView({ room, players, ownPlayerId }) {
  const ownPlayer = players.find(p => p.id === ownPlayerId)
  const accuracy = ownPlayer && room.question_count > 0
    ? Math.round((ownPlayer.correct_count / room.question_count) * 100)
    : null

  return (
    <div className="page">
      <h1 style={{ textAlign: 'center' }}>🎉 Quiz Complete</h1>

      <h3 style={{ margin: '1.5rem 0 0.6rem' }}>Final Leaderboard</h3>
      <Leaderboard players={players} ownPlayerId={ownPlayerId} />

      {ownPlayer && (
        <>
          <h3 style={{ margin: '1.5rem 0 0.6rem' }}>Your Performance</h3>
          <div className="card" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.8rem', fontSize: '0.9rem' }}>
              <div>Questions<br /><strong>{room.question_count}</strong></div>
              <div>Correct<br /><strong>{ownPlayer.correct_count}</strong></div>
              <div>Accuracy<br /><strong>{accuracy}%</strong></div>
              <div>Points<br /><strong>{ownPlayer.total_points}</strong></div>
              <div>Final Rank<br /><strong>#{ownPlayer.rank}</strong></div>
              <div>Fastest Answer<br /><strong>{ownPlayer.fastest_answer_ms != null ? `${(ownPlayer.fastest_answer_ms / 1000).toFixed(1)}s` : '—'}</strong></div>
            </div>
          </div>
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <Link to="/lab/quiz/history"><button className="secondary">View Detailed Results</button></Link>
      </div>
    </div>
  )
}

export default QuizFinalResultsView
