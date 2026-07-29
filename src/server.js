// ============================================================================
// ReplyFox — HTTP server entry point
// Spec reference: SPEC.md §5.4 (API endpoints)
//
// A small router over Node's built-in `http` module (no Express dependency).
// Each /api/* route delegates to a pure handler in src/api/*.js that returns
// { status, headers?, body }. This file handles body reading, routing, CORS,
// static widget.js serving, and error normalization.
//
//   npm start    → node src/server.js
//   npm run dev  → node --watch src/server.js
//
// Deployable as-is on any Node host (Render/Railway/Fly/a VPS). For Vercel,
// each src/api/*.js handler can be wrapped in an adapter (see README note).
// ============================================================================

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import chat from './api/chat.js';
import train from './api/train.js';
import signup from './api/signup.js';
import usage from './api/usage.js';
import widgetConfig from './api/widget-config.js';
import billing from './api/billing.js';
import { parseQuery } from './lib/http.js';

// Auto-detect demo mode: use mock DB/LLM when no credentials are configured.
const USE_MOCK_DB = !process.env.SUPABASE_URL;
const USE_MOCK_LLM = !process.env.GROQ_API_KEY && !process.env.LLM_API_KEY;
const mockDb = USE_MOCK_DB ? (await import('./lib/mock-db.js')) : null;
const mockLlm = USE_MOCK_LLM ? (await import('./lib/mock-llm.js')) : null;
const DEMO_SERVICES = (USE_MOCK_DB || USE_MOCK_LLM) ? {
  ...(USE_MOCK_DB ? { db: mockDb } : {}),
  ...(USE_MOCK_LLM ? { llm: mockLlm } : {}),
} : undefined;

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIDGET_PATH = join(__dirname, 'widget', 'widget.js');

const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_BODY = 2 * 1024 * 1024; // 2 MB safety cap

// Route table: [method, pathname, handler]
const routes = [
  ['POST', '/api/chat', chat],
  ['POST', '/api/train', train],
  ['POST', '/api/signup', signup],
  ['GET', '/api/usage', usage],
  ['GET', '/api/widget-config', widgetConfig],
  ['POST', '/api/billing/webhook', billing],
];

// CORS — the widget runs on third-party sites and POSTs cross-origin to /api/chat.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function send(res, status, body, headers = {}) {
  const h = { ...CORS_HEADERS, ...headers };
  res.writeHead(status, h);
  res.end(body);
}

function sendJson(res, status, obj, headers = {}) {
  send(res, status, JSON.stringify(obj), {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        if (!aborted) {
          aborted = true;
          reject(Object.assign(new Error('Request body too large.'), { statusCode: 413 }));
        }
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

let _widgetSource = null;
async function serveWidget(res) {
  try {
    if (!_widgetSource) _widgetSource = await readFile(WIDGET_PATH, 'utf8');
    send(res, 200, _widgetSource, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    });
  } catch {
    sendJson(res, 404, { error: 'widget.js not found' });
  }
}

const server = http.createServer(async (req, res) => {
  const method = req.method;
  const url = req.url || '/';
  const pathname = url.split('?')[0];

  // Preflight
  if (method === 'OPTIONS') {
    return send(res, 204, '');
  }

  // Static + health
  if (method === 'GET' && (pathname === '/widget.js' || pathname === '/widget.min.js')) {
    return serveWidget(res);
  }
  // Demo page
  if (method === 'GET' && pathname === '/demo') {
    try {
      const demoHtml = await readFile(join(__dirname, 'demo', 'demo.html'), 'utf8');
      return send(res, 200, demoHtml, { 'Content-Type': 'text/html; charset=utf-8' });
    } catch {
      return sendJson(res, 404, { error: 'demo.html not found' });
    }
  }
  if (method === 'GET' && (pathname === '/healthz' || pathname === '/')) {
    return sendJson(res, 200, {
      ok: true,
      service: 'replyfox',
      time: new Date().toISOString(),
    });
  }

  // API routes
  const route = routes.find(([m, p]) => m === method && pathname === p);
  if (!route) {
    return sendJson(res, 404, { error: `Not found: ${method} ${pathname}` });
  }
  const [, , handler] = route;

  // Parse body for POST routes; pass rawBody to every handler (billing needs it).
  let rawBody = Buffer.alloc(0);
  if (method === 'POST') {
    try {
      rawBody = await readBody(req);
    } catch (e) {
      return sendJson(res, e.statusCode || 400, { error: e.message });
    }
  }

  let body = {};
  if (rawBody.length > 0) {
    const text = rawBody.toString('utf8');
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
    }
  }

  const ctx = {
    method,
    url,
    pathname,
    headers: req.headers,
    socket: req.socket,
    query: parseQuery(url),
    body,
    rawBody,
  };

  try {
    const result = await handler(ctx, DEMO_SERVICES);
    if (result == null) return sendJson(res, 204, {});
    const status = result.status || 200;
    if (result.body === undefined) {
      return send(res, status, '', result.headers);
    }
    return sendJson(res, status, result.body, result.headers);
  } catch (e) {
    const status = e.statusCode || 500;
    if (status >= 500) console.error('[replyfox] handler error:', e);
    return sendJson(res, status, { error: e.message || 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  ┌─────────────────────────────────────────────┐`);
  console.log(`  │  ReplyFox API listening on :${PORT}             │`);
  if (DEMO_SERVICES) {
    console.log(`  │  ⚡ DEMO MODE (mock data — no creds needed)  │`);
    console.log(`  │  DB: ${USE_MOCK_DB ? 'mock (in-memory)' : 'Supabase'}            LLM: ${USE_MOCK_LLM ? 'mock (pattern)' : 'Groq'}     │`);
    console.log(`  │  Demo key: demo-key-0001                    │`);
  }
  console.log(`  │  widget: http://localhost:${PORT}/widget.js      │`);
  console.log(`  │  health: http://localhost:${PORT}/healthz      │`);
  console.log(`  │  demo:   http://localhost:${PORT}/demo         │`);
  console.log(`  └─────────────────────────────────────────────┘\n`);
});

export default server;
