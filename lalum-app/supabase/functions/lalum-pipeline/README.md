# lalum-pipeline

Source of the deployed edge function `lalum-pipeline` (Supabase project `meoymkcotomoluwlwues`), as a
bundled `index.js`. It carries the PII shield, the conflict engine, the playbook analysis and the draft,
analyze and export routes of the case cockpit. Until this folder existed the source lived only in
Supabase.

## State of this copy

Deployed as **version 21** (2026-10-11, `ezbr_sha256` 4a1ae863...): version 20 plus two changes. Live smoke test passed (OPTIONS 204, unauthenticated POST 401, run by the owner):

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
conflict engine. The client workaround (`client_address` in `UNMASKED_FIELDS`) was removed once the live smoke test passed; the address now goes through the shield like any other field.

## Health check: GET /selftest

`GET .../functions/v1/lalum-pipeline/selftest` masks one fixed synthetic string and returns it. It takes no
input, reads no database row and needs no secret, so it can stay public. After every deploy, open it and
compare with the expected answer; it proves the deployed bundle is the one with the current shield:

```
{"masked":"מר [CLIENT_NAME_1], ת.ז. [ID_NUMBER_1], טלפון [PHONE_1], דוא\"ל [EMAIL_1], ברחוב [ADDRESS_1], חשבון בנק [BANK_ACCOUNT_1], [CLIENT_NAME_2], Adv"}
```

From version 27 the string ends with a synthetic `John Smith, Adv`. Versions 24 to 26 answer without the last part,
so this line alone tells which of them is live.

Note that the street name is masked and the word "ברחוב" is kept; `lalum-inquiry-email` uses a different
address rule and answers `ב[ADDRESS_1]`.

## Deploying

Deploys need the owner's explicit approval. The function is deployed as one bundled file (`index.js`,
no import map). Deploy with the Supabase MCP `deploy_edge_function` or `supabase functions deploy
lalum-pipeline`, with `verify_jwt` false as it is today. The change is safe in any order against the
migration: if `lalum_token_floor` is missing the route falls back to the old behaviour.

## Version 22 (deployed 2026-10-12): conflict role policy

A name that repeats across matters is flagged only when at least one side is a declared party (CLIENT or
ADVERSE). Two undeclared mentions (OTHER on both sides) are ignored. Why: in production 8 of 10 matters were
POTENTIAL (`ROLE_UNKNOWN_MATCH`) for that reason alone, 261 shared name indexes, none involving a declared
party, because bulk import sends no parties and the engine had never seen a declared ADVERSE. The owner chose
this policy. Cost: two imported documents that both only mention a person no longer raise anything; the match
appears the moment either side is declared. Existing matters keep their stored status; nothing is recomputed.
Tests: `npm run conflict-check`.

## Version 27 (not deployed): a title after the name (T49)

Only a title before a name was recognized (`Adv John Smith`, `עו"ד יוסי לוינסון`). A signature line puts it
after the name: `John Smith, Adv`, `Jane Doe Esq.`, `Dan Levi CPA`, `יוסי לוינסון, עו"ד`. Those names reached
the model unmasked. Version 27 adds two heuristics next to the existing ones, with the same confidence (0.75):
English `Adv`, `Esq` or `CPA` after one to three capitalized words, and Hebrew `עו"ד` or `רו"ח` after a comma.
Without the comma a Hebrew title usually opens the next name, which the title rule already takes. Stop words
before the comma are cut, as for the other Hebrew heuristics. `/selftest` changed with it (above).

Source: `lalomavi-collab/LALUMap`, `lib/ai/anonymizerProxy.ts`, with the same cases in `tests/pii-corpus.test.ts`.
The bundle here was edited in the same three places (two regular expressions, the loop that runs them, the
probe); `npm run pipeline-shield-check` cuts the shield out of `index.js` and runs the cases against it.
Deploy order: version 26 first (day 2, step 6: the gateway token, then the deploy), then version 27 on its own
approval. Rollback: the Versions menu of the function, back to version 26.
