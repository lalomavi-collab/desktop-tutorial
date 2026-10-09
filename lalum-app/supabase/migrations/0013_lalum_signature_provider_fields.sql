-- Add external e-signature provider fields to the signing requests. A request is
-- either signed in the portal (provider PORTAL, the built-in flow) or handed to
-- an external provider (DOCUSEAL): the provider emails the signer a link, and a
-- webhook reports back the outcome and the signed document URL. The columns are
-- written by the lalum-esign edge function (service role); clients and the firm
-- read them through the policies already on the table.
-- Applied to project meoymkcotomoluwlwues as migration "lalum_signature_provider_fields".

alter table public.lalum_signature_requests
  add column if not exists provider text not null default 'PORTAL'
    check (provider in ('PORTAL','DOCUSEAL')),
  add column if not exists provider_submission_id text,
  add column if not exists provider_slug text,
  add column if not exists signed_document_url text;

create index if not exists lalum_signature_requests_provider_sub_idx
  on public.lalum_signature_requests (provider, provider_submission_id);
