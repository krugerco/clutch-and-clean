# Clutch & Clean Detailing

Marketing site for Clutch & Clean Detailing — mobile interior & exterior auto detailing serving the North Iowa / Cedar Valley area.

## Stack
Static single-page site. No build step. Plain HTML + CSS + vanilla JS.

## Structure
- `index.html` — the entire site (styles and scripts inline)
- `assets/` — logo, badge, hero image

## Inquiry form
The "Send an Inquiry" form posts via AJAX to Formspree, which emails each lead
to Clutchandcleandetailers@gmail.com. The endpoint lives in the `FORM_ENDPOINT`
variable near the bottom of `index.html`.

## Deploying (Cloudflare Pages)
Connected to Cloudflare Pages for continuous deployment. Every push to `main`
triggers an automatic deploy.

- Build command: *(none — static site)*
- Build output directory: `/` (root)

## Local preview
Open `index.html` in a browser, or run a simple static server:
```
python3 -m http.server 8000
```
