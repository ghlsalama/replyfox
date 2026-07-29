// ============================================================================
// ReplyFox — POST /api/train
// Spec reference: SPEC.md §4.4 (data flow), §5.4 (/api/train)
//   Input:  { businessKey, content, source (url|text|file) }
//   Flow:   lookup business → if URL, fetch + extract text → clean → chunk
//           (≤500 chars) → store in knowledge_base
//   Output: { success, chunksProcessed, charsProcessed, embedCode }
//   Rate limit: 10/hour per business (best-effort, in-process).
// ============================================================================

import * as db from '../lib/supabase.js';
import { ok, fail, assert, uuid } from '../lib/http.js';

const CHUNK_SIZE = 500;            // SPEC §4.4: max 500 chars per chunk
const MAX_CONTENT_CHARS = 200_000; // safety cap on fetched text
const TRAIN_WINDOW_MS = 60 * 60 * 1000;
const TRAIN_MAX = 10;
const trainHits = new Map();

export function _rateLimit(businessKey) {
  const now = Date.now();
  const arr = (trainHits.get(businessKey) || []).filter((t) => t > now - TRAIN_WINDOW_MS);
  arr.push(now);
  trainHits.set(businessKey, arr);
  return arr.length <= TRAIN_MAX;
}

// ----------------------------------------------------------------------------
// HTML → text (no dependencies)
// ----------------------------------------------------------------------------

const ENTITY_MAP = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&#x27;': "'", '&apos;': "'", '&nbsp;': ' ', '&copy;': '(c)', '&reg;': '(r)',
  '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
};

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&[a-z#x0-9]+;/gi, (e) => ENTITY_MAP[e.toLowerCase()] ?? e);
}

/**
 * Strip a fetched HTML document down to readable text. Removes scripts,
 * styles, nav/footers, and tag markup; decodes entities; collapses whitespace.
 * Crude but dependency-free — fine for FAQ / about / product pages.
 */
export function htmlToText(html) {
  if (!html) return '';
  let s = String(html);
  // Drop non-content blocks entirely.
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  s = s.replace(/<header[\s\S]*?<\/header>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  // Turn block-level closers into line breaks so chunks stay readable.
  s = s.replace(/<\/(p|div|section|article|li|h[1-6]|tr|br|ul|ol|table)\s*>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  // Strip remaining tags.
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  // Collapse whitespace.
  s = s.replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
  return s;
}

/**
 * Chunk text into sections of roughly `size` chars, breaking on paragraph or
 * sentence boundaries when possible (SPEC §4.4). Returns the chunks.
 */
export function chunkText(text, size = CHUNK_SIZE) {
  const out = [];
  if (!text) return out;
  const clean = text.replace(/\r\n/g, '\n');
  // Split into paragraphs first, then greedily pack up to `size` chars.
  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  let buf = '';
  const flush = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = '';
  };
  for (const p of paragraphs) {
    if (p.length > size) {
      // Hard-split long paragraphs on sentence boundaries.
      flush();
      const sentences = p.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [p];
      for (const s of sentences) {
        if ((buf + s).length > size) flush();
        buf += (buf ? ' ' : '') + s.trim();
        if (buf.length >= size) flush();
      }
      flush();
    } else if ((buf + '\n\n' + p).length > size) {
      flush();
      buf = p;
    } else {
      buf += (buf ? '\n\n' : '') + p;
    }
  }
  flush();
  return out;
}

async function fetchUrlText(url, fetchImpl) {
  const fetchFn = fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ReplyFoxBot/1.0 (+https://replyfox.app)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
    const html = await res.text();
    return htmlToText(html);
  } finally {
    clearTimeout(timer);
  }
}

export async function handler(req, services = {}) {
  const DB = services.db || db;
  const body = req.body || {};
  const businessKey = body.businessKey || body.business_key;
  const content = body.content;
  let source = (body.source || '').toLowerCase();

  try {
    assert(businessKey, 'businessKey is required.');
    assert(content && typeof content === 'string' && content.trim(), 'content is required.');
  } catch (e) {
    return fail(e.message, e.statusCode || 400);
  }

  // Infer source if omitted.
  if (!source) {
    source = /^https?:\/\//i.test(content.trim()) ? 'url' : 'text';
  }

  // Lookup business.
  let business;
  try {
    business = await DB.findBusinessByKey(businessKey);
  } catch (e) {
    return fail('Database error looking up business.', 503, { detail: e.message });
  }
  if (!business) return fail('Business not found for that key.', 404);

  if (!_rateLimit(businessKey)) {
    return fail('Training rate limit reached (10/hour). Try again later.', 429);
  }

  // Resolve content to plain text.
  let text = '';
  let sourceUrl = null;
  try {
    if (source === 'url') {
      sourceUrl = content.trim();
      text = await fetchUrlText(sourceUrl, services.fetch);
    } else if (source === 'file') {
      // `content` expected to be extracted file text already.
      text = String(content);
    } else {
      text = String(content);
    }
  } catch (e) {
    return fail(`Could not process content: ${e.message}`, 502);
  }

  text = text.trim();
  if (!text) return fail('No usable text found in the provided content.', 422);
  if (text.length > MAX_CONTENT_CHARS) text = text.slice(0, MAX_CONTENT_CHARS);

  const chunks = chunkText(text);
  if (chunks.length === 0) return fail('Content was too short to train on.', 422);

  // Store (append a fresh knowledge_base row; the chat endpoint uses the latest).
  try {
    await DB.addKnowledge({
      businessId: business.id,
      content: text,
      source,
      sourceUrl,
      chunkCount: chunks.length,
    });
  } catch (e) {
    return fail('Could not store knowledge base.', 503, { detail: e.message });
  }

  const publicBase = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const embedCode = `<script src="${publicBase}/widget.js" data-key="${businessKey}"></script>`;

  return ok({
    success: true,
    chunksProcessed: chunks.length,
    charsProcessed: text.length,
    source,
    embedCode,
  });
}

export default handler;
