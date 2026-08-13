// Place at: src/quiz/Leaderboard.jsx
// Live ranked leaderboard with a rank-change indicator ("↑ You moved from
// #4 -> #2"). Rank deltas are computed by diffing this render's incoming
// `players` against the previous render's ranks (kept in a ref) rather than
// asking the server for a delta - the server already sends a fresh full
// ranking on every players_updated broadcast, this just remembers the last
// one it saw.
import { useEffect, useRef, useState } from 'react'
import MedalRank from './MedalRank'

function Leaderboard({ players, ownPlayerId }) {
  const previousRanksRef = useRef({})
  const [ownDelta, setOwnDelta] = useState(null)

  useEffect(() => {
    const previous = previousRanksRef.current
    if (ownPlayerId && previous[ownPlayerId] != null) {
      const ownPlayer = players.find(p => p.id === ownPlayerId)
      if (ownPlayer && ownPlayer.rank !== previous[ownPlayerId]) {
        setOwnDelta({ from: previous[ownPlayerId], to: ownPlayer.rank })
      }
    }
    const next = {}
    players.forEach(p => { next[p.id] = p.rank })
    previousRanksRef.current = next
  }, [players, ownPlayerId])

  return (
    <div>
      {ownDelta && (
        <p style={{
          textAlign: 'center', fontWeight: 600, marginBottom: '0.8rem',
          color: ownDelta.to < ownDelta.from ? 'var(--status-good)' : 'var(--color-muted)',
        }}>
          {ownDelta.to < ownDelta.from ? '↑' : '↓'} You moved from #{ownDelta.from} → #{ownDelta.to}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {players.map(p => (
          <div
            key={p.id}
            className="card"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.7rem',
              padding: '0.6rem 0.9rem',
              borderColor: p.id === ownPlayerId ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          >
            <span style={{ width: '2rem', textAlign: 'center', fontWeight: 700 }}><MedalRank rank={p.rank} /></span>
            <span style={{ fontSize: '1.1rem' }}>{p.avatar || '🙂'}</span>
            <span style={{ flex: 1, fontWeight: p.id === ownPlayerId ? 700 : 400 }}>
              {p.nickname}{p.id === ownPlayerId ? ' (you)' : ''}
            </span>
            <span style={{ fontWeight: 700 }}>{p.total_points} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Leaderboard
