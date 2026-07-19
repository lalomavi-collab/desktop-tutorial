-- 0003_voice_agent.sql
-- Voice AI Agent: call lifecycle, transcripts, intent classification, and the
-- compliance/risk audit trail (RECIR framework adaptation).
--
-- Design notes:
--   * All operational writes happen through the streaming server using the
--     service role, so no client INSERT/UPDATE policies are defined here.
--   * pgvector powers Retrieval-Augmented Generation (RAG) over enterprise
--     knowledge (service terms, FAQs, public guidelines).
--   * Every row that the agent speaks is traceable to a compliance score and,
--     when intercepted, to a compliance_violations record.

create extension if not exists vector;

-- ── Enumerated states (kept as text + check for easy migration) ────────────────
-- call.status  : lifecycle of a phone call
-- turn.role    : who produced a transcript segment
-- risk.decision: outcome of the pre-flight RECIR check

-- ── calls: one row per inbound phone call ─────────────────────────────────────
create table if not exists public.calls (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null default 'twilio'
                       check (provider in ('twilio','livekit')),
  provider_call_sid  text unique,
  from_number        text,
  to_number          text,
  status             text not null default 'ringing'
                       check (status in (
                         'ringing','in_progress','escalated',
                         'completed','failed','abandoned')),
  escalated          boolean not null default false,
  escalation_reason  text,
  turn_count         int not null default 0,
  avg_compliance     numeric(4,3),
  metadata           jsonb not null default '{}'::jsonb,
  started_at         timestamptz not null default now(),
  answered_at        timestamptz,
  ended_at           timestamptz
);

create index if not exists calls_status_idx    on public.calls (status, started_at desc);
create index if not exists calls_from_idx       on public.calls (from_number, started_at desc);

-- ── transcripts: every STT/TTS turn, in order ─────────────────────────────────
create table if not exists public.transcripts (
  id             uuid primary key default gen_random_uuid(),
  call_id        uuid not null references public.calls(id) on delete cascade,
  turn_index     int not null,
  role           text not null check (role in ('caller','agent','system')),
  content        text not null,
  is_final       boolean not null default true,
  stt_confidence numeric(4,3),
  latency_ms     int,
  created_at     timestamptz not null default now(),
  unique (call_id, turn_index, role)
);

create index if not exists transcripts_call_idx
  on public.transcripts (call_id, turn_index);

-- ── intent_logs: classified caller intent + extracted entities per turn ───────
-- Drives the Action Execution Layer (DOM framework): scheduling, lead capture,
-- task generation. entities holds the structured JSON extracted by function
-- calling; action_status tracks the downstream trigger.
create table if not exists public.intent_logs (
  id             uuid primary key default gen_random_uuid(),
  call_id        uuid not null references public.calls(id) on delete cascade,
  turn_index     int not null,
  intent         text not null,
  confidence     numeric(4,3),
  entities       jsonb not null default '{}'::jsonb,
  action         text,
  action_status  text not null default 'none'
                   check (action_status in (
                     'none','pending','succeeded','failed','skipped')),
  action_result  jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists intent_logs_call_idx  on public.intent_logs (call_id, turn_index);
create index if not exists intent_logs_intent_idx on public.intent_logs (intent, created_at desc);

-- ── compliance_violations: RECIR interceptions (the audit spine) ──────────────
-- One row every time the risk layer intercepts, redirects, or escalates. Kept
-- separate from transcripts so auditors can read the risk history in isolation.
create table if not exists public.compliance_violations (
  id                 uuid primary key default gen_random_uuid(),
  call_id            uuid not null references public.calls(id) on delete cascade,
  turn_index         int,
  category           text not null check (category in (
                       'unauthorized_advice','binding_commitment',
                       'confidential_exposure','financial_commitment',
                       'hallucination_risk','out_of_scope','other')),
  severity           text not null default 'medium'
                       check (severity in ('low','medium','high','critical')),
  compliance_score   numeric(4,3) not null,
  decision           text not null check (decision in (
                       'allowed','redirected','blocked','escalated')),
  triggered_text     text,
  replacement_text   text,
  detector           text not null default 'rule'
                       check (detector in ('rule','llm_judge','hybrid')),
  created_at         timestamptz not null default now()
);

create index if not exists compliance_call_idx
  on public.compliance_violations (call_id, created_at);
create index if not exists compliance_severity_idx
  on public.compliance_violations (severity, created_at desc);

-- ── knowledge_chunks: RAG corpus with pgvector embeddings ─────────────────────
-- 1536 dims matches common embedding models; adjust to your embedder.
create table if not exists public.knowledge_chunks (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  title       text,
  content     text not null,
  category    text not null default 'general'
                check (category in (
                  'service_terms','faq','public_guideline','pricing','general')),
  is_public   boolean not null default true,
  embedding   vector(1536),
  metadata    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- IVFFlat index for cosine similarity. Build after the table has data for best
-- recall; lists is tuned to corpus size (sqrt(rows) is a good starting point).
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists knowledge_chunks_category_idx
  on public.knowledge_chunks (category) where is_public = true;

-- ── match_knowledge: cosine similarity search for the retriever ───────────────
-- Returns only public chunks above a similarity threshold, honouring the
-- Sandbox Guardrail (never surface confidential rows to the agent).
create or replace function public.match_knowledge(
  query_embedding vector(1536),
  match_threshold  float default 0.72,
  match_count      int   default 5
)
returns table (
  id         uuid,
  source     text,
  title      text,
  content    text,
  category   text,
  similarity float
)
language sql stable
as $$
  select
    kc.id, kc.source, kc.title, kc.content, kc.category,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where kc.is_public = true
    and kc.embedding is not null
    and 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

-- ── RLS: operational tables are service-role only; admins may read ────────────
alter table public.calls                 enable row level security;
alter table public.transcripts           enable row level security;
alter table public.intent_logs           enable row level security;
alter table public.compliance_violations enable row level security;
alter table public.knowledge_chunks      enable row level security;

-- Admin read policies (reuse the platform admin flag on ldr_profiles).
do $$
declare
  t text;
begin
  foreach t in array array[
    'calls','transcripts','intent_logs','compliance_violations','knowledge_chunks'
  ]
  loop
    execute format('drop policy if exists %I_admin_read on public.%I', t, t);
    execute format($f$
      create policy %I_admin_read on public.%I
        for select using (
          exists (
            select 1 from public.ldr_profiles p
            where p.id = auth.uid() and p.is_admin = true
          )
        )
    $f$, t, t);
  end loop;
end $$;
-- (No client write policies: the streaming server writes with the service role.)
