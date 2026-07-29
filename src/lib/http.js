// ============================================================================
// ReplyFox — tiny HTTP helpers shared by the API handlers + server.
// Handlers are plain async functions: `async (req, services) => Response`
// where Response = { status, headers?, body }. The server serializes `body`
// as JSON. Keeping handlers pure makes them trivial to unit-test.
// ============================================================================

/** Success response (200 by default). */
export function ok(body, status = 200, headers) {
  return { status, headers, body };
}

/** Error response shaped as `{ error, ...extra }`. */
export function fail(message, status = 400, extra = {}) {
  return { status, body: { error: message, ...extra } };
}

/** Validation helper — throws an object the server turns into a 400. */
export function assert(condition, message, extra = {}) {
  if (!condition) {
    const err = new Error(message);
    err.statusCode = 400;
    err.extra = extra;
    throw err;
  }
}

/**
 * Read + JSON-parse an IncomingMessage body (Node http). Returns the parsed
 * object, or {} for empty bodies. Throws on invalid JSON.
 */
export function readJsonBody(req, rawBuffer) {
  if (!rawBuffer || rawBuffer.length === 0) return {};
  const text = rawBuffer.toString('utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON body');
    err.statusCode = 400;
    throw err;
  }
}

/** Build query object from a URL string. */
export function parseQuery(url) {
  const u = new URL(url, 'http://localhost');
  const query = {};
  for (const [k, v] of u.searchParams.entries()) query[k] = v;
  return query;
}

/** Generate a UUID v4 (uses Node's crypto when available). */
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback (older runtimes).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
