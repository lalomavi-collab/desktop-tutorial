# LALUM SEO and GEO project

Backlog for the site promotion project. The daily routine advances the first
unchecked item each day, verifies with `npm run seo-check` and `npm run build`,
then keeps the site healthy. Keep each item small and independently shippable.

## Day 1, foundation (done)

- [x] On-page meta: title, description, canonical, Open Graph, Twitter
- [x] JSON-LD: Organization, founder Person, WebSite
- [x] robots.txt welcomes AI crawlers; llms.txt for GEO
- [x] `npm run seo-check` automated checks
- [x] Daily SEO Telegram report at 20:00

## Day 2, structured data depth

- [x] Per-page title and meta description for each route and article (#281)
- [x] FAQPage JSON-LD generated from the home FAQ
- [x] Article JSON-LD on each insights article (headline, datePublished, author, image)
- [ ] BreadcrumbList on inner pages
- [ ] Service JSON-LD for the six rubrics, and Course JSON-LD for the Academy

## Day 3, crawler visible content

- [ ] Pre-render static HTML per route so content is in the HTML, not only JS
- [ ] hreflang or language handling for the two languages

## Day 4, off site and performance

- [ ] Prepare Google Search Console and Bing verification (owner completes sign in)
- [ ] Code split the large JS bundle; lazy load pdfjs and mammoth
- [ ] Image optimization and loading="lazy"; alt text audit
- [ ] Internal linking pass

## Ongoing maintenance

- [ ] Keep seo-check green; add Article JSON-LD to new insights as they land
- [ ] Refresh sitemap and watch Core Web Vitals
