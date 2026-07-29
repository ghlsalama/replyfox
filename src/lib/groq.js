// ============================================================================
// ReplyFox — Groq LLM client (OpenAI-compatible)
// Spec reference: SPEC.md §7 (LLM Prompt Engineering)
//   model        = llama-3.3-70b-versatile
//   temperature  = 0.3   (factual, consistent)
//   max_tokens   = 300   (concise responses)
//   top_p        = 0.9
//   base URL     = https://api.groq.com/openai/v1
// ============================================================================

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export const GROQ_DEFAULTS = Object.freeze({
  model: DEFAULT_MODEL,
  temperature: 0.3,
  maxTokens: 300,
  topP: 0.9,
});

function config(overrides = {}) {
  return {
    apiKey: overrides.apiKey || process.env.GROQ_API_KEY,
    baseUrl: (overrides.baseUrl || process.env.GROQ_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    model: overrides.model || process.env.GROQ_MODEL || DEFAULT_MODEL,
    temperature:
      typeof overrides.temperature === 'number'
        ? overrides.temperature
        : GROQ_DEFAULTS.temperature,
    maxTokens:
      typeof overrides.maxTokens === 'number'
        ? overrides.maxTokens
        : GROQ_DEFAULTS.maxTokens,
    topP: typeof overrides.topP === 'number' ? overrides.topP : GROQ_DEFAULTS.topP,
  };
}

/**
 * Call the Groq chat-completions endpoint.
 *
 * @param {object} opts
 * @param {string} opts.system              System prompt (§7.1).
 * @param {string} [opts.user]              Current visitor message.
 * @param {Array<{role:string,content:string}>} [opts.history]  Prior turns.
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.topP]
 * @param {string} [opts.model]
 * @param {typeof fetch} [opts.fetchImpl]   Injectable for tests.
 * @returns {Promise<{reply:string, usage:object, raw:object}>}
 */
export async function chatCompletion(opts = {}) {
  const cfg = config(opts);
  if (!cfg.apiKey) {
    throw new Error('GROQ_API_KEY is not set. Add it to your environment.');
  }

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  if (Array.isArray(opts.history)) {
    for (const m of opts.history) {
      if (m && m.content) messages.push({ role: m.role, content: m.content });
    }
  }
  if (opts.user) messages.push({ role: 'user', content: opts.user });

  const fetchImpl = opts.fetchImpl || fetch;

  const url = `${cfg.baseUrl}/chat/completions`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      top_p: cfg.topP,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Groq API error ${res.status}: ${body.slice(0, 500)}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content?.trim() || '';

  return {
    reply,
    usage: data?.usage || null,
    raw: data,
  };
}

/** Health check / model listing helper (optional, useful for debugging). */
export async function listModels(opts = {}) {
  const cfg = config(opts);
  if (!cfg.apiKey) throw new Error('GROQ_API_KEY is not set.');
  const fetchImpl = opts.fetchImpl || fetch;
  const res = await fetchImpl(`${cfg.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!res.ok) throw new Error(`Groq models ${res.status}`);
  return res.json();
}
