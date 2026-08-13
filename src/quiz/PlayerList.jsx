// Place at: src/quiz/PlayerList.jsx
// Lobby player list - name, optional avatar, ready status. Used by both the
// player-facing lobby and the admin dashboard's "View Players" panel.
function PlayerList({ players, ownPlayerId }) {
  if (!players.length) {
    return <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Waiting for players to join...</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {players.map(p => (
        <div
          key={p.id}
          className="card"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.6rem 0.9rem',
            borderColor: p.id === ownPlayerId ? 'var(--color-primary)' : 'var(--color-border)',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>{p.avatar || '🙂'}</span>
          <span style={{ flex: 1, fontWeight: p.id === ownPlayerId ? 700 : 400 }}>
            {p.nickname}{p.id === ownPlayerId ? ' (you)' : ''}
          </span>
          <span style={{
            fontSize: '0.78rem', fontWeight: 600,
            color: p.is_ready ? 'var(--status-good)' : 'var(--color-muted)',
          }}>
            {p.is_ready ? 'Ready' : 'Not ready'}
          </span>
        </div>
      ))}
    </div>
  )
}

export default PlayerList
