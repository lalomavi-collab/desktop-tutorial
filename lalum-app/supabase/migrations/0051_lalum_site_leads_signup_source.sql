-- A sign-up (required to use the site assistant) is recorded as a lead, with consent, through lalum-lead-submit.
alter table public.lalum_site_leads drop constraint lalum_site_leads_source_check;
alter table public.lalum_site_leads add constraint lalum_site_leads_source_check check (source = any (array['site'::text, 'chat'::text, 'signup'::text]));
