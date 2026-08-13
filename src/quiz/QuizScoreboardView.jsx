// Place at: src/quiz/QuizScoreboardView.jsx
// Shown after each question reveals: the correct answer + explanation, plus
// the live leaderboard. Advancing to the next question is an admin-only
// action (see QuizAdminDashboard.jsx) - players just wait here.
import { useEffect, useState } from 'react'
import { invokeQuiz } from '../quizApi'
import Leaderboard from './Leaderboard'

function QuizScoreboardView({ roomId, room, players, ownPlayerId }) {
  const [question, setQuestion] = useState(null)

  useEffect(() => {
    let cancelled = false
    setQuestion(null)
    invokeQuiz('get-quiz-question', { room_id: roomId, index: room.current_question_index }).then(res => {
      if (!cancelled) setQuestion(res.question)
    })
    return () => { cancelled = true }
  }, [roomId, room.current_question_index])

  return (
    <div className="page">
      <p style={{ textAlign: 'center', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>
        Question {room.current_question_index + 1}/{room.question_count}
      </p>

      {question && (
        <div className="card" style={{ padding: '1rem', margin: '0.8rem 0', textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--status-good)' }}>
            Correct: {question.options[question.correct_option_index]}
          </p>
          {question.explanation && <p style={{ margin: '0.4rem 0 0', color: 'var(--color-muted)', fontSize: '0.9rem' }}>{question.explanation}</p>}
        </div>
      )}

      <h3 style={{ margin: '1.2rem 0 0.6rem' }}>Scoreboard</h3>
      <Leaderboard players={players} ownPlayerId={ownPlayerId} />

      <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '1rem' }}>
        Waiting for the host to continue...
      </p>
    </div>
  )
}

export default QuizScoreboardView
