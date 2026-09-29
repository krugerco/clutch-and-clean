/* Every /api/admin/* request must carry `Authorization: Bearer <ADMIN_PASSWORD>`. */
import { error, safeEqual } from '../../../lib/api.js';

export const onRequest = async ({ request, env, next }) => {
  if (!env.ADMIN_PASSWORD) return error('ADMIN_PASSWORD is not set on this Pages project.', 500);
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !safeEqual(token, env.ADMIN_PASSWORD)) return error('Unauthorized', 401);
  return next();
};
