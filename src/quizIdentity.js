// Place at: src/quizIdentity.js
// Anonymous quiz players have no Verticals account, so "who is this device"
// is tracked with two separate localStorage tokens instead of auth.uid():
// a single cross-room identity token (this file) that lets Quiz Home/Point
// History find every room this device has ever played, and a per-room write
// credential (player_id + player_secret, issued by join-quiz-room) that
// proves a request to submit-quiz-answer/set-player-ready actually comes
// from the browser that joined - see quiz_tables migration's comments on
// quiz_player_identities/quiz_players for why these are two different
// things. Both are device-local by design: a different browser or device is
// a different player, an accepted MVP limitation.

const IDENTITY_KEY = 'verticals_quiz_identity'
let cachedIdentityToken = null

export function getQuizIdentityToken() {
  if (cachedIdentityToken) return cachedIdentityToken
  let token = localStorage.getItem(IDENTITY_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(IDENTITY_KEY, token)
  }
  cachedIdentityToken = token
  return token
}

function credentialKey(roomId) {
  return `verticals_quiz_player_${roomId}`
}

export function getStoredPlayerCredential(roomId) {
  const raw = localStorage.getItem(credentialKey(roomId))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// nickname/avatar are stashed alongside the credential (not just player_id/
// player_secret) so a page remount can silently re-call join-quiz-room to
// refresh its player list (see QuizRoom.jsx) without blanking out the name
// this player already chose - join-quiz-room's upsert always applies
// whatever nickname/avatar it's given, so this is what a "just resume with
// the same identity" call needs on hand.
export function storePlayerCredential(roomId, { player_id, player_secret, nickname, avatar }) {
  localStorage.setItem(credentialKey(roomId), JSON.stringify({ player_id, player_secret, nickname, avatar }))
}

export function clearPlayerCredential(roomId) {
  localStorage.removeItem(credentialKey(roomId))
}
