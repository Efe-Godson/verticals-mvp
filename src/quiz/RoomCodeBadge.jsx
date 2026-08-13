// Place at: src/quiz/RoomCodeBadge.jsx
import { useState } from 'react'

function RoomCodeBadge({ code }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      className="secondary"
      onClick={copy}
      title="Copy room code"
      style={{
        fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.08em',
        padding: '0.6rem 1.2rem', fontFamily: 'monospace'
      }}
    >
      {copied ? 'Copied!' : code}
    </button>
  )
}

export default RoomCodeBadge
