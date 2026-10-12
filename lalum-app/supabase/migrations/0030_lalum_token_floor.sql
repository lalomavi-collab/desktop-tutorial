-- Highest token number ever used per kind in one document, so the draft route can floor the shield's
-- counters and never issue a token number twice (see supabase/functions/lalum-pipeline/README.md).
-- Reads the original masked text, the current text and every stored version. Service role only: it is
-- called from the edge function, never from a browser. Applied to project meoymkcotomoluwlwues.
create or replace function public.lalum_token_floor(p_doc uuid, p_firm uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_object_agg(kind, mx), '{}'::jsonb) from (
    select m[1] as kind, max(m[2]::int) as mx
      from (
        select regexp_matches(t, '\[([A-Z][A-Z_]*)_(\d{1,9})\]', 'g') as m
          from (
            select baseline_content as t from public.lalum_matter_documents where id = p_doc and firm_id = p_firm
            union all
            select editor_content from public.lalum_matter_documents where id = p_doc and firm_id = p_firm
            union all
            select content from public.lalum_document_versions where document_id = p_doc and firm_id = p_firm
          ) s
      ) r
     group by m[1]
  ) q $$;
revoke execute on function public.lalum_token_floor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.lalum_token_floor(uuid, uuid) to service_role;
