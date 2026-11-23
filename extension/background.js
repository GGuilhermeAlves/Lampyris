/* Lampyris background.
 * - lets the Peek frame load (lifts anti-framing headers in that tab while a Peek is open)
 * - keeps you logged in inside the Peek (see auth())
 * - follows the Peek frame: current URL, load, failures
 * - popup-window fallback, context menu */
const api = globalThis.browser ?? globalThis.chrome;
const S = api.storage.session;
const cleanUrl = (u) => { try { const x = new URL(u); x.hash = ''; return x.href; } catch { return u; } };

const SLD = new Set(['com', 'net', 'org', 'gov', 'edu', 'co', 'ac', 'or', 'ne', 'go', 'mil', 'nom', 'art', 'blog', 'eco', 'app', 'dev']);
function siteOf(u) {
  let host;
  try { host = new URL(u).hostname; } catch { return ''; }
  if (/^[\d.]+$|^\[|:/.test(host)) return host;
  const p = host.replace(/^www\./, '').split('.');
  if (p.length <= 2) return p.join('.');
  const n = p[p.length - 2].length <= 3 && SLD.has(p[p.length - 2]) && p[p.length - 1].length === 2 ? 3 : 2;
  return p.slice(-n).join('.');
}

async function getPeek(tabId) { return (await S.get(`p${tabId}`))[`p${tabId}`]; }
async function setPeek(tabId, v) { v ? await S.set({ [`p${tabId}`]: v }) : await S.remove(`p${tabId}`); }
async function allPeeks() {
  const all = await S.get(null);
  return Object.entries(all).filter(([k]) => /^p\d+$/.test(k)).map(([k, v]) => [Number(k.slice(1)), v]);
}
async function alloc(n) {
  const { nextRule = 1000 } = await S.get('nextRule');
  await S.set({ nextRule: nextRule + n > 2e9 ? 1000 : nextRule + n });
  return Array.from({ length: n }, (_, i) => nextRule + i);
}
const dnr = (add, remove = []) => api.declarativeNetRequest.updateSessionRules({ addRules: add, removeRuleIds: remove }).catch((e) => console.warn('Lampyris rules:', e));

/* ---------- framing ---------- */
const stripRule = (id, tabId) => ({
  id, priority: 1,
  action: { type: 'modifyHeaders', responseHeaders: [
    { header: 'x-frame-options', operation: 'remove' },
    { header: 'content-security-policy', operation: 'remove' },
  ] },
  condition: { tabIds: [tabId], resourceTypes: ['sub_frame'] },
});

/* ---------- staying logged in ----------
 * The site is embedded through an extension page (frame.html), so the browser gives it its
 * normal storage and sends its cookies on the first load. Requests the site makes afterwards
 * (fetch, images, links clicked inside the Peek) would still go out without cookies, because the
 * page around the Peek is another site. These rules attach the site's own cookies to those
 * requests: only in this tab, only to the peeked site, only when the site itself makes the
 * request, and only while the Peek is open. */
const SUB = ['xmlhttprequest', 'script', 'image', 'stylesheet', 'font', 'media', 'object', 'ping', 'websocket', 'other'];
const cookieHeader = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');

async function auth(tabId, st, url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const site = siteOf(url);
  const old = st.auth || [];
  st.site = site;
  st.auth = [];
  if (!/^https?:$/.test(u.protocol) || site === st.pageSite || !api.cookies) {
    if (old.length) await dnr([], old);
    await setPeek(tabId, st);
    return false;
  }
  const host = u.hostname;
  const [forHost, forSite] = await Promise.all([
    api.cookies.getAll({ url: `${u.protocol}//${u.host}/` }).catch(() => []),
    api.cookies.getAll({ domain: site }).catch(() => []),
  ]);
  const siteWide = forSite.filter((c) => !c.hostOnly && (u.protocol === 'https:' || !c.secure));
  const rules = [];
  const ids = await alloc(3);
  const set = (v) => ({ type: 'modifyHeaders', requestHeaders: [{ header: 'cookie', operation: 'set', value: v }] });
  if (forHost.length) {
    const h = cookieHeader(forHost);
    // links clicked inside the Peek (not frames the surrounding page creates)
    rules.push({ id: ids[0], priority: 3, action: set(h), condition: {
      tabIds: [tabId], requestDomains: [host], resourceTypes: ['sub_frame'],
      ...(st.pageSite ? { excludedInitiatorDomains: [st.pageSite] } : {}) } });
    // the site's own requests
    rules.push({ id: ids[1], priority: 3, action: set(h), condition: {
      tabIds: [tabId], requestDomains: [host], initiatorDomains: [site], resourceTypes: SUB } });
  }
  if (siteWide.length) {   // other subdomains of the same site (api., static.…)
    rules.push({ id: ids[2], priority: 2, action: set(cookieHeader(siteWide)), condition: {
      tabIds: [tabId], requestDomains: [site], excludedRequestDomains: [host], initiatorDomains: [site], resourceTypes: SUB } });
  }
  await dnr(rules, old);
  st.auth = rules.map((r) => r.id);
  await setPeek(tabId, st);
  return forHost.length > 0;
}

// keep the cookies in the rules current (login, logout, refreshed session)
let cookieTimer = null;
api.cookies?.onChanged.addListener(({ cookie }) => {
  clearTimeout(cookieTimer);
  cookieTimer = setTimeout(async () => {
    const d = cookie.domain.replace(/^\./, '');
    for (const [tabId, st] of await allPeeks()) {
      if (st.site && (d === st.site || d.endsWith('.' + st.site))) await auth(tabId, st, st.cur || st.url);
    }
  }, 150);
});

async function release(tabId) {
  const st = await getPeek(tabId);
  if (!st) return;
  await setPeek(tabId, null);
  await dnr([], [st.strip, ...(st.auth || [])].filter(Boolean));
}

/* ---------- popup-window Peek (fallback, and "open in window" button) ---------- */
async function openWindow(url, fromTab) {
  let b = { width: 1100, height: 800 };
  try {
    const w = await api.windows.get(fromTab.windowId);
    const width = Math.round(Math.min(w.width * 0.82, 1240)), height = Math.round(w.height * 0.86);
    b = { width, height, left: Math.round(w.left + (w.width - width) / 2), top: Math.round(w.top + (w.height - height) / 2) };
  } catch { /* defaults */ }
  let win;
  try { win = await api.windows.create({ url, type: 'popup', focused: true, ...b }); }
  catch {   // bounds partly off-screen (browser window dragged past the edge, small display…)
    try { win = await api.windows.create({ url, type: 'popup', focused: true, width: b.width, height: b.height }); }
    catch { win = await api.windows.create({ url, type: 'popup', focused: true }); }
  }
  const { popups = [] } = await S.get('popups');
  await S.set({ popups: [...popups, win.id] });
}
api.windows.onFocusChanged.addListener(async (focused) => {
  if (focused === api.windows.WINDOW_ID_NONE) return;            // switched to another app
  const { popups = [] } = await S.get('popups');
  if (!popups.length) return;
  const { outside = true } = await api.storage.sync.get('outside');
  if (!outside) return;
  for (const id of popups) if (id !== focused) api.windows.remove(id).catch(() => {});
  await S.set({ popups: popups.filter((id) => id === focused) });
});
api.windows.onRemoved.addListener(async (id) => {
  const { popups = [] } = await S.get('popups');
  if (popups.includes(id)) await S.set({ popups: popups.filter((x) => x !== id) });
});

/* ---------- messages ---------- */
api.runtime.onMessage.addListener((m, sender) => {
  const tab = sender.tab;
  if (m.type === 'frame') {          // frame.html redeeming its one-time ticket
    return (async () => {
      if (!tab || !m.ticket) return null;
      const st = await getPeek(tab.id);
      if (!st || st.used || st.ticket !== m.ticket) return null;
      st.used = true;
      await setPeek(tab.id, st);
      return st.url;
    })();
  }
  if (!tab) return;
  const tabId = tab.id;
  if (m.type === 'hello') return Promise.resolve({ pinned: !!tab.pinned });
  if (m.type === 'peek') {
    return (async () => {
      await release(tabId);
      const [strip] = await alloc(1);
      await dnr([stripRule(strip, tabId)]);
      const st = { url: cleanUrl(m.url), frameId: null, ticket: crypto.randomUUID(), used: false,
                   pageSite: siteOf(tab.url || sender.url || ''), strip, auth: [] };
      await setPeek(tabId, st);
      await auth(tabId, st, m.url);
      return { ticket: st.ticket };
    })();
  }
  if (m.type === 'closed') { release(tabId); return; }
  if (m.type === 'mini') {          // mini Peek: only the framing rule, no login
    return (async () => {
      const k = `m${tabId}`;
      const old = (await S.get(k))[k];
      const [id] = await alloc(1);
      await dnr([stripRule(id, tabId)], old ? [old] : []);
      await S.set({ [k]: id });
      return true;
    })();
  }
  if (m.type === 'miniClosed') {
    (async () => {
      const k = `m${tabId}`;
      const id = (await S.get(k))[k];
      if (id) { await S.remove(k); await dnr([], [id]); }
    })();
    return;
  }
  if (m.type === 'tab') {
    api.tabs.create({ url: m.url, index: tab.index + 1, active: true, openerTabId: tabId, windowId: tab.windowId });
    return;
  }
  if (m.type === 'window') { openWindow(m.url, tab); return; }
});

/* ---------- follow the Peek frame ---------- */
async function match(d) {
  if (d.frameId === 0) return null;
  const st = await getPeek(d.tabId);
  if (!st) return null;
  if (st.frameId === null && cleanUrl(d.url) === st.url) {
    st.frameId = d.frameId;
    await setPeek(d.tabId, st);
  }
  return st.frameId === d.frameId ? st : null;
}
const send = (tabId, msg) => api.tabs.sendMessage(tabId, msg, { frameId: 0 }).catch(() => {});

api.webNavigation.onBeforeNavigate.addListener(async (d) => {
  const st = await match(d);
  // heading to another site inside the Peek: switch the cookie rules. The request has usually
  // left already, so if you have cookies there the page is loaded again once they're in place.
  if (st && siteOf(d.url) !== st.site && await auth(d.tabId, st, d.url)) {
    st.renav = cleanUrl(d.url);
    await setPeek(d.tabId, st);
  }
});
api.webNavigation.onCommitted.addListener(async (d) => {
  const st = await match(d);
  if (!st) return;
  st.cur = d.url;
  const again = st.renav && st.renav === cleanUrl(d.url);
  if (again) st.renav = null;
  await setPeek(d.tabId, st);
  send(d.tabId, { type: 'url', url: d.url });
  if (again) api.runtime.sendMessage({ type: 'renav', ticket: st.ticket, url: d.url }).catch(() => {});
});
api.webNavigation.onHistoryStateUpdated.addListener(async (d) => {
  const st = await match(d);
  if (!st) return;
  st.cur = d.url;
  await setPeek(d.tabId, st);
  send(d.tabId, { type: 'url', url: d.url });
});
api.webNavigation.onDOMContentLoaded.addListener(async (d) => {
  if (await match(d)) send(d.tabId, { type: 'loaded' });
});
api.webNavigation.onErrorOccurred.addListener(async (d) => {
  if (/ABORTED|NS_BINDING_ABORTED/i.test(d.error || '')) return;
  if (await match(d)) send(d.tabId, { type: 'failed', error: d.error });
});

/* ---------- pinned state, context menu, cleanup ---------- */
api.tabs.onUpdated.addListener((tabId, info) => {
  if ('pinned' in info) send(tabId, { type: 'pinned', pinned: info.pinned });
});
api.tabs.onRemoved.addListener(async (tabId) => {
  release(tabId);
  const id = (await S.get(`m${tabId}`))[`m${tabId}`];
  if (id) { await S.remove(`m${tabId}`); await dnr([], [id]); }
});

function menus() {
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({
      id: 'lampyris-peek',
      title: api.i18n.getMessage('menuPeek'),
      contexts: ['link'],
      targetUrlPatterns: ['http://*/*', 'https://*/*'],
    });
  });
}
api.runtime.onInstalled.addListener(async () => {
  menus();
  const old = await api.declarativeNetRequest.getSessionRules();
  if (old.length) await dnr([], old.map((r) => r.id));
});
api.runtime.onStartup?.addListener(menus);
api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'lampyris-peek' || !tab) return;
  api.tabs.sendMessage(tab.id, { type: 'open', url: info.linkUrl }, { frameId: 0 })
    .catch(() => openWindow(info.linkUrl, tab));   // page without the content script (e.g. the store)
});
