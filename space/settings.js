/* ViKernel Desktop: System Settings app. Non-critical settings change here;
   critical ones are sent to the real ViKernel gate, which denies them. */
(() => {
'use strict';
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
const LANG = LS.get('vk_lang', 'en') === 'ko' ? 'ko' : 'en';
const STR = {
  en: {
    title: 'System Settings', about: 'About', model: 'Model & kernel', sec: 'Security & privacy', net: 'Network egress',
    pol: 'Policies', kill: 'Kill switch', audit: 'Audit', look: 'Appearance', apps: 'Apps', upd: 'Updates',
    loading: 'Loading...', err: 'Could not reach the backend. It may be starting; try again.', rate: 'Too many requests. Wait a moment.',
    retry: 'Retry', locked: 'Locked by ViKernel', needKey: 'requires a signed operator key', close: 'Close',
    asking: 'Asking the kernel...', verdict: 'Verdict', rule: 'rule', auditN: 'audit #',
  },
  ko: {
    title: '시스템 설정', about: '정보', model: '모델과 커널', sec: '보안과 개인정보', net: '외부 접속',
    pol: '정책', kill: '킬 스위치', audit: '감사 기록', look: '화면', apps: '앱', upd: '업데이트',
    loading: '불러오는 중...', err: '백엔드에 닿지 못했습니다. 시작 중일 수 있습니다. 다시 시도하십시오.', rate: '요청이 너무 많습니다. 잠시 기다리십시오.',
    retry: '다시 시도', locked: 'ViKernel 이 잠금', needKey: '서명된 운영자 키가 필요합니다', close: '닫기',
    asking: '커널에 묻는 중...', verdict: '판정', rule: '규칙', auditN: '감사 #',
  },
};
const T = k => (STR[LANG][k] || STR.en[k] || k);

/* Appearance: apply on load */
const ACCENTS = ['#4338CA', '#0EA5E9', '#10B981', '#F43F5E', '#F59E0B', '#7C3AED'];
const WALLS = {
  aurora: 'linear-gradient(135deg,#c7d2fe 0%,#e0e7ff 40%,#cffafe 100%)',
  dusk: 'linear-gradient(160deg,#312e81 0%,#7c3aed 55%,#f43f5e 100%)',
  slate: 'linear-gradient(180deg,#0f172a 0%,#334155 100%)',
};
function applyTheme() {
  const t = LS.get('vk_theme', 'system');
  const dark = t === 'dark' || (t === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}
function applyLook() {
  applyTheme();
  const a = LS.get('vk_accent', '');
  if (a && ACCENTS.includes(a)) document.documentElement.style.setProperty('--indigo', a);
  const w = LS.get('vk_wall', '');
  const d = document.getElementById('desk');
  if (d && WALLS[w]) d.style.background = WALLS[w];
}
applyLook();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLook);
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (e) {}

const css = `
.vs2-root{display:flex;height:100%;min-height:0;font-size:13px;color:var(--vs2-fg);background:var(--vs2-bg);
 --vs2-bg:#fff;--vs2-fg:#0f172a;--vs2-mut:#64748b;--vs2-line:#e2e8f0;--vs2-side:#f8fafc;--vs2-card:#fff;--vs2-soft:#f1f5f9}
[data-theme=dark] .vs2-root{--vs2-bg:#0f172a;--vs2-fg:#e2e8f0;--vs2-mut:#94a3b8;--vs2-line:#334155;--vs2-side:#111827;--vs2-card:#1e293b;--vs2-soft:#1e293b}
.vs2-side{width:210px;flex:none;background:var(--vs2-side);border-right:1px solid var(--vs2-line);padding:10px 8px;overflow:auto;outline:none}
.vs2-nav{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.vs2-nav:hover{background:var(--vs2-soft)}.vs2-nav.on{background:var(--indigo);color:#fff}
.vs2-nav:focus-visible{outline:2px solid var(--indigo);outline-offset:1px}
.vs2-main{flex:1;min-width:0;overflow:auto;padding:18px 22px}
.vs2-main h2{margin:0 0 4px;font-size:20px}.vs2-sub{color:var(--vs2-mut);margin:0 0 14px}
.vs2-card{background:var(--vs2-card);border:1px solid var(--vs2-line);border-radius:12px;padding:12px 14px;margin-bottom:12px}
.vs2-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--vs2-line)}.vs2-row:last-child{border-bottom:0}
.vs2-row .vs2-k{flex:1;min-width:0}.vs2-row small{display:block;color:var(--vs2-mut)}
.vs2-mono{font-family:ui-monospace,Consolas,monospace;font-size:12px;word-break:break-all}
.vs2-btn{border:1px solid var(--vs2-line);background:var(--vs2-card);color:inherit;border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer}
.vs2-btn:hover{border-color:var(--indigo)}.vs2-btn.pri{background:var(--indigo);border-color:var(--indigo);color:#fff}
.vs2-btn.dng{background:#e11d48;border-color:#e11d48;color:#fff}.vs2-btn:disabled{opacity:.5;cursor:default}
.vs2-sw{position:relative;width:40px;height:22px;flex:none;border-radius:11px;border:0;background:#cbd5e1;cursor:pointer;transition:background .15s}
.vs2-sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}
.vs2-sw[aria-checked=true]{background:var(--indigo)}.vs2-sw[aria-checked=true]::after{left:21px}.vs2-sw:disabled{opacity:.5}
.vs2-lockrow{cursor:pointer}.vs2-lockrow:hover{background:var(--vs2-soft)}
.vs2-lk{display:inline-flex;align-items:center;gap:4px;color:#b45309;font-weight:600;font-size:12px}
.vs2-pill{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:700;font-size:12px}
.vs2-ok{background:#d1fae5;color:#065f46}.vs2-bad{background:#ffe4e6;color:#9f1239}.vs2-unk{background:var(--vs2-soft);color:var(--vs2-mut)}
.vs2-radio{display:block;width:100%;text-align:left;border:2px solid var(--vs2-line);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--vs2-card);color:inherit;font:inherit;cursor:pointer}
.vs2-radio.on{border-color:var(--indigo)}
.vs2-in{border:1px solid var(--vs2-line);border-radius:8px;padding:6px 10px;font:inherit;background:var(--vs2-bg);color:inherit;min-width:0}
.vs2-swatch{width:26px;height:26px;border-radius:50%;border:2px solid transparent;cursor:pointer}.vs2-swatch.on{border-color:var(--vs2-fg)}
.vs2-wall{width:70px;height:44px;border-radius:8px;border:2px solid transparent;cursor:pointer}.vs2-wall.on{border-color:var(--indigo)}
.vs2-note{color:var(--vs2-mut);font-size:12px;margin-top:6px}.vs2-res{margin-top:8px;font-size:12px}
.vs2-table{width:100%;border-collapse:collapse}.vs2-table td,.vs2-table th{text-align:left;padding:6px;border-bottom:1px solid var(--vs2-line);vertical-align:top}
.vs2-empty{text-align:center;padding:30px 10px;color:var(--vs2-mut)}
.vs2-modal{position:absolute;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:5}
.vs2-dlg{background:var(--vs2-card);color:var(--vs2-fg);border-radius:14px;padding:20px;width:min(420px,92%);box-shadow:0 20px 50px rgba(0,0,0,.3);text-align:center}
.vs2-dlg svg{color:#b45309}
.vs2-back{display:none}
@media (max-width:640px){.vs2-root{display:block;overflow:auto}.vs2-side{width:auto;border-right:0}
 .vs2-root.vs2-detail .vs2-side{display:none}.vs2-root:not(.vs2-detail) .vs2-main{display:none}
 .vs2-back{display:inline-block;margin-bottom:10px}.vs2-main{padding:14px 16px}}
`;
const LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const GEAR = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api = (p, b) => window.VK_API(p, b === undefined ? undefined : Object.assign({session: window.VK_SID}, b));
const errMsg = e => (e && e.message === 'rate') ? T('rate') : T('err');
const kv = k => k ? `${T('verdict')}: <b>${esc(k.verdict)}</b> · ${T('rule')} ${esc(k.rule)}${k.audit_seq != null ? ' · ' + T('auditN') + esc(k.audit_seq) : ''}` : '';

window.VK_EXTRA_APPS = window.VK_EXTRA_APPS || [];
window.VK_EXTRA_APPS.push(h => ({
  id: 'settings', name: () => T('title'), color: '#64748B', icon: GEAR, w: 980, h: 680,
  render(body, win) {
    if (!document.getElementById('vs2-style')) {
      const st = document.createElement('style'); st.id = 'vs2-style'; st.textContent = css; document.head.appendChild(st);
    }
    const SECS = ['about', 'model', 'sec', 'net', 'pol', 'kill', 'audit', 'look', 'apps', 'upd'];
    let cur = LS.get('vk_settings_sec', 'about'); if (!SECS.includes(cur)) cur = 'about';
    let data = null;
    body.innerHTML = '';
    body.style.position = 'relative';
    const root = document.createElement('div'); root.className = 'vs2-root';
    const side = document.createElement('nav'); side.className = 'vs2-side'; side.setAttribute('role', 'tablist'); side.setAttribute('aria-label', T('title'));
    const main = document.createElement('section'); main.className = 'vs2-main'; main.setAttribute('role', 'tabpanel');
    root.append(side, main); body.appendChild(root);
    const toast = m => { try { h.toast(m); } catch (e) {} };

    SECS.forEach(id => {
      const b = document.createElement('button'); b.className = 'vs2-nav'; b.dataset.id = id; b.setAttribute('role', 'tab');
      b.textContent = T(id); b.onclick = () => go(id, true); side.appendChild(b);
    });
    side.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const i = SECS.indexOf(cur), n = (i + (e.key === 'ArrowDown' ? 1 : SECS.length - 1)) % SECS.length;
      go(SECS[n], false); side.querySelector(`[data-id="${SECS[n]}"]`).focus();
    });

    function go(id, detail) {
      cur = id; LS.set('vk_settings_sec', id);
      side.querySelectorAll('.vs2-nav').forEach(b => { const on = b.dataset.id === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
      if (detail) root.classList.add('vs2-detail');
      draw();
    }
    async function load() {
      main.innerHTML = `<div class="vs2-empty">${T('loading')}</div>`;
      try { data = await api('settings/get', {}); draw(); }
      catch (e) {
        data = null;
        main.innerHTML = `<div class="vs2-empty">${esc(errMsg(e))}<br><br><button class="vs2-btn pri">${T('retry')}</button></div>`;
        main.querySelector('button').onclick = load;
      }
    }
    function head(title, sub) {
      return `<button class="vs2-btn vs2-back">&larr; ${esc(T('title'))}</button><h2>${esc(title)}</h2>${sub ? `<p class="vs2-sub">${esc(sub)}</p>` : ''}`;
    }
    function lockRow(action, label, sub) {
      return `<div class="vs2-row vs2-lockrow" tabindex="0" role="button" data-lock="${esc(action)}"><div class="vs2-k">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</div><span class="vs2-lk">${LOCK} Locked</span></div>`;
    }
    function wireLocks() {
      main.querySelectorAll('[data-lock]').forEach(r => {
        r.onclick = () => lockedModal(r.dataset.lock);
        r.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lockedModal(r.dataset.lock); } };
      });
      const bk = main.querySelector('.vs2-back'); if (bk) bk.onclick = () => root.classList.remove('vs2-detail');
    }
    function lockedModal(action, pre) {
      const m = document.createElement('div'); m.className = 'vs2-modal';
      m.innerHTML = `<div class="vs2-dlg" role="dialog" aria-modal="true"><div>${LOCK.replace(/14/g, '36')}</div>
        <h3 style="margin:8px 0 4px">${T('locked')}</h3><p style="margin:0 0 10px">${esc(action.replace(/_/g, ' '))}: ${T('needKey')}</p>
        <div class="vs2-res vs2-mono">${pre ? kv(pre.kernel) : T('asking')}</div><br><button class="vs2-btn pri">${T('close')}</button></div>`;
      body.appendChild(m);
      const close = () => m.remove();
      m.querySelector('button').onclick = close; m.onclick = e => { if (e.target === m) close(); };
      m.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
      m.querySelector('button').focus();
      if (pre) return;
      api('settings/locked', {action}).then(r => {
        m.querySelector('.vs2-res').innerHTML = r && r.kernel ? kv(r.kernel) + (r.kernel.reason ? `<br>${esc(r.kernel.reason)}` : '') : esc(T('err'));
      }).catch(e => { m.querySelector('.vs2-res').textContent = errMsg(e); });
    }

    const view = {
      about() {
        const k = data.kernel || {};
        const ok = k.verified === true, halted = String(k.kernel_state || '').toUpperCase().includes('HALT');
        return head(T('about'), 'ViKernel Desktop, a public web demo.') + `<div class="vs2-card">
          <div class="vs2-row"><div class="vs2-k">Version</div><b>${esc(data.version)}</b></div>
          <div class="vs2-row"><div class="vs2-k">Boot status</div><span class="vs2-pill ${halted ? 'vs2-bad' : ok ? 'vs2-ok' : 'vs2-unk'}">${esc(k.kernel_state || 'unknown')}${ok ? ' · verified' : ''}</span></div>
          <div class="vs2-row"><div class="vs2-k">Audit chain head</div><span class="vs2-mono">${esc(String(k.audit_head || '').slice(0, 16))}${k.audit_head ? '...' : 'none'} (${esc(k.audit_n || 0)} entries)</span></div>
          <div class="vs2-row"><div class="vs2-k">Model</div><span>${esc(data.model || 'unknown')}</span></div>
          <div class="vs2-row"><div class="vs2-k">Gate kernel mode<small>Mode B: CPU reference implementation of the ViKernel gate</small></div><b>Mode B</b></div></div>
          <p class="vs2-note">Mode A (kernel inside the weights) is available on the Glimmer option in Agent Guard.</p>`;
      },
      model() {
        const pref = LS.get('vk_model_pref', 'spark');
        const opt = (id, t, s, active) => `<button class="vs2-radio ${pref === id ? 'on' : ''}" data-pref="${id}" role="radio" aria-checked="${pref === id}"><b>${esc(t)}</b>${active ? ' <span class="vs2-pill vs2-ok">active</span>' : ''}<br><small class="vs2-note">${esc(s)}</small></button>`;
        return head(T('model'), 'Which model drives the agent, and where the kernel runs.') +
          opt('spark', 'Meta Muse Spark 1.3 (API) + ViKernel gate', 'Every tool call is decided by the ViKernel gate (Mode B).', true) +
          opt('glimmer_b', 'Meta Muse Glimmer 30B + ViKernel in-weights, Mode B', 'Local open weights, gate on the CPU reference.') +
          opt('glimmer_a', 'Meta Muse Glimmer 30B + ViKernel in-weights, Mode A', 'The kernel runs inside the model weights.') +
          (pref !== 'spark' ? `<div class="vs2-card">Open Agent Guard to use it. <button class="vs2-btn pri" data-open="guard">Open Agent Guard</button></div>` : '');
      },
      sec() {
        const a = data.app;
        if (!a) return head(T('sec'), 'Per-app permissions.') + `<div class="vs2-card vs2-empty">No app is installed in this session.<br><br><button class="vs2-btn pri" data-open="appstore">Open the App Store</button></div>`;
        const rows = a.declared.map(t => { const on = a.current.includes(t);
          return `<div class="vs2-row"><div class="vs2-k"><span class="vs2-mono">${esc(t)}</span><small>${on ? 'Allowed' : 'Revoked: the kernel denies it (rule manifest)'}</small></div><button class="vs2-sw" role="switch" aria-label="${esc(t)}" aria-checked="${on}" data-tool="${esc(t)}"></button></div>`; }).join('');
        return head(T('sec'), 'Like a phone OS: turn off any permission the app declared.') + `<div class="vs2-card"><b>${esc(a.name)}</b> <small class="vs2-note">${esc(a.id)}</small>
          ${rows || '<div class="vs2-empty">This app declared no tools.</div>'}
          ${a.paths.length ? `<div class="vs2-note">File paths: <span class="vs2-mono">${a.paths.map(esc).join(', ')}</span></div>` : ''}
          <div class="vs2-res" id="vs2-permres"></div></div>
          <p class="vs2-note">Try it: Ask the agent in Agent Guard to use this tool; it will be denied (rule manifest).</p>`;
      },
      net() {
        const l = data.settings.egress_allow;
        return head(T('net'), 'The agent may only reach these domains. Everything else is denied (rule egress).') + `<div class="vs2-card">
          ${l.length ? l.map(d => `<div class="vs2-row"><div class="vs2-k vs2-mono">${esc(d)}</div><button class="vs2-btn" data-rm="${esc(d)}">Remove</button></div>`).join('') : '<div class="vs2-empty">The allowlist is empty: all egress is denied.</div>'}
          <div class="vs2-row"><input class="vs2-in" id="vs2-dom" placeholder="docs.python.org" aria-label="Domain" style="flex:1"><button class="vs2-btn pri" id="vs2-add">Add</button></div>
          <div class="vs2-res" id="vs2-netres"></div></div>
          <div class="vs2-card">${lockRow('allow_all_egress', 'Allow all egress', 'Wildcards, IP addresses, localhost and metadata hosts count as this.')}</div>`;
      },
      pol() {
        const p = data.settings.policy;
        const tog = (k, l) => `<div class="vs2-row"><div class="vs2-k">${esc(l)}</div><button class="vs2-sw" role="switch" aria-label="${esc(l)}" aria-checked="${!!p[k]}" data-pol="${k}"></button></div>`;
        return head(T('pol'), 'The rules the kernel enforces on every action.') +
          `<div class="vs2-card"><table class="vs2-table"><tr><th>Rule</th><th>Name</th><th>What it does</th></tr>${data.policies.map(r => `<tr><td><b>${esc(r.id)}</b></td><td>${esc(r.name)}</td><td>${esc(r.desc)}</td></tr>`).join('')}</table></div>
          <div class="vs2-card"><b>Display and agent (not critical)</b>
          ${tog('verbose_audit_view', 'Verbose audit view')}${tog('show_kernel_ms', 'Show kernel time (ms)')}
          <div class="vs2-row"><div class="vs2-k">Agent step limit<small>1 to 12</small></div><input class="vs2-in" type="number" min="1" max="12" id="vs2-steps" value="${esc(p.agent_step_limit)}" style="width:70px"></div>
          <div class="vs2-res" id="vs2-polres"></div></div>
          <div class="vs2-card"><b>Critical rules</b>${data.policies.filter(r => r.critical).map(r => lockRow('lower_policy', 'Turn off rule ' + r.id + ' (' + r.name + ')')).join('')}</div>`;
      },
      kill() {
        const k = data.kernel || {}, halted = String(k.kernel_state || '').toUpperCase().includes('HALT');
        return head(T('kill'), 'The kill switch sits above every app. When halted, every action is denied.') + `<div class="vs2-card">
          <div class="vs2-row"><div class="vs2-k">Kernel state</div><span class="vs2-pill ${halted ? 'vs2-bad' : 'vs2-ok'}" id="vs2-kstate">${esc(k.kernel_state || 'unknown')}</span></div>
          <div class="vs2-row"><div class="vs2-k">Test the kill switch<small>Halts the kernel for this demo. Resume needs the operator key.</small></div><button class="vs2-btn dng" id="vs2-kill">Test kill switch</button></div>
          <div class="vs2-res" id="vs2-killres"></div></div>
          <div class="vs2-card"><b>Operator key</b><p class="vs2-note">The demo key is published in the README for testing. A real deployment keeps it offline.</p>
          <div class="vs2-row"><input class="vs2-in" type="password" id="vs2-key" autocomplete="off" placeholder="operator key" aria-label="Operator key" style="flex:1"><button class="vs2-btn pri" id="vs2-resume">Resume</button></div>
          <div class="vs2-res" id="vs2-resres"></div></div>
          <div class="vs2-card">${lockRow('disable_kill_switch', 'Disable kill switch')}</div>`;
      },
      audit() {
        return head(T('audit'), 'Every kernel decision is sealed in a hash chain.') + `<div class="vs2-card">
          <div class="vs2-row"><div class="vs2-k">Retention</div><span>kept for the session; exported on demand</span></div>
          <div class="vs2-row"><div class="vs2-k">Verify the chain</div><button class="vs2-btn" id="vs2-verify">Verify</button></div>
          <div class="vs2-row"><div class="vs2-k">Export</div><button class="vs2-btn" id="vs2-export">Export JSON</button></div>
          <div class="vs2-res" id="vs2-audres"></div></div>
          <div class="vs2-card">${lockRow('disable_audit', 'Turn off audit')}</div>`;
      },
      look() {
        const t = LS.get('vk_theme', 'system'), a = LS.get('vk_accent', ACCENTS[0]), w = LS.get('vk_wall', '');
        return head(T('look'), 'Saved in this browser only.') + `<div class="vs2-card">
          <div class="vs2-row"><div class="vs2-k">Theme</div>${['light', 'dark', 'system'].map(x => `<button class="vs2-btn ${t === x ? 'pri' : ''}" data-theme-set="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div>
          <div class="vs2-row"><div class="vs2-k">Accent color</div>${ACCENTS.map(c => `<button class="vs2-swatch ${a === c ? 'on' : ''}" style="background:${c}" data-accent="${c}" aria-label="Accent ${c}"></button>`).join('')}</div>
          <div class="vs2-row"><div class="vs2-k">Wallpaper</div><button class="vs2-wall ${!w ? 'on' : ''}" style="background:var(--vs2-soft)" data-wall="" aria-label="Default"></button>${Object.keys(WALLS).map(k => `<button class="vs2-wall ${w === k ? 'on' : ''}" style="background:${WALLS[k]}" data-wall="${k}" aria-label="${k}"></button>`).join('')}</div>
          <div class="vs2-row"><div class="vs2-k">Language / 언어</div><button class="vs2-btn ${LANG === 'en' ? 'pri' : ''}" data-lang="en">EN</button><button class="vs2-btn ${LANG === 'ko' ? 'pri' : ''}" data-lang="ko">KO</button></div></div>`;
      },
      apps() {
        const a = data.app;
        return head(T('apps'), 'Agent apps installed in this session.') + `<div class="vs2-card">${a ? `<div class="vs2-row"><div class="vs2-k"><b>${esc(a.name)}</b><small>${esc(a.id)} · ${a.current.length}/${a.declared.length} tools allowed</small></div><button class="vs2-btn dng" id="vs2-remove">Remove</button></div>` : '<div class="vs2-empty">No app installed.</div>'}
          <div class="vs2-res" id="vs2-appres"></div></div><button class="vs2-btn pri" data-open="appstore">Open the App Store</button>`;
      },
      upd() {
        const log = [['v0.4', 'App Store, Browser, Settings, Terminal, Minesweeper, product pass'], ['v0.3', 'App Store preview, VDR packages'],
          ['v0.2', 'Live Meta Muse agent with Agent Guard'], ['v0.1', 'Desktop shell']];
        return head(T('upd'), 'You are on ' + (data.version || 'v0.4') + '.') + `<div class="vs2-card">${log.map(([v, s]) => `<div class="vs2-row"><div class="vs2-k"><b>${v}</b><small>${esc(s)}</small></div></div>`).join('')}</div>`;
      },
    };

    function draw() {
      if (!data) return;
      main.innerHTML = view[cur]();
      main.scrollTop = 0;
      wireLocks();
      main.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { try { h.openApp(b.dataset.open); } catch (e) {} });
      const q = s => main.querySelector(s);
      const res = (id, html) => { const e = q(id); if (e) e.innerHTML = html; };
      if (cur === 'model') main.querySelectorAll('[data-pref]').forEach(b => b.onclick = () => { LS.set('vk_model_pref', b.dataset.pref); draw(); });
      if (cur === 'sec') main.querySelectorAll('[data-tool]').forEach(b => b.onclick = async () => {
        const on = b.getAttribute('aria-checked') === 'true'; b.disabled = true;
        try {
          const r = await api(on ? 'settings/revoke' : 'settings/grant', {tool: b.dataset.tool});
          if (r && r.app) { data.app = r.app; draw(); res('#vs2-permres', `${on ? 'Revoked' : 'Granted'}: <span class="vs2-mono">${esc(b.dataset.tool)}</span>`); }
          else res('#vs2-permres', esc((r && r.error) || T('err')));
          try { h.refreshTray && h.refreshTray(); } catch (e) {}
        } catch (e) { b.disabled = false; res('#vs2-permres', esc(errMsg(e))); }
      });
      if (cur === 'net') {
        const edit = async body => {
          try {
            const r = await api('settings/egress', body);
            if (r && r.locked) { lockedModal(r.action, r); return; }
            if (r && r.egress_allow) { data.settings.egress_allow = r.egress_allow; draw(); }
            else res('#vs2-netres', esc((r && r.error) || T('err')));
          } catch (e) { res('#vs2-netres', esc(e.message.startsWith('http 400') ? 'Invalid domain. Use a name like docs.python.org.' : errMsg(e))); }
        };
        q('#vs2-add').onclick = () => { const v = q('#vs2-dom').value.trim(); if (v) edit({add: v}); };
        q('#vs2-dom').onkeydown = e => { if (e.key === 'Enter') q('#vs2-add').click(); };
        main.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => edit({remove: b.dataset.rm}));
      }
      if (cur === 'pol') {
        const set = async (key, value) => {
          try {
            const r = await api('settings/policy', {key, value});
            if (r && r.locked) { lockedModal(r.action, r); return; }
            if (r && r.policy) { data.settings.policy = r.policy; draw(); res('#vs2-polres', 'Saved.'); }
          } catch (e) { res('#vs2-polres', esc(e.message.startsWith('http 400') ? 'Value out of range.' : errMsg(e))); }
        };
        main.querySelectorAll('[data-pol]').forEach(b => b.onclick = () => set(b.dataset.pol, b.getAttribute('aria-checked') !== 'true'));
        q('#vs2-steps').onchange = e => set('agent_step_limit', parseInt(e.target.value, 10));
      }
      if (cur === 'kill') {
        q('#vs2-kill').onclick = async () => {
          try {
            const r = await api('kill', {});
            const s = await window.VK_API('status').catch(() => null);
            if (s) data.kernel = Object.assign(data.kernel || {}, s);
            draw(); res('#vs2-killres', `<span class="vs2-pill vs2-bad">HALTED</span> ${esc((r && r.message) || '')}`);
            try { h.refreshTray && h.refreshTray(); } catch (e) {}
          } catch (e) { res('#vs2-killres', esc(errMsg(e))); }
        };
        q('#vs2-resume').onclick = async () => {
          const inp = q('#vs2-key'), key = inp.value; inp.value = '';
          if (!key) { res('#vs2-resres', 'Enter the operator key.'); return; }
          try {
            const r = await api('resume', {key});
            const s = await window.VK_API('status').catch(() => null);
            if (s) data.kernel = Object.assign(data.kernel || {}, s);
            draw(); res('#vs2-resres', `<span class="vs2-pill ${r && r.ok ? 'vs2-ok' : 'vs2-bad'}">${r && r.ok ? 'RESUMED' : 'REFUSED'}</span> ${esc((r && r.message) || '')}`);
            try { h.refreshTray && h.refreshTray(); } catch (e) {}
          } catch (e) { res('#vs2-resres', esc(errMsg(e))); }
        };
      }
      if (cur === 'audit') {
        q('#vs2-verify').onclick = async () => {
          res('#vs2-audres', T('loading'));
          try { const r = await window.VK_API('audit'); const v = (r && r.verify) || {};
            res('#vs2-audres', `<span class="vs2-pill ${v.ok ? 'vs2-ok' : 'vs2-bad'}">${v.ok ? 'CHAIN OK' : 'CHAIN BROKEN'}</span> ${esc(v.n || 0)} entries${v.errors && v.errors.length ? ' · ' + esc(v.errors.length) + ' errors' : ''}`);
          } catch (e) { res('#vs2-audres', esc(errMsg(e))); }
        };
        q('#vs2-export').onclick = async () => {
          try {
            const r = await window.VK_API('audit');
            const rows = (r.lines || []).map(l => { try { return JSON.parse(l); } catch (e) { return l; } });
            const blob = new Blob([JSON.stringify({exported: new Date().toISOString(), verify: r.verify, entries: rows}, null, 2)], {type: 'application/json'});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vikernel-audit.json';
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            res('#vs2-audres', `Exported ${rows.length} entries.`);
          } catch (e) { res('#vs2-audres', esc(errMsg(e))); }
        };
      }
      if (cur === 'look') {
        main.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => { LS.set('vk_theme', b.dataset.themeSet); applyTheme(); draw(); });
        main.querySelectorAll('[data-accent]').forEach(b => b.onclick = () => { LS.set('vk_accent', b.dataset.accent); document.documentElement.style.setProperty('--indigo', b.dataset.accent); draw(); });
        main.querySelectorAll('[data-wall]').forEach(b => b.onclick = () => {
          LS.set('vk_wall', b.dataset.wall); const d = document.getElementById('desk');
          if (d) d.style.background = WALLS[b.dataset.wall] || ''; draw();
        });
        main.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { if (b.dataset.lang === LANG) return; LS.set('vk_lang', b.dataset.lang); location.reload(); });
      }
      if (cur === 'apps' && q('#vs2-remove')) q('#vs2-remove').onclick = async () => {
        try { const cur = (data && (data.app || data.installed)) || null; await api('store/install', {id: ''}); try { const bin = JSON.parse(localStorage.getItem('vk_trash') || '[]'); if (cur && cur.id) { bin.push({id: cur.id, name: cur.name || cur.id, removed_at: new Date().toISOString()}); localStorage.setItem('vk_trash', JSON.stringify(bin)); } } catch (e2) {} toast('App removed (moved to the Recycle Bin)'); await load(); }
        catch (e) { res('#vs2-appres', esc(errMsg(e))); }
      };
    }

    go(cur, false);
    load();
  },
}));
})();
