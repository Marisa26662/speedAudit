# SpeedAudit

SpeedAudit is an embedded Shopify app that audits a store's storefront pages and
returns a categorized, actionable report on **performance, SEO, accessibility, and
best practices**.

## What it does

1. **Pick a page to audit.** The app builds the list of auditable URLs by combining
   the store's `sitemap.xml`, the Shopify Admin GraphQL API (pages, products,
   collections, blogs), and known dynamic routes (`/cart`, `/search`, `/account/...`).
2. **Run the audit.** For the selected URL it gathers data from two sources:
   - **Google PageSpeed Insights (Lighthouse)** — Core Web Vitals and category scores.
   - **A direct HTTP fetch + HTML analysis** — meta tags, headings, images, structured
     data, security headers, and technology detection.
3. **Apply the rule engine.** Over 60 rules evaluate that data and produce findings,
   each with a severity, an impact, and step-by-step recommendations — including
   Shopify-specific checks (app-script count, CDN image usage, Liquid render time).
4. **Score and report.** Results are scored per category and combined into a weighted
   overall score (Performance 40%, SEO 30%, Accessibility 20%, Best Practices 10%),
   then displayed in the app.

## Tech stack

- React Router v7 + TypeScript
- Shopify App Bridge (embedded app)
- Prisma + SQLite
- Google PageSpeed Insights API

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` runs `shopify app dev`, which starts the local server and a tunnel and
opens the app in your development store. The app only runs while this command is
active; to keep it online permanently, deploy it to a host and set `application_url`
in `shopify.app.toml` to that URL.

## Project layout

- `app/routes/` — embedded app pages (dashboard, new audit, report, settings) and auth/webhook endpoints
- `app/lib/analysis/` — the audit engine (data sources, rule engine, scoring)
- `app/lib/sitemap.server.ts` — sitemap parsing and page discovery
- `prisma/schema.prisma` — `Session`, `Audit`, and `Settings` tables
