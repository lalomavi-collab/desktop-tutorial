-- Intake brief, phase 2 (owner, 31.10.2026): the Claude reading of a whole matter (edge function lalum-matter-brief) and
-- the lawyer's answers to the brief's questions. Answers are ids from closed lists only, never free text, so nothing typed
-- sits outside the PII shield; the check constraints make that a database rule rather than a convention.

create table if not exists public.lalum_matter_briefs (
  matter_id uuid primary key references public.lalum_cockpit_matters(id) on delete cascade,
  firm_id uuid not null,
  map jsonb not null,
  doc_ids uuid[] not null default '{}',
  model text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.lalum_matter_briefs enable row level security;

-- Written only by the edge function (service role), after it has read the matter's documents as the member; members read.
drop policy if exists lalum_matter_briefs_read on public.lalum_matter_briefs;
create policy lalum_matter_briefs_read on public.lalum_matter_briefs for select to authenticated
  using (public.lalum_my_role() is distinct from 'BOOKKEEPER' and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));

create table if not exists public.lalum_matter_brief_answers (
  matter_id uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  question_id text not null check (question_id ~ '^[a-z0-9_]{1,40}$'),
  option_id text not null check (option_id ~ '^[a-z0-9_]{1,40}$'),
  answered_by uuid,
  answered_at timestamptz not null default now(),
  primary key (matter_id, question_id)
);
alter table public.lalum_matter_brief_answers enable row level security;

drop policy if exists lalum_matter_brief_answers_read on public.lalum_matter_brief_answers;
create policy lalum_matter_brief_answers_read on public.lalum_matter_brief_answers for select to authenticated
  using (public.lalum_my_role() is distinct from 'BOOKKEEPER' and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));
drop policy if exists lalum_matter_brief_answers_insert on public.lalum_matter_brief_answers;
create policy lalum_matter_brief_answers_insert on public.lalum_matter_brief_answers for insert to authenticated
  with check (public.lalum_my_role() is distinct from 'BOOKKEEPER' and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));
drop policy if exists lalum_matter_brief_answers_update on public.lalum_matter_brief_answers;
create policy lalum_matter_brief_answers_update on public.lalum_matter_brief_answers for update to authenticated
  using (public.lalum_my_role() is distinct from 'BOOKKEEPER' and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id))
  with check (public.lalum_my_role() is distinct from 'BOOKKEEPER' and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));

-- Who answered and when are stamped by the database, so a client cannot write another member's name on an answer.
create or replace function public.lalum_brief_answer_stamp() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.answered_by := auth.uid();
  new.answered_at := now();
  return new;
end $$;
drop trigger if exists lalum_brief_answer_stamp on public.lalum_matter_brief_answers;
create trigger lalum_brief_answer_stamp before insert or update on public.lalum_matter_brief_answers
  for each row execute function public.lalum_brief_answer_stamp();
