-- 0069: remove the unpaged originals list of the firm export.
--
-- lalum_firm_export_originals(firm) (0066) returned every original of the firm in one answer, which is what capped the export at 1000.
-- Migration 0068 added lalum_firm_export_originals_page, and the Edge Function lalum-export-originals version 2 (deployed 2026-10-21) calls
-- only that. Nothing else calls the old one: the app, the scripts and the tests were checked by name. Left in place it is a second door to
-- every storage path of the firm behind the same gate but without a page bound and with a different audit shape, so it goes.
-- No cascade: if anything still depends on it, this fails and changes nothing.

drop function if exists public.lalum_firm_export_originals(uuid);
