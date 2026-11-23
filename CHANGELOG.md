# Changelog

## 1.1.1 — 2026-11-23

- Fix: videos (YouTube and others) started playing inside Mini Peek previews, couldn't be paused and kept playing in the background after the preview hid. Previews now keep all video and audio paused and muted; the full Peek plays normally.
- Opening the full Peek from a preview discards that preview, and switching tabs frees the stored previews, so no page keeps running hidden.

## 1.1.0 — 2026-11-23

- **Automatic Peek** (Peek → Auto): a plain click on a link to another site opens it in a Peek, in any tab, like Arc's pinned tabs. Links within the same site navigate normally; Alt+click still peeks any link.
- **Automatic Mini Peek** (Mini Peek → Auto): rest the pointer on a link for a moment and the preview appears, no key needed. Just passing over links loads nothing.
- Settings popup: a bit wider, so every option fits.

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
