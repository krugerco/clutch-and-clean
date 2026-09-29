/* Public endpoint: the website inquiry form posts here (alongside Formspree).
   Saves the lead to D1 and, if NTFY_TOPIC is set, pushes a phone notification. */
import { json, error, readBody, clean, insertRow, handle } from './lib/api.js';

export const onRequestPost = handle(async ({ request, env, waitUntil }) => {
  const body = await readBody(request);
  if (body._gotcha) return json({ ok: true }); // honeypot filled in = bot; pretend success

  const data = clean('leads', {
    name: body.name, phone: body.phone, email: body.email, vehicle: body.vehicle,
    service: body.service, message: body.message, source: 'website',
  });
  if (!data.phone) return error('phone is required');

  const lead = await insertRow(env.DB, 'leads', data);
  if (env.NTFY_TOPIC) waitUntil(notify(env, lead));
  return json({ ok: true, id: lead.id }, 201);
});

async function notify(env, lead) {
  const lines = [
    `${lead.name} · ${lead.phone}`,
    [lead.vehicle, lead.service].filter(Boolean).join(' · '),
    lead.message,
  ].filter(Boolean);
  const headers = { Title: 'New detail inquiry', Tags: 'car', Priority: 'high' };
  if (env.SITE_URL) headers.Click = `${env.SITE_URL.replace(/\/$/, '')}/admin/#leads`;
  if (env.NTFY_TOKEN) headers.Authorization = `Bearer ${env.NTFY_TOKEN}`;
  const server = (env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');
  try {
    await fetch(`${server}/${encodeURIComponent(env.NTFY_TOPIC)}`, { method: 'POST', body: lines.join('\n'), headers });
  } catch (e) {
    console.error('ntfy failed', e);
  }
}
