---
name: social-posts
description: Create and publish LALUM social media posts (Facebook, Telegram, LinkedIn, Instagram). Use when drafting, designing images for, previewing, or scheduling any social media post. Covers the file structure, image sizes, color schemes, and connected platforms. The mandatory approval flow itself lives in CLAUDE.md and always applies.
---

# LALUM Social Posts, Details

The mandatory approval flow (draft, images, preview page, explicit approval, only then publish) is defined in the root CLAUDE.md and ALWAYS applies. This skill holds the supporting details.

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

## Image sizes per platform
- Hebrew wide (1200x630) for Facebook/Telegram
- English wide (1200x630) for LinkedIn
- Hebrew square (1080x1080) for Instagram

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
