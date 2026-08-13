// Place at: src/JoinQuizRoom.jsx
// Anonymous join flow: room code + nickname + optional avatar. No Verticals
// login involved - join-quiz-room issues the actual write credential this
// browser plays with, stored via storePlayerCredential (see quizIdentity.js).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from './Toast'
import { invokeQuiz } from './quizApi'
import { getQuizIdentityToken, storePlayerCredential } from './quizIdentity'

const AVATARS = ['🙂', '🐱', '🐶', '🦊', '🐼', '🐸', '🦁', '🐵', '🦄', '🐯', '🐨', '🐷']

function JoinQuizRoom() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [joining, setJoining] = useState(false)

  async function handleJoin(e) {
    e.preventDefault()
    if (!code.trim()) return showToast('Enter a room code', 'error')
    if (!nickname.trim()) return showToast('Enter a nickname', 'error')

    setJoining(true)
    try {
      const result = await invokeQuiz('join-quiz-room', {
        code: code.trim(), nickname: nickname.trim(), avatar, identity_token: getQuizIdentityToken(),
      })
      storePlayerCredential(result.room.id, { ...result, nickname: nickname.trim(), avatar })
      navigate(`/lab/quiz/room/${result.room.id}/play`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="page">
      <h1>Join a Room</h1>
      <form onSubmit={handleJoin} className="card" style={{ padding: '1.3rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <label>
          Room Code
          <input
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="QZ-4821" style={{ width: '100%', marginTop: '0.3rem', fontFamily: 'monospace', letterSpacing: '0.05em' }}
          />
        </label>
        <label>
          Your Name
          <input value={nickname} onChange={e => setNickname(e.target.value)} maxLength={24} style={{ width: '100%', marginTop: '0.3rem' }} />
        </label>
        <div>
          Avatar
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem' }}>
            {AVATARS.map(a => (
              <button
                type="button" key={a} onClick={() => setAvatar(a)}
                className="secondary"
                style={{
                  fontSize: '1.2rem', padding: '0.5rem 0.7rem',
                  border: `2px solid ${avatar === a ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={joining}>{joining ? 'Joining...' : 'Join Room'}</button>
      </form>
    </div>
  )
}

export default JoinQuizRoom
