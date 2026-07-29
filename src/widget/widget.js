/*!
 * ReplyFox — embeddable AI support widget
 * Spec: SPEC.md §5.3 + §9.  Vanilla JS, no dependencies, scoped CSS (.rf-).
 * Embed:
 *   <script src="https://your-host/widget.js" data-key="BUSINESS_KEY"></script>
 * Size: < 30KB. Mobile responsive. localStorage session persistence.
 */
(function () {
  'use strict';
  if (window.__replyfox_loaded) return;
  window.__replyfox_loaded = true;

  // ── Bootstrap ────────────────────────────────────────────────────────────
  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName('script');
      return s[s.length - 1];
    })();
  var BUSINESS_KEY = script && script.getAttribute('data-key');
  if (!BUSINESS_KEY) {
    if (window.console) console.warn('[ReplyFox] missing data-key attribute');
    return;
  }
  var API_BASE = (function () {
    if (script && script.src) {
      try {
        return new URL(script.src).origin;
      } catch (e) {}
    }
    return '';
  })();

  var GREET_DELAY = 3000;   // auto-greeting after N ms
  var IDLE_DELAY = 30000;   // "anything else?" after N ms idle
  var MAX_HISTORY = 50;
  var LS_KEY = 'rf_session_' + BUSINESS_KEY;

  var state = {
    config: null,
    open: false,
    greeted: false,
    sending: false,
    session: loadSession(),
    idleTimer: null,
    lastBotId: null,
  };

  // ── DOM + styles ─────────────────────────────────────────────────────────
  var css = `
.rf-root{--rf-color:#4F46E5}
.rf-root, .rf-root *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.rf-bubble{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:#4F46E5;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:2147483000;transition:transform .15s ease,opacity .2s ease;font-size:26px;border:none;line-height:1}
.rf-bubble:hover{transform:scale(1.06)}
.rf-bubble.rf-left{right:auto;left:20px}
.rf-bubble.rf-pulse::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(255,255,255,.6);animation:rfpulse 2s infinite}
@keyframes rfpulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.4);opacity:0}100%{opacity:0}}
.rf-launch-hint{position:fixed;bottom:30px;right:90px;background:#fff;color:#222;padding:8px 12px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.2);font-size:13px;z-index:2147483000;max-width:220px;opacity:0;transform:translateX(8px);transition:opacity .3s,transform .3s;pointer-events:none}
.rf-launch-hint.rf-show{opacity:1;transform:translateX(0)}
.rf-window{position:fixed;bottom:90px;right:20px;width:360px;height:520px;max-height:calc(100vh - 110px);background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);z-index:2147483001;display:none;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(12px) scale(.98);transition:opacity .18s ease,transform .18s ease}
.rf-window.rf-left{right:auto;left:20px}
.rf-window.rf-open{display:flex;opacity:1;transform:none}
.rf-header{background:#4F46E5;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0}
.rf-header-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.rf-header-title{font-size:15px;font-weight:600;flex:1;line-height:1.2}
.rf-header-sub{font-size:11px;opacity:.85;font-weight:400}
.rf-close{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;opacity:.9;padding:0 4px}
.rf-close:hover{opacity:1}
.rf-messages{flex:1;overflow-y:auto;padding:14px;background:#f6f7f9;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
.rf-msg{max-width:82%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;word-wrap:break-word;white-space:normal;position:relative;animation:rfin .18s ease}
@keyframes rfin{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.rf-msg.rf-bot{align-self:flex-start;background:#fff;border:1px solid #e6e8eb;border-bottom-left-radius:4px}
.rf-msg.rf-visitor{align-self:flex-end;background:#e9ebef;color:#1f2328;border-bottom-right-radius:4px}
.rf-msg.rf-visitor a{color:#1f2328;text-decoration:underline}
.rf-msg.rf-bot a{color:var(--rf-color)}
.rf-msg p{margin:0 0 4px}
.rf-msg p:last-child{margin-bottom:0}
.rf-msg ul,.rf-msg ol{margin:4px 0 4px 18px}
.rf-time{display:block;font-size:10px;opacity:.6;margin-top:3px}
.rf-actions{display:flex;gap:6px;margin-top:5px}
.rf-thumb{background:#eef0f3;border:none;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:13px;line-height:1}
.rf-thumb:hover{background:#e2e5e9}
.rf-thumb.rf-picked{background:var(--rf-color);color:#fff}
.rf-typing{align-self:flex-start;background:#fff;border:1px solid #e6e8eb;padding:10px 14px;border-radius:14px;border-bottom-left-radius:4px;display:none;gap:4px}
.rf-typing.rf-on{display:inline-flex}
.rf-typing span{width:6px;height:6px;border-radius:50%;background:#b6bcc6;animation:rfdot 1.2s infinite}
.rf-typing span:nth-child(2){animation-delay:.2s}
.rf-typing span:nth-child(3){animation-delay:.4s}
@keyframes rfdot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.rf-email-row{align-self:flex-start;background:#fff;border:1px solid #e6e8eb;padding:10px;border-radius:14px;border-bottom-left-radius:4px;display:none;flex-direction:column;gap:8px;max-width:82%}
.rf-email-row.rf-on{display:flex}
.rf-email-row input{border:1px solid #d4d8de;border-radius:8px;padding:8px 10px;font-size:14px;outline:none}
.rf-email-row input:focus{border-color:var(--rf-color)}
.rf-email-row button{background:#4F46E5;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:14px;cursor:pointer;font-weight:600}
.rf-input{border-top:1px solid #eceef1;padding:10px;background:#fff;display:flex;gap:8px;flex-shrink:0}
.rf-input textarea{flex:1;border:1px solid #d4d8de;border-radius:10px;padding:9px 11px;font-size:14px;resize:none;max-height:90px;outline:none;font-family:inherit}
.rf-input textarea:focus{border-color:var(--rf-color)}
.rf-send{background:#4F46E5;color:#fff;border:none;border-radius:10px;width:38px;font-size:18px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.rf-send:disabled{opacity:.5;cursor:not-allowed}
.rf-powered{font-size:10px;color:#9aa1ab;text-align:center;padding:6px;background:#fff;border-top:1px solid #f0f1f3;flex-shrink:0;text-decoration:none}
.rf-powered a{color:#9aa1ab;text-decoration:none}
.rf-error{align-self:center;font-size:12px;color:#c0392b;background:#fdecea;padding:6px 10px;border-radius:8px;display:none}
.rf-error.rf-on{display:block}
@media (max-width:768px){
  .rf-window{width:100%!important;height:100%!important;max-height:100%!important;bottom:0!important;right:0!important;left:0!important;border-radius:0}
  .rf-launch-hint{right:84px;bottom:24px}
  .rf-bubble{bottom:16px;right:16px}
}
`;
  var style = document.createElement('style');
  style.id = 'rf-style';
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.className = 'rf-root';
  root.innerHTML =
    '<div class="rf-launch-hint" id="rfHint"></div>' +
    '<button class="rf-bubble rf-pulse" id="rfBubble" aria-label="Open chat">💬</button>' +
    '<div class="rf-window" id="rfWindow" role="dialog" aria-label="Chat window">' +
      '<div class="rf-header" id="rfHeader">' +
        '<div class="rf-header-avatar" id="rfAvatar">🤖</div>' +
        '<div style="flex:1">' +
          '<div class="rf-header-title" id="rfTitle">ReplyFox</div>' +
          '<div class="rf-header-sub" id="rfSub">Typically replies instantly</div>' +
        '</div>' +
        '<button class="rf-close" id="rfClose" aria-label="Close chat">×</button>' +
      '</div>' +
      '<div class="rf-messages" id="rfMessages"></div>' +
      '<div class="rf-typing" id="rfTyping"><span></span><span></span><span></span></div>' +
      '<div class="rf-error" id="rfError"></div>' +
      '<div class="rf-input">' +
        '<textarea id="rfText" rows="1" placeholder="Type a message…"></textarea>' +
        '<button class="rf-send" id="rfSend" aria-label="Send">➤</button>' +
      '</div>' +
      '<div class="rf-powered">Powered by <a href="#" rel="noopener">ReplyFox</a></div>' +
    '</div>';
  document.body.appendChild(root);

  var el = {
    bubble: document.getElementById('rfBubble'),
    hint: document.getElementById('rfHint'),
    window: document.getElementById('rfWindow'),
    header: document.getElementById('rfHeader'),
    avatar: document.getElementById('rfAvatar'),
    title: document.getElementById('rfTitle'),
    sub: document.getElementById('rfSub'),
    close: document.getElementById('rfClose'),
    messages: document.getElementById('rfMessages'),
    typing: document.getElementById('rfTyping'),
    error: document.getElementById('rfError'),
    text: document.getElementById('rfText'),
    send: document.getElementById('rfSend'),
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  function loadSession() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.sessionId) return { sessionId: s.sessionId, messages: s.messages || [] };
      }
    } catch (e) {}
    var sid = 'rf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    return { sessionId: sid, messages: [] };
  }
  function saveSession() {
    try {
      var trimmed = state.session.messages.slice(-MAX_HISTORY);
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ sessionId: state.session.sessionId, messages: trimmed })
      );
    } catch (e) {}
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }
  function now() {
    var d = new Date();
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Minimal, safe markdown: escape first, then apply bold/italic/links/breaks.
  function renderMarkdown(text) {
    var t = esc(text);
    // links [text](http(s)://...)
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // bare URLs
    t = t.replace(/(^|[\s(])((https?:\/\/)[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    // bold **x**
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic *x* or _x_
    t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    t = t.replace(/(^|\s)_([^_\n]+)_/g, '$1<em>$2</em>');
    // line breaks
    t = t.replace(/\n/g, '<br>');
    return t;
  }
  function scrollBottom() {
    el.messages.scrollTop = el.messages.scrollHeight;
  }
  function setColor(c) {
    if (!c) return;
    el.bubble.style.background = c;
    el.header.style.background = c;
    el.send.style.background = c;
    var sheets = document.getElementById('rf-style');
    // patch dynamic color into bot message link + send hover via CSS vars (simple approach: inline)
    root.style.setProperty('--rf-color', c);
  }
  function setSide(side) {
    if (side === 'bottom-left') {
      el.bubble.classList.add('rf-left');
      el.window.classList.add('rf-left');
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function addMessage(role, content, opts) {
    opts = opts || {};
    var node = document.createElement('div');
    node.className = 'rf-msg ' + (role === 'visitor' ? 'rf-visitor' : 'rf-bot');
    node.innerHTML =
      '<p>' + renderMarkdown(content) + '</p>' +
      '<span class="rf-time">' + (opts.time || now()) + '</span>';
    el.messages.appendChild(node);

    if (role === 'bot') {
      state.lastBotId = uuid();
      node.dataset.id = state.lastBotId;
      if (opts.showSatisfaction) appendSatisfaction(node, state.lastBotId);
    }
    scrollBottom();
    state.session.messages.push({ role: role, content: content, time: opts.time || now() });
    saveSession();
    return node;
  }
  function appendSatisfaction(node, id) {
    var row = document.createElement('div');
    row.className = 'rf-actions';
    var up = document.createElement('button');
    up.className = 'rf-thumb';
    up.textContent = '👍';
    up.setAttribute('aria-label', 'Helpful');
    var down = document.createElement('button');
    down.className = 'rf-thumb';
    down.textContent = '👎';
    down.setAttribute('aria-label', 'Not helpful');
    up.onclick = function () { pick(id, up, down, 'up'); };
    down.onclick = function () { pick(id, up, down, 'down'); };
    row.appendChild(up);
    row.appendChild(down);
    node.appendChild(row);
    function pick(mid, u, d, val) {
      u.classList.remove('rf-picked');
      d.classList.remove('rf-picked');
      (val === 'up' ? u : d).classList.add('rf-picked');
      sendFeedback(mid, val);
    }
  }
  function showTyping(on) {
    el.typing.classList.toggle('rf-on', !!on);
    if (on) scrollBottom();
  }
  function showError(msg) {
    el.error.textContent = msg;
    el.error.classList.add('rf-on');
    setTimeout(function () { el.error.classList.remove('rf-on'); }, 4000);
  }
  function showEmailCapture() {
    var row = document.createElement('div');
    row.className = 'rf-email-row rf-on';
    row.innerHTML =
      '<input type="email" id="rfEmailInput" placeholder="you@example.com" />' +
      '<button type="button" id="rfEmailBtn">Send my email</button>';
    el.messages.appendChild(row);
    var input = row.querySelector('#rfEmailInput');
    var btn = row.querySelector('#rfEmailBtn');
    function submit() {
      var val = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
        input.style.borderColor = '#e23d3d';
        return;
      }
      row.remove();
      sendMessage(val, true);
    }
    btn.onclick = submit;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    input.focus();
    scrollBottom();
  }

  // ── Idle follow-up ───────────────────────────────────────────────────────
  function resetIdle() {
    clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(function () {
      if (state.open && !state.sending) {
        addMessage('bot', 'Is there anything else I can help with?');
      }
    }, IDLE_DELAY);
  }

  // ── Networking ───────────────────────────────────────────────────────────
  function api(path, opts) {
    opts = opts || {};
    return fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, status: r.status, data: j || {} };
      });
    });
  }
  function sendFeedback(messageId, satisfaction) {
    // Best-effort: report satisfaction via chat endpoint as a typed signal.
    api('/api/chat', {
      method: 'POST',
      body: {
        businessKey: BUSINESS_KEY,
        sessionId: state.session.sessionId,
        message: '__satisfaction__:' + satisfaction,
        feedbackFor: messageId,
      },
    }).catch(function () {});
  }

  function sendMessage(text, isEmail) {
    if (state.sending) return;
    text = (text || '').trim();
    if (!text) return;
    addMessage('visitor', text);
    el.text.value = '';
    autoGrow();
    state.sending = true;
    el.send.disabled = true;
    showTyping(true);

    var payload = {
      businessKey: BUSINESS_KEY,
      sessionId: state.session.sessionId,
      message: text,
    };
    if (isEmail) payload.emailCapture = true;

    api('/api/chat', { method: 'POST', body: payload })
      .then(function (res) {
        showTyping(false);
        state.sending = false;
        el.send.disabled = false;
        if (!res.ok) {
          showError('Connection issue — please try again.');
          return;
        }
        var reply = res.data.reply || "I'm not sure right now — please try again.";
        addMessage('bot', reply, { showSatisfaction: true });
        if (res.data.emailRequest) showEmailCapture();
        resetIdle();
      })
      .catch(function () {
        showTyping(false);
        state.sending = false;
        el.send.disabled = false;
        showError('Network error — retrying…');
        setTimeout(function () { sendMessage(text, isEmail); }, 5000);
      });
  }

  // ── UI behaviour ─────────────────────────────────────────────────────────
  function toggle(force) {
    var willOpen = typeof force === 'boolean' ? force : !state.open;
    state.open = willOpen;
    el.window.classList.toggle('rf-open', willOpen);
    if (willOpen) {
      el.bubble.classList.remove('rf-pulse');
      el.hint.classList.remove('rf-show');
      setTimeout(function () { el.text.focus(); }, 200);
      maybeGreet();
      resetIdle();
    }
  }
  function maybeGreet() {
    if (state.greeted) return;
    state.greeted = true;
    var greeting = (state.config && state.config.greeting) || 'Hi! How can I help you today?';
    if (!state.session.messages.length) addMessage('bot', greeting, { showSatisfaction: false });
    resetIdle();
  }
  function autoGrow() {
    el.text.style.height = 'auto';
    el.text.style.height = Math.min(el.text.scrollHeight, 90) + 'px';
  }

  el.bubble.addEventListener('click', function () { toggle(); });
  el.close.addEventListener('click', function () { toggle(false); });
  el.send.addEventListener('click', function () { sendMessage(el.text.value); });
  el.text.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(el.text.value);
    }
  });
  el.text.addEventListener('input', autoGrow);

  // ── Replay persisted history ─────────────────────────────────────────────
  function replay() {
    if (!state.session.messages.length) return;
    state.session.messages.forEach(function (m) {
      addMessage(m.role, m.content, { time: m.time });
    });
    state.greeted = true;
  }

  // ── Boot: fetch config ───────────────────────────────────────────────────
  function applyConfig(cfg) {
    state.config = cfg;
    if (cfg.color) setColor(cfg.color);
    if (cfg.position) setSide(cfg.position);
    if (cfg.avatar) el.avatar.textContent = cfg.avatar;
    if (cfg.businessName) el.title.textContent = cfg.businessName;
  }
  function boot() {
    replay();
    api('/api/widget-config?key=' + encodeURIComponent(BUSINESS_KEY))
      .then(function (res) {
        if (res.ok && res.data && !res.data.error) applyConfig(res.data);
        else applyConfig({ businessName: 'ReplyFox' });
      })
      .catch(function () { applyConfig({ businessName: 'ReplyFox' }); });

    // Auto-open hint after greet delay.
    setTimeout(function () {
      if (!state.open) {
        var hintMsg = (state.config && state.config.greeting) || 'Hi! 👋 How can I help you today?';
        el.hint.textContent = hintMsg;
        el.hint.classList.add('rf-show');
        setTimeout(function () { el.hint.classList.remove('rf-show'); }, 6000);
      }
    }, GREET_DELAY);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
