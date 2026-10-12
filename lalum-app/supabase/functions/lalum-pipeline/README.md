# lalum-pipeline

Source of the deployed edge function `lalum-pipeline` (Supabase project `meoymkcotomoluwlwues`), as a
bundled `index.js`. It carries the PII shield, the conflict engine, the playbook analysis and the draft,
analyze and export routes of the case cockpit. Until this folder existed the source lived only in
Supabase.

## State of this copy

Deployed as **version 21** (2026-10-11, `ezbr_sha256` 4a1ae863...): version 20 plus two changes. The live smoke test (OPTIONS 204, unauthenticated POST 401) was not run from the build environment and is still owed:

1. `draftRoute` calls the database function `lalum_token_floor` (migration `0030`, already applied) and
   reserves its answer in the vault, so a token number is never issued twice within a document.
2. An address detector (`detectAddresses`, kind `ADDRESS`, token `[ADDRESS_n]`): see below.

## Why

The shield issues tokens such as `[CLIENT_NAME_2]`. The browser keeps, for the session only, a map from
each token to the original text and puts the real names back on export. The draft route used to floor its
counters only from the tokens present in the text being saved. After a token was deleted and a different
name typed, the same number was issued again and the export restored the old name in its place, with no
signal. The floor now comes from the original text, the current text and every stored version.

There is no valid client side guard: from the browser a reused number is indistinguishable from the
original, so the fix has to be here. Documents saved before this fix may already contain a reused number;
that cannot be detected afterwards, because the tokens carry no value.

## Address detector

Hebrew and Latin street addresses (a street marker, or a known city, next to a house number; apartment
and floor tails; a PO box; a house number before the street). It is a heuristic, like the name heuristics:
it lowers the confidence to 0.8 so every address counts toward `needsReview`, it is **not** in
`assertClean` (a false positive there would block a legitimate save) and addresses never reach the
conflict engine. The client still keeps its workaround (`UNMASKED_FIELDS` in
`src/lib/cockpit/templates.ts` holds `client_address` back from the server); remove that entry only after
the live smoke test passes.

`npm run address-check` measures it on three labelled sets and on 1.08M characters of real legal articles.
Read the honesty note at the top of that script: the first run on the independent set scored 76 percent
recall and 79 percent precision, and the detector was then generalised, so the final 100 percent is on sets
it was tuned on. The only independent negative measure is the corpus scan (0 detections). Expect misses
on unusual forms and some false positives on a word, a number and a city in a row.

## Test

`npm run token-floor-check` and `npm run address-check` cut the shield out of this file and runs it: it reproduces the reuse without
the floor, shows it gone with the floor, and checks that the route asks for the floor.

## Deploying

Deploys need the owner's explicit approval. The function is deployed as one bundled file (`index.js`,
no import map). Deploy with the Supabase MCP `deploy_edge_function` or `supabase functions deploy
lalum-pipeline`, with `verify_jwt` false as it is today. The change is safe in any order against the
migration: if `lalum_token_floor` is missing the route falls back to the old behaviour.
