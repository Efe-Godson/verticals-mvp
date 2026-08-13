// Place at: src/quiz/QuizLobbyView.jsx
import RoomCodeBadge from './RoomCodeBadge'
import PlayerList from './PlayerList'

function QuizLobbyView({ room, players, ownPlayerId, onToggleReady }) {
  const ownPlayer = players.find(p => p.id === ownPlayerId)

  return (
    <div className="page">
      <h1 style={{ marginBottom: '0.3rem' }}>{room.name}</h1>
      <div style={{ marginBottom: '1.2rem' }}><RoomCodeBadge code={room.code} /></div>
      <p style={{ color: 'var(--color-muted)' }}>Waiting for the host to start the quiz...</p>

      <div style={{ margin: '1.2rem 0' }}>
        <PlayerList players={players} ownPlayerId={ownPlayerId} />
      </div>

      {ownPlayer && (
        <button
          className={ownPlayer.is_ready ? 'secondary' : undefined}
          onClick={() => onToggleReady(!ownPlayer.is_ready)}
        >
          {ownPlayer.is_ready ? 'Not Ready' : "I'm Ready"}
        </button>
      )}
    </div>
  )
}

export default QuizLobbyView
