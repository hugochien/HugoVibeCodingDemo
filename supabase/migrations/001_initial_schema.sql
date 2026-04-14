-- EchoLog — Initial Schema
-- Run this in the Supabase SQL editor or via `supabase db push`.

-- Enable UUID generation (available by default on Supabase)
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: user_rules
-- Stores per-user schema definitions for structured extraction.
-- Each row defines one field that the extraction engine should
-- look for in the user's voice transcripts.
-- ============================================================
create table if not exists public.user_rules (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  key            text not null,
  -- Use CHECK rather than an ENUM so adding new types is a simple migration.
  type           text not null check (type in ('number', 'category', 'text', 'boolean')),
  -- Native Postgres array; only populated when type = 'category'.
  allowed_values text[] default null,
  required       boolean not null default false,
  description    text default null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Prevents duplicate field keys within a single user's schema.
  constraint user_rules_user_id_key_unique unique (user_id, key)
);

-- Index for fast per-user schema lookups (most common query pattern).
create index if not exists user_rules_user_id_idx
  on public.user_rules (user_id);

-- ── updated_at trigger ────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_rules_updated_at
  before update on public.user_rules
  for each row execute function public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────
alter table public.user_rules enable row level security;

create policy "Users can view their own rules"
  on public.user_rules for select
  using (auth.uid() = user_id);

create policy "Users can insert their own rules"
  on public.user_rules for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own rules"
  on public.user_rules for update
  using (auth.uid() = user_id);

create policy "Users can delete their own rules"
  on public.user_rules for delete
  using (auth.uid() = user_id);


-- ============================================================
-- TABLE: logs
-- Stores timestamped extraction results.
-- Each row is one completed voice-entry session: the raw
-- Whisper transcript and the structured JSON payload extracted
-- from it by the LLM.
-- Logs are intentionally immutable — no UPDATE/DELETE RLS.
-- ============================================================
create table if not exists public.logs (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- JSONB (binary JSON) enables GIN indexing and O(1) key lookups.
  payload        jsonb not null default '{}'::jsonb,
  raw_transcript text not null,
  created_at     timestamptz not null default now()
);

-- Composite index: user + time — primary access pattern for the log feed.
create index if not exists logs_user_id_created_at_idx
  on public.logs (user_id, created_at desc);

-- GIN index on payload for efficient JSONB key/value queries,
-- e.g. "find all logs where payload @> '{"mood": "happy"}'".
create index if not exists logs_payload_gin_idx
  on public.logs using gin (payload);

-- ── Row Level Security ────────────────────────────────────────
alter table public.logs enable row level security;

create policy "Users can view their own logs"
  on public.logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own logs"
  on public.logs for insert
  with check (auth.uid() = user_id);

-- No UPDATE or DELETE policies — logs are append-only by design.
-- Implement soft-delete (deleted_at column) in a future migration if needed.
