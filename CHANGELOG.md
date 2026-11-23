# Changelog

## 1.0.0 — 2026-11-23

First release.

- Peek with Alt+click (or Shift+click) on any link.
- Mini Peek: hold a key (Shift by default) and rest the pointer on a link for a small live preview, loaded without cookies. Click it to open the full Peek.
- Pinned tabs work like Arc: links to other sites open in a Peek.
- "Peek with Lampyris" in the link context menu.
- Toolbar: current site, reload, copy link, open in a window, open as a tab. Close with Esc, ✕ or a click outside.
- You stay logged in inside the Peek: sites are embedded through an extension frame (normal storage and cookies), and the site's own follow-up requests get its cookies through a rule scoped to the tab, the site and the Peek's lifetime. One-time tickets keep other pages from using the frame.
- Sites that refuse framing load inside the Peek (rule scoped to the tab, removed on close); pages that still fail open in a popup window.
- Mini Peek starts loading the moment the pointer reaches a link and keeps the last few previews ready, so going back to one is instant.
- Frosted settings popup over a live, blurred snapshot of the page (same as Glaux). Settings: on/off, pinned tabs, Peek shortcut, Mini Peek key, size, close on outside click, per-site off switch.
- English and Brazilian Portuguese.
- Chromium and Firefox (140+) from one codebase. `pack.sh` builds a zip for each store.
