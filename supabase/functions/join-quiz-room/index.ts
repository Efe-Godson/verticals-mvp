// Place at: supabase/functions/join-quiz-room/index.ts
// Deploy: supabase functions deploy join-quiz-room
// Public, unauthenticated by design (verify_jwt = false) - the anonymous
// player join flow, same shape as submit-form for public form respondents.
// identity_token is a client-generated crypto.randomUUID() (see
// src/quizIdentity.js), sent back on every join from the same device so a
// rejoin resumes the existing quiz_players row (and its score) instead of
// creating a duplicate - the unique(room_id, identity_id) constraint is
// what makes that safe under concurrent double-submits of this same call.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders, broadcastPlayers } from '../_shared/quiz.ts'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { code, nickname, avatar, identity_token } = await req.json()
    if (!code?.trim()) return jsonResponse({ error: 'code is required' }, 400)
    if (!identity_token) return jsonResponse({ error: 'identity_token is required' }, 400)

    const trimmedNickname = (nickname || '').trim().slice(0, 24)
    if (!trimmedNickname) return jsonResponse({ error: 'nickname is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: room, error: roomError } = await supabase
      .from('quiz_rooms').select('*')
      .eq('code', code.trim().toUpperCase()).is('deleted_at', null)
      .maybeSingle()
    if (roomError) throw roomError
    if (!room) return jsonResponse({ error: 'Room not found' }, 404)
    if (!['setup', 'lobby'].includes(room.state)) {
      return jsonResponse({ error: 'This quiz has already started or finished' }, 403)
    }

    await supabase
      .from('quiz_player_identities')
      .upsert(
        { id: identity_token, last_seen_at: new Date().toISOString(), last_nickname: trimmedNickname },
        { onConflict: 'id' }
      )

    const { data: inserted, error: insertError } = await supabase
      .from('quiz_players')
      .insert([{ room_id: room.id, identity_id: identity_token, nickname: trimmedNickname, avatar: avatar || null }])
      .select('id, player_secret')
      .single()

    let player = inserted
    let resumed = false

    if (insertError) {
      if (insertError.code !== '23505') throw insertError
      resumed = true
      const { data: existing, error: updateError } = await supabase
        .from('quiz_players')
        .update({ nickname: trimmedNickname, avatar: avatar || null })
        .eq('room_id', room.id).eq('identity_id', identity_token)
        .select('id, player_secret')
        .single()
      if (updateError) throw updateError
      player = existing
    }

    await broadcastPlayers(supabase, room.id)

    return jsonResponse({
      player_id: player.id,
      player_secret: player.player_secret,
      resumed,
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        topic: room.topic,
        state: room.state,
        question_count: room.question_count,
        time_per_question_seconds: room.time_per_question_seconds,
      },
    })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
