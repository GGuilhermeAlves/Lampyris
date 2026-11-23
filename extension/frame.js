/* The Peek's middle frame. Because the site is embedded by an extension page that has host
 * permission for it, the browser gives it its normal (top-level) storage and sends its cookies on
 * the first load, so you stay logged in. The background adds the cookies to the site's own
 * follow-up requests while the Peek is open.
 * The URL comes from the background in exchange for a one-time ticket bound to this tab, so other
 * sites can't use this page to embed a logged-in site. */
const api = globalThis.browser ?? globalThis.chrome;
const f = document.getElementById('f');
const ticket = location.hash.slice(1);
history.replaceState(null, '', location.pathname);   // don't leave the ticket in the address
api.runtime.sendMessage({ type: 'frame', ticket }).then((url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) f.src = url;
}).catch(() => {});
// reload with your cookies after a link inside the Peek went to another site
api.runtime.onMessage.addListener((m) => {
  if (m.type === 'renav' && m.ticket === ticket && /^https?:\/\//i.test(m.url)) f.src = m.url;
});
f.addEventListener('load', () => { try { f.focus(); } catch { /* ignore */ } });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.parent.postMessage({ __lampyris: 'esc' }, '*');
}, true);
