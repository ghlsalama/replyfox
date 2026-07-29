// ============================================================================
// ReplyFox — GET /api/widget-config
// Spec reference: SPEC.md §5.4 (/api/widget-config), §9 (widget)
//   Query:  ?key=<businessKey>
//   Output: { businessName, color, position, greeting, avatar, hours,
//             outsideHoursMessage }
//   Public: called by widget.js on load to configure appearance.
// ============================================================================

import * as db from '../lib/supabase.js';
import { ok, fail } from '../lib/http.js';

export async function handler(req, services = {}) {
  const DB = services.db || db;
  const key = req.query?.key;

  if (!key) {
    return fail('key is required.', 400);
  }

  let business;
  try {
    business = await DB.findBusinessByKey(key);
  } catch (e) {
    return fail('Database error.', 503, { detail: e.message });
  }
  if (!business) {
    return fail('Business not found for that key.', 404);
  }

  let config = null;
  try {
    config = await DB.getWidgetConfig(business.id);
  } catch (e) {
    /* fall back to defaults below */
  }

  return ok({
    businessName: business.business_name,
    color: config?.color || '#4F46E5',
    position: config?.position || 'bottom-right',
    greeting: config?.greeting || 'Hi! How can I help you today?',
    avatar: config?.avatar || '🤖',
    hours: config?.business_hours || null,
    outsideHoursMessage:
      config?.outside_hours_message ||
      'We are currently closed. Leave your email and we will get back to you.',
  });
}

export default handler;
