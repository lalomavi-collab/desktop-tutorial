-- Live-only column of lalum_matter_documents (analysis) that the stub documents table in 02_matter_team_stub.sql lacks.
alter table public.lalum_matter_documents add column if not exists analysis jsonb not null default '{}'::jsonb;
