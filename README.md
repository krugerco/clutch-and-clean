# Clutch & Clean Detailing

Marketing site for Clutch & Clean Detailing — mobile interior & exterior auto detailing serving the North Iowa / Cedar Valley area.

## Stack
Static single-page site. No build step. Plain HTML + CSS + vanilla JS.
Back office (`/admin`): a Cloudflare Worker (`src/`) with D1 + R2. See [BACKEND.md](BACKEND.md).

## Structure
- `index.html` — the entire site (styles and scripts inline)
- `assets/` — logo, badge, hero image
- `admin/` — private back office for leads, jobs, invoices, expenses and sales totals
- `src/`, `migrations/`, `wrangler.jsonc` — the back office API, database schema and Worker config

## Inquiry form
The "Send an Inquiry" form posts via AJAX to Formspree, which emails each lead
to Clutchandcleandetailers@gmail.com, and to `/api/leads`, which saves it in the
back office (and can send a phone push). Both endpoints live near the bottom
of `index.html` (`FORM_ENDPOINT`, `LEADS_ENDPOINT`).

## Deploying (Cloudflare Workers)
Connected to Cloudflare Workers Builds. Every push to `main` deploys automatically
using `wrangler.jsonc` (static site + API + database/photo bindings).

## Local preview
Open `index.html` in a browser, or run a simple static server:
```
python3 -m http.server 8000
```
