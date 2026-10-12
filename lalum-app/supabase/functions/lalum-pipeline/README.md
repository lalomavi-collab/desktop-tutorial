# lalum-pipeline

Source of the deployed edge function `lalum-pipeline` (Supabase project `meoymkcotomoluwlwues`), as a
bundled `index.js`. It carries the PII shield, the conflict engine, the playbook analysis and the draft,
analyze and export routes of the case cockpit. Until this folder existed the source lived only in
Supabase.

## State of this copy

Version 20 as deployed, plus **one change that is not deployed yet**: `draftRoute` calls the database
function `lalum_token_floor` (migration `0030`, already applied) and reserves its answer in the vault, so
a token number is never issued twice within a document.

## Why

The shield issues tokens such as `[CLIENT_NAME_2]`. The browser keeps, for the session only, a map from
each token to the original text and puts the real names back on export. The draft route used to floor its
counters only from the tokens present in the text being saved. After a token was deleted and a different
name typed, the same number was issued again and the export restored the old name in its place, with no
signal. The floor now comes from the original text, the current text and every stored version.

There is no valid client side guard: from the browser a reused number is indistinguishable from the
original, so the fix has to be here. Documents saved before this fix may already contain a reused number;
that cannot be detected afterwards, because the tokens carry no value.

## Test

`npm run token-floor-check` cuts the shield out of this file and runs it: it reproduces the reuse without
the floor, shows it gone with the floor, and checks that the route asks for the floor.

## Deploying

Not done without the owner's explicit approval. The function is deployed as one bundled file (`index.js`,
no import map). Deploy with the Supabase MCP `deploy_edge_function` or `supabase functions deploy
lalum-pipeline`, with `verify_jwt` false as it is today. The change is safe in any order against the
migration: if `lalum_token_floor` is missing the route falls back to the old behaviour.
