/* Sales / cost / profit rollup for a date range: GET /api/admin/summary?from=YYYY-MM-DD&to=YYYY-MM-DD */
import { json, handle } from './lib/api.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestGet = handle(async ({ env, request }) => {
  const url = new URL(request.url);
  const year = new Date().toISOString().slice(0, 4);
  const from = DATE_RE.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : `${year}-01-01`;
  const to = DATE_RE.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : `${year}-12-31`;
  const mileageRate = Number(env.MILEAGE_RATE_CENTS || 70); // IRS standard mileage rate, cents/mile
  const db = env.DB;

  const done = "status = 'completed' AND job_date BETWEEN ?1 AND ?2";
  const [totals, expenses, byMonth, byService, byCategory, outstanding, upcoming, leads] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS jobs,
        COALESCE(SUM(price_cents),0) AS revenue_cents,
        COALESCE(SUM(tip_cents),0) AS tips_cents,
        COALESCE(SUM(supply_cost_cents + other_cost_cents),0) AS job_costs_cents,
        COALESCE(SUM(miles),0) AS miles,
        COALESCE(SUM(hours),0) AS hours
      FROM jobs WHERE ${done}`).bind(from, to),
    db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS cents FROM expenses WHERE expense_date BETWEEN ?1 AND ?2').bind(from, to),
    db.prepare(`SELECT month, SUM(jobs) AS jobs, SUM(revenue) AS revenue_cents, SUM(costs) AS costs_cents FROM (
        SELECT substr(job_date,1,7) AS month, COUNT(*) AS jobs,
               SUM(price_cents + tip_cents) AS revenue, SUM(supply_cost_cents + other_cost_cents) AS costs
          FROM jobs WHERE ${done} GROUP BY month
        UNION ALL
        SELECT substr(expense_date,1,7), 0, 0, SUM(amount_cents)
          FROM expenses WHERE expense_date BETWEEN ?1 AND ?2 GROUP BY 1
      ) GROUP BY month ORDER BY month`).bind(from, to),
    db.prepare(`SELECT COALESCE(NULLIF(service,''),'Other') AS service, COUNT(*) AS jobs, SUM(price_cents) AS revenue_cents
      FROM jobs WHERE ${done} GROUP BY 1 ORDER BY revenue_cents DESC`).bind(from, to),
    db.prepare(`SELECT category, SUM(amount_cents) AS cents FROM expenses
      WHERE expense_date BETWEEN ?1 AND ?2 GROUP BY category ORDER BY cents DESC`).bind(from, to),
    db.prepare(`SELECT COUNT(*) AS jobs, COALESCE(SUM(price_cents),0) AS cents
      FROM jobs WHERE status = 'completed' AND paid = 0`),
    db.prepare(`SELECT COUNT(*) AS jobs, COALESCE(SUM(price_cents),0) AS cents
      FROM jobs WHERE status = 'scheduled' AND job_date >= date('now')`),
    db.prepare(`SELECT
        SUM(status = 'new') AS new,
        SUM(status IN ('contacted','quoted')) AS open,
        SUM(created_at BETWEEN ?1 AND ?2 || ' 23:59:59') AS in_range,
        SUM(status = 'booked' AND created_at BETWEEN ?1 AND ?2 || ' 23:59:59') AS booked_in_range
      FROM leads`).bind(from, to),
  ]);

  const t = totals.results[0];
  const expenseCents = expenses.results[0].cents;
  const grossCents = t.revenue_cents + t.tips_cents;
  const profitCents = grossCents - t.job_costs_cents - expenseCents;

  return json({
    from, to,
    jobs: t.jobs,
    revenue_cents: t.revenue_cents,
    tips_cents: t.tips_cents,
    gross_cents: grossCents,
    job_costs_cents: t.job_costs_cents,
    expenses_cents: expenseCents,
    profit_cents: profitCents,
    avg_ticket_cents: t.jobs ? Math.round(t.revenue_cents / t.jobs) : 0,
    hours: t.hours,
    profit_per_hour_cents: t.hours ? Math.round(profitCents / t.hours) : null,
    miles: t.miles,
    mileage_rate_cents: mileageRate,
    mileage_deduction_cents: Math.round(t.miles * mileageRate),
    outstanding: outstanding.results[0],
    upcoming: upcoming.results[0],
    leads: leads.results[0],
    by_month: byMonth.results,
    by_service: byService.results,
    expenses_by_category: byCategory.results,
  });
});
