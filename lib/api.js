/* Shared helpers for the Pages Functions under /functions. */

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

export async function readBody(request) {
  const type = request.headers.get('Content-Type') || '';
  if (type.includes('application/json')) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

/* Constant-time string compare so the admin password can't be guessed by timing. */
export function safeEqual(a, b) {
  const ea = new TextEncoder().encode(String(a));
  const eb = new TextEncoder().encode(String(b));
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] || 0) ^ (eb[i] || 0);
  return diff === 0;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* Field coercers. Each returns the DB value, or throws a message string. */
const T = {
  text: (max = 500) => (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s.length > max) throw `must be ${max} characters or fewer`;
    return s || null;
  },
  date: () => (v) => {
    if (v === null || v === undefined || v === '') return null;
    if (!DATE_RE.test(String(v))) throw 'must be a YYYY-MM-DD date';
    return String(v);
  },
  cents: () => (v) => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n < 0) throw 'must be a non-negative amount';
    return Math.round(n);
  },
  num: () => (v) => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n < 0) throw 'must be a non-negative number';
    return n;
  },
  bool: () => (v) => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on' ? 1 : 0),
  oneOf: (...opts) => (v) => {
    if (!opts.includes(v)) throw `must be one of ${opts.join(', ')}`;
    return v;
  },
  id: () => (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) throw 'must be an id';
    return n;
  },
};

/* Editable columns per table (anything not listed here is ignored). */
export const TABLES = {
  leads: {
    required: ['name'],
    order: 'created_at DESC, id DESC',
    dateCol: 'created_at',
    fields: {
      name: T.text(120), phone: T.text(40), email: T.text(200), vehicle: T.text(80),
      service: T.text(80), message: T.text(3000), source: T.text(40),
      status: T.oneOf('new', 'contacted', 'quoted', 'booked', 'lost'), notes: T.text(3000),
    },
  },
  jobs: {
    required: ['job_date', 'customer_name'],
    order: 'job_date DESC, id DESC',
    dateCol: 'job_date',
    touch: true,
    fields: {
      job_date: T.date(), status: T.oneOf('scheduled', 'completed', 'cancelled'),
      customer_name: T.text(120), phone: T.text(40), email: T.text(200), address: T.text(300),
      vehicle: T.text(120), service: T.text(120), addons: T.text(500),
      price_cents: T.cents(), tip_cents: T.cents(), supply_cost_cents: T.cents(), other_cost_cents: T.cents(),
      miles: T.num(), hours: T.num(), invoice_no: T.text(40), paid: T.bool(), paid_date: T.date(),
      payment_method: T.text(40), notes: T.text(3000), lead_id: T.id(),
    },
  },
  expenses: {
    required: ['expense_date'],
    order: 'expense_date DESC, id DESC',
    dateCol: 'expense_date',
    fields: {
      expense_date: T.date(),
      category: T.oneOf('supplies', 'equipment', 'fuel', 'vehicle', 'marketing', 'insurance', 'fees', 'other'),
      vendor: T.text(120), description: T.text(500), amount_cents: T.cents(), notes: T.text(3000),
    },
  },
};

/* Validate + pick known columns. Throws a Response on bad input. */
export function clean(table, input, { partial = false } = {}) {
  const def = TABLES[table];
  const out = {};
  for (const [col, coerce] of Object.entries(def.fields)) {
    if (!(col in input)) continue;
    try {
      out[col] = coerce(input[col]);
    } catch (msg) {
      throw error(`${col} ${msg}`);
    }
  }
  if (!partial) {
    for (const col of def.required) {
      if (out[col] === null || out[col] === undefined || out[col] === '') throw error(`${col} is required`);
    }
  } else {
    for (const col of def.required) {
      if (col in out && (out[col] === null || out[col] === '')) throw error(`${col} is required`);
    }
  }
  return out;
}

export async function insertRow(db, table, data) {
  const cols = Object.keys(data);
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING *`;
  return db.prepare(sql).bind(...cols.map((c) => data[c])).first();
}

export async function updateRow(db, table, id, data) {
  const cols = Object.keys(data);
  if (TABLES[table].touch) cols.push('updated_at');
  if (!cols.length) return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  const sets = cols.map((c) => (c === 'updated_at' ? "updated_at = datetime('now')" : `${c} = ?`));
  const vals = cols.filter((c) => c !== 'updated_at').map((c) => data[c]);
  const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ? RETURNING *`;
  return db.prepare(sql).bind(...vals, id).first();
}

export async function listRows(db, table, url) {
  const def = TABLES[table];
  const where = [];
  const binds = [];
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status');
  if (from && DATE_RE.test(from)) { where.push(`${def.dateCol} >= ?`); binds.push(from); }
  if (to && DATE_RE.test(to)) { where.push(`substr(${def.dateCol}, 1, 10) <= ?`); binds.push(to); }
  if (status && 'status' in def.fields) { where.push('status = ?'); binds.push(status); }
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '500', 10) || 500, 1), 2000);
  const sql = `SELECT * FROM ${table}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${def.order} LIMIT ${limit}`;
  const { results } = await db.prepare(sql).bind(...binds).all();
  return results;
}

export function parseId(params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) throw error('bad id', 404);
  return id;
}

/* Wraps a handler so thrown Responses (validation errors) are returned as-is. */
export function handle(fn) {
  return async (ctx) => {
    if (!ctx.env.DB) return error('Database not configured: bind a D1 database named DB to this Pages project.', 500);
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof Response) return e;
      console.error(e);
      return error('Server error', 500);
    }
  };
}

/* Builds GET/POST (collection) and GET/PATCH/DELETE (item) handlers for a table. */
export function collection(table, { afterInsert } = {}) {
  return {
    onRequestGet: handle(async ({ env, request }) => json(await listRows(env.DB, table, new URL(request.url)))),
    onRequestPost: handle(async (ctx) => {
      const data = clean(table, await readBody(ctx.request));
      let row = await insertRow(ctx.env.DB, table, data);
      if (afterInsert) row = (await afterInsert(ctx, row)) || row;
      return json(row, 201);
    }),
  };
}

export function item(table, { afterUpdate } = {}) {
  const get = async (db, id) => {
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
    if (!row) throw error('not found', 404);
    return row;
  };
  return {
    onRequestGet: handle(async ({ env, params }) => json(await get(env.DB, parseId(params)))),
    onRequestPatch: handle(async (ctx) => {
      const id = parseId(ctx.params);
      await get(ctx.env.DB, id);
      const data = clean(table, await readBody(ctx.request), { partial: true });
      let row = await updateRow(ctx.env.DB, table, id, data);
      if (afterUpdate) row = (await afterUpdate(ctx, row)) || row;
      return json(row);
    }),
    onRequestDelete: handle(async ({ env, params }) => {
      const id = parseId(params);
      await get(env.DB, id);
      await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
      return json({ ok: true });
    }),
  };
}
