# Project Rules - Prompt Builder Agent

## Writing Style - Dashes (PERMANENT)

**Never use dashes as punctuation, in chat replies or in any generated file (docx, html, pdf, posts).**

- Forbidden: em-dash `—`, en-dash `–`, and a hyphen used as a clause/sentence separator (e.g. ` - `).
- Instead use a comma, period, colon, or parentheses.
- Allowed: a hyphen that is an integral part of a word, term, identifier, date, URL, or email (e.g. `פינוי-בינוי`, `תמ"א`, `UTF-8`, `2026-06-22`, `test@lalum.legal`). These are not separators and stay as-is.

## Logo: Single Source (PERMANENT)

**Only the current logo may represent LALUM, in the app and in every deliverable.**

- The logo is the LALUM wordmark supplied in `lalum-app/brand/LALUM-LOGO.pdf`. It is artwork, not text.
- Never set the name in a typeface as a substitute, and never reuse a retired mark (the cream seal, the serif LALUM, the L in a circle, the gold dot).
- Inside the app use the `Wordmark` component (`lalum-app/src/components/Wordmark.tsx`), which inherits the surrounding colour.
- Outside the app use `public/lalum-logo.svg` on light backgrounds, `public/lalum-logo-inverse.svg` on dark ones, and `public/lalum-logo.png` only where SVG is rejected (email).
- Icons, favicons and Open Graph cards are all derived from that same artwork. Regeneration and geometry are documented in `lalum-app/brand/README.md`.
- Every produced file (docx, html, pdf, images, posts, presentations) carries this logo and no other.

## Two Focus Areas (PERMANENT)

**LALUM leads with two areas, and only two: real estate and urban renewal (in Israel and abroad), and AI.**

- AI means the full offering: advisory, ongoing accompaniment, and training. Not a second opinion alone.
- Real estate covers both sides of the border: deals and urban renewal here, and property and investment abroad.
- **Mediation and dispute resolution is not to be invested in from now on.** Its pages stay live and keep working, and it may be mentioned as a service the practice provides. Do not write new mediation articles, do not build it new pages, and do not spend promotion on it. The mediation cluster already holds 64 articles; it needs nothing more.
- Anything produced for the site (articles, posts, pages, keywords, campaigns) serves one of the two areas.
- Before writing a new article, check it does not compete with one that exists. `npm run build` fails on two articles whose titles are variations of each other, and on two pages sharing a meta description. Both defects reached production and neither was visible without looking for it.

## The Name (PERMANENT)

**In Hebrew the name is always `ד״ר עו״ד אברהם ללום`, in that order, wherever the app or the site speaks.**

- One form in the interface, in headings, in bylines, in article metadata and in the site's own prose. Before this rule the app said `ד״ר אברהם ללום` and the article metadata said `עו״ד אברהם ללום`, so the same person carried two different titles depending on which page you landed on.
- Full form on the first mention in a piece; `ד״ר ללום` on every mention after it. Repeating the full form in every sentence is not consistency, it is unreadable Hebrew. Untitled mentions stay as they are.
- In English and the other languages the name carries both titles too: `Dr. Avraham Lalum, Adv.` The Latin form keeps English word order rather than mirroring the Hebrew one, because `Dr. Adv.` reads as a mistake to a reader abroad, and abroad is half of one of the two focus areas.
- The other spellings (`אברהם ללום`, `אבי ללום`, `ד״ר ללום`) stay in the Person entity's `alternateName`. Those are what people type into a search box, and the entity needs them to resolve to one person. They are search variants, never display forms.
- `npm run build` fails on any titled mention that is not the canonical form, including a doubled title.

## Case Law: Full Double Verification Before Publishing (PERMANENT)

**A ruling goes on the site only after full verification against its own text, from two independent sources. When verification is incomplete, it does not go up at all.**

- The bar is the ruling itself: the judgment as published by the court, or a full digest that reproduces its language. A news report is corroboration, never the basis.
- Two independent sources, and they must agree on the docket number, the court, the date, the bench, and the outcome. One source is not enough, however reputable.
- Everything a record asserts has to come from what was actually read. Do not fill in a bench, a date to the day, or facts by inference. `dateLabel` says what is known (`9.12.2025` or `דצמבר 2025`), and the record says nothing beyond it.
- Separate what was decided from what was said around it. Obiter remarks, and a ruling given only on the principled level after the dispute settled, are not holdings, and presenting them as binding is its own failure.
- A record with no citation, no court, no date and no public source does not belong in `lalum-app/src/data/rulings.json`, and the types make that a compile error rather than a review comment. Anything shown on a page reads from that corpus, so a citation has exactly one home.
- Incomplete verification means it waits. A missing card is a gap; a card carrying a citation nobody opened is the exact failure the practice writes about, on the practice's own site.

## More Than One Session Works Here (PERMANENT)

**This repository is worked on by several Claude sessions and by scheduled automation at the same time. Before building anything, find out whether it is already being built.**

The evidence that this matters: three sessions merged work into `main` within the same hour, and two roadmap edits had to be resolved by hand because two of them rewrote the same chapter.

### Before starting non-trivial work

1. `git fetch origin main` and start from it. Never build on a branch that is hours old.
2. Look at the open pull requests and at the last day of commits on `main`. If someone is already in the same file or the same subject, do not start a second version of it.
3. If the work is a new article, check the roadmap first (`docs/seo-content-roadmap.md`) and mark the item as taken the moment you begin, not when you finish. An unmarked item is an invitation for a second session to write the same piece.

### Lanes

Work is divided by kind, not by file, and each lane stays out of the others' way:

- **The daily content task** writes the next article in the roadmap queue. It does not change structure, navigation, or positioning.
- **Maintenance** covers fixes, quality checks, and removing what blocks promotion. It does not write articles.
- **Design** changes how pages look. It does not change copy, because the copy is shared across five languages and the prerender.

A session that needs to cross into another lane should do the smallest possible thing there and say so in the pull request.

### Rules that prevent the collisions that actually happened

- **One subject per pull request, merged the same session.** A branch that lives for a day collects conflicts.
- **Never push to `main` directly.** A repository rule requires a pull request, and automation that tries to push is rejected. This is not a rule to work around: it is what stops two sessions overwriting each other.
- **`data/search-console` is a data branch and is never merged into `main`.** It deliberately diverges. Do not open a pull request from it.
- **Shared files are conflict-prone.** `docs/seo-content-roadmap.md`, `src/lib/strings.ts`, `src/lib/blogMeta.ts` and `CLAUDE.md` are edited by everyone. Touch the fewest lines that do the job, and re-fetch before pushing.

## Hebrew Documents - Quality Standards (PERMANENT)

**Applies to every file produced for the user (docx, html, pdf, posts), in all actions.**

- Direction: force RTL. In docx set `w:bidi` before `w:jc` on every paragraph, plus on the section (`sectPr`) and the Normal style. In html use `dir="rtl"` and `lang="he"`.
- Alignment: headings and signatures aligned right or centered; body paragraphs justified (`both`).
- Fonts: use a complex-script Hebrew font (Arial as a safe default, or Frank Ruhl Libre / Heebo for html). Set the `w:cs` font and `w:szCs` so Hebrew renders correctly.
- Mixed direction: keep Latin and technical tokens (emails, URLs, code, `UTF-8`) isolated LTR inside Hebrew text.
- Brand colors (Prestige Executive): Obsidian `#1B1B1B`, Gold `#D4AF37`, Cream `#FFFDD0`, Burgundy `#800020`.
- Always include a short disclaimer on sample legal documents (not legal advice, not binding).
- Verify the output: confirm no forbidden dashes and correct RTL before delivering.

## Social Media Posts - Mandatory Approval Flow

**CRITICAL: Never publish a post without explicit user approval.**

Every post MUST follow this flow:

### Step 1: Draft
- Write Hebrew text (Facebook, Telegram, Instagram)
- Write English text (LinkedIn)
- Save to `posts/` directory

### Step 2: Create Images
- Hebrew wide (1200x630) for Facebook/Telegram
- English wide (1200x630) for LinkedIn
- Hebrew square (1080x1080) for Instagram
- Save to `posts/images/`
- Use Prestige Executive color scheme (Obsidian #1B1B1B, Gold #D4AF37, Cream #FFFDD0, Burgundy #800020)

### Step 3: Preview Page
- Create/update `posts/preview.html` showing ALL content:
  - Post text (Hebrew + English)
  - Images embedded (all sizes)
  - Target platforms
  - Scheduled date/time
- Tell the user to open the preview page in their browser

### Step 4: Wait for Approval
- **DO NOT** create workflow files or trigger any dispatch until user says "approved" / "מאושר"
- If user requests changes, update and show preview again
- Only after explicit approval: create the scheduled workflow and commit

### Step 5: Publish
- Only after approval: create `.github/workflows/` file
- Commit and push
- User merges to main and triggers

## Post Details

File structure, image sizes, color schemes, and connected platforms live in the `social-posts` skill (`.claude/skills/social-posts/SKILL.md`), loaded on demand when working on posts.
