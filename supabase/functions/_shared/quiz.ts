// Place at: supabase/functions/_shared/quiz.ts
// Shared by every quiz-* edge function. Mirrors _shared/stats.ts's shape
// (requireFormOwner -> requireQuizAdmin, corsHeaders/jsonResponse reused as-is)
// but extends the "writes go through a service-role function" pattern
// submit-form/manage-submission already use for anonymous form respondents
// to reads too - see the quiz_tables migration for why (most quiz tables
// have RLS enabled with no policies at all, default-deny for every role).

import { corsHeaders, jsonResponse } from './stats.ts'

export { corsHeaders, jsonResponse }

// Hardcoded to the one admin account for now, matching AdminOnlyRoute in
// App.jsx - becomes "check against quiz_rooms.admin_user_id" once Quiz
// graduates out of the Lab and other users can host their own rooms.
const TEMPLATE_ADMIN_USER_ID = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe'

// Points awarded for a correct answer scale continuously with how much time
// was left, not fixed brackets - "every second matters, no weird jumps at a
// bracket edge" per the product spec. Bounded to exactly [5, 15] rather than
// a pure base*remaining% (which would trend toward 0, not floor at 5, near
// the deadline).
const MIN_CORRECT_POINTS = 5
const MAX_CORRECT_POINTS = 15
// Pure network-jitter allowance for a click that was genuinely in time but
// arrived a little late in transit - does not grant bonus points (the score
// formula's own clamp already floors at MIN_CORRECT_POINTS), it only decides
// whether the submission is accepted at all.
export const GRACE_MS = 400

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const ROOM_CODE_LENGTH = 4

export function generateRoomCode() {
  let suffix = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    suffix += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  }
  return `QZ-${suffix}`
}

// Validates the caller's JWT and confirms they're the admin account. When
// roomId is passed, also confirms that room is theirs (a room_id in a
// request body is not itself a secret - it's returned to the creating
// admin and embedded in shareable URLs - so ownership must be re-checked
// server-side same as requireFormOwner does for forms).
export async function requireQuizAdmin(req: Request, supabase: any, roomId?: string) {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return { error: 'Missing Authorization header', status: 401 }

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData?.user) return { error: 'Invalid or expired session', status: 401 }
  if (userData.user.id !== TEMPLATE_ADMIN_USER_ID) return { error: 'Not authorized', status: 403 }

  if (!roomId) return { userId: userData.user.id }

  const { data: room, error: roomError } = await supabase
    .from('quiz_rooms').select('*').eq('id', roomId).is('deleted_at', null).single()
  if (roomError || !room) return { error: 'Room not found', status: 404 }
  if (room.admin_user_id !== userData.user.id) return { error: 'Room not found', status: 404 }

  return { userId: userData.user.id, room }
}

// The actual access control for anonymous players: player_secret is
// returned once, by join-quiz-room, to the browser that created the row,
// and never by any read path - so presenting a matching (room_id, player_id,
// player_secret) triple is proof this request comes from that same browser.
export async function requirePlayerCredential(supabase: any, roomId: string, playerId: string, playerSecret: string) {
  if (!playerId || !playerSecret) return { error: 'player_id and player_secret are required', status: 400 }

  const { data: player, error } = await supabase
    .from('quiz_players').select('*')
    .eq('id', playerId).eq('room_id', roomId).eq('player_secret', playerSecret)
    .maybeSingle()
  if (error) throw error
  if (!player) return { error: 'Invalid player credentials', status: 403 }

  return { player }
}

export function scoreAnswer(isCorrect: boolean, endsAtMs: number, answeredAtMs: number, durationSeconds: number) {
  if (!isCorrect) return 0
  const remainingFraction = Math.min(1, Math.max(0, (endsAtMs - answeredAtMs) / (durationSeconds * 1000)))
  return Math.round(MIN_CORRECT_POINTS + (MAX_CORRECT_POINTS - MIN_CORRECT_POINTS) * remainingFraction)
}

// Re-fetches the room's players fresh (rather than trusting the caller to
// pass an up-to-date list) and pushes a sanitized leaderboard to everyone
// watching. Deliberately never includes player_secret/identity_id - this is
// the one payload anonymous players' browsers actually receive live, so
// leaving a credential out of the select is what keeps it off the wire,
// unlike Postgres Changes replication (which can't filter columns at all -
// the reason quiz_players is never added to that publication).
export async function broadcastPlayers(supabase: any, roomId: string) {
  const { data: players, error } = await supabase
    .from('quiz_players')
    .select('id, nickname, avatar, total_points, correct_count, is_ready, final_rank')
    .eq('room_id', roomId)
    .order('total_points', { ascending: false })
  if (error) throw error

  const ranked = (players || []).map((p: any, i: number) => ({ ...p, rank: i + 1 }))

  const channel = supabase.channel(`quiz-room:${roomId}`)
  await channel.send({ type: 'broadcast', event: 'players_updated', payload: { players: ranked } })
  await supabase.removeChannel(channel)

  return ranked
}
