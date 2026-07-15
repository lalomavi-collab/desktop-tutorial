# LALUM site

Home page for the LALUM law firm, implemented from the Claude Design source
`Home-en.dc.html`.

## What this is

`index.html` is a single, self-contained page (no build step, no dependencies).
Open it directly in a browser or serve the folder with any static server:

```
cd lalum-site
python3 -m http.server 8000
# then open http://localhost:8000
```

## What is implemented

The original `.dc.html` relied on a proprietary Claude Design runtime
(`support.js`, `<x-dc>`, `sc-for`/`sc-if`, `{{ }}` bindings). Those are
reimplemented here in plain, framework-free JavaScript:

- Language switcher (English, Hebrew, Russian, Arabic) with `localStorage`
  persistence and automatic RTL for Hebrew and Arabic. Non-English content
  shows an "in progress" notice and stays in English for now.
- FAQ accordion (show/hide plus one-open-at-a-time expansion).
- Booking widget: pick a business day (weekends skipped) and a time slot,
  enter name and email, and confirm to open a prefilled email draft to the
  firm.

## Booking via Calendly (optional)

To embed a scheduling calendar instead of the built-in day/time picker, set
`CALENDLY_URL` in the page config block near the top of the `<script>` in
`index.html`. When set, the calendar iframe replaces the manual widget.

## Assets and fonts

Icons are inlined as an SVG sprite. Fonts (Newsreader, Hanken Grotesk) load
from Google Fonts, with Georgia and a system sans as fallbacks.
