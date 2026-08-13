// Place at: src/quiz/QuestionTimer.jsx
// Countdown runs entirely client-side off `endsAt` (a server timestamp), not
// a network tick every second - serverNow/clientNowAtFetch let it correct
// for clock skew once, at mount, rather than trusting the browser's own
// clock against a server-issued deadline.
import { useEffect, useState } from 'react'

function QuestionTimer({ endsAt, serverNow, isPaused, onExpire }) {
  const skewMs = serverNow ? serverNow - Date.now() : 0
  const [secondsLeft, setSecondsLeft] = useState(() => remaining(endsAt, skewMs))

  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(() => {
      const next = remaining(endsAt, skewMs)
      setSecondsLeft(next)
      if (next <= 0) clearInterval(interval)
    }, 250)
    return () => clearInterval(interval)
  }, [endsAt, skewMs, isPaused])

  // Fires onExpire exactly once, the render after secondsLeft first reaches 0.
  useEffect(() => {
    if (secondsLeft === 0) onExpire?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft === 0])

  return (
    <div style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 700 }}>
      {isPaused ? '⏸ Paused' : `⏱ ${secondsLeft} second${secondsLeft === 1 ? '' : 's'}`}
    </div>
  )
}

function remaining(endsAt, skewMs) {
  if (!endsAt) return 0
  const msLeft = new Date(endsAt).getTime() - (Date.now() + skewMs)
  return Math.max(0, Math.ceil(msLeft / 1000))
}

export default QuestionTimer
