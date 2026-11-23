/* Runs at document_start in every frame, but only acts inside Mini Peek previews (the frame is
 * named "__lampyris_mini" by the extension): a preview is a quick look, so videos and audio never
 * play there. Otherwise a page like a video would start playing in a preview you can't click,
 * and keep going while the preview is hidden. The full Peek plays normally. */
if (window.name === '__lampyris_mini') {
  const hush = (m) => {
    if (!(m instanceof HTMLMediaElement)) return;
    m.muted = true;
    m.autoplay = false;
    if (!m.paused) m.pause();
  };
  // media events don't bubble, but a capturing listener on window sees them all
  for (const ev of ['play', 'playing', 'loadedmetadata']) addEventListener(ev, (e) => hush(e.target), true);
  // and anything that started before this ran, or that a player resumes later
  const sweep = () => document.querySelectorAll('video, audio').forEach(hush);
  setInterval(sweep, 1000);
  addEventListener('DOMContentLoaded', sweep);
}
