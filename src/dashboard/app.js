/* ============================================================
   ReplyFox — Business Dashboard App (vanilla JS, no framework)
   - Onboarding flow (signup → train → customize → embed → live)
   - SPA routing across Home, Knowledge, Customize, Analytics, Billing, Settings
   - Live widget preview, SVG message chart with hover tooltip
   - State persisted to localStorage (demo data only; no backend yet)
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- Mock data ---------------- */
  var COLORS = ['#1763e6', '#0d9488', '#7c3aed', '#db2777', '#ea580c', '#0ea5e9'];
  var AVATARS = ['🤖', '🦊', '💬', '👋', '✨', '🎓', '🐾', '🌟'];

  var SAMPLE_KB = [
    'Bloom & Co. Florist — About Us',
    'Hours: Monday–Friday 9am–6pm, Saturday 10am–4pm, Sunday closed.',
    'We deliver across the city same-day for orders placed before 1pm. Standard delivery is next day.',
    'We ship nationally via courier. Delivery takes 2–5 business days depending on location.',
    'International shipping is available to select countries. Delivery takes 5–8 days. Contact us for a quote.',
    'Returns: cut flowers are non-returnable. Gifts and vases can be returned within 14 days in original condition.',
    'Pricing: bouquets start at $35. Seasonal arrangements from $60. Wedding consultations are free.',
    'You can order online, by phone (555-0142), or in store. We accept Visa, Mastercard, Amex, and Apple Pay.',
    'Subscriptions: weekly fresh-flower delivery from $28/week. Pause or cancel anytime in your account.',
    'Weddings & events: book a consultation at least 6 weeks ahead. A 25% deposit secures your date.'
  ].join('\n\n');

  var SAMPLE_CONVERSATIONS = [
    { q: 'Do you ship internationally?', a: 'Yes! We ship to select countries. Delivery takes 5–8 days — want me to check your location?', time: '2m ago', lead: false, who: 'JM' },
    { q: 'What are your hours?', a: 'We\'re open Mon–Fri 9am–6pm and Saturday 10am–4pm. We\'re closed Sundays.', time: '14m ago', lead: false, who: 'SK' },
    { q: 'How much are your wedding flowers?', a: 'Wedding consultations are free! Bouquets start at $35 and seasonal arrangements from $60. Shall I book you a consult?', time: '38m ago', lead: true, who: 'AR' },
    { q: 'Can I get same-day delivery?', a: 'Yes, for orders placed before 1pm within the city. What would you like to send?', time: '1h ago', lead: false, who: 'TP' },
    { q: 'Do you offer subscriptions?', a: 'We do — weekly fresh-flower delivery from $28/week. You can pause or cancel anytime.', time: '2h ago', lead: false, who: 'LD' },
    { q: 'What\'s your return policy?', a: 'Cut flowers are non-returnable, but gifts and vases can be returned within 14 days in original condition.', time: '3h ago', lead: false, who: 'MV' },
    { q: 'Do you take Amex?', a: 'We do! We accept Visa, Mastercard, Amex, and Apple Pay.', time: '5h ago', lead: false, who: 'RC' },
    { q: 'Can you do my wedding in 3 weeks?', a: 'I\'m not sure about that one — could you leave your email so our team can follow up?', time: '6h ago', lead: true, who: 'EB' },
    { q: 'Where are you located?', a: 'We\'re at 42 Garden Lane, right by the park. Free parking out back!', time: '8h ago', lead: false, who: 'NG' },
    { q: 'Do you deliver on Sundays?', a: 'We\'re closed Sundays, but Saturday delivery is available for orders placed by Friday 1pm.', time: '11h ago', lead: false, who: 'HF' }
  ];

  var SAMPLE_TOP_Q = [
    { q: 'Do you ship internationally?', count: 47 },
    { q: 'What are your hours?', count: 39 },
    { q: 'How much does it cost?', count: 31 },
    { q: 'Do you offer same-day delivery?', count: 24 },
    { q: 'What is your return policy?', count: 18 },
    { q: 'Can I cancel my subscription?', count: 12 }
  ];

  /* ---------------- State ---------------- */
  var DEFAULT_STATE = {
    onboarded: false,
    businessName: '',
    email: '',
    businessKey: '',
    apiKey: '',
    plan: 'free',
    widget: { color: '#1763e6', greeting: 'Hi! 👋 How can I help you today?', avatar: '🤖', position: 'bottom-right', hours: 'off' },
    knowledge: { content: '', source: '', sourceUrl: '' },
    usage: { messagesThisMonth: 0, quota: 50 }
  };

  var state = loadState();

  function loadState() {
    try {
      var raw = localStorage.getItem('replyfox_state');
      if (raw) {
        var parsed = JSON.parse(raw);
        return Object.assign({}, DEFAULT_STATE, parsed, { widget: Object.assign({}, DEFAULT_STATE.widget, parsed.widget || {}) });
      }
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  function saveState() {
    try { localStorage.setItem('replyfox_state', JSON.stringify(state)); } catch (e) {}
  }
  function genKey(len) {
    var s = ''; var chars = 'abcdef0123456789';
    for (var i = 0; i < (len || 24); i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  /* ---------------- DOM helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    if (kids) kids.forEach(function (k) { n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    return n;
  }

  /* ---------------- Toasts ---------------- */
  function toast(msg, kind) {
    var t = el('div', { class: 'toast ' + (kind || ''), role: 'status' });
    var icon = kind === 'success' ? '✓' : kind === 'error' ? '⚠' : 'ℹ';
    t.innerHTML = '<span>' + icon + '</span><span>' + escapeHtml(msg) + '</span>';
    $('#toastWrap').appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 300); }, 2800);
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ============================================================
     ONBOARDING
     ============================================================ */
  var ob = { step: 1, total: 5 };

  function initOnboarding() {
    renderObSteps();
    // prefill email from landing ?email=
    var params = new URLSearchParams(window.location.search);
    var emailParam = params.get('email');
    if (emailParam) { $('#bizEmail').value = emailParam; }

    // color presets + avatars
    buildColorPresets('#colorPresets', '#widgetColor');
    buildAvatarOpts('#avatarOpts');

    // source tabs
    $$('#onboarding .src-tabs').forEach(function () {}); // onboard has its own
    $$('#onboarding .src-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { switchSrcTab(tab, $('#onboarding')); });
    });

    // position seg
    segBind('#positionSeg', 'position', function (v) { state.widget.position = v; saveState(); });

    // color + greeting live to state
    $('#widgetColor').addEventListener('input', function (e) {
      state.widget.color = e.target.value;
      $$('#colorPresets .color-swatch').forEach(function (s) { s.classList.toggle('active', s.dataset.c.toLowerCase() === e.target.value.toLowerCase()); });
      saveState();
    });
    $('#widgetGreeting').addEventListener('input', function (e) { state.widget.greeting = e.target.value; saveState(); });

    $('#obNext').addEventListener('click', obNext);
    $('#obBack').addEventListener('click', obBack);
    $('#copyEmbed').addEventListener('click', function () { copyText(getEmbedCode(), $('#copyEmbed')); });
    $('#goToDashboard').addEventListener('click', finishOnboarding);

    showObStep(1);
  }

  function renderObSteps() {
    var host = $('#obSteps'); host.innerHTML = '';
    for (var i = 1; i <= ob.total; i++) {
      var dot = el('div', { class: 'ob-dot' }, [el('span', { class: 'dot', text: String(i) })]);
      host.appendChild(dot);
      if (i < ob.total) host.appendChild(el('span', { class: 'ob-bar' }));
    }
    updateObDots();
  }
  function updateObDots() {
    var dots = $$('#obSteps .ob-dot');
    var bars = $$('#obSteps .ob-bar');
    dots.forEach(function (d, i) {
      var n = i + 1;
      d.classList.toggle('active', n === ob.step);
      d.classList.toggle('done', n < ob.step);
      d.querySelector('.dot').textContent = n < ob.step ? '✓' : String(n);
    });
    bars.forEach(function (b, i) { b.classList.toggle('done', i + 1 < ob.step); });
  }

  function showObStep(n) {
    ob.step = n;
    $$('#onboarding .ob-step').forEach(function (s) { s.classList.toggle('active', Number(s.dataset.step) === n); });
    updateObDots();
    $('#obBack').disabled = (n === 1);
    $('#obNext').textContent = (n === ob.total - 1) ? 'I\'ve added it →' : (n === ob.total ? '' : 'Continue →');
    $('#obNext').style.display = (n === ob.total) ? 'none' : '';
    // scroll into view
    var card = $('.onboard-card');
    if (card) card.scrollTop = 0;
  }

  function obNext() {
    if (ob.step === 1) {
      var name = $('#bizName').value.trim();
      var email = $('#bizEmail').value.trim();
      if (!name) { toast('Please enter your business name', 'error'); $('#bizName').focus(); return; }
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Please enter a valid email', 'error'); $('#bizEmail').focus(); return; }
      state.businessName = name; state.email = email;
      if (!state.businessKey) state.businessKey = genKey(20);
      saveState();
      showObStep(2);
    } else if (ob.step === 2) {
      // train (simulated)
      var active = $('#onboarding .src-tab.active');
      var src = active ? active.dataset.src : 'url';
      var content = readSource(src, { url: '#srcUrl', text: '#srcText', file: '#srcFile' });
      if (!content) { toast('Add some content to train your bot', 'error'); return; }
      simulateTrain(content, src, '#trainStatus', function (trained) {
        state.knowledge.content = trained; state.knowledge.source = src;
        if (src === 'url') state.knowledge.sourceUrl = $('#srcUrl').value.trim();
        saveState();
        // prefill customize page
        $('#widgetGreeting').value = state.widget.greeting;
        $('#widgetColor').value = state.widget.color;
        syncColorSwatches();
        showObStep(3);
      });
    } else if (ob.step === 3) {
      showObStep(4);
      // render embed code
      $('#embedCode').innerHTML = formatEmbed();
    } else if (ob.step === 4) {
      showObStep(5);
    }
  }
  function obBack() { if (ob.step > 1) showObStep(ob.step - 1); }

  function readSource(src, ids) {
    if (src === 'url') return $('#srcUrl').value.trim() ? 'Content scraped from ' + $('#srcUrl').value.trim() + '\n\n' + SAMPLE_KB : '';
    if (src === 'text') return $('#srcText').value.trim() || '';
    if (src === 'file') {
      var f = $('#srcFile').files[0];
      return f ? 'Content imported from ' + f.name + '\n\n' + SAMPLE_KB : '';
    }
    return '';
  }

  function simulateTrain(content, src, statusSel, done) {
    var host = $(statusSel); host.textContent = ''; host.style.color = 'var(--rf-blue-600)';
    var steps = ['Reading your content…', 'Cleaning & chunking text…', 'Indexing knowledge base…', 'Training complete ✓'];
    var i = 0;
    host.textContent = steps[0];
    var iv = setInterval(function () {
      i++; host.textContent = steps[i];
      if (i === steps.length - 1) {
        clearInterval(iv);
        host.style.color = 'var(--rf-green)';
        setTimeout(function () { done(content); }, 350);
      }
    }, 600);
  }

  function formatEmbed() {
    var k = state.businessKey || 'YOUR_BUSINESS_KEY';
    return '<span class="ck-com">&lt;!-- ReplyFox chatbot --&gt;</span>\n<span class="ck-key">&lt;script</span>\n  <span class="ck-key">src</span>=<span class="ck-str">"https://cdn.replyfox.io/widget.js"</span>\n  <span class="ck-key">data-key</span>=<span class="ck-str">"' + k + '"</span>\n  <span class="ck-key">async</span>\n<span class="ck-key">&gt;&lt;/script&gt;</span>';
  }
  function getEmbedCode() {
    var k = state.businessKey || 'YOUR_BUSINESS_KEY';
    return '<!-- ReplyFox chatbot -->\n<script src="https://cdn.replyfox.io/widget.js" data-key="' + k + '" async><\/script>';
  }

  function finishOnboarding() {
    state.onboarded = true;
    if (!state.usage.messagesThisMonth) state.usage.messagesThisMonth = 38; // seed demo
    if (!state.apiKey) state.apiKey = 'rf_live_' + genKey(28);
    saveState();
    enterApp();
  }

  /* ---------------- shared UI builders ---------------- */
  function buildColorPresets(presetsSel, inputSel) {
    var host = $(presetsSel); host.innerHTML = '';
    COLORS.forEach(function (c) {
      var s = el('button', { type: 'button', class: 'color-swatch' + (c.toLowerCase() === state.widget.color.toLowerCase() ? ' active' : ''), 'aria-label': 'Color ' + c, style: 'background:' + c, 'data-c': c });
      s.addEventListener('click', function () {
        state.widget.color = c; saveState();
        $(inputSel).value = c; syncColorSwatches();
      });
      host.appendChild(s);
    });
  }
  function syncColorSwatches() {
    $$('.color-swatch').forEach(function (s) { s.classList.toggle('active', s.dataset.c.toLowerCase() === state.widget.color.toLowerCase()); });
  }
  function buildAvatarOpts(sel) {
    var host = $(sel); host.innerHTML = '';
    AVATARS.forEach(function (a) {
      var b = el('button', { type: 'button', class: 'avatar-opt' + (a === state.widget.avatar ? ' active' : ''), 'aria-label': 'Avatar ' + a, 'data-a': a, text: a });
      b.addEventListener('click', function () {
        state.widget.avatar = a; saveState();
        $$(sel + ' .avatar-opt').forEach(function (x) { x.classList.toggle('active', x.dataset.a === a); });
        var pv = $('#pvAvatar'); if (pv) pv.textContent = a;
      });
      host.appendChild(b);
    });
  }
  function segBind(sel, key, cb) {
    $$(sel + ' button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$(sel + ' button').forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        b.classList.add('active'); b.setAttribute('aria-selected', 'true');
        var v = b.dataset[key] || b.dataset.pos || b.dataset.hours;
        if (cb) cb(v);
      });
    });
  }
  function switchSrcTab(tab, root) {
    $$(root + ' .src-tab').forEach(function (t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
    var src = tab.dataset.src;
    $$('[data-srcfield]', root).forEach(function (f) { f.hidden = (f.dataset.srcfield !== src); });
  }

  function copyText(text, btn) {
    function flash() { if (btn) { btn.textContent = 'Copied!'; btn.classList.add('copied'); setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500); } }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(flash).catch(function () { fallbackCopy(text); flash(); });
    } else { fallbackCopy(text); flash(); }
    toast('Copied to clipboard', 'success');
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove();
  }

  /* ============================================================
     ENTER APP
     ============================================================ */
  function enterApp() {
    $('#onboarding').hidden = true;
    $('#appShell').hidden = false;
    document.body.style.background = '';
    hydrateShell();
    renderHome();
    renderKnowledge();
    initCustomize();
    initAnalytics();
    initBilling();
    initSettings();
    bindNav();
  }

  function hydrateShell() {
    var name = state.businessName || 'Your Business';
    $('#sideName').textContent = name;
    $('#sideEmail').textContent = state.email || 'you@email.com';
    $('#sideAvatar').textContent = (name[0] || 'R').toUpperCase();
    $('#homeName').textContent = name.split(' ')[0];
    $('#setEmail').textContent = state.email || 'you@email.com';
    var planName = state.plan === 'free' ? 'Free' : state.plan === 'pro' ? 'Pro' : 'Business';
    $('#sidePlan').textContent = planName;
  }

  /* ---------------- Navigation ---------------- */
  function bindNav() {
    $$('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () { goPage(btn.dataset.page); });
    });
    $('#menuBtn').addEventListener('click', toggleSidebar);
    $('#navBackdrop').addEventListener('click', closeSidebar);
    $('#topEmbed').addEventListener('click', function () { showEmbedModal(); });
    window.addEventListener('hashchange', function () { var p = (location.hash || '').replace('#', ''); if (p) goPage(p, true); });
  }
  function goPage(page, fromHash) {
    $$('.page').forEach(function (p) { p.classList.remove('active'); });
    var target = $('#page-' + page); if (!target) return;
    target.classList.add('active');
    $$('.nav-item').forEach(function (n) { n.classList.toggle('active', n.dataset.page === page); });
    var label = { home: 'Dashboard', knowledge: 'Knowledge Base', customize: 'Customize', analytics: 'Analytics', billing: 'Billing', settings: 'Settings' }[page] || 'Dashboard';
    $('#crumbPage').textContent = label;
    if (!fromHash) history.replaceState(null, '', '#' + page);
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'analytics') drawChart();
  }
  function toggleSidebar() { $('#sidebar').classList.add('open'); $('#navBackdrop').classList.add('show'); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#navBackdrop').classList.remove('show'); }

  function showEmbedModal() {
    // simple: switch to customize-less toast w/ copy. Reuse a prompt-style via toast + copy
    copyText(getEmbedCode());
  }

  /* ---------------- Home ---------------- */
  function renderHome() {
    var used = state.usage.messagesThisMonth;
    var quota = state.plan === 'free' ? 50 : Infinity;
    $('#ubUsed').textContent = used;
    $('#ubQuota').textContent = quota === Infinity ? '∞' : quota;
    var pct = quota === Infinity ? 30 : Math.min(100, Math.round((used / quota) * 100));
    $('#ubFill').style.width = pct + '%';
    $('#usageBar').classList.toggle('warn', pct >= 80);

    $('#stMessages').textContent = used;
    $('#stConvos').textContent = Math.max(1, Math.round(used / 3.2));
    var leads = Math.round(used * 0.14);
    $('#stLeads').textContent = leads;
    var sat = 92 + (used % 5);
    $('#stSat').textContent = sat + '%';

    // conversations
    var list = $('#convList'); list.innerHTML = '';
    var convos = SAMPLE_CONVERSATIONS.slice(0, Math.min(10, Math.max(4, Math.ceil(used / 4))));
    convos.forEach(function (c) {
      list.appendChild(el('div', { class: 'conv' }, [
        el('div', { class: 'cav', text: c.who }),
        el('div', { class: 'cbody' }, [el('div', { class: 'cq', text: c.q }), el('div', { class: 'ca', text: c.a })]),
        el('div', { class: 'cmeta' }, [document.createTextNode(c.time),
          el('span', { class: 'tag ' + (c.lead ? 'lead' : 'ok'), text: c.lead ? '★ Lead' : '✓ Answered' })])
      ]));
    });
    if (!convos.length) list.appendChild(emptyState('💬', 'No conversations yet.'));
  }

  function emptyState(icon, msg) {
    return el('div', { class: 'empty' }, [el('div', { class: 'ei', text: icon }), el('p', { text: msg })]);
  }

  /* ---------------- Knowledge Base ---------------- */
  function renderKnowledge() {
    var content = state.knowledge.content || SAMPLE_KB;
    $('#kbContent').textContent = content;
    var chars = content.length;
    $('#kbChars').textContent = chars.toLocaleString();
    $('#kbChunks').textContent = Math.max(1, Math.ceil(chars / 500));
    $('#kbSources').textContent = state.knowledge.source ? '1' : '1';

    // quality score
    var score = computeQuality(content);
    var ring = $('#qrCircle');
    ring.style.setProperty('--p', score);
    $('#qrPct').textContent = score + '%';
    var q = qualityMsg(score);
    $('#qrTitle').textContent = q.title;
    $('#qrMsg').textContent = q.msg;

    // add-more tabs
    $$('#page-knowledge .src-tab').forEach(function (tab) {
      if (tab.__bound) return; tab.__bound = true;
      tab.addEventListener('click', function () { switchSrcTab(tab, '#page-knowledge'); });
    });
    $('#kbTrainBtn').onclick = function () {
      var active = $('#page-knowledge .src-tab.active');
      var src = active ? active.dataset.src : 'url';
      var content2 = readSource(src, { url: '#kbSrcUrl', text: '#kbSrcText', file: '#kbSrcFile' });
      if (!content2) { toast('Add some content first', 'error'); return; }
      var btn = this; btn.disabled = true; btn.textContent = 'Training…';
      simulateTrain(content2, src, '#kbTrainStatus', function (trained) {
        state.knowledge.content = (state.knowledge.content ? state.knowledge.content + '\n\n' : '') + trained;
        if (src === 'url') state.knowledge.sourceUrl = $('#kbSrcUrl').value.trim();
        state.knowledge.source = src;
        saveState();
        renderKnowledge();
        btn.disabled = false; btn.textContent = 'Train chatbot';
        toast('Knowledge base updated', 'success');
        // clear inputs
        $('#kbSrcUrl').value = ''; $('#kbSrcText').value = ''; if ($('#kbSrcFile').files[0]) $('#kbSrcFile').value = '';
      });
    };
  }
  function computeQuality(content) {
    if (!content) return 0;
    var words = content.trim().split(/\s+/).length;
    var hasStructure = /\n/.test(content) ? 10 : 0;
    var hasNumbers = /\d/.test(content) ? 8 : 0;
    var base = Math.min(70, Math.round(words / 12));
    return Math.min(100, base + hasStructure + hasNumbers + 10);
  }
  function qualityMsg(s) {
    if (s >= 85) return { title: 'Excellent coverage', msg: 'Your bot can confidently answer almost any question about your business.' };
    if (s >= 65) return { title: 'Good foundation', msg: 'Your bot can answer most common questions. Add pricing, policies, and shipping details to cover more.' };
    if (s >= 40) return { title: 'Getting there', msg: 'Add more detail — hours, pricing, policies, and FAQs — so the bot can answer confidently.' };
    return { title: 'Needs more content', msg: 'Your bot has very little to work with. Paste your website URL or FAQ to get started.' };
  }

  /* ---------------- Customize ---------------- */
  function initCustomize() {
    $('#cName').value = state.businessName || '';
    $('#cGreeting').value = state.widget.greeting;
    $('#cColor').value = state.widget.color;
    buildColorPresets('#cColorPresets', '#cColor');
    buildAvatarOpts('#cAvatarOpts');

    $('#cColor').addEventListener('input', function (e) { state.widget.color = e.target.value; saveState(); syncColorSwatches(); updatePreview(); });
    $('#cGreeting').addEventListener('input', function (e) { state.widget.greeting = e.target.value; saveState(); updatePreview(); });
    $('#cName').addEventListener('input', function (e) { state.businessName = e.target.value; saveState(); updatePreview(); });

    segBind('#cPositionSeg', 'pos', function (v) { state.widget.position = v; saveState(); updatePreview(); });
    segBind('#cHoursSeg', 'hours', function (v) { state.widget.hours = v; saveState(); });

    $('#cSave').addEventListener('click', function () {
      hydrateShell();
      toast('Widget saved — changes are live on your site', 'success');
    });

    // bubble toggles window
    $('#pvBubble').addEventListener('click', function () {
      var w = $('#pvWindow'); w.hidden = !w.hidden;
      if (!w.hidden) w.style.display = '';
    });

    updatePreview();
  }
  function updatePreview() {
    var c = state.widget.color, pos = state.widget.position, name = state.businessName || 'Your Business';
    var bubble = $('#pvBubble'), win = $('#pvWindow');
    // bubble content (chat icon)
    bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" fill="#fff"/></svg>';
    bubble.style.background = c;
    // position
    var right = (pos === 'bottom-right');
    bubble.style.right = right ? '18px' : 'auto';
    bubble.style.left = right ? 'auto' : '18px';
    bubble.style.bottom = '18px';
    win.style.right = right ? '18px' : 'auto';
    win.style.left = right ? 'auto' : '18px';
    win.style.bottom = '86px';
    // header
    $('.pv-head', win).style.background = c;
    $('#pvSend').style.background = c;
    $('#pvTitle').textContent = name;
    $('#pvAvatar').textContent = state.widget.avatar;
    $('#pvGreeting').textContent = state.widget.greeting;
    // reflect active avatar + color swatches
    syncColorSwatches();
    $$('#cAvatarOpts .avatar-opt').forEach(function (x) { x.classList.toggle('active', x.dataset.a === state.widget.avatar); });
  }

  /* ---------------- Analytics ---------------- */
  var analyticsReady = false;
  function initAnalytics() {
    if (analyticsReady) return; analyticsReady = true;
    $$('[data-range]').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-range]').forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        b.classList.add('active'); b.setAttribute('aria-selected', 'true');
        drawChart(Number(b.dataset.range));
      });
    });

    // top questions
    var max = SAMPLE_TOP_Q[0].count;
    var host = $('#topQuestions'); host.innerHTML = '';
    SAMPLE_TOP_Q.forEach(function (item, i) {
      host.appendChild(el('div', { class: 'top-q' }, [
        el('div', { class: 'rank', text: String(i + 1) }),
        el('div', { class: 'q' }, [document.createTextNode(item.q), el('div', { class: 'bar-bg' }, [el('div', { class: 'bar-fl', style: 'width:' + Math.round(item.count / max * 100) + '%' })])]),
        el('div', { class: 'cnt', text: String(item.count) })
      ]));
    });

    // stat tiles
    var total = SAMPLE_TOP_Q.reduce(function (s, q) { return s + q.count; }, 0);
    $('#anTotal').textContent = (total + 142).toLocaleString();
    $('#anEsc').textContent = '11%';
    $('#anSat').textContent = '94%';
    $('#anConv').textContent = '14%';

    window.addEventListener('resize', function () { if ($('#page-analytics').classList.contains('active')) drawChart(); });
  }

  function buildSeries(days) {
    // deterministic pseudo-random so it's stable across redraws
    var seed = days === 7 ? 7 : 30;
    var n = days, arr = [], s = seed;
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = 0; i < n; i++) {
      var base = days === 7 ? 18 : 10;
      var weekend = (i % 7 === 5 || i % 7 === 6) ? -0.35 : 0;
      var v = Math.max(2, Math.round(base + Math.sin(i / 2) * 6 + rnd() * 12 + weekend * base));
      arr.push(v);
    }
    return arr;
  }

  function drawChart(daysOverride) {
    var svg = $('#msgChart'); if (!svg) return;
    var rangeBtn = $('[data-range].active');
    var days = daysOverride || (rangeBtn ? Number(rangeBtn.dataset.range) : 7);
    var data = buildSeries(days);
    var rect = svg.getBoundingClientRect();
    var W = Math.max(280, rect.width), H = 260;
    var m = { t: 16, r: 16, b: 30, l: 38 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = Math.max.apply(null, data) * 1.15;
    var stepX = iw / (data.length - 1);
    var pts = data.map(function (v, i) { return { x: m.l + i * stepX, y: m.t + ih - (v / max) * ih, v: v, i: i }; });

    // axis labels (dates)
    var today = new Date();
    var labels = data.map(function (_, i) {
      var d = new Date(today); d.setDate(today.getDate() - (data.length - 1 - i));
      return (d.getMonth() + 1) + '/' + d.getDate();
    });

    // build path
    var linePath = pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    var areaPath = linePath + ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + (m.t + ih) + ' L' + pts[0].x.toFixed(1) + ' ' + (m.t + ih) + ' Z';

    // y ticks (4)
    var yTicks = ''; var yCount = 4;
    for (var t = 0; t <= yCount; t++) {
      var val = Math.round(max * (1 - t / yCount));
      var y = m.t + (ih * t / yCount);
      yTicks += '<line x1="' + m.l + '" y1="' + y + '" x2="' + (m.l + iw) + '" y2="' + y + '"></line>';
      yTicks += '<text x="' + (m.l - 8) + '" y="' + (y + 3) + '" text-anchor="end">' + val + '</text>';
    }
    // x labels (thin out for 30d)
    var xTicks = '';
    var every = days > 15 ? 5 : 1;
    pts.forEach(function (p, i) {
      if (i % every === 0 || i === pts.length - 1) {
        xTicks += '<text x="' + p.x + '" y="' + (m.t + ih + 18) + '" text-anchor="middle">' + labels[i] + '</text>';
      }
    });

    var gid = 'rf-grad';
    svg.innerHTML =
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#1763e6" stop-opacity="0.28"></stop>' +
        '<stop offset="100%" stop-color="#1763e6" stop-opacity="0"></stop>' +
      '</linearGradient></defs>' +
      '<g class="grid">' + yTicks + '</g>' +
      '<path class="area" d="' + areaPath + '" fill="url(#' + gid + ')"></path>' +
      '<path class="series" d="' + linePath + '" stroke="#1763e6"></path>' +
      pts.map(function (p) { return '<circle class="dot" cx="' + p.x + '" cy="' + p.y + '" r="3.5" fill="#1763e6" data-i="' + p.i + '"></circle>'; }).join('') +
      '<g class="axis">' + xTicks + '</g>' +
      '<line class="crosshair" x1="0" y1="' + m.t + '" x2="0" y2="' + (m.t + ih) + '" style="opacity:0"></line>';

    // hover
    var tip = $('#chartTooltip');
    var cross = svg.querySelector('.crosshair');
    var dots = svg.querySelectorAll('.dot');
    function showTip(p) {
      tip.innerHTML = '<strong>' + p.v + ' messages</strong>' + labels[p.i];
      tip.style.opacity = '1';
      tip.style.left = (p.x + 14) + 'px';
      tip.style.top = (p.y - 12) + 'px';
      cross.setAttribute('x1', p.x); cross.setAttribute('x2', p.x); cross.style.opacity = '1';
    }
    function hideTip() { tip.style.opacity = '0'; cross.style.opacity = '0'; }
    dots.forEach(function (d) {
      var i = Number(d.getAttribute('data-i'));
      d.addEventListener('mouseenter', function () { showTip(pts[i]); });
      d.addEventListener('focus', function () { showTip(pts[i]); });
      d.setAttribute('tabindex', '0');
      d.setAttribute('role', 'img');
      d.setAttribute('aria-label', labels[i] + ': ' + pts[i].v + ' messages');
    });
    svg.addEventListener('mouseleave', hideTip);
  }

  /* ---------------- Billing ---------------- */
  function initBilling() {
    refreshBilling();
    $('#upgradePro').addEventListener('click', function () { simulateCheckout('pro'); });
    $('#upgradeBiz').addEventListener('click', function () { simulateCheckout('business'); });
  }
  function refreshBilling() {
    var plan = state.plan;
    var map = {
      free: { name: 'Free plan', detail: '$0/month · 50 messages', badge: 'FREE', cls: 'free' },
      pro: { name: 'Pro plan', detail: '$29/month · Unlimited messages', badge: 'PRO', cls: 'pro' },
      business: { name: 'Business plan', detail: '$99/month · Everything + white-label', badge: 'BUSINESS', cls: 'biz' }
    };
    var p = map[plan];
    $('#billPlan').textContent = p.name;
    $('#billPlanDetail').textContent = p.detail;
    var b = $('#billBadge'); b.textContent = p.badge; b.className = 'badge ' + p.cls;
    $('#sidePlan').textContent = plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : 'Business';

    // invoices
    var inv = $('#invoiceList');
    if (plan === 'free') {
      inv.innerHTML = '<div class="empty"><div class="ei">🧾</div>No invoices yet — you\'re on the free plan.</div>';
    } else {
      var amount = plan === 'pro' ? '$29.00' : '$99.00';
      var rows = '';
      for (var i = 0; i < 3; i++) {
        var d = new Date(); d.setMonth(d.getMonth() - i);
        var label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        rows += '<div class="invoice"><span>' + label + ' ' + (plan === 'pro' ? 'Pro' : 'Business') + '</span><span class="badge paid">PAID</span><span class="amt">' + amount + '</span></div>';
      }
      inv.innerHTML = rows;
    }
    // update usage bar quota
    $('#ubQuota').textContent = plan === 'free' ? '50' : '∞';
  }
  function simulateCheckout(plan) {
    var btn = plan === 'pro' ? $('#upgradePro') : $('#upgradeBiz');
    btn.disabled = true; btn.textContent = 'Redirecting to checkout…';
    setTimeout(function () {
      state.plan = plan;
      state.usage.quota = Infinity;
      saveState();
      refreshBilling();
      renderHome();
      hydrateShell();
      btn.disabled = false; btn.textContent = plan === 'pro' ? 'Upgrade to Pro' : 'Go Business';
      toast('Welcome to ' + (plan === 'pro' ? 'Pro' : 'Business') + '! 🎉', 'success');
    }, 1200);
  }

  /* ---------------- Settings ---------------- */
  function initSettings() {
    $('#setBizKey').textContent = state.businessKey || '—';
    $('#setApiKey').textContent = '•'.repeat(24);
    $('#setEmail').textContent = state.email || 'you@email.com';
    $('#copyKey').addEventListener('click', function () { copyText(state.businessKey || ''); });
    $('#revealKey').addEventListener('click', function () {
      var code = $('#setApiKey');
      if (code.textContent.indexOf('•') === 0) { code.textContent = state.apiKey || '—'; this.textContent = 'Hide'; }
      else { code.textContent = '•'.repeat(24); this.textContent = 'Reveal'; }
    });
    $('#deleteAccount').addEventListener('click', function () {
      if (confirm('Delete your account and all data? This cannot be undone.')) {
        try { localStorage.removeItem('replyfox_state'); } catch (e) {}
        toast('Account deleted. Redirecting…', 'error');
        setTimeout(function () { window.location.href = '../landing/index.html'; }, 1200);
      }
    });
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    // Pre-populate onboarding fields if returning mid-flow
    if (state.businessName) $('#bizName').value = state.businessName;
    if (state.email) $('#bizEmail').value = state.email;
    initOnboarding();

    if (state.onboarded) {
      enterApp();
      var page = (location.hash || '').replace('#', '');
      if (page) goPage(page, true);
    } else {
      // show onboarding
      $('#onboarding').hidden = false;
      $('#appShell').hidden = true;
    }

    // expose a tiny debug handle
    window.ReplyFox = { reset: function () { try { localStorage.removeItem('replyfox_state'); } catch (e) {} window.location.reload(); }, state: state };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
