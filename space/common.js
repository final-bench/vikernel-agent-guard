/* Shared runtime for ViKernel Desktop extension apps: session id, live API helper, highlight styles. */
(() => {
'use strict';
try { window.VK_SID = sessionStorage.getItem('vk_sid') || ('s' + Math.random().toString(36).slice(2, 10)); sessionStorage.setItem('vk_sid', window.VK_SID); }
catch (e) { window.VK_SID = 's' + Math.random().toString(36).slice(2, 10); }
window.VK_OVERRIDES = window.VK_OVERRIDES || {};
// every page load starts this visitor's session in RUN (a session KILL never survives a reload)
try { fetch('api/ag/session/start', {method:'POST', headers:{'Content-Type':'application/json', 'X-VK-Session':window.VK_SID}, body:'{}'}); } catch (e) {}
window.VK_EXTRA_APPS = window.VK_EXTRA_APPS || [];
window.VK_API = async (path, body, timeoutMs) => {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), timeoutMs || 120000);
  try {
    const r = await fetch('api/ag/' + path, body === undefined ? {cache:'no-store', signal:ctl.signal, headers:{'X-VK-Session':window.VK_SID}} :
      {method:'POST', headers:{'Content-Type':'application/json', 'X-VK-Session':window.VK_SID}, body:JSON.stringify(body), signal:ctl.signal});
    if (r.status === 429) throw new Error('rate');
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
};
const css = document.createElement('style');
css.textContent = `@keyframes vkpulse{0%{box-shadow:0 0 0 0 rgba(99,102,241,.55)}70%{box-shadow:0 0 0 12px rgba(99,102,241,0)}100%{box-shadow:0 0 0 0 rgba(99,102,241,0)}}
.icon.hl .g,.dk.hl .g{outline:2px solid #818CF8;outline-offset:2px;animation:vkpulse 2.2s ease-out infinite}
.icon.hl{position:relative}.icon.hl::after{content:'NEW';position:absolute;top:2px;right:8px;background:#E11D48;color:#fff;font:800 9px/1 system-ui,sans-serif;padding:3px 5px;border-radius:6px;letter-spacing:.5px}
.dk.hl{position:relative}.dk.hl::after{content:'';position:absolute;top:4px;right:4px;width:8px;height:8px;border-radius:50%;background:#E11D48}
@media (max-width:700px){.win .body{overflow-x:hidden}.win .body *{max-width:100%;box-sizing:border-box;min-width:0}.win .body pre,.win .body code{white-space:pre-wrap;word-break:break-word}.win .body table{display:block;overflow-x:auto}}
#linkbar{display:flex;flex-wrap:nowrap;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 4px;grid-column:1/-1;width:100%}#linkbar::-webkit-scrollbar{display:none}#linkbar a{flex:0 0 auto;font:700 11px/1 system-ui,sans-serif;color:#fff;background:var(--c);padding:4px 8px;border-radius:999px;text-decoration:none;white-space:nowrap}#linkbar a:hover{filter:brightness(1.15)}
.icon[data-open="mines"]{position:relative}.icon[data-open="mines"]::before{content:'from App Store';position:absolute;top:-2px;left:50%;transform:translateX(-50%);background:#4F46E5;color:#fff;font:700 8px/1 system-ui,sans-serif;padding:2px 4px;border-radius:5px;white-space:nowrap;z-index:1}
@media (prefers-reduced-motion:reduce){.icon.hl .g,.dk.hl .g{animation:none}}`;
document.head.append(css);
})();
