// Place at: supabase/functions/set-player-ready/index.ts
// Deploy: supabase functions deploy set-player-ready
// Public, unauthenticated (verify_jwt = false) - a player toggling their own
// ready status in the lobby. requirePlayerCredential is the only access
// control (see _shared/quiz.ts).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders, requirePlayerCredential, broadcastPlayers } from '../_shared/quiz.ts'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { room_id, player_id, player_secret, ready } = await req.json()
    if (!room_id) return jsonResponse({ error: 'room_id is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const credential = await requirePlayerCredential(supabase, room_id, player_id, player_secret)
    if (credential.error) return jsonResponse({ error: credential.error }, credential.status)

    const { error } = await supabase
      .from('quiz_players').update({ is_ready: !!ready }).eq('id', player_id)
    if (error) throw error

    await broadcastPlayers(supabase, room_id)

    return jsonResponse({ ok: true })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
