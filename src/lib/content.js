/* Editable website content: prices, testimonials and before/after photos. */
import { json, error, readBody, handle, parseId } from './api.js';

/* Matches what is hard-coded in index.html (used until Reed saves his own). */
export const DEFAULT_PRICING = {
  services: {
    bronze:   { name: 'Bronze Package',   p: [200, 225, 250] },
    silver:   { name: 'Silver Package',   p: [245, 270, 295] },
    gold:     { name: 'Gold Package',     p: [290, 315, 340] },
    interior: { name: 'Interior Only',    p: [165, 175, 185] },
    exterior: { name: 'Exterior Only',    p: [150, 165, 180] },
    quick:    { name: 'Quick Wash & Vac', p: [75, 90, 100] },
  },
  addons: {
    odor:      { name: 'Odor / smoke elimination', lo: 50, hi: 50 },
    stain:     { name: 'Stain removal',            lo: 35, hi: 100 },
    headlight: { name: 'Headlight restoration',    lo: 60, hi: 60 },
    engine:    { name: 'Engine bay cleaning',      lo: 75, hi: 75 },
    pet:       { name: 'Pet hair removal',         lo: 25, hi: 50 },
    clay:      { name: 'Clay bar treatment',       lo: 75, hi: 100 },
  },
};

export const DEFAULT_TESTIMONIALS = [
  { text: "I didn't realize how rough my car's paint had become until the clay bar treatment. The difference was insane — smoother than when I bought it. Right on time, done within an hour, flawless results.", name: 'Delighted Customer', stars: 5 },
  { text: 'I was thinking about replacing my foggy headlights, but Clutch & Clean made them crystal clear in no time. They came right to my driveway and had my lights looking brand new in under an hour.', name: 'Satisfied Client', stars: 5 },
  { text: "Hands down the best detail I've ever gotten. They came right to my office — interior, exterior, tire shine, wax, conditioned seats. My car looked fresh off the lot in about two hours.", name: 'Happy Customer', stars: 5 },
];

export async function getSetting(db, key, fallback) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}

export async function putSetting(db, key, value) {
  await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')")
    .bind(key, JSON.stringify(value))
    .run();
}

const dollars = (v, what) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw error(`${what} must be a whole dollar amount`);
  return n;
};

/* Only prices are editable; names and the list of services/add-ons stay fixed to match the site. */
function cleanPricing(input) {
  const out = { services: {}, addons: {} };
  for (const [k, def] of Object.entries(DEFAULT_PRICING.services)) {
    const p = input?.services?.[k]?.p;
    if (!Array.isArray(p) || p.length !== 3) throw error(`${def.name} needs 3 prices`);
    out.services[k] = { name: def.name, p: p.map((v) => dollars(v, def.name)) };
  }
  for (const [k, def] of Object.entries(DEFAULT_PRICING.addons)) {
    const a = input?.addons?.[k] || {};
    const lo = dollars(a.lo, def.name);
    const hi = dollars(a.hi ?? a.lo, def.name);
    if (hi < lo) throw error(`${def.name}: the high price can't be below the low price`);
    out.addons[k] = { name: def.name, lo, hi };
  }
  return out;
}

function cleanTestimonials(input) {
  if (!Array.isArray(input) || input.length > 12) throw error('Up to 12 testimonials');
  return input.map((t, i) => {
    const text = String(t?.text || '').trim();
    const name = String(t?.name || '').trim() || 'Happy Customer';
    const stars = Math.min(5, Math.max(1, parseInt(t?.stars, 10) || 5));
    if (!text) throw error(`Testimonial ${i + 1} is empty`);
    if (text.length > 600 || name.length > 60) throw error(`Testimonial ${i + 1} is too long`);
    return { text, name, stars };
  });
}

const photoOut = (p) => ({
  id: p.id, title: p.title, caption: p.caption, sort: p.sort, visible: p.visible,
  before: `/photos/${p.before_key}`, after: `/photos/${p.after_key}`,
});

/* ---------- public ---------- */

/* GET /api/site — everything the public page needs, in one cached request. */
export const site = {
  onRequestGet: handle(async ({ env }) => {
    const [pricing, testimonials, photos] = await Promise.all([
      getSetting(env.DB, 'pricing', DEFAULT_PRICING),
      getSetting(env.DB, 'testimonials', DEFAULT_TESTIMONIALS),
      env.DB.prepare('SELECT * FROM photos WHERE visible = 1 ORDER BY sort, id DESC LIMIT 60').all(),
    ]);
    const res = json({ pricing, testimonials, photos: photos.results.map(photoOut) });
    res.headers.set('Cache-Control', 'public, max-age=30');
    return res;
  }),
};

/* GET /photos/<key> — serves an uploaded image from R2. */
export async function servePhoto(env, key) {
  if (!env.PHOTOS || !/^[a-z0-9-]+\.(jpg|png|webp)$/.test(key)) return error('Not found', 404);
  const obj = await env.PHOTOS.get(key);
  if (!obj) return error('Not found', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('ETag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
}

/* ---------- admin ---------- */

export const pricing = {
  onRequestGet: handle(async ({ env }) => json(await getSetting(env.DB, 'pricing', DEFAULT_PRICING))),
  onRequestPut: handle(async ({ env, request }) => {
    const value = cleanPricing(await readBody(request));
    await putSetting(env.DB, 'pricing', value);
    return json(value);
  }),
};

export const testimonials = {
  onRequestGet: handle(async ({ env }) => json(await getSetting(env.DB, 'testimonials', DEFAULT_TESTIMONIALS))),
  onRequestPut: handle(async ({ env, request }) => {
    const value = cleanTestimonials(await readBody(request));
    await putSetting(env.DB, 'testimonials', value);
    return json(value);
  }),
};

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 10 * 1024 * 1024;

async function storeImage(env, file, label) {
  if (!file || typeof file === 'string') throw error(`${label} photo is missing`);
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw error(`${label} photo must be a JPG, PNG or WebP image`);
  if (file.size > MAX_BYTES) throw error(`${label} photo is over 10 MB`);
  const key = `${crypto.randomUUID()}.${ext}`;
  await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return key;
}

const text = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);

export const photos = {
  onRequestGet: handle(async ({ env }) => {
    const { results } = await env.DB.prepare('SELECT * FROM photos ORDER BY sort, id DESC').all();
    return json(results.map(photoOut));
  }),
  /* multipart/form-data: before, after (files), title, caption */
  onRequestPost: handle(async ({ env, request }) => {
    if (!env.PHOTOS) return error('Photo storage not configured: bind an R2 bucket named PHOTOS.', 500);
    const form = await request.formData();
    const beforeKey = await storeImage(env, form.get('before'), 'Before');
    let afterKey;
    try {
      afterKey = await storeImage(env, form.get('after'), 'After');
    } catch (e) {
      await env.PHOTOS.delete(beforeKey);
      throw e;
    }
    const row = await env.DB
      .prepare('INSERT INTO photos (title, caption, before_key, after_key, sort) VALUES (?, ?, ?, ?, (SELECT COALESCE(MIN(sort), 0) - 1 FROM photos)) RETURNING *')
      .bind(text(form.get('title'), 80), text(form.get('caption'), 300), beforeKey, afterKey)
      .first();
    return json(photoOut(row), 201);
  }),
};

export const photo = {
  onRequestPatch: handle(async ({ env, request, params }) => {
    const id = parseId(params);
    const body = await readBody(request);
    const sets = [];
    const vals = [];
    if ('title' in body) { sets.push('title = ?'); vals.push(text(body.title, 80)); }
    if ('caption' in body) { sets.push('caption = ?'); vals.push(text(body.caption, 300)); }
    if ('visible' in body) { sets.push('visible = ?'); vals.push(body.visible ? 1 : 0); }
    if ('sort' in body) { sets.push('sort = ?'); vals.push(parseInt(body.sort, 10) || 0); }
    if (!sets.length) return error('Nothing to update');
    const row = await env.DB.prepare(`UPDATE photos SET ${sets.join(', ')} WHERE id = ? RETURNING *`).bind(...vals, id).first();
    if (!row) return error('not found', 404);
    return json(photoOut(row));
  }),
  onRequestDelete: handle(async ({ env, params }) => {
    const id = parseId(params);
    const row = await env.DB.prepare('DELETE FROM photos WHERE id = ? RETURNING *').bind(id).first();
    if (!row) return error('not found', 404);
    if (env.PHOTOS) await env.PHOTOS.delete([row.before_key, row.after_key]);
    return json({ ok: true });
  }),
};
