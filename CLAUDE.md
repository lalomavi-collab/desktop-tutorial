# Project Rules - Prompt Builder Agent

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
