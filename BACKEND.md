# Back Office — leads, jobs, invoices, quotes, photos & website editing

A private dashboard at **`/admin`** on the live site, built for Reed. It runs on the same
Cloudflare Worker as the website, with a Cloudflare D1 database for records and an R2 bucket for
photos, so there's no separate server.

## Signing in
Go to `https://<your-site>/admin/` and enter your **PIN**. You stay signed in on that device until
you tap **Sign out**, so on your phone, open it once and use **Add to Home Screen**.
- Change the PIN any time under **Website → Sign-in PIN** (4–8 digits).
- 5 wrong tries locks sign-in for 15 minutes, so a short PIN stays safe.
- Forgot it? Add a Secret called `ADMIN_PASSWORD` to the Worker in the Cloudflare dashboard. It
  works as a backup key on the sign-in screen, and from there you can set a new PIN.

## Tabs
- **Dashboard:** **+ New job** and **Quote** buttons up top, then total sales, costs, profit, profit per hour, average ticket, unpaid balance,
  upcoming jobs, open leads and a mileage-deduction estimate, broken down by month, service and
  expense category.
- **Leads:** every "Send an inquiry" form submission, which is also still emailed through
  Formspree. Mark leads contacted, quoted or lost, or hit **Book job** to turn one into a job with
  everything filled in.
- **Jobs & Invoices:** log each cleaning (price, tip, supplies, other costs, miles, hours,
  paid/unpaid). Each job gets an invoice number automatically (`CC-2026-0001`), and
  **Print invoice** makes an invoice you can print or save as a PDF. Export to CSV.
  - The job form has the **price builder** built in. Tap the vehicle size, service, add-ons,
    extra time and extra charges, and **Charged** adds itself up from your prices. The invoice
    then lists every line.
  - Typing a price into **Charged** yourself switches auto-adding off, so your number is kept.
    Tick **Add up automatically** to switch it back on.
  - A saved job keeps the prices it was built with, even if you change your prices later.
- **Expenses:** costs not tied to one job, like equipment, bulk chemicals, fuel and insurance.
  Export to CSV.
- **Quote:** the price builder on its own. Pick the vehicle, service and add-ons, set exact
  amounts for ranged add-ons, then add:
  - **Extra time:** hours × your hourly rate (the rate can be changed per quote)
  - **Extra charges:** one tap for your saved quick charges, or **+ Custom charge** for anything
  - **Discount / adjustment** with a reason

  Then **Copy text** to paste into a message, or **Make it a job**.
- **Photos:** upload a before & after pair from any phone, tablet or computer (take a photo or
  pick from the library). Photos are shrunk automatically and appear on the website in a
  **Before & After** section with a drag slider. You can reorder, hide or delete them. The
  section stays hidden until you add the first pair.
- **Website:** change every package, à la carte and add-on price (per vehicle size), and edit
  the testimonials. Changes show on the site within about 30 seconds. This is also where you set
  your **extra time rate** and **quick charges**. Those are back office only and never shown on
  the site.

## Phone notifications for new leads (optional)
Uses [ntfy](https://ntfy.sh), which is free with no account needed.
1. Install the **ntfy** app and subscribe to a topic with a long random name, e.g.
   `clutchclean-leads-8f3k2q9x`. Anyone who knows the name can read it.
2. Cloudflare dashboard → **Workers & Pages → clutch-and-clean → Settings → Variables and
   Secrets**, and add `NTFY_TOPIC` (and optionally `SITE_URL` = `https://your-domain`, so tapping
   the push opens the Leads tab).
3. Redeploy (push any commit, or **Deployments → Retry**).

Other optional variables: `MILEAGE_RATE_CENTS` (default `70`, the per-mile deduction estimate;
update it to the current IRS rate each year), `NTFY_SERVER`, `NTFY_TOKEN`.

## How it's wired
Cloudflare resources (already created):
- D1 database **`clutch-and-clean`**, bound as `DB`
- R2 bucket **`clutch-and-clean-photos`**, bound as `PHOTOS`

Both are declared in [`wrangler.jsonc`](wrangler.jsonc), so every push to `main` deploys the site,
the API and the bindings together through Workers Builds.

```
src/worker.js        entry: routes /api/* and /photos/*, everything else = static site
src/leads.js         POST /api/leads (public): website form → lead (+ optional ntfy push)
src/auth.js          PIN check + lockout for /api/admin/*, PUT /api/admin/pin
src/summary.js       GET  /api/admin/summary?from=&to=
src/lib/api.js       validation + CRUD helpers for leads / jobs / expenses
src/lib/jobs.js      auto invoice numbers, paid date, lead → booked
src/lib/content.js   prices, testimonials, photos (GET /api/site is the public read)
migrations/          database tables (run in order on a new database)
admin/index.html     the back office UI (plain HTML/JS)
.assetsignore        keeps src/, migrations/, config and docs from being served publicly
```

### Database changes
New tables or columns go in a new numbered file in `migrations/`. Apply it with the D1 console
in the Cloudflare dashboard, or run
`npx wrangler d1 execute clutch-and-clean --remote --file migrations/000N_name.sql`.

### Running it locally
```bash
npm i -g wrangler
echo 'ADMIN_PASSWORD=test' > .dev.vars
for f in migrations/*.sql; do wrangler d1 execute DB --local --persist-to ../cc-state --file $f; done
wrangler dev --persist-to ../cc-state     # sign in with "test"
```
Keep the local state folder outside the project (as above). Otherwise the dev server sees its own
database files change and keeps reloading.
