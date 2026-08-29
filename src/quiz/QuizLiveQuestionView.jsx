// Place at: src/quiz/QuizLiveQuestionView.jsx
// One question, synchronized across every player via room.current_question_
// index/ends_at (Postgres Changes on quiz_rooms). Selecting an option
// submits immediately - there's no separate "confirm" step, matching "answer
// locks after submission, no changing your answer" from the product spec.
import { useEffect, useState } from 'react'
import { invokeQuiz } from '../quizApi'
import QuestionTimer from './QuestionTimer'
import McqOptionGrid from './McqOptionGrid'
import PageSkeleton from '../components/PageSkeleton'

function QuizLiveQuestionView({ roomId, room, credential }) {
  const [question, setQuestion] = useState(null)
  const [meta, setMeta] = useState({ endsAt: null, serverNow: null })
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [revealTriggered, setRevealTriggered] = useState(false)

  useEffect(() => {
    let cancelled = false
    setQuestion(null)
    setSelectedIndex(null)
    setSubmitted(false)
    setRevealTriggered(false)

    invokeQuiz('get-quiz-question', { room_id: roomId, index: room.current_question_index }).then(res => {
      if (cancelled) return
      setQuestion(res.question)
      setMeta({ endsAt: res.ends_at, serverNow: res.server_now })
    })
    return () => { cancelled = true }
  }, [roomId, room.current_question_index])

  async function handleSelect(index) {
    if (submitted) return
    setSelectedIndex(index)
    setSubmitted(true)
    try {
      await invokeQuiz('submit-quiz-answer', {
        room_id: roomId, player_id: credential.player_id, player_secret: credential.player_secret,
        question_id: question.id, selected_option_index: index,
      })
    } catch {
      // Already answered / time's up - stays locked either way, nothing
      // more useful to do client-side than leave the selection showing.
    }
  }

  async function handleExpire() {
    if (revealTriggered) return
    setRevealTriggered(true)
    // Best-effort: whichever client's timer fires first nudges the room
    // past the deadline (see advance-quiz-room's dual-authorization 'reveal'
    // path) - if the admin or another player already did it, this just
    // no-ops server-side.
    invokeQuiz('advance-quiz-room', { room_id: roomId, action: 'reveal' }).catch(() => {})
  }

  if (!question) return <PageSkeleton variant="detail" />

  return (
    <div className="page">
      <p style={{ textAlign: 'center', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>
        Question {room.current_question_index + 1}/{room.question_count}
      </p>
      <QuestionTimer endsAt={meta.endsAt} serverNow={meta.serverNow} isPaused={room.is_paused} onExpire={handleExpire} />

      <h2 style={{ textAlign: 'center', margin: '1rem 0' }}>{question.prompt}</h2>

      <McqOptionGrid
        options={question.options}
        selectedIndex={selectedIndex}
        correctIndex={null}
        disabled={submitted}
        onSelect={handleSelect}
      />

      {submitted && (
        <p style={{ textAlign: 'center', marginTop: '1.2rem', fontWeight: 600, color: 'var(--status-good)' }}>
          Answer submitted ✓
        </p>
      )}
    </div>
  )
}

export default QuizLiveQuestionView
