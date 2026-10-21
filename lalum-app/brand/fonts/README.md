# Lalum Serif

The display face of the app and the site: headlines, card titles, the numbers
that carry a page. It replaces Suez One (Hebrew) and Newsreader (Latin), and it
is the only display family now.

## What it is

A merged, renamed cut of two SIL Open Font License fonts, one file per style:

| Script | Source | Why |
| --- | --- | --- |
| Hebrew | Frank Ruhl Libre | The Hebrew classic of legal and editorial print: calm, exact, high contrast. |
| Latin | Newsreader, optical size 32 | A text serif with a display bias, so English headlines keep their hairlines at card size and at 60px. |

The Latin is scaled so its capital height (660) keeps the proportion Frank Ruhl
Libre itself holds between Hebrew (597) and Latin (660). Vertical metrics are
unified (957 up, 334 down) so a line mixing both scripts has one baseline and
one line box. Real faces: 400, 500 and 700, and one 400 italic. Hebrew has no
italic: the italic file carries upright Hebrew, which is better than a slanted
fake. The shekel sign comes from Frank Ruhl Libre.

It is not a font drawn from scratch. A new Hebrew and Latin family is a
type designer's project of months; this is a considered cut that is ours to
ship, tune and extend.

## Files

- `public/fonts/lalum-serif-{400,500,700}.woff2` and `lalum-serif-400-italic.woff2`,
  about 34 KB each.
- `public/fonts/OFL.txt`: the license and both copyright lines. It must travel
  with the fonts.
- `src/index.css`: the `@font-face` rules and the `--serif` token. The 500 face
  is preloaded in `index.html`. `public/_headers` caches `/fonts/*` for a year.

## Regenerating

Download the sources (they are not committed):

    https://raw.githubusercontent.com/google/fonts/main/ofl/frankruhllibre/FrankRuhlLibre[wght].ttf
    https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/Newsreader[opsz,wght].ttf
    https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/Newsreader-Italic[opsz,wght].ttf

Then, with fontTools and brotli installed in a virtual environment:

    python3 -m venv venv && venv/bin/pip install fonttools brotli
    venv/bin/python brand/fonts/build.py <dir with the three ttf> public/fonts

Change a number (optical size, scale, metrics) only in `build.py`, rebuild, and
check a Hebrew line mixed with Latin and digits at 20px and at 60px.

## Rules

- Never set the LALUM name in this face as a logo. The wordmark is artwork
  (`brand/README.md`).
- Body text stays in Assistant and Heebo (Hebrew) and Hanken Grotesk (Latin).
  Arabic keeps Markazi Text and Cairo.
- Do not rename the files or add weights without updating `index.css` and the
  preload; a changed file under an old name is cached for a year.
