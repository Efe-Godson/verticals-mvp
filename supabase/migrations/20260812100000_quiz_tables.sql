-- Quiz: a real-time multiplayer AI-generated MCQ quiz game, Lab-only for now
-- (see AdminOnlyRoute-gated /lab/quiz/* routes). Structurally unlike every
-- other template - players join anonymously by room code (no Verticals
-- login), so most of the design below is about keeping two things away from
-- anonymous browsers: the correct-answer key, and per-player answer rows
-- (which leak the key by aggregation the instant one player answers
-- correctly). Only quiz_rooms is directly readable via RLS; everything else
-- has RLS enabled with no policies at all (default-deny) and is read/written
-- exclusively through edge functions using the service role key - the same
-- "writes mediated by a function" shape submit-form/manage-submission already
-- use for anonymous form respondents, just extended here to reads too.

create table quiz_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  topic text,
  admin_user_id uuid not null references auth.users(id),
  state text not null default 'setup' check (state in ('setup', 'lobby', 'live', 'finished')),
  live_phase text check (live_phase in ('question', 'scoreboard')),
  question_count int not null check (question_count between 1 and 20),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'mixed')),
  question_type text not null check (question_type in ('mcq', 'true_false', 'mixed')),
  time_per_question_seconds int not null check (time_per_question_seconds in (10, 20, 30, 60)),
  current_question_index int not null default -1,
  current_question_started_at timestamptz,
  current_question_ends_at timestamptz,
  is_paused boolean not null default false,
  paused_at timestamptz,
  ai_prompt text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Codes recycle once a room is soft-deleted - a partial index instead of a
-- plain unique constraint so an old code isn't permanently burned out of the
-- small QZ-XXXX space.
create unique index quiz_rooms_code_key on quiz_rooms (code) where deleted_at is null;

alter table quiz_rooms enable row level security;

-- The only Quiz table read directly by the client. It carries no secrets
-- (no answer keys, no player write-credentials), so it's safe to expose
-- whole to anyone, logged in or not - players need this to see room/game
-- state without an account, and it's what Postgres Changes replicates for
-- the live lobby/question/scoreboard sync. All writes go through edge
-- functions with the service role key instead of policies here.
create policy "Anyone can view active quiz rooms"
on quiz_rooms for select
to public
using (deleted_at is null);

alter publication supabase_realtime add table quiz_rooms;


create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references quiz_rooms(id) on delete cascade,
  idx int not null,
  type text not null check (type in ('mcq', 'true_false')),
  prompt text not null,
  options jsonb not null,
  correct_option_index int not null,
  explanation text,
  difficulty text,
  duration_seconds int not null,
  created_at timestamptz not null default now(),
  unique (room_id, idx)
);

-- RLS enabled, no policies: default-deny for every role, including
-- authenticated. Exposing this table would hand out correct_option_index -
-- only the service-role-backed edge functions ever read or write it, and
-- they decide what's safe to reveal based on the room's live_phase.
alter table quiz_questions enable row level security;


create table quiz_player_identities (
  id uuid primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_nickname text
);

-- id is client-generated (crypto.randomUUID(), stored in localStorage) and
-- doubles as the identity token itself - there's nothing else to protect
-- here beyond keeping it off any read path that isn't the player's own
-- device presenting the same token back, which join-quiz-room enforces.
alter table quiz_player_identities enable row level security;


create table quiz_players (
  id uuid primary key default gen_random_uuid(),
  -- The actual write credential for this player's row - returned once by
  -- join-quiz-room to the joining browser and never by any read path, so
  -- there's no way for another player to read it off the public leaderboard
  -- and hijack this player's answers.
  player_secret uuid not null default gen_random_uuid(),
  room_id uuid not null references quiz_rooms(id) on delete cascade,
  identity_id uuid not null references quiz_player_identities(id),
  nickname text not null,
  avatar text,
  is_ready boolean not null default false,
  total_points int not null default 0,
  correct_count int not null default 0,
  fastest_answer_ms int,
  final_rank int,
  joined_at timestamptz not null default now(),
  -- Rejoining the same room from the same device resumes this row (and its
  -- existing score) instead of creating a duplicate player.
  unique (room_id, identity_id)
);

-- RLS enabled, no policies: reads are served by edge functions (which
-- sanitize out player_secret/identity_id) and pushed live via a Broadcast
-- channel, never Postgres Changes - Realtime's replication payload can't
-- hide a column, so this table can never go on the publication without
-- leaking player_secret.
alter table quiz_players enable row level security;


create table quiz_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references quiz_rooms(id) on delete cascade,
  question_id uuid not null references quiz_questions(id) on delete cascade,
  player_id uuid not null references quiz_players(id) on delete cascade,
  selected_option_index int,
  is_correct boolean not null,
  points_awarded int not null default 0,
  response_ms int not null,
  answered_at timestamptz not null,
  -- The actual double-submission guard: race-safe at the database level,
  -- unlike a read-then-check in the edge function.
  unique (question_id, player_id)
);

-- RLS enabled, no policies: raw rows would leak is_correct per option live
-- during a question (i.e. leak the answer key by aggregation) the moment
-- the first player answers correctly. Only read by service-role functions
-- (admin analytics, scoring).
alter table quiz_answers enable row level security;
