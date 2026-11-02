/* Shared runtime for ViKernel Desktop extension apps: session id, live API helper, highlight styles. */
(() => {
'use strict';
try { window.VK_SID = sessionStorage.getItem('vk_sid') || ('s' + Math.random().toString(36).slice(2, 10)); sessionStorage.setItem('vk_sid', window.VK_SID); }
catch (e) { window.VK_SID = 's' + Math.random().toString(36).slice(2, 10); }
window.VK_OVERRIDES = window.VK_OVERRIDES || {};
window.VK_EXTRA_APPS = window.VK_EXTRA_APPS || [];
window.VK_API = async (path, body, timeoutMs) => {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), timeoutMs || 120000);
  try {
    const r = await fetch('api/ag/' + path, body === undefined ? {cache:'no-store', signal:ctl.signal} :
      {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:ctl.signal});
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
@media (prefers-reduced-motion:reduce){.icon.hl .g,.dk.hl .g{animation:none}}`;
document.head.append(css);
})();
