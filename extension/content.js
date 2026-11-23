/* Lampyris: Arc-style Peek for any browser.
 * Top frame: intercepts link clicks and draws the Peek.
 * Sub-frames: only forward Esc to the top frame, so Esc works while focus is inside a Peek. */
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const MSG = '__lampyris';

  if (window !== window.top) {
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        try { window.top.postMessage({ [MSG]: 'esc' }, '*'); } catch { /* detached */ }
      }
    }, true);
    return;
  }
  if (window.__lampyrisLoaded) return;
  window.__lampyrisLoaded = true;

  const DEFAULTS = { enabled: true, pinned: true, modifier: 'alt', mini: 'shift', size: 'medium', outside: true, blocked: [] };
  let cfg = { ...DEFAULTS };
  let pinned = false;
  let peek = null;               // { host, root, card, frame, url, ... } while open
  const t = (k, sub) => api.i18n.getMessage(k, sub) || k;

  api.storage.sync.get(DEFAULTS).then((v) => { cfg = { ...DEFAULTS, ...v }; });
  api.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync') return;
    for (const [k, { newValue }] of Object.entries(ch)) cfg[k] = newValue ?? DEFAULTS[k];
  });
  api.runtime.sendMessage({ type: 'hello' }).then((r) => { pinned = !!r?.pinned; }).catch(() => {});

  api.runtime.onMessage.addListener((m) => {
    if (m.type === 'pinned') pinned = m.pinned;
    else if (m.type === 'open') open(m.url, null);
    else if (m.type === 'url' && peek) setUrl(m.url);
    else if (m.type === 'loaded' && peek) loaded();
    else if (m.type === 'failed' && peek && !peek.closing) fallback();
  });

  /* ---------- deciding which clicks become a Peek ---------- */
  const SLD = new Set(['com', 'net', 'org', 'gov', 'edu', 'co', 'ac', 'or', 'ne', 'go', 'mil', 'nom', 'art', 'blog', 'eco', 'app', 'dev']);
  function site(host) {
    const p = host.replace(/^www\./, '').split('.');
    if (p.length <= 2) return p.join('.');
    const n = p[p.length - 2].length <= 3 && SLD.has(p[p.length - 2]) && p[p.length - 1].length === 2 ? 3 : 2;
    return p.slice(-n).join('.');
  }
  const siteBlocked = () => (cfg.blocked || []).includes(location.hostname.replace(/^www\./, ''));

  function linkFrom(e) {
    for (const el of e.composedPath()) {
      if (el instanceof Element && (el.localName === 'a' || el.localName === 'area') && el.href) return el;
      if (el === document.body) break;
    }
    return null;
  }

  function wants(e, a) {
    if (!cfg.enabled || siteBlocked() || peek) return false;
    if (e.button !== 0 || e.ctrlKey || e.metaKey) return false;
    if (a.hasAttribute('download')) return false;
    let url;
    try { url = new URL(a.href, location.href); } catch { return false; }
    if (!/^https?:$/.test(url.protocol)) return false;
    const auto = cfg.modifier === 'auto';
    const mod = cfg.modifier === 'shift' ? e.shiftKey && !e.altKey
              : cfg.modifier === 'alt' || auto ? e.altKey && !e.shiftKey : false;
    if (mod) return true;
    if (e.shiftKey || e.altKey) return false;
    const cross = site(url.hostname) !== site(location.hostname);
    // Automatic: a plain click on a link to another site opens a Peek, in any tab.
    // Arc: the same, but only in pinned tabs.
    return cross && (auto || (cfg.pinned && pinned));
  }

  addEventListener('click', (e) => {
    const a = linkFrom(e);
    if (a && mini && mini.a === a && e.button === 0) {   // clicking the link while its mini Peek shows
      e.preventDefault(); e.stopImmediatePropagation();
      const url = mini.url; hideMini(true); open(url, { x: e.clientX, y: e.clientY });
      return;
    }
    if (!a || !wants(e, a)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open(a.href, { x: e.clientX, y: e.clientY });
  }, true);
  // Alt+click downloads the link in Chromium; Shift+mousedown starts a text selection.
  addEventListener('mousedown', (e) => {
    if (e.button === 0 && (e.shiftKey || e.altKey)) {
      const a = linkFrom(e);
      if (a && wants(e, a)) e.preventDefault();
    }
  }, true);

  addEventListener('message', (e) => {
    if (peek && e.data && e.data[MSG] === 'esc') close();
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (peek) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    else if (mini) { e.preventDefault(); hideMini(); }
  }, true);

  /* ---------- mini Peek: hold a key and rest the pointer on a link ----------
   * A small, scaled-down live preview next to the link. It loads without your cookies or storage
   * (credentialless frame), so a glance can never act on your account (log out, unsubscribe…).
   * Click it, or click the link, to open the full Peek. */
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const KEY = { shift: 'Shift', alt: 'Alt', ctrl: isMac ? 'Meta' : 'Control' };
  // 'auto': no key, just rest the pointer on a link a little longer
  const held = (e) => cfg.mini === 'auto' ? true : cfg.mini === 'shift' ? e.shiftKey : cfg.mini === 'alt' ? e.altKey
                    : cfg.mini === 'ctrl' ? (isMac ? e.metaKey : e.ctrlKey) : false;
  const MW = 480, MH = 300, SCALE = 0.4;
  const REVEAL_MS = 120;        // a short rest on the link; the page already starts loading meanwhile
  const AUTO_MS = 350;          // automatic mode: wait this long before loading, so passing over links costs nothing
  let hover = null, keyDown = false, mini = null, miniTimer = 0, leaveTimer = 0, pendingFor = null;
  const cache = new Map();      // url -> recently shown previews, kept hidden and loaded for a quick return

  /* The framing rule is armed as soon as the key goes down, so the preview can start loading the
   * moment the pointer reaches a link, and released a moment after the key comes back up. */
  let armed = null, disarmTimer = 0;
  function arm() {
    clearTimeout(disarmTimer);
    if (!armed) armed = api.runtime.sendMessage({ type: 'mini' }).catch(() => {});
    return armed;
  }
  function disarmSoon() {
    clearTimeout(disarmTimer);
    disarmTimer = setTimeout(() => {
      if ((keyDown && cfg.mini !== 'auto') || mini || !armed) return;
      armed = null;
      api.runtime.sendMessage({ type: 'miniClosed' }).catch(() => {});
    }, 1500);
  }

  function miniOk(a) {
    if (!a || !cfg.enabled || cfg.mini === 'off' || siteBlocked() || peek) return false;
    if (a.hasAttribute('download')) return false;
    try { return /^https?:$/.test(new URL(a.href, location.href).protocol); } catch { return false; }
  }
  function schedule() {
    if (cfg.mini === 'auto') {
      if (hover === pendingFor) return;          // still resting on the same link
      clearTimeout(miniTimer);
      pendingFor = null;
      if (!miniOk(hover) || (mini && mini.a === hover)) return;
      pendingFor = hover;
      miniTimer = setTimeout(() => {
        pendingFor = null;
        if (miniOk(hover) && !(mini && mini.a === hover)) showMini(hover);
      }, AUTO_MS);
      return;
    }
    clearTimeout(miniTimer);
    if (!keyDown || !miniOk(hover) || (mini && mini.a === hover)) return;
    showMini(hover);
  }
  addEventListener('mouseover', (e) => {
    const onMini = mini && e.composedPath().includes(mini.host);
    hover = onMini ? hover : linkFrom(e);
    const was = keyDown;
    keyDown = held(e);
    if (keyDown && !was && cfg.mini !== 'auto') arm();
    clearTimeout(leaveTimer);
    if (mini && !onMini && hover !== mini.a) {   // left the link: give the pointer time to reach the preview
      leaveTimer = setTimeout(() => { if (mini && !mini.hovered && hover !== mini.a) hideMini(false, true); }, 200);
    }
    schedule();
  }, true);
  addEventListener('keydown', (e) => {
    if (e.key !== KEY[cfg.mini] || e.repeat || cfg.mini === 'off' || !cfg.enabled) return;
    keyDown = true;
    arm();
    schedule();
  }, true);
  addEventListener('keyup', (e) => {
    if (e.key !== KEY[cfg.mini]) return;
    keyDown = false;
    clearTimeout(miniTimer);
    if (mini && !mini.hovered) hideMini();
    disarmSoon();
  }, true);
  addEventListener('blur', () => { keyDown = false; hideMini(); disarmSoon(); });
  addEventListener('scroll', () => {   // close only if the link actually moved (not for carousels etc.)
    if (!mini?.a || !mini.at) return;
    const r = mini.a.getBoundingClientRect();
    if (Math.abs(r.top - mini.at.top) > 6 || Math.abs(r.left - mini.at.left) > 6) hideMini();
  }, { capture: true, passive: true });

  const MINI_CSS = `
    :host { all: initial; position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; }
    .box { position: absolute; width: ${MW}px; height: ${MH}px; border-radius: 12px; overflow: hidden; background: #fff;
      pointer-events: auto; cursor: pointer;
      box-shadow: 0 0 0 1px rgba(0,0,0,.1), 0 14px 44px rgba(0,0,0,.35), 0 3px 10px rgba(0,0,0,.2);
      opacity: 0; transform: scale(.96); transition: opacity .15s ease, transform .18s cubic-bezier(.2,.9,.25,1.06); }
    @media (prefers-color-scheme: dark) { .box { background: #1f1f1f; } }
    .on .box { opacity: 1; transform: none; }
    iframe { position: absolute; left: 0; top: 0; width: ${Math.round(MW / SCALE)}px; height: ${Math.round(MH / SCALE)}px;
      border: 0; transform: scale(${SCALE}); transform-origin: 0 0; pointer-events: none; background: transparent; }
    .chip { position: absolute; left: 8px; bottom: 8px; max-width: calc(100% - 16px); padding: 6px 11px; border-radius: 28px;
      background: rgba(0,0,0,.6); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); color: #fff;
      font: 500 12px/1 "YouTube Sans", Roboto, system-ui, -apple-system, "Segoe UI", sans-serif;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ring { position: absolute; left: 50%; top: 50%; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%;
      border: 2px solid rgba(128,128,128,.25); border-top-color: rgba(128,128,128,.85); animation: spin .8s linear infinite; }
    .loaded .ring { display: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .box { transition-duration: .01s; } }
  `;

  function buildMini(url) {
    const host = document.createElement('lampyris-mini');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${MINI_CSS}</style><div class="wrap"><div class="box" role="button"
      aria-label="${t('openPeek')}" title="${t('openPeek')}"><div class="ring"></div><span class="chip"></span></div></div>`;
    const box = root.querySelector('.box');
    root.querySelector('.chip').textContent = hostOf(url);
    const m = { host, root, box, wrap: root.querySelector('.wrap'), url, a: null, hovered: false, timer: 0 };
    box.addEventListener('mouseenter', () => { m.hovered = true; clearTimeout(leaveTimer); });
    box.addEventListener('mouseleave', () => { m.hovered = false; if (hover !== m.a || !keyDown) hideMini(false, true); });
    box.addEventListener('click', (e) => {
      e.preventDefault();
      const b = box.getBoundingClientRect();
      hideMini(true);
      open(url, { x: b.left + b.width / 2, y: b.top + b.height / 2 });
    });
    document.documentElement.appendChild(host);
    arm().then(() => {
      const f = document.createElement('iframe');
      f.setAttribute('credentialless', '');
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      f.setAttribute('tabindex', '-1');
      f.setAttribute('aria-hidden', 'true');
      f.addEventListener('load', () => box.classList.add('loaded'));
      f.src = url;
      box.prepend(f);
    });
    return m;
  }

  function showMini(a) {
    const url = new URL(a.href, location.href).href;
    if (mini && mini.url !== url) hideMini(true, true);
    let m = cache.get(url);
    const warm = !!m;
    if (m) { cache.delete(url); clearTimeout(m.timer); } else m = buildMini(url);
    m.a = a;
    mini = m;
    const r = a.getBoundingClientRect();
    m.at = { top: r.top, left: r.left };
    const below = r.bottom + 8 + MH <= innerHeight - 8;
    m.box.style.left = Math.max(8, Math.min(r.left, innerWidth - MW - 8)) + 'px';
    m.box.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - 8 - MH)) + 'px';
    m.box.style.transformOrigin = below ? 'top left' : 'bottom left';
    m.host.style.display = '';
    clearTimeout(miniTimer);
    const reveal = () => requestAnimationFrame(() => { if (mini === m) m.wrap.classList.add('on'); });
    if (warm) reveal(); else miniTimer = setTimeout(reveal, REVEAL_MS);
  }

  function hideMini(instant, keepPending) {   // keepPending: another link's preview is on its way
    if (!keepPending) { clearTimeout(miniTimer); pendingFor = null; }
    clearTimeout(leaveTimer);
    if (!mini) return;
    const m = mini;
    mini = null;
    m.hovered = false;
    m.wrap.classList.remove('on');
    const park = () => {
      if (mini === m) return;
      m.host.style.display = 'none';
      cache.set(m.url, m);
      m.timer = setTimeout(() => { if (cache.get(m.url) === m) { cache.delete(m.url); m.host.remove(); } }, 20000);
      while (cache.size > 3) { const [k, old] = cache.entries().next().value; cache.delete(k); clearTimeout(old.timer); old.host.remove(); }
    };
    instant ? park() : setTimeout(park, 160);
    if (!keyDown || cfg.mini === 'auto') disarmSoon();
  }

  /* ---------- the Peek ---------- */
  const SIZES = {
    compact: { w: 0.70, mw: 920, h: 0.80 },
    medium:  { w: 0.82, mw: 1240, h: 0.86 },
    large:   { w: 0.94, mw: 1800, h: 0.90 },
  };
  const ICON = {
    reload: '<path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.74 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>',
    copy: '<path d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z"/>',
    window: '<path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4v-2H5V8h14v10h-4v2h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-7 6-4 4h3v6h2v-6h3l-4-4z"/>',
    tab: '<path d="M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z"/>',
    close: '<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
  };
  const CSS = `
    :host { all: initial; position: fixed; inset: 0; z-index: 2147483647; }
    * { box-sizing: border-box; }
    .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.38);
      backdrop-filter: blur(3px) saturate(.9); -webkit-backdrop-filter: blur(3px) saturate(.9);
      opacity: 0; transition: opacity .22s ease; }
    .stage { position: absolute; left: 50%; top: 50%; display: flex; flex-direction: column; gap: 8px;
      transform: translate(-50%, -50%); pointer-events: none; }
    .bar { align-self: flex-end; display: flex; align-items: center; gap: 2px; height: 40px; padding: 0 4px 0 14px;
      border-radius: 28px; background: rgba(0,0,0,.6); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      color: #fff; font: 500 13px/1 "YouTube Sans", Roboto, system-ui, -apple-system, "Segoe UI", sans-serif;
      pointer-events: auto; opacity: 0; transform: translateY(6px); transition: opacity .2s ease .05s, transform .25s ease .05s; }
    .host { max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; opacity: .92; }
    button { all: unset; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
      transition: background .15s; }
    button:hover { background: rgba(255,255,255,.14); }
    button:focus-visible { outline: 2px solid rgba(255,255,255,.7); outline-offset: -2px; }
    svg { width: 18px; height: 18px; fill: #fff; }
    .card { position: relative; border-radius: 14px; overflow: hidden; background: #fff; pointer-events: auto;
      box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 24px 80px rgba(0,0,0,.45), 0 6px 20px rgba(0,0,0,.25);
      opacity: 0; transform: scale(.55); transition: transform .32s cubic-bezier(.2,.9,.25,1.06), opacity .2s ease; }
    @media (prefers-color-scheme: dark) { .card { background: #1f1f1f; } }
    iframe { display: block; width: 100%; height: 100%; border: 0; background: transparent; }
    .ring { position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%;
      border: 2.5px solid rgba(128,128,128,.25); border-top-color: rgba(128,128,128,.85); animation: spin .8s linear infinite;
      transition: opacity .2s; }
    .loaded .ring { opacity: 0; animation: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .toast { position: absolute; left: 50%; bottom: 12px; transform: translate(-50%, 10px); padding: 10px 16px; border-radius: 28px;
      background: rgba(0,0,0,.6); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); color: #fff;
      font: 500 13px/1 Roboto, system-ui, sans-serif; opacity: 0; transition: opacity .2s, transform .2s; pointer-events: none; }
    .toast.on { opacity: 1; transform: translate(-50%, 0); }
    .open .backdrop { opacity: 1; }
    .open .card { opacity: 1; transform: scale(1); }
    .open .bar { opacity: 1; transform: none; }
    .closing .backdrop { opacity: 0; transition-duration: .16s; }
    .closing .card { opacity: 0; transform: scale(.9); transition: transform .16s ease-in, opacity .16s ease-in; }
    .closing .bar { opacity: 0; transition-duration: .1s; }
    @media (prefers-reduced-motion: reduce) { .card, .bar, .backdrop { transition-duration: .01s !important; } }
  `;

  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

  async function open(href, at) {
    hideMini(true);
    if (peek) close(true);
    const sz = SIZES[cfg.size] || SIZES.medium;
    const vw = innerWidth, vh = innerHeight;
    const w = Math.round(Math.min(vw * sz.w, sz.mw)), h = Math.round(vh * sz.h - 48);

    const host = document.createElement('lampyris-peek');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${CSS}</style>
      <div class="wrap">
        <div class="backdrop"></div>
        <div class="stage">
          <div class="bar" role="toolbar" aria-label="Lampyris">
            <span class="host"></span>
            <button data-a="reload" title="${t('reload')}" aria-label="${t('reload')}"><svg viewBox="0 0 24 24">${ICON.reload}</svg></button>
            <button data-a="copy" title="${t('copyLink')}" aria-label="${t('copyLink')}"><svg viewBox="0 0 24 24">${ICON.copy}</svg></button>
            <button data-a="window" title="${t('openWindow')}" aria-label="${t('openWindow')}"><svg viewBox="0 0 24 24">${ICON.window}</svg></button>
            <button data-a="tab" title="${t('openTab')}" aria-label="${t('openTab')}"><svg viewBox="0 0 24 24">${ICON.tab}</svg></button>
            <button data-a="close" title="${t('close')}" aria-label="${t('close')}"><svg viewBox="0 0 24 24">${ICON.close}</svg></button>
          </div>
          <div class="card"><div class="ring"></div></div>
        </div>
        <div class="toast"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const wrap = $('.wrap'), card = $('.card');
    card.style.width = w + 'px';
    card.style.height = h + 'px';
    if (at) {   // grow out of the clicked link
      const left = (vw - w) / 2, top = (vh - h - 48) / 2 + 48;
      card.style.transformOrigin = `${at.x - left}px ${at.y - top}px`;
    }

    const prevOverflow = document.documentElement.style.overflow;
    peek = { host, root, wrap, card, url: href, prevOverflow, closing: false, ok: false };
    setUrl(href);
    $('.backdrop').addEventListener('click', () => { if (cfg.outside) close(); });
    $('.bar').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) act(b.dataset.a);
    });

    document.documentElement.appendChild(host);
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));

    load(href);
  }

  /* Other sites go through the extension's own frame (frame.html): embedded that way, the browser
   * treats the site as if it were opened in a tab, so you stay logged in. Same-site links are
   * embedded directly. */
  async function load(href) {
    const p = peek;
    let ticket = null;
    // the background unlocks framing for this tab before the frame starts loading
    try { ticket = (await api.runtime.sendMessage({ type: 'peek', url: href }))?.ticket; } catch { /* still try */ }
    if (peek !== p) return;
    p.ok = false;
    p.card.classList.remove('loaded');
    p.frame?.remove();
    const f = document.createElement('iframe');
    f.setAttribute('allow', 'autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share');
    f.setAttribute('allowfullscreen', '');
    const nested = ticket && site(new URL(href).hostname) !== site(location.hostname);
    if (nested) {
      f.src = api.runtime.getURL('frame.html') + '#' + ticket;
    } else {
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation allow-storage-access-by-user-activation');
      f.addEventListener('load', loaded);
      f.src = href;
    }
    p.card.appendChild(f);
    p.frame = f;
    setTimeout(() => { if (peek === p) loaded(); }, 8000);   // never spin forever
  }

  function loaded() {
    if (!peek || peek.ok) return;
    peek.ok = true;
    peek.card.classList.add('loaded');
    try { peek.frame.focus(); } catch { /* ignore */ }
  }

  function setUrl(u) {
    if (!peek) return;
    peek.url = u;
    const el = peek.root.querySelector('.host');
    el.textContent = hostOf(u);
    el.title = u;
  }

  function toast(msg) {
    const el = peek?.root.querySelector('.toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('on'), 1400);
  }

  async function act(a) {
    if (!peek) return;
    const url = peek.url;
    if (a === 'close') close();
    else if (a === 'reload') load(url);
    else if (a === 'copy') {
      try { await navigator.clipboard.writeText(url); }
      catch {
        const ta = Object.assign(document.createElement('textarea'), { value: url });
        peek.root.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      toast(t('copied'));
    } else if (a === 'tab') {
      api.runtime.sendMessage({ type: 'tab', url });
      close();
    } else if (a === 'window') {
      api.runtime.sendMessage({ type: 'window', url });
      close();
    }
  }

  function fallback() {   // the site refused to load inside the page
    const url = peek.url;
    close();
    api.runtime.sendMessage({ type: 'window', url, auto: true });
  }

  function close(instant) {
    if (!peek || peek.closing) return;
    const p = peek;
    p.closing = true;
    peek = null;
    api.runtime.sendMessage({ type: 'closed' }).catch(() => {});
    document.documentElement.style.overflow = p.prevOverflow;
    if (instant) { p.host.remove(); return; }
    p.wrap.classList.add('closing');
    setTimeout(() => p.host.remove(), 180);
  }
})();
