# LALUM overlay for Impeccable (binding)

This overlay narrows the skill to what the repository allows. The rules in the root `CLAUDE.md` outrank everything in this skill. Where the two disagree, `CLAUDE.md` wins, and then this file.

## Allowed commands

Evaluate and refine, in the Design lane only:

- `critique`, `audit`: read only evaluation. Report findings, change nothing.
- `polish`, `layout`, `typeset`, `adapt`, `optimize`, `harden`, `colorize`, `quieter`, `distill`, `animate`: only when the user names the command and a target, and only within the existing design system.

## Forbidden without the owner's explicit request in the current message

- `bolder`, `overdrive`, `delight`: they push the look away from the brand.
- `clarify`: it rewrites copy. Copy is shared across five languages and the prerender, and the Design lane does not change copy.
- `craft`, `shape`, `new-work`, `init`, `document`, `extract`, `live`, `generate`: they create new visual worlds, overwrite `PRODUCT.md` and `DESIGN.md`, or inject scripts into the dev server.
- `hooks on`, `pin`, and any write to `.claude/settings.json`, `.claude/settings.local.json` or `~/.claude`. The repository already has a `Stop` hook for Telegram, and the detector must not be added beside it.

## Brand rules that apply to every output

1. **Logo.** Only the `Wordmark` component (`lalum-app/src/components/Wordmark.tsx`) or the files named in `lalum-app/brand/README.md`. Never set the name in a typeface, never invent or restore a mark.
2. **Palette and type in the app** come from `lalum-app/src/index.css` and `lalum-app/DESIGN.md`. Do not introduce new colours, fonts, gradients or "out of distribution" directions. The skill's instinct to be bold is switched off here: the brief wins, and the brief is the existing system.
3. **Documents, posts and decks** (docx, html, pdf, social images) use the Prestige palette from `CLAUDE.md`: Obsidian `#1B1B1B`, Gold `#D4AF37`, Cream `#FFFDD0`, Burgundy `#800020`. The app and the documents are two systems. Do not mix them.
4. **Hebrew is the primary language.** Use `dir="rtl"` and `lang="he"`, logical properties (`margin-inline-start`, not `margin-left`), and the Hebrew font stack from `index.css`. Check every layout in RTL first, then LTR for English. The detector and the skill's examples assume LTR, so treat their layout findings as suspect until checked in RTL.
5. **Dashes.** Never use an em-dash, an en-dash or a spaced hyphen as punctuation in any text the skill produces, including code comments, reports and DESIGN.md. Use a comma, period, colon or parentheses.
6. **The name.** In Hebrew always `ד״ר עו״ד אברהם ללום`; in English `Dr. Avraham Lalum, Adv.`.
7. **Two focus areas only**, Legal AI and real estate with urban renewal. The home hero speaks about Legal AI alone. Do not add mediation content or new areas.
8. **Sources.** Never add a ruling, statute, fine or date to a design or mock-up that was not verified against its own text.

## Working rules

- Before any non-trivial change: `git fetch origin main`, check open pull requests, one subject per pull request.
- Never push to `main`. Touch the fewest lines of shared files.
- A change that crosses into copy, structure or navigation is out of lane: do the smallest thing and say so in the pull request.
- Verify by rendering at 375, 768 and 1280 px, in Hebrew RTL and in English.

## The engine binary

The skill's `scripts/impeccable` launcher downloads an unaudited executable from GitHub releases on first run. It is not installed and must not be fetched automatically.

- Do not run `scripts/impeccable` (any verb) in this repository until the owner has downloaded the binary himself, verified it, and set `IMPECCABLE_BIN`.
- Without the binary, follow the launcher-unavailable path in `SKILL.md`: read `lalum-app/PRODUCT.md` and `lalum-app/DESIGN.md` directly and continue.
- `critique`, `audit` and `polish` work without the engine as written playbooks. Skip any step that needs the `detect`, `context` or `live` verbs.
