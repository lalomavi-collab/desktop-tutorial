# LALUM brand assets

`LALUM-LOGO.pdf` is the logo. It is the only one. Everything below is derived
from it, and nothing else may stand in for it: not a typeface, not an older
seal, not a letter in a circle.

## The artwork

Adobe Illustrator vector, one page, 595.138 x 599.931 pt. A black field with the
LALUM wordmark in white, centred on both axes. The wordmark's own bounding box
is 442.1429 x 70.759 pt (aspect 6.2489:1) and covers 74.3% of the field's width.

The wordmark is artwork, not text. It carries no font: the letters are outlines.

## Derived files

| File | What it is |
| --- | --- |
| `public/lalum-logo.svg` | wordmark, ink `#1B1B1B`, transparent |
| `public/lalum-logo-inverse.svg` | wordmark, white, transparent, for dark grounds |
| `public/lalum-logo.png` | the same wordmark at 1768 px wide, for contexts that reject SVG (email) |
| `public/lalum-mark.svg` | the square lockup exactly as supplied |
| `public/favicon.svg`, `public/favicon.ico` | the lockup with the black field trimmed to 86%, because at 16 to 48 px the supplied margin swallows the letters |
| `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/lalum-badge.png` | the lockup at the supplied proportions, which also keep the wordmark inside the maskable safe circle |
| `src/components/Wordmark.tsx` | the same paths inline, filled with `currentColor`, for use inside the app |

## Regenerating

The Open Graph cards are rebuilt from `public/lalum-logo.svg`:

    PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/og-cards.mjs

Playwright is a dev tool here, not an app dependency, so it is not in
`package.json`. The icons were rendered from the same vector; regenerate them
only if the artwork itself changes, and keep the geometry above.

## Using it

- Inside the app, use `Wordmark`. It inherits the surrounding colour, so it
  works on ivory and on the dark bands without a second file.
- Outside the app (email, decks, documents, social posts), use
  `public/lalum-logo.svg` on light grounds and `public/lalum-logo-inverse.svg`
  on dark ones.
- Clear space: keep at least the height of the letters free on every side.
- Never stretch it, recolour it into two tones, add a container, or set the
  name in a typeface as a substitute.
