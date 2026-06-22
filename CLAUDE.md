# Project Rules - Prompt Builder Agent

## Writing Style - Dashes (PERMANENT)

**Never use dashes as punctuation, in chat replies or in any generated file (docx, html, pdf, posts).**

- Forbidden: em-dash `—`, en-dash `–`, and a hyphen used as a clause/sentence separator (e.g. ` - `).
- Instead use a comma, period, colon, or parentheses.
- Allowed: a hyphen that is an integral part of a word, term, identifier, date, URL, or email (e.g. `פינוי-בינוי`, `תמ"א`, `UTF-8`, `2026-06-22`, `test@lalum.legal`). These are not separators and stay as-is.

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

## File Structure
```
posts/
  001_post_name_he.md     # Hebrew text
  001_post_name_en.md     # English text (LinkedIn)
  preview.html            # Preview page (always updated)
  images/
    001_post_name_he.html  # Hebrew wide image (1200x630)
    001_post_name_en.html  # English wide image (1200x630)
    001_post_name_ig.html  # Instagram square (1080x1080)
```

## Color Schemes
- **Prestige Executive** (default): #1B1B1B, #D4AF37, #FFFDD0, #800020
- **Monochromatic**: #0A0A0A, #FFFFFF, #708090, #C0C0C0
- **Modern Professional**: #010101, #4682B4, #F4F7F6, #00FFFF

## Connected Platforms
- Facebook: ZAPIER_FACEBOOK secret
- Telegram: ZAPIER_TELEGRAM secret
- LinkedIn: ZAPIER_LINKEDIN secret
- Instagram: ZAPIER_INSTAGRAM secret
- LinkedIn gets English version, all others get Hebrew
