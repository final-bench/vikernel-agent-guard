/* ViKernel Browser: a governed agentic browser app for ViKernel Desktop.
   Every navigation passes egress policy, SSRF guard and the ViKernel kernel gate on the server.
   The page is shown as a sanitized reader view; hidden instructions are surfaced, and agent
   actions on the page are decided by the gate. */
(() => {
'use strict';

const MAX_TABS = 6;
const BM_KEY = 'vb.bookmarks.v1';
const START = 'vb:start';

const ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M3 11h16M11 3c2.6 2.8 2.6 13.2 0 16M11 3c-2.6 2.8-2.6 13.2 0 16"/><path d="M17 13.5l4 1.5v3c0 2.2-1.7 3.6-4 4.5-2.3-.9-4-2.3-4-4.5v-3z" fill="currentColor" fill-opacity=".18"/></svg>';
const I = {
  back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  fwd: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  reload: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z" fill="currentColor" fill-opacity=".12"/><path d="M9 9l6 6M15 9l-6 6" stroke-linecap="round"/></svg>',
  agent: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/></svg>',
  hist: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>'
};

const CSS = `
.vb-root{--vb-bg:#fff;--vb-fg:#0f172a;--vb-mut:#64748b;--vb-line:#e2e8f0;--vb-chrome:#f1f5f9;--vb-tab:#e2e8f0;--vb-acc:#2563EB;--vb-ok:#16a34a;--vb-okbg:#dcfce7;--vb-bad:#dc2626;--vb-badbg:#fee2e2;--vb-warn:#b45309;--vb-warnbg:#fef3c7;--vb-card:#f8fafc;--vb-mark:#fde68a;
  position:relative;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--vb-bg);color:var(--vb-fg);font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;container-type:inline-size;outline:none;overflow:hidden}
@media (prefers-color-scheme:dark){.vb-root{--vb-bg:#0b1220;--vb-fg:#e2e8f0;--vb-mut:#94a3b8;--vb-line:#1e293b;--vb-chrome:#111a2e;--vb-tab:#1e293b;--vb-okbg:#052e16;--vb-ok:#4ade80;--vb-badbg:#450a0a;--vb-bad:#f87171;--vb-warnbg:#422006;--vb-warn:#fbbf24;--vb-card:#0f172a;--vb-mark:#713f12}}
:is(.dark,[data-theme="dark"]) .vb-root{--vb-bg:#0b1220;--vb-fg:#e2e8f0;--vb-mut:#94a3b8;--vb-line:#1e293b;--vb-chrome:#111a2e;--vb-tab:#1e293b;--vb-okbg:#052e16;--vb-ok:#4ade80;--vb-badbg:#450a0a;--vb-bad:#f87171;--vb-warnbg:#422006;--vb-warn:#fbbf24;--vb-card:#0f172a;--vb-mark:#713f12}
.vb-root *{box-sizing:border-box}
.vb-root button{font:inherit;color:inherit;cursor:pointer}
.vb-tabs{display:flex;align-items:flex-end;gap:2px;padding:6px 6px 0;background:var(--vb-chrome);overflow-x:auto;scrollbar-width:none;flex:none}
.vb-tab{display:flex;align-items:center;gap:6px;min-width:0;max-width:200px;flex:1 1 140px;padding:6px 8px 7px 10px;border-radius:8px 8px 0 0;background:transparent;border:0;color:var(--vb-mut);white-space:nowrap}
.vb-tab:hover{background:var(--vb-tab)}
.vb-tab.on{background:var(--vb-bg);color:var(--vb-fg);font-weight:600}
.vb-tab .vb-tt{overflow:hidden;text-overflow:ellipsis;flex:1;text-align:left}
.vb-tab .vb-tx{display:grid;place-items:center;width:18px;height:18px;border-radius:5px;border:0;background:transparent;padding:0;opacity:.6}
.vb-tab .vb-tx:hover{background:var(--vb-line);opacity:1}
.vb-tab .vb-dot{width:7px;height:7px;border-radius:50%;background:var(--vb-mut);flex:none}
.vb-tab .vb-dot.ok{background:var(--vb-ok)}.vb-tab .vb-dot.bad{background:var(--vb-bad)}.vb-tab .vb-dot.warn{background:var(--vb-warn)}
.vb-newtab{flex:none;width:28px;height:28px;margin-bottom:3px;border:0;border-radius:7px;background:transparent;display:grid;place-items:center}
.vb-newtab:hover{background:var(--vb-tab)}
.vb-bar{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid var(--vb-line);flex:none}
.vb-ib{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:8px;background:transparent;flex:none}
.vb-ib:hover:not(:disabled){background:var(--vb-chrome)}
.vb-ib:disabled{opacity:.35;cursor:default}
.vb-ib.on{color:var(--vb-acc);background:var(--vb-chrome)}
.vb-ib.starred{color:#eab308}.vb-ib.starred svg{fill:currentColor}
.vb-addr{flex:1;min-width:80px;display:flex;align-items:center;gap:6px;height:32px;padding:0 6px 0 10px;border-radius:16px;background:var(--vb-chrome);border:1px solid transparent}
.vb-addr:focus-within{border-color:var(--vb-acc);background:var(--vb-bg)}
.vb-addr input{flex:1;min-width:0;border:0;background:transparent;color:var(--vb-fg);font:inherit;font-size:13px;outline:none}
.vb-lock{display:grid;place-items:center;color:var(--vb-mut)}.vb-lock.https{color:var(--vb-ok)}.vb-lock.http{color:var(--vb-warn)}
.vb-chip{flex:none;font:700 11px/1 system-ui,sans-serif;padding:5px 8px;border-radius:10px;white-space:nowrap;letter-spacing:.2px}
.vb-chip.ok{background:var(--vb-okbg);color:var(--vb-ok)}.vb-chip.bad{background:var(--vb-badbg);color:var(--vb-bad)}.vb-chip.mut{background:var(--vb-chrome);color:var(--vb-mut)}
.vb-bm{display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid var(--vb-line);overflow-x:auto;scrollbar-width:thin;flex:none}
.vb-bm button{flex:none;border:0;background:transparent;border-radius:6px;padding:3px 8px;color:var(--vb-mut);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vb-bm button:hover{background:var(--vb-chrome);color:var(--vb-fg)}
.vb-bm button.bad{color:var(--vb-bad)}.vb-bm button.demo{color:var(--vb-warn);font-weight:600}
.vb-main{flex:1;min-height:0;display:flex}
.vb-content{flex:1;min-width:0;overflow:auto;position:relative}
.vb-side{width:340px;flex:none;border-left:1px solid var(--vb-line);display:flex;flex-direction:column;min-height:0;background:var(--vb-card)}
.vb-side[hidden]{display:none}
.vb-side h3{margin:0;font-size:14px}
.vb-sidehd{padding:12px;border-bottom:1px solid var(--vb-line);display:flex;flex-direction:column;gap:8px}
.vb-sidehd textarea{width:100%;min-height:54px;resize:vertical;border:1px solid var(--vb-line);border-radius:8px;padding:8px;background:var(--vb-bg);color:var(--vb-fg);font:inherit}
.vb-run{align-self:flex-end;border:0;border-radius:8px;padding:7px 16px;background:var(--vb-acc);color:#fff !important;font-weight:700}
.vb-run:disabled{opacity:.5;cursor:default}
.vb-ev{flex:1;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.vb-e{border:1px solid var(--vb-line);border-radius:8px;padding:8px 10px;background:var(--vb-bg);word-break:break-word}
.vb-e .vb-k{font:700 10px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.6px;color:var(--vb-mut);margin-bottom:4px}
.vb-e code,.vb-e pre{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
.vb-e pre{margin:4px 0 0;white-space:pre-wrap;max-height:140px;overflow:auto;background:var(--vb-chrome);padding:6px;border-radius:6px}
.vb-e.deny{border-color:var(--vb-bad)}.vb-e.allow{border-color:var(--vb-ok)}
.vb-tag{display:inline-block;font:700 11px/1 system-ui,sans-serif;padding:4px 7px;border-radius:6px;margin-right:6px}
.vb-tag.ok{background:var(--vb-okbg);color:var(--vb-ok)}.vb-tag.bad{background:var(--vb-badbg);color:var(--vb-bad)}
.vb-callout{border-radius:10px;padding:10px 12px;background:var(--vb-badbg);color:var(--vb-bad);font-weight:600;border:1px solid var(--vb-bad)}
.vb-final{border-color:var(--vb-acc)}
.vb-banner{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--vb-warnbg);color:var(--vb-warn);font-weight:600;border-bottom:1px solid var(--vb-line)}
.vb-banner.soft{font-weight:500}
.vb-banner button{margin-left:auto;border:1px solid currentColor;background:transparent;border-radius:6px;padding:3px 10px;font-weight:700}
.vb-page{max-width:760px;margin:0 auto;padding:22px 28px 60px;font:16px/1.65 Georgia,"Times New Roman",serif;color:var(--vb-fg)}
.vb-page h1{font:700 28px/1.25 system-ui,sans-serif;margin:.2em 0 .6em}
.vb-page h2,.vb-page h3,.vb-page h4{font-family:system-ui,sans-serif;line-height:1.3;margin:1.4em 0 .5em}
.vb-page a{color:var(--vb-acc)}
.vb-page img{max-width:100%;height:auto;border-radius:6px}
.vb-page pre{overflow:auto;background:var(--vb-chrome);padding:10px;border-radius:8px;font-size:13px}
.vb-page code{font-family:ui-monospace,Consolas,monospace;font-size:.9em}
.vb-page blockquote{margin:1em 0;padding:.2em 1em;border-left:3px solid var(--vb-line);color:var(--vb-mut)}
.vb-page table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%;font:14px/1.4 system-ui,sans-serif}
.vb-page td,.vb-page th{border:1px solid var(--vb-line);padding:5px 8px;vertical-align:top}
.vb-pagehd{font:12px/1.4 system-ui,sans-serif;color:var(--vb-mut);margin-bottom:6px;word-break:break-all}
.vb-hidden-wrap{margin-top:40px;padding-top:14px;border-top:2px dashed var(--vb-warn);font-family:system-ui,sans-serif}
.vb-hidden-wrap h3{color:var(--vb-warn);margin-top:0}
mark.vb-hidden{display:block;background:var(--vb-mark);color:inherit;padding:8px 10px;border-radius:8px;margin:8px 0;font-size:14px;transition:box-shadow .3s}
mark.vb-hidden i{color:var(--vb-mut);font-size:12px}
mark.vb-hidden.vb-sus{border-left:4px solid var(--vb-bad)}
.vb-flash mark.vb-hidden{box-shadow:0 0 0 3px var(--vb-bad)}
.vb-center{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 20px;min-height:100%;gap:10px}
.vb-block{color:var(--vb-bad)}
.vb-block h2{margin:0;font:800 24px/1.2 system-ui,sans-serif;color:var(--vb-fg)}
.vb-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;text-align:left;max-width:520px;background:var(--vb-card);border:1px solid var(--vb-line);border-radius:10px;padding:12px 16px;color:var(--vb-fg)}
.vb-kv b{color:var(--vb-mut);font-weight:600}
.vb-kv span{word-break:break-all}
.vb-spin{width:34px;height:34px;border-radius:50%;border:3px solid var(--vb-line);border-top-color:var(--vb-acc);animation:vbspin .8s linear infinite}
@keyframes vbspin{to{transform:rotate(360deg)}}
.vb-start{max-width:780px;margin:0 auto;padding:30px 24px}
.vb-start h2{font:800 22px/1.2 system-ui,sans-serif;margin:0 0 4px;display:flex;align-items:center;gap:10px}
.vb-start h2 svg{color:var(--vb-acc)}
.vb-start p{color:var(--vb-mut);margin:0 0 18px}
.vb-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:22px}
.vb-tile{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid var(--vb-line);border-radius:10px;background:var(--vb-card);padding:12px;min-height:76px}
.vb-tile:hover{border-color:var(--vb-acc)}
.vb-tile b{font-size:13px}.vb-tile small{color:var(--vb-mut);word-break:break-all;font-size:11px}
.vb-tile.bad b{color:var(--vb-bad)}.vb-tile.demo b{color:var(--vb-warn)}
.vb-guide{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.vb-guide li{background:var(--vb-card);border:1px solid var(--vb-line);border-radius:8px;padding:9px 12px}
.vb-panel{position:absolute;top:84px;right:8px;bottom:8px;width:min(380px,calc(100% - 16px));z-index:5;background:var(--vb-bg);border:1px solid var(--vb-line);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:flex;flex-direction:column}
.vb-panel[hidden]{display:none}
.vb-panel header{display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid var(--vb-line);font-weight:700}
.vb-panel header button{margin-left:auto;border:0;background:transparent;border-radius:6px;padding:4px}
.vb-panel .vb-pb{overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.vb-hrow{display:flex;flex-direction:column;align-items:flex-start;border:0;background:transparent;text-align:left;padding:6px 8px;border-radius:6px;word-break:break-all}
.vb-hrow:hover{background:var(--vb-chrome)}
.vb-hrow small{color:var(--vb-mut)}
.vb-layer{border:1px solid var(--vb-line);border-radius:8px;padding:9px 11px}
.vb-layer b{display:block;margin-bottom:2px}
.vb-mut{color:var(--vb-mut)}
.vb-err{color:var(--vb-warn)}
@container (max-width:760px){.vb-main{flex-direction:column}.vb-side{width:auto;border-left:0;border-top:1px solid var(--vb-line);max-height:55%}.vb-page{padding:16px 16px 40px}.vb-chip{display:none}.vb-bar .vb-hide-sm{display:none}}
@media (max-width:760px){.vb-main{flex-direction:column}.vb-side{width:auto;border-left:0;border-top:1px solid var(--vb-line);max-height:55%}}
@media (prefers-reduced-motion:reduce){.vb-spin{animation-duration:2.4s}}
`;

function injectCss() {
  if (document.getElementById('vb-style')) return;
  const s = document.createElement('style');
  s.id = 'vb-style';
  s.textContent = CSS;
  document.head.append(s);
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
function mk(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

function defaultBookmarks() {
  return [
    {title:'Demo: poisoned page', url:location.origin + '/demo/poisoned-page', kind:'demo', note:'Hidden instructions try to hijack the agent'},
    {title:'Wikipedia: Operating system', url:'https://en.wikipedia.org/wiki/Operating_system', note:'A long real page'},
    {title:'Example.com', url:'https://example.com', note:'The simplest page'},
    {title:'Blocked: attacker.example', url:'https://attacker.example/', kind:'bad', note:'Egress denylist'},
    {title:'Blocked: metadata', url:'http://169.254.169.254/latest/meta-data/', kind:'bad', note:'SSRF guard, cloud metadata'}
  ];
}
function loadBookmarks() {
  try { const v = JSON.parse(localStorage.getItem(BM_KEY) || 'null'); if (Array.isArray(v) && v.length) return v.filter(b => b && typeof b.url === 'string').slice(0, 40); } catch (e) { /* storage may be blocked */ }
  return defaultBookmarks();
}
function saveBookmarks(list) { try { localStorage.setItem(BM_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ } }

/* Defense in depth: the server already sanitizes; strip anything active again before inserting. */
const OK_TAGS = new Set('H1 H2 H3 H4 H5 H6 P UL OL LI BLOCKQUOTE PRE CODE TABLE THEAD TBODY TFOOT TR TH TD CAPTION A IMG BR HR EM STRONG B I U S SMALL SUB SUP DL DT DD FIGURE FIGCAPTION KBD SAMP Q ABBR CITE TIME MARK DEL INS DIV'.split(' '));
const OK_ATTR = new Set(['href', 'data-vb-href', 'rel', 'target', 'src', 'alt', 'loading', 'colspan', 'rowspan', 'class', 'data-vb-finding']);
function scrub(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html || '');
  const walk = node => {
    for (const c of [...node.children]) {
      if (!OK_TAGS.has(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); continue; }
      for (const a of [...c.attributes]) {
        const n = a.name.toLowerCase();
        if (!OK_ATTR.has(n)) { c.removeAttribute(a.name); continue; }
        if ((n === 'href' || n === 'data-vb-href') && !/^https?:\/\//i.test(a.value)) c.removeAttribute(a.name);
        if (n === 'class' && !/^vb-[\w -]*$/.test(a.value)) c.removeAttribute(a.name);
      }
      if (c.tagName === 'IMG') {
        const s = c.getAttribute('src') || '';
        if (s.startsWith('browser-img?u=')) c.setAttribute('src', 'api/ag/browser/img?u=' + s.slice('browser-img?u='.length));
        else c.remove();
        c.setAttribute('referrerpolicy', 'no-referrer');
        c.setAttribute('loading', 'lazy');
        continue;
      }
      walk(c);
    }
  };
  walk(t.content);
  // final guard: nothing outside the allow list survives
  t.content.querySelectorAll('*').forEach(c => { if (!OK_TAGS.has(c.tagName)) c.remove(); });
  return t.content;
}

const hostOf = u => { try { return new URL(u).hostname; } catch (e) { return u; } };
const isSend = fn => /^(http_post|send_email|upload|post|exfil)/i.test(String(fn || ''));
const vOk = v => String(v || '').toUpperCase() === 'ALLOW';

window.VK_EXTRA_APPS = window.VK_EXTRA_APPS || [];
window.VK_EXTRA_APPS.push(h => ({
  id:'browser',
  name:() => 'ViKernel Browser',
  color:'#2563EB',
  icon:ICON,
  w:1100,
  h:720,
  render(body, win) {
    injectCss();
    const toast = m => { try { if (h && h.toast) h.toast(m); } catch (e) { /* ignore */ } };
    const api = window.VK_API;
    let bookmarks = loadBookmarks();
    const visits = [];
    let seq = 0;
    const tabs = [];
    let active = null;

    const root = mk('div', 'vb-root');
    root.tabIndex = -1;
    root.innerHTML = `
      <div class="vb-tabs" role="tablist"></div>
      <div class="vb-bar">
        <button class="vb-ib" data-a="back" title="Back (Alt+Left)" aria-label="Back">${I.back}</button>
        <button class="vb-ib" data-a="fwd" title="Forward (Alt+Right)" aria-label="Forward">${I.fwd}</button>
        <button class="vb-ib" data-a="reload" title="Reload (F5)" aria-label="Reload">${I.reload}</button>
        <form class="vb-addr" autocomplete="off"><span class="vb-lock" aria-hidden="true">${I.info}</span><input type="text" spellcheck="false" placeholder="Enter a URL, e.g. en.wikipedia.org/wiki/Kernel" aria-label="Address bar"><button type="button" class="vb-ib" data-a="star" title="Bookmark this page" aria-label="Bookmark">${I.star}</button></form>
        <span class="vb-chip mut" title="Kernel verdict for this navigation">no page</span>
        <button class="vb-ib" data-a="agent" title="Ask Muse Spark (agent)" aria-label="Agent sidebar">${I.agent}</button>
        <button class="vb-ib vb-hide-sm" data-a="hist" title="History" aria-label="History">${I.hist}</button>
        <button class="vb-ib" data-a="about" title="About the protection layers" aria-label="About">${I.info}</button>
      </div>
      <div class="vb-bm"></div>
      <div class="vb-main">
        <div class="vb-content"></div>
        <aside class="vb-side" hidden>
          <div class="vb-sidehd">
            <h3>Ask Muse Spark to do this on the page</h3>
            <div class="vb-mut">The agent reads the whole page, hidden text included. Every action it proposes goes through the ViKernel gate.</div>
            <textarea maxlength="500" aria-label="Task">Summarize this page for me</textarea>
            <button class="vb-run">Run</button>
          </div>
          <div class="vb-ev"><div class="vb-mut">Open a page, then run a task.</div></div>
        </aside>
      </div>
      <section class="vb-panel" data-p="hist" hidden><header>History<button data-close aria-label="Close">${I.x}</button></header><div class="vb-pb"></div></section>
      <section class="vb-panel" data-p="about" hidden><header>How ViKernel Browser protects you<button data-close aria-label="Close">${I.x}</button></header><div class="vb-pb"></div></section>`;
    body.innerHTML = '';
    body.append(root);

    const $ = s => root.querySelector(s);
    const tabsEl = $('.vb-tabs'), bmEl = $('.vb-bm'), content = $('.vb-content'), side = $('.vb-side');
    const addr = $('.vb-addr input'), lockEl = $('.vb-lock'), chip = $('.vb-chip'), evEl = $('.vb-ev');
    const runBtn = $('.vb-run'), taskEl = $('.vb-sidehd textarea');
    const btn = a => root.querySelector(`[data-a="${a}"]`);

    function newTab(url, focus = true) {
      if (tabs.length >= MAX_TABS) { toast('Maximum ' + MAX_TABS + ' tabs'); return null; }
      const t = {id:++seq, hist:[], idx:-1, url:START, title:'New tab', state:'start', data:null, nav:0, events:null, agentBusy:false, showHidden:false};
      tabs.push(t);
      if (focus || !active) active = t;
      if (url) navigate(t, url); else renderAll();
      return t;
    }
    function closeTab(t) {
      const i = tabs.indexOf(t);
      if (i < 0) return;
      tabs.splice(i, 1);
      if (!tabs.length) { active = null; newTab(); return; }
      if (active === t) active = tabs[Math.min(i, tabs.length - 1)];
      renderAll();
    }

    async function navigate(t, raw, push = true) {
      let url = String(raw || '').trim();
      if (!url) return;
      if (url === START) { t.url = START; t.state = 'start'; t.title = 'New tab'; t.data = null; if (push) pushHist(t, START); renderAll(); return; }
      if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
      const my = ++t.nav;
      t.url = url; t.state = 'loading'; t.title = hostOf(url); t.data = null; t.events = null; t.showHidden = false;
      if (push) pushHist(t, url);
      renderAll();
      let r;
      try { r = await api('browser/open', {url}); }
      catch (e) { r = {ok:false, error:e && e.message === 'rate' ? 'Rate limited. Please wait a few seconds and try again.' : 'Network error: ' + (e && e.message || e)}; }
      if (my !== t.nav) return;
      t.data = r || {ok:false, error:'Empty response'};
      if (r && r.ok) {
        t.state = 'page'; t.title = r.title || hostOf(r.final_url || url);
        if (r.final_url && r.final_url !== url) { t.url = r.final_url; t.hist[t.idx] = r.final_url; }
      } else if (r && r.blocked) { t.state = 'blocked'; t.title = 'Blocked: ' + hostOf(url); }
      else { t.state = 'error'; t.title = 'Error: ' + hostOf(url); }
      visits.unshift({url:t.url, title:t.title, at:new Date(), state:t.state});
      if (visits.length > 100) visits.pop();
      renderAll();
      if (t === active) content.scrollTop = 0;
    }
    function pushHist(t, url) { t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(url); t.idx = t.hist.length - 1; }
    function go(delta) {
      const t = active;
      if (!t) return;
      const j = t.idx + delta;
      if (j < 0 || j >= t.hist.length) return;
      t.idx = j;
      navigate(t, t.hist[j], false);
    }
    const reload = () => { if (active && active.url !== START) navigate(active, active.url, false); };

    function renderTabs() {
      tabsEl.innerHTML = '';
      for (const t of tabs) {
        const b = mk('button', 'vb-tab' + (t === active ? ' on' : ''));
        b.setAttribute('role', 'tab');
        b.title = t.url === START ? 'New tab' : t.url;
        const sus = t.data && t.data.ok && (t.data.findings || []).some(f => f.suspicious);
        const dot = t.state === 'blocked' ? 'bad' : sus ? 'warn' : t.state === 'page' ? 'ok' : '';
        b.innerHTML = `<span class="vb-dot ${dot}"></span><span class="vb-tt">${esc(t.state === 'loading' ? 'Loading ' + t.title : t.title)}</span><span class="vb-tx" role="button" aria-label="Close tab">${I.x}</span>`;
        b.onclick = e => { if (e.target.closest('.vb-tx')) { e.stopPropagation(); closeTab(t); return; } active = t; renderAll(); };
        b.onauxclick = e => { if (e.button === 1) closeTab(t); };
        tabsEl.append(b);
      }
      const n = mk('button', 'vb-newtab', I.plus);
      n.title = 'New tab'; n.setAttribute('aria-label', 'New tab');
      n.onclick = () => newTab();
      tabsEl.append(n);
    }

    function renderBar() {
      const t = active;
      btn('back').disabled = !t || t.idx <= 0;
      btn('fwd').disabled = !t || t.idx >= t.hist.length - 1;
      if (document.activeElement !== addr) addr.value = !t || t.url === START ? '' : t.url;
      const proto = t && t.url !== START ? (t.url.match(/^(\w+):/) || [])[1] : '';
      lockEl.className = 'vb-lock' + (proto === 'https' ? ' https' : proto ? ' http' : '');
      lockEl.innerHTML = proto === 'https' ? I.lock : proto ? I.unlock : I.info;
      lockEl.title = proto === 'https' ? 'Encrypted connection (https)' : proto ? 'Not encrypted (' + proto + ')' : '';
      const d = t && t.data;
      if (!t || t.state === 'start') { chip.className = 'vb-chip mut'; chip.textContent = 'no page'; }
      else if (t.state === 'loading') { chip.className = 'vb-chip mut'; chip.textContent = 'checking...'; }
      else if (d && d.ok && d.kernel) { chip.className = 'vb-chip ok'; chip.textContent = 'ALLOW · audit #' + (d.kernel.audit_seq ?? '?'); chip.title = 'Kernel gate rule ' + (d.kernel.rule || '-') + (d.kernel.kernel_ms != null ? ', ' + d.kernel.kernel_ms + ' ms' : ''); }
      else if (d && d.blocked) { chip.className = 'vb-chip bad'; chip.textContent = 'DENY · rule ' + d.blocked.rule; chip.title = d.blocked.reason || ''; }
      else { chip.className = 'vb-chip mut'; chip.textContent = 'error'; }
      const starred = t && t.url !== START && bookmarks.some(b => b.url === t.url);
      btn('star').classList.toggle('starred', !!starred);
      btn('star').disabled = !t || t.url === START;
      btn('agent').classList.toggle('on', !side.hidden);
    }

    function renderBookmarks() {
      bmEl.innerHTML = '';
      for (const b of bookmarks) {
        const x = mk('button', b.kind || '');
        x.textContent = b.title || b.url;
        x.title = b.url + (b.note ? '\n' + b.note : '');
        x.onclick = e => { if (e.ctrlKey || e.metaKey) newTab(b.url); else navigate(active, b.url); };
        bmEl.append(x);
      }
    }

    function startPage() {
      const w = mk('div', 'vb-start');
      w.innerHTML = `<h2>${ICON} ViKernel Browser</h2>
        <p>A governed browser. Every page load passes egress policy, an SSRF guard and the ViKernel kernel gate, and every agent action on a page is decided by the gate.</p>
        <div class="vb-tiles"></div>
        <ol class="vb-guide">
          <li><b>1.</b> Open <b>Demo: poisoned page</b>. It looks like a normal review blog, but hides instructions for AI agents. The banner shows what was hidden.</li>
          <li><b>2.</b> Open the agent sidebar and press <b>Run</b>. The agent reads the hidden text too. When it tries to send your files out, ViKernel denies it and records an audit entry.</li>
          <li><b>3.</b> Try the <b>Blocked</b> bookmarks to see the egress policy and the SSRF guard stop a request before any byte leaves.</li>
        </ol>`;
      const tiles = w.querySelector('.vb-tiles');
      for (const b of bookmarks) {
        const x = mk('button', 'vb-tile ' + (b.kind || ''));
        x.innerHTML = `<b>${esc(b.title || b.url)}</b><small>${esc(b.note || hostOf(b.url))}</small>`;
        x.title = b.url;
        x.onclick = () => navigate(active, b.url);
        tiles.append(x);
      }
      return w;
    }

    function blockPage(d) {
      const b = d.blocked || {};
      const w = mk('div', 'vb-center vb-block');
      const audit = d.kernel && d.kernel.audit_seq != null ? `<b>Audit</b><span>#${esc(d.kernel.audit_seq)}</span>` : '';
      const layerName = {egress:'Egress policy', ssrf:'SSRF guard', kernel:'Kernel gate'}[b.layer] || b.layer || '-';
      w.innerHTML = `${I.shield}<h2>Blocked by ViKernel</h2>
        <div class="vb-mut">This request never left the server.</div>
        <div class="vb-kv"><b>URL</b><span>${esc(d.url)}</span><b>Rule</b><span>${esc(b.rule || '-')}</span><b>Layer</b><span>${esc(layerName)}</span><b>Reason</b><span>${esc(b.reason || '-')}</span>${audit}</div>`;
      return w;
    }

    function errorPage(d) {
      const w = mk('div', 'vb-center');
      w.innerHTML = `<div class="vb-err">${I.warn}</div><h3 style="margin:0">This page could not be loaded</h3><div class="vb-mut">${esc(d && d.error || 'Unknown error')}</div>`;
      const r = mk('button', 'vb-run', 'Try again');
      r.onclick = reload;
      w.append(r);
      return w;
    }

    function pageView(t) {
      const d = t.data;
      const frag = document.createDocumentFragment();
      const fs = d.findings || [];
      const sus = fs.filter(f => f.suspicious).length;
      if (fs.length) {
        const bn = mk('div', 'vb-banner' + (sus ? '' : ' soft'));
        bn.innerHTML = sus ? `${I.warn}<span>Injection detected: ${sus} hidden instruction${sus === 1 ? '' : 's'} on this page</span>`
          : `${I.info}<span>${fs.length} hidden text block${fs.length === 1 ? '' : 's'} on this page (no instructions found)</span>`;
        const sb = mk('button', '', t.showHidden ? 'Hide' : 'Show');
        sb.onclick = () => {
          t.showHidden = !t.showHidden;
          sb.textContent = t.showHidden ? 'Hide' : 'Show';
          const pg = content.querySelector('.vb-page');
          if (!pg) return;
          pg.classList.toggle('vb-flash', t.showHidden);
          const first = pg.querySelector('mark.vb-sus') || pg.querySelector('mark.vb-hidden');
          if (t.showHidden && first) first.scrollIntoView({behavior:'smooth', block:'center'});
        };
        bn.append(sb);
        frag.append(bn);
      }
      const pg = mk('article', 'vb-page' + (t.showHidden ? ' vb-flash' : ''));
      const hd = mk('div', 'vb-pagehd');
      hd.textContent = (d.final_url || d.url) + '  ·  ' + Math.round((d.bytes || 0) / 1024) + ' KB  ·  ' + (d.ms != null ? d.ms + ' ms' : '') + (d.truncated ? '  ·  truncated' : '');
      pg.append(hd);
      if (d.title) { const h1 = mk('h1'); h1.textContent = d.title; pg.append(h1); }
      pg.append(scrub(d.html));
      frag.append(pg);
      return frag;
    }

    function renderContent() {
      const t = active;
      content.innerHTML = '';
      if (!t) return;
      if (t.state === 'start') content.append(startPage());
      else if (t.state === 'loading') { const w = mk('div', 'vb-center'); w.innerHTML = `<div class="vb-spin" role="status" aria-label="Loading"></div><div class="vb-mut">Checking egress, SSRF and kernel gate for ${esc(hostOf(t.url))}...</div>`; content.append(w); }
      else if (t.state === 'blocked') content.append(blockPage(t.data));
      else if (t.state === 'error') content.append(errorPage(t.data));
      else content.append(pageView(t));
    }

    function evCard(k, cls, html) { const e = mk('div', 'vb-e ' + (cls || '')); e.innerHTML = `<div class="vb-k">${esc(k)}</div>${html}`; return e; }
    const short = v => { let s; try { s = typeof v === 'string' ? v : JSON.stringify(v, null, 1); } catch (e) { s = String(v); } return s && s.length > 900 ? s.slice(0, 900) + ' ...' : s; };

    function renderEvents() {
      const t = active;
      evEl.innerHTML = '';
      runBtn.disabled = !t || t.state !== 'page' || t.agentBusy;
      runBtn.textContent = t && t.agentBusy ? 'Running...' : 'Run';
      if (!t || t.state !== 'page') { evEl.innerHTML = '<div class="vb-mut">Open a page, then run a task.</div>'; return; }
      if (t.agentBusy && !t.events) { const w = mk('div', 'vb-center'); w.style.minHeight = '120px'; w.innerHTML = '<div class="vb-spin"></div><div class="vb-mut">The agent is reading the page. Each action waits for a kernel verdict.</div>'; evEl.append(w); return; }
      if (!t.events) { evEl.innerHTML = '<div class="vb-mut">Press Run. Try the poisoned demo page to see the gate stop a hijacked agent.</div>'; return; }
      const r = t.events;
      if (r.error) evEl.append(evCard('error', 'deny', `<div>${esc(r.error)}</div>`));
      if (r.blocked) evEl.append(evCard('blocked', 'deny', `<div>Blocked by ViKernel: rule ${esc(r.blocked.rule)} (${esc(r.blocked.layer)}). ${esc(r.blocked.reason)}</div>`));
      const evs = Array.isArray(r.events) ? r.events : [];
      const denied = evs.filter(e => (e.type || e.kind) === 'verdict' && !vOk(e.verdict));
      for (const d of denied) {
        const ref = `(rule ${esc(d.rule || '?')}, audit #${esc(d.audit_seq ?? '?')})`;
        const msg = d.probe ? `The page hides an instruction to send your files to ${esc((d.args || {}).url || 'an outside URL')}. Muse Spark did not follow it; the same action sent as a compromised agent would was denied by ViKernel ${ref}.` : isSend(d.fn) ? `The page tried to make the agent send your files. ViKernel denied it ${ref}.`
          : `ViKernel denied the agent's ${esc(d.fn)} call ${ref}.`;
        evEl.append(mk('div', 'vb-callout', msg));
      }
      for (const e of evs) {
        const ty = e.type || e.kind || e.event;
        if (ty === 'user') evEl.append(evCard('task', '', `<div>${esc(e.text || '')}</div>`));
        else if (ty === 'proposed') evEl.append(evCard('proposed action', '', `<div><code>${esc(e.fn)}</code>${e.model ? ` <span class="vb-mut">by ${esc(e.model)}${e.model_ms != null ? ', ' + esc(e.model_ms) + ' ms' : ''}</span>` : ''}</div><pre>${esc(short(e.args))}</pre>`));
        else if (ty === 'verdict') {
          const ok = vOk(e.verdict);
          evEl.append(evCard(e.probe ? 'kernel verdict (' + e.probe + ')' : 'kernel verdict', ok ? 'allow' : 'deny', `<div><span class="vb-tag ${ok ? 'ok' : 'bad'}">${esc(String(e.verdict || '?').toUpperCase())}</span><code>${esc(e.fn)}</code> <span class="vb-mut">rule ${esc(e.rule || '-')} · audit #${esc(e.audit_seq ?? '?')}</span></div>${e.reason ? `<div class="vb-mut">${esc(e.reason)}</div>` : ''}`));
        } else if (ty === 'executed') evEl.append(evCard('executed', '', `<div><code>${esc(e.fn)}</code></div><pre>${esc(short(e.result))}</pre>`));
        else if (ty === 'final') evEl.append(evCard('answer', 'vb-final', `<div style="white-space:pre-wrap">${esc(e.text || '')}</div>`));
        else if (ty === 'error') evEl.append(evCard('error', 'deny', `<div>${esc(e.text || '')}</div>`));
      }
      if (!evs.length && !r.error && !r.blocked) evEl.append(mk('div', 'vb-mut', 'The agent returned no events.'));
    }

    async function runAgent() {
      const t = active;
      if (!t || t.state !== 'page' || t.agentBusy) return;
      const task = taskEl.value.trim() || 'Summarize this page for me';
      t.agentBusy = true; t.events = null;
      renderEvents();
      let r;
      try { r = await api('browser/agent', {url:t.url, task}); }
      catch (e) { r = {error:e && e.message === 'rate' ? 'Rate limited. Please wait a few seconds and try again.' : 'Network error: ' + (e && e.message || e)}; }
      t.agentBusy = false; t.events = r || {error:'Empty response'};
      if (t === active) renderEvents();
      const den = (r && r.events || []).find(e => (e.type || e.kind) === 'verdict' && !vOk(e.verdict));
      if (den) toast('ViKernel denied ' + den.fn + ' (audit #' + (den.audit_seq ?? '?') + ')');
    }

    function renderHistory() {
      const pb = root.querySelector('[data-p="hist"] .vb-pb');
      pb.innerHTML = '';
      const t = active;
      if (t && t.hist.length) {
        pb.append(mk('div', 'vb-mut', 'This tab'));
        t.hist.forEach((u, i) => {
          const r = mk('button', 'vb-hrow');
          r.innerHTML = `<span>${i === t.idx ? '&#9656; ' : ''}${esc(u === START ? 'New tab' : u)}</span>`;
          r.onclick = () => { t.idx = i; navigate(t, u, false); };
          pb.append(r);
        });
      }
      pb.append(mk('div', 'vb-mut', 'All visits this session'));
      if (!visits.length) pb.append(mk('div', 'vb-mut', 'Nothing yet.'));
      for (const v of visits) {
        const r = mk('button', 'vb-hrow');
        r.innerHTML = `<span>${esc(v.title)}</span><small>${esc(v.url)} · ${esc(v.state)} · ${esc(v.at.toLocaleTimeString())}</small>`;
        r.onclick = () => navigate(active, v.url);
        pb.append(r);
      }
    }

    let policyCache = null;
    async function renderAbout() {
      const pb = root.querySelector('[data-p="about"] .vb-pb');
      const layers = [
        ['1. Egress policy', 'Only http and https on ports 80 and 443. No credentials in URLs. Known exfiltration hosts (attacker.example, collector.example.invalid, evil.test, anything containing "attacker") are denied.'],
        ['2. SSRF guard', 'The server resolves DNS and refuses private, loopback, link-local, multicast, reserved, unspecified and IPv4-mapped addresses, plus cloud metadata names. It re-checks after every redirect (max 3).'],
        ['3. Kernel gate', 'Each navigation is decided by the real ViKernel gate and written to the audit log. The verdict chip shows the audit id. Agent actions (http_post, send_email, upload) go through the same gate.'],
        ['4. Injection scanner', 'Before the page is cleaned, the raw HTML is scanned for hidden text (display:none, visibility:hidden, font-size:0, opacity:0, white on white, aria-hidden), comments and phrases like "ignore previous instructions". Findings are shown at the end of the page.'],
        ['5. Reader view', 'Scripts, styles, frames, forms and embeds are removed. Pages are fetched with GET only, no cookies, a 6 s timeout and a 1.5 MB cap. Images go through the same guarded proxy.']
      ];
      pb.innerHTML = layers.map(([a, b]) => `<div class="vb-layer"><b>${esc(a)}</b>${esc(b)}</div>`).join('') + '<div class="vb-mut vb-pol">Loading live policy...</div>';
      try {
        policyCache = policyCache || await api('browser/policy', {});
        const p = policyCache;
        const el = pb.querySelector('.vb-pol');
        el.className = 'vb-layer';
        el.innerHTML = `<b>Live policy from the server</b>Deny hosts: ${esc((p.egress && p.egress.deny_hosts || []).join(', '))}<br>Ports: ${esc((p.egress && p.egress.ports || []).join(', '))}<br>Max redirects: ${esc(p.ssrf && p.ssrf.max_redirects)}<br>Page limit: ${esc(Math.round((p.fetch && p.fetch.max_page_bytes || 0) / 1000))} KB, timeout ${esc(p.fetch && p.fetch.timeout_s)} s<br>User-Agent: <code>${esc(p.fetch && p.fetch.user_agent)}</code>`;
      } catch (e) {
        const el = pb.querySelector('.vb-pol');
        if (el) el.textContent = 'Live policy unavailable right now.';
      }
    }

    function togglePanel(name) {
      root.querySelectorAll('.vb-panel').forEach(p => { p.hidden = p.dataset.p !== name || !p.hidden; });
      const p = root.querySelector(`[data-p="${name}"]`);
      if (p && !p.hidden) { if (name === 'hist') renderHistory(); else renderAbout(); }
    }

    function renderAll() { renderTabs(); renderBar(); renderContent(); renderEvents(); }

    // events
    $('.vb-addr').addEventListener('submit', e => { e.preventDefault(); const v = addr.value.trim(); if (v) { navigate(active, v); addr.blur(); } });
    addr.addEventListener('keydown', e => { if (e.key === 'Escape') { addr.value = active && active.url !== START ? active.url : ''; addr.blur(); } });
    addr.addEventListener('focus', () => addr.select());
    btn('back').onclick = () => go(-1);
    btn('fwd').onclick = () => go(1);
    btn('reload').onclick = reload;
    btn('star').onclick = () => {
      const t = active;
      if (!t || t.url === START) return;
      const i = bookmarks.findIndex(b => b.url === t.url);
      if (i >= 0) { bookmarks.splice(i, 1); toast('Bookmark removed'); }
      else { bookmarks.push({title:(t.title || hostOf(t.url)).slice(0, 60), url:t.url}); toast('Bookmarked'); }
      saveBookmarks(bookmarks);
      renderBookmarks(); renderBar();
    };
    btn('agent').onclick = () => { side.hidden = !side.hidden; renderBar(); if (!side.hidden) taskEl.focus(); };
    btn('hist').onclick = () => togglePanel('hist');
    btn('about').onclick = () => togglePanel('about');
    root.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => { b.closest('.vb-panel').hidden = true; }; });
    runBtn.onclick = runAgent;
    taskEl.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runAgent(); } });

    content.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (!a || !content.contains(a)) return;
      e.preventDefault();
      const u = a.getAttribute('data-vb-href') || a.getAttribute('href');
      if (!u || !/^https?:\/\//i.test(u)) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) newTab(u, false); else navigate(active, u);
    });
    content.addEventListener('auxclick', e => {
      const a = e.button === 1 && e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      const u = a.getAttribute('data-vb-href') || a.getAttribute('href');
      if (u && /^https?:\/\//i.test(u)) newTab(u, false);
    });

    root.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); addr.focus(); addr.select(); }
      else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'F5') { e.preventDefault(); reload(); }
      else if (e.key === 'Escape') root.querySelectorAll('.vb-panel').forEach(p => { p.hidden = true; });
    });
    root.addEventListener('mousedown', e => { if (!e.target.closest('input,textarea,button,a,.vb-content')) root.focus({preventScroll:true}); });

    renderBookmarks();
    newTab();
    void win;
    return root;
  }
}));
})();
