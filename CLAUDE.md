# Project Rules - Prompt Builder Agent

## Social Media Posts - Mandatory Approval Flow

**CRITICAL: Never publish a post without explicit user approval.**

Every post MUST follow this flow:

### Step 0: World Case Research (MANDATORY)
Before writing ANY post, perform a web search for real-world cases:
- Search for 2–3 real legal/court cases related to the topic
- Prefer cases from 2023–2026 for maximum relevance
- Include case name, jurisdiction, outcome, and why it matters
- These cases become the factual backbone of the post
- Save findings in the post draft and in `posts/topics-bank.md`

### Step 1: Draft
- Write Hebrew text (Facebook, Telegram, Instagram)
- Write English text (LinkedIn)
- Each post must reference at least one real-world case
- Save to `posts/` directory

### Step 2: Create Images — Topic-Specific (NOT generic)
Every image must visually reflect the specific post topic:
- Use a unique visual concept per post (not just the brand template)
- Include a relevant visual metaphor (scales, broken chain, split face, etc.)
- Hebrew wide (1200x630) for Facebook/Telegram
- English wide (1200x630) for LinkedIn
- Hebrew square (1080x1080) for Instagram
- Save to `posts/images/`
- Use Prestige Executive color scheme (Obsidian #1B1B1B, Gold #D4AF37, Cream #FFFDD0, Burgundy #800020)

### Step 3: Preview Page
- Create/update `posts/preview.html` showing ALL content:
  - Post text (Hebrew + English)
  - ALL THREE images embedded side by side
  - Real-world cases referenced
  - Target platforms
  - Scheduled date/time
- Tell the user to open the preview page in their browser

### Step 4: Wait for Approval — Three Explicit Approvals Required
The user must approve ALL THREE separately:
1. **Instagram** — Hebrew square image + Hebrew text
2. **Facebook** — Hebrew wide image + Hebrew text
3. **LinkedIn** — English wide image + English text

- **DO NOT** create workflow files until all three are approved
- If user requests changes to any one, update only that item and re-show
- Only after explicit "approved" / "מאושר" for all three: proceed to Step 5

### Step 5: Publish
- Only after full approval: create `.github/workflows/` file
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

## Content Strategy — Law + AI Only
**All posts must focus exclusively on the intersection of Law and AI.**

Core topics (mandatory):
- Algorithmic risk management in complex transactions
- IP and copyright in AI-generated content
- Legal liability when AI causes damage
- Decision-making transparency (DOM model)
- Urban renewal + real estate with AI tools
- Attorney ethics and professional responsibility in AI era
- Israeli/EU regulation of AI (AI Act, privacy law)

**Scheduling cadence:** Every Saturday at 19:00 IST
**Numbering:** Sequential — next post after 006 is 007, then 008, etc.
**Topic bank:** See `posts/topics-bank.md` for pre-approved future topics

When user asks for "פוסט להיום" or next post:
1. Pick the next topic from `posts/topics-bank.md` (lowest unused number)
2. Follow the 5-step approval flow above
3. Schedule for the next available Saturday 19:00
