// Place at: src/QuizRoom.jsx
// The one persistent route a player sits on for an entire game - which of
// Lobby/LiveQuestion/Scoreboard/FinalResults renders is driven entirely by
// room.state/live_phase from quiz_rooms, kept live via a Postgres Changes
// subscription (quiz_rooms carries no secrets, see the quiz_tables
// migration, so it's the one quiz table safe to replicate in full). The
// player list/leaderboard is a separate Broadcast subscription instead,
// since quiz_players can never go on Postgres Changes without leaking
// player_secret to every subscriber.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { LoadingState } from './LoadingState'
import { ErrorState } from './ErrorState'
import { getQuizIdentityToken, getStoredPlayerCredential, storePlayerCredential } from './quizIdentity'
import { invokeQuiz } from './quizApi'
import QuizLobbyView from './quiz/QuizLobbyView'
import QuizLiveQuestionView from './quiz/QuizLiveQuestionView'
import QuizScoreboardView from './quiz/QuizScoreboardView'
import QuizFinalResultsView from './quiz/QuizFinalResultsView'

function QuizRoom() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [credential, setCredential] = useState(() => getStoredPlayerCredential(roomId))
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!credential) { navigate('/lab/quiz/join'); return }

    let cancelled = false

    async function bootstrap() {
      const { data: initialRoom, error } = await supabase.from('quiz_rooms').select('*').eq('id', roomId).single()
      if (cancelled) return
      if (error || !initialRoom) { setNotFound(true); return }
      setRoom(initialRoom)

      // Re-joining (idempotent, resumes the same row via unique(room_id,
      // identity_id)) both refreshes this browser's credential and forces a
      // fresh players_updated broadcast, which is otherwise the only way
      // this page would ever learn who else is in the room after a reload
      // (Broadcast is ephemeral - there's nothing to "fetch" once, only
      // future events to subscribe to).
      try {
        const result = await invokeQuiz('join-quiz-room', {
          code: initialRoom.code, nickname: credential.nickname, avatar: credential.avatar,
          identity_token: getQuizIdentityToken(),
        })
        if (cancelled) return
        storePlayerCredential(roomId, { ...result, nickname: credential.nickname, avatar: credential.avatar })
        setCredential({ ...credential, player_id: result.player_id, player_secret: result.player_secret })
      } catch {
        // Room may have moved past 'lobby'/'setup' (join-quiz-room rejects
        // mid-game joins) - the stored credential still works for
        // submit-quiz-answer/set-player-ready either way, so just continue.
      }
    }
    bootstrap()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  useEffect(() => {
    if (!credential) return

    const roomChannel = supabase.channel(`quiz-room-state:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quiz_rooms', filter: `id=eq.${roomId}` },
        payload => setRoom(payload.new))
      .subscribe()

    const playersChannel = supabase.channel(`quiz-room:${roomId}`)
      .on('broadcast', { event: 'players_updated' }, ({ payload }) => setPlayers(payload.players))
      .subscribe()

    return () => {
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(playersChannel)
    }
  }, [roomId, credential])

  async function handleToggleReady(ready) {
    await invokeQuiz('set-player-ready', {
      room_id: roomId, player_id: credential.player_id, player_secret: credential.player_secret, ready,
    }).catch(() => {})
  }

  if (notFound) return <ErrorState message="This quiz room no longer exists." />
  if (!room || !credential) return <LoadingState />

  if (room.state === 'setup' || room.state === 'lobby') {
    return <QuizLobbyView room={room} players={players} ownPlayerId={credential.player_id} onToggleReady={handleToggleReady} />
  }
  if (room.state === 'live' && room.live_phase === 'question') {
    return <QuizLiveQuestionView roomId={roomId} room={room} credential={credential} />
  }
  if (room.state === 'live' && room.live_phase === 'scoreboard') {
    return <QuizScoreboardView roomId={roomId} room={room} players={players} ownPlayerId={credential.player_id} />
  }
  if (room.state === 'finished') {
    return <QuizFinalResultsView room={room} players={players} ownPlayerId={credential.player_id} />
  }
  return <LoadingState />
}

export default QuizRoom
