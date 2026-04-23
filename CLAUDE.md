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

---

# Andrej Karpathy Skills - LLM Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

*Source: [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)*
