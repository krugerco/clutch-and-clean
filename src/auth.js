/* Admin sign-in. Every /api/admin/* request carries `Authorization: Bearer <PIN>`.
   The PIN is stored hashed in the settings table (Reed can change it in the back office);
   the ADMIN_PASSWORD secret, if set, also works as a backup key.
   5 wrong tries from one IP locks sign-in for 15 minutes, which keeps a short PIN safe. */
import { json, error, readBody, safeEqual, handle } from './lib/api.js';

const MAX_FAILS = 5;
const WINDOW = '-15 minutes';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ipOf = (request) => request.headers.get('CF-Connecting-IP') || 'local';

/* Returns an error Response to send back, or null when the request is allowed. */
export async function checkAuth(request, env) {
  if (!env.DB) return error('Database not configured: bind a D1 database named DB to this Worker.', 500);
  const ip = ipOf(request);
  const [fails, hashRow, saltRow] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM auth_fails WHERE ip = ? AND at > datetime('now', '${WINDOW}')`).bind(ip),
    env.DB.prepare("SELECT value FROM settings WHERE key = 'pin_hash'"),
    env.DB.prepare("SELECT value FROM settings WHERE key = 'pin_salt'"),
  ]);
  if (fails.results[0].n >= MAX_FAILS) return error('Too many wrong tries. Wait 15 minutes and try again.', 429);

  const pinHash = hashRow.results[0] && JSON.parse(hashRow.results[0].value);
  const salt = saltRow.results[0] && JSON.parse(saltRow.results[0].value);
  if (!pinHash && !env.ADMIN_PASSWORD) return error('No PIN has been set up yet.', 500);

  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const ok = !!token && (
    (env.ADMIN_PASSWORD && safeEqual(token, env.ADMIN_PASSWORD)) ||
    (pinHash && safeEqual(await sha256(`${salt}:${token}`), pinHash))
  );
  if (ok) return null;

  await env.DB.batch([
    env.DB.prepare('INSERT INTO auth_fails (ip) VALUES (?)').bind(ip),
    env.DB.prepare("DELETE FROM auth_fails WHERE at < datetime('now', '-1 day')"),
  ]);
  const left = MAX_FAILS - fails.results[0].n - 1;
  return error(left > 0 ? `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Wait 15 minutes and try again.', left > 0 ? 401 : 429);
}

/* PUT /api/admin/pin  { pin: "123456" } — change the sign-in PIN. */
export const pin = {
  onRequestPut: handle(async ({ env, request }) => {
    const { pin: next } = await readBody(request);
    if (!/^\d{4,8}$/.test(String(next || ''))) return error('PIN must be 4 to 8 digits');
    const salt = crypto.randomUUID();
    const hash = await sha256(`${salt}:${next}`);
    const put = "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')";
    await env.DB.batch([
      env.DB.prepare(put).bind('pin_salt', JSON.stringify(salt)),
      env.DB.prepare(put).bind('pin_hash', JSON.stringify(hash)),
    ]);
    return json({ ok: true });
  }),
};
