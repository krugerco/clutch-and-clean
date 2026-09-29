/* Cloudflare Worker entry: /api/* and /photos/* are handled here, everything else is the static site (ASSETS). */
import { collection, item, error } from './lib/api.js';
import { afterJobSave } from './lib/jobs.js';
import { site, pricing, testimonials, photos, photo, servePhoto } from './lib/content.js';
import { checkAuth, pin } from './auth.js';
import * as leads from './leads.js';
import * as summary from './summary.js';

/* /api/admin/<name>            → [collection handlers]
   /api/admin/<name>/<id>       → [item handlers] */
const admin = {
  leads: [collection('leads'), item('leads')],
  jobs: [collection('jobs', { afterInsert: afterJobSave }), item('jobs', { afterUpdate: afterJobSave })],
  expenses: [collection('expenses'), item('expenses')],
  photos: [photos, photo],
  summary: [summary],
  pricing: [pricing],
  testimonials: [testimonials],
  pin: [pin],
};

const methodKey = (m) => 'onRequest' + m.charAt(0) + m.slice(1).toLowerCase();

function dispatch(handlers, ctx) {
  const fn = handlers && handlers[methodKey(ctx.request.method)];
  return fn ? fn(ctx) : error('Method not allowed', 405);
}

export default {
  async fetch(request, env, execCtx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const ctx = { request, env, params: {}, waitUntil: (p) => execCtx.waitUntil(p) };

    if (path.startsWith('/photos/')) return servePhoto(env, path.slice('/photos/'.length));
    if (path === '/api/leads') return dispatch(leads, ctx);
    if (path === '/api/site') return dispatch(site, ctx);

    if (path === '/api/admin' || path.startsWith('/api/admin/')) {
      const denied = await checkAuth(request, env);
      if (denied) return denied;
      const [, resource, id, extra] = path.slice('/api/admin'.length).split('/');
      const routes = Object.hasOwn(admin, resource || '') ? admin[resource] : null;
      if (routes && extra === undefined) {
        if (id === undefined) return dispatch(routes[0], ctx);
        if (routes[1]) {
          ctx.params.id = id;
          return dispatch(routes[1], ctx);
        }
      }
      return error('Not found', 404);
    }

    if (path.startsWith('/api/')) return error('Not found', 404);
    return env.ASSETS.fetch(request);
  },
};
