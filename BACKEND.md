# Back Office — leads, jobs, invoices & sales tracking

A private dashboard at **`/admin`** on the live site. It runs on Cloudflare Pages Functions and a
Cloudflare D1 database, so there is no separate server to run or pay for.

## What it does
- **Leads:** every "Send an inquiry" form submission is saved here (it is still emailed through
  Formspree as before). You can get an optional instant phone push for each one (see below). Move a
  lead from new → contacted → quoted, mark it lost, or hit **Book job** to turn it into a job with
  the vehicle, service, add-ons and on-site quote already filled in.
- **Jobs & Invoices:** log every cleaning, scheduled or done. Record what you charged, the tip,
  supplies used, other costs, miles and hours. Each job gets an invoice number automatically
  (`CC-2026-0001`), and **Print invoice** makes a clean invoice you can print or save as a PDF to
  text or email. Track paid/unpaid and how they paid.
- **Expenses:** general costs that aren't tied to one job (equipment, bulk chemicals, fuel,
  insurance, ads).
- **Dashboard:** total sales, total costs, profit, profit per hour, average ticket, unpaid
  balance, upcoming scheduled work, open leads, and miles with an estimated mileage deduction,
  broken down by month, service and expense category. Pick this month, last month, this year,
  last year or all time.
- **Export CSV** of jobs and expenses for taxes or your accountant.

## One-time setup (Cloudflare dashboard, ~10 minutes)

### 1. Create the database
Cloudflare dashboard → **Storage & Databases → D1 → Create database**. Name it `clutch-and-clean`.

Open the new database → **Console** tab. Paste in the whole contents of
[`migrations/0001_init.sql`](migrations/0001_init.sql) and click **Execute**.

### 2. Connect it to the site
**Workers & Pages → clutch-and-clean → Settings → Bindings → Add → D1 database**
- Variable name: `DB` (exactly that)
- D1 database: `clutch-and-clean`

### 3. Set the admin password
Same project → **Settings → Variables and Secrets → Add**
- Type **Secret**, name `ADMIN_PASSWORD`, value: a long password only you know.

### 4. Redeploy
**Deployments → ⋯ on the latest → Retry deployment** (or just push any commit). Bindings and
secrets only take effect on a new deploy.

Then go to `https://<your-site>/admin/` and sign in. Bookmark it or add it to your phone's home
screen.

## Optional: instant phone notifications for new leads
Uses [ntfy](https://ntfy.sh), which is free with no account needed.
1. Install the **ntfy** app (iOS/Android) and subscribe to a topic with a long random name,
   e.g. `clutchclean-leads-8f3k2q9x`. Anyone who knows the name can read it, so don't use
   something guessable.
2. In Cloudflare → Settings → Variables and Secrets, add:
   - `NTFY_TOPIC` = that topic name (Secret)
   - `SITE_URL` = `https://your-domain` (optional; tapping the push opens the Leads tab)
3. Redeploy. Each inquiry now buzzes your phone with the name, phone, vehicle and message.

Formspree still emails every inquiry too, so you have two ways to hear about new work.

## Optional settings
| Variable | Default | Purpose |
|---|---|---|
| `MILEAGE_RATE_CENTS` | `70` | Cents per mile for the deduction estimate on the dashboard. Update it to the current IRS rate each year. |
| `NTFY_SERVER` | `https://ntfy.sh` | If you self-host ntfy |
| `NTFY_TOKEN` | — | Access token if your ntfy topic is protected |

## Extra lock (recommended)
The password protects all the data. For a second layer, put **Cloudflare Access** (Zero Trust →
Access → Applications, free for up to 50 users) in front of `/admin/*` and `/api/admin/*`.
Cloudflare will then email you a login code before the page even loads.

## How it's built
```
functions/api/leads.js           POST  public: website form → saves lead, sends optional push
functions/api/admin/_middleware  auth check: Authorization: Bearer <ADMIN_PASSWORD>
functions/api/admin/leads/…      list / create / update / delete leads
functions/api/admin/jobs/…       list / create / update / delete jobs (auto invoice #)
functions/api/admin/expenses/…   list / create / update / delete expenses
functions/api/admin/summary.js   GET  totals for a date range (?from=YYYY-MM-DD&to=YYYY-MM-DD)
lib/                             shared validation + database helpers
migrations/0001_init.sql         database tables (leads, jobs, expenses)
admin/index.html                 the dashboard (plain HTML/JS, no build step)
```
Money is stored as whole cents. List endpoints accept `?from=`, `?to=` and `?status=`.

### Running it locally
```bash
npm i -g wrangler
cat > wrangler.toml <<'EOF'
name = "clutch-and-clean"
pages_build_output_dir = "."
compatibility_date = "2026-01-01"
[[d1_databases]]
binding = "DB"
database_name = "clutch-and-clean"
database_id = "local"
EOF
echo 'ADMIN_PASSWORD=test' > .dev.vars
wrangler d1 execute DB --local --file migrations/0001_init.sql
wrangler pages dev --d1 DB=local
```
`wrangler.toml`, `.dev.vars` and `.wrangler/` are gitignored. Don't commit them: the live site
uses the bindings set in the Cloudflare dashboard.
