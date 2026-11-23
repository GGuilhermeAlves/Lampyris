const api = globalThis.browser ?? globalThis.chrome;
const DEFAULTS = { enabled: true, pinned: true, modifier: 'alt', mini: 'shift', size: 'medium', outside: true, blocked: [] };
const $ = (s) => document.querySelector(s);

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
for (const el of document.querySelectorAll('[data-i18n]')) {
  let s = api.i18n.getMessage(el.dataset.i18n);
  if (isMac && el.classList.contains('k')) s = s.replace('Alt', '⌥').replace('Ctrl', '⌘').replace('Shift', '⇧');
  el.textContent = s;
}

// Frosted "see-through" look: a blurred, live snapshot of the visible tab sits behind the popup.
// It's refreshed a couple of times per second (the browser's capture rate limit) while the popup is
// open, so a playing video or a scroll shows through. Images only live in this popup's memory.
const BACKDROP_MS = 600;
let baseId = null, lastUrl = '', fading = false;
function showShot(url, w) {
  if (url === lastUrl || fading) return;   // nothing changed, or the previous fade is still running
  lastUrl = url;
  const nextId = baseId === 'shotA' ? 'shotB' : 'shotA';
  const next = $('#' + nextId), dpr = window.devicePixelRatio || 1;
  next.style.backgroundImage = `url(${url})`;
  // the popup opens under the toolbar at the top-right corner of the page
  next.style.backgroundSize = `${w / dpr}px auto`;
  next.style.backgroundPosition = 'right 16px top 0';   // a little past the edge so the blur doesn't fade it
  next.className = 'shot incoming';
  void next.offsetWidth;                   // commit opacity:0 before fading in
  fading = true;
  next.classList.add('in');
  setTimeout(() => {
    next.className = 'shot base';          // promote: stays opaque, no transition
    if (baseId) $('#' + baseId).className = 'shot';
    baseId = nextId;
    fading = false;
  }, 380);
}
async function captureBackdrop() {
  try {
    const url = await api.tabs.captureVisibleTab({ format: 'jpeg', quality: 45 });
    const img = new Image();
    img.onload = () => showShot(url, img.naturalWidth);
    img.src = url;
    return true;
  } catch { return false; }                // browser pages, the stores… keep the plain dark backdrop
}
captureBackdrop().then((ok) => { if (ok) setInterval(captureBackdrop, BACKDROP_MS); });

(async () => {
  const cfg = { ...DEFAULTS, ...(await api.storage.sync.get(DEFAULTS)) };
  const save = (k, v) => { cfg[k] = v; api.storage.sync.set({ [k]: v }); };

  const sync = () => $('#opts').classList.toggle('off', !cfg.enabled);
  for (const k of ['enabled', 'pinned', 'outside']) {
    $('#' + k).checked = cfg[k];
    $('#' + k).addEventListener('change', (e) => { save(k, e.target.checked); sync(); });
  }
  sync();

  for (const seg of document.querySelectorAll('.seg')) {
    const k = seg.dataset.key;
    const paint = () => {
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === cfg[k]));
      document.querySelectorAll(`.hint[data-for="${k}"]`).forEach((h) =>
        h.classList.toggle('on', h.dataset.not ? cfg[k] !== h.dataset.not : h.dataset.v === cfg[k]));
    };
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { save(k, b.dataset.v); paint(); }
    });
    paint();
  }

  // per-site switch
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try { const u = new URL(tab.url); if (/^https?:$/.test(u.protocol)) host = u.hostname.replace(/^www\./, ''); } catch { /* no url */ }
  const site = $('#site');
  if (!host) {
    $('#siteLabel').textContent = api.i18n.getMessage('popNoSite');
    site.disabled = true;
  } else {
    $('#siteLabel').textContent = api.i18n.getMessage('popSite', [host]);
    site.checked = cfg.blocked.includes(host);
    site.addEventListener('change', () => {
      const set = new Set(cfg.blocked);
      site.checked ? set.add(host) : set.delete(host);
      save('blocked', [...set]);
    });
  }
})();
