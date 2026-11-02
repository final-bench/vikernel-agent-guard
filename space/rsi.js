/* RSI Lab: skill-level recursive self-improvement under the ViKernel kill switch.
   The agent edits its own skill (prompt, tools, workflow). No weight training happens in this demo. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api = (p, b) => window.VK_API(p, b === undefined ? undefined : Object.assign({session: window.VK_SID}, b));
  const errMsg = e => (e && e.message === 'rate') ? 'Too many requests. Wait a few seconds and try again.' : 'Request failed: ' + esc(e && e.message || 'network');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12a9 9 0 0 1 15.5-6.2"/><polyline points="18.5 2 18.5 6 14.5 6"/><polyline points="5.5 22 5.5 18 9.5 18"/></svg>';

  const css = `
.vr-root{--vr-bg:#f8fafc;--vr-fg:#0f172a;--vr-mut:#64748b;--vr-line:#e2e8f0;--vr-card:#fff;--vr-soft:#f1f5f9;--vr-acc:#9333EA;
  --vr-ok:#16a34a;--vr-bad:#dc2626;--vr-warn:#d97706;--vr-addbg:#dcfce7;--vr-delbg:#fee2e2;
  background:var(--vr-bg);color:var(--vr-fg);font:13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;height:100%;overflow:auto;box-sizing:border-box;padding:14px}
[data-theme=dark] .vr-root{--vr-bg:#0f172a;--vr-fg:#e2e8f0;--vr-mut:#94a3b8;--vr-line:#334155;--vr-card:#1e293b;--vr-soft:#172033;--vr-addbg:#14532d;--vr-delbg:#7f1d1d}
@media (prefers-color-scheme: dark){:root:not([data-theme=light]) .vr-root{--vr-bg:#0f172a;--vr-fg:#e2e8f0;--vr-mut:#94a3b8;--vr-line:#334155;--vr-card:#1e293b;--vr-soft:#172033;--vr-addbg:#14532d;--vr-delbg:#7f1d1d}}
.vr-root *{box-sizing:border-box}
.vr-head{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.vr-title{flex:1 1 320px;min-width:0}.vr-title h2{margin:0;font-size:17px}.vr-title p{margin:2px 0 0;color:var(--vr-mut)}
.vr-gen{font:800 30px/1 ui-monospace,Consolas,monospace;color:var(--vr-acc);padding:6px 12px;border:2px solid var(--vr-acc);border-radius:12px;min-width:110px;text-align:center}
.vr-gen.bump{animation:vrbump .5s ease}@keyframes vrbump{40%{transform:scale(1.15)}}
.vr-ks{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.vr-pill{font-weight:700;padding:4px 10px;border-radius:999px;font-size:12px;background:var(--vr-soft);border:1px solid var(--vr-line)}
.vr-pill.run{background:#dcfce7;color:#166534;border-color:#86efac}.vr-pill.halt{background:#fef3c7;color:#92400e;border-color:#f59e0b;animation:vrblink 1s infinite}
@keyframes vrblink{50%{opacity:.6}}
.vr-btn{border:1px solid var(--vr-line);background:var(--vr-card);color:var(--vr-fg);border-radius:8px;padding:7px 11px;font:inherit;font-weight:600;cursor:pointer}
.vr-btn:hover:not(:disabled){border-color:var(--vr-acc)}.vr-btn:disabled{opacity:.5;cursor:not-allowed}
.vr-btn:focus-visible,.vr-in:focus-visible{outline:2px solid var(--vr-acc);outline-offset:2px}
.vr-btn.pri{background:var(--vr-acc);border-color:var(--vr-acc);color:#fff}.vr-btn.kill{background:#dc2626;border-color:#dc2626;color:#fff}
.vr-btn.warn{border-color:#f59e0b}.vr-btn.sm{padding:3px 8px;font-size:12px}
.vr-in{border:1px solid var(--vr-line);background:var(--vr-card);color:var(--vr-fg);border-radius:8px;padding:6px 8px;font:inherit;width:120px}
.vr-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:12px}
.vr-card{background:var(--vr-card);border:1px solid var(--vr-line);border-radius:12px;padding:12px;margin-bottom:12px;min-width:0}
.vr-card h3{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--vr-mut)}
.vr-prompt{background:var(--vr-soft);border-radius:8px;padding:8px;white-space:pre-wrap;word-break:break-word}
.vr-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.vr-tag{font:12px ui-monospace,Consolas,monospace;background:var(--vr-soft);border:1px solid var(--vr-line);border-radius:6px;padding:1px 6px}
.vr-tag.add{background:var(--vr-delbg);border-color:var(--vr-bad);color:var(--vr-fg);font-weight:700}
.vr-k{color:var(--vr-mut);font-size:12px;min-width:56px;display:inline-block}
.vr-props{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
.vr-props .vr-btn{text-align:left}
.vr-diff{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.vr-diff>div{min-width:0}
.vr-diff ins{background:var(--vr-addbg);text-decoration:none;border-radius:3px}.vr-diff del{background:var(--vr-delbg);border-radius:3px}
.vr-meta{color:var(--vr-mut);font-size:12px;margin:6px 0}
.vr-steps{list-style:none;margin:0;padding:0}.vr-steps li{display:flex;gap:8px;padding:6px 0;border-bottom:1px dashed var(--vr-line);animation:vrin .25s ease}
@keyframes vrin{from{opacity:0;transform:translateY(-4px)}}
.vr-ic{flex:0 0 20px;height:20px;border-radius:50%;display:grid;place-items:center;font-weight:800;color:#fff;font-size:12px}
.vr-ic.ok{background:var(--vr-ok)}.vr-ic.no{background:var(--vr-bad)}.vr-ic.wait{background:var(--vr-mut)}
.vr-steps b{display:block}.vr-steps small{color:var(--vr-mut);word-break:break-word}
.vr-gate{font:12px ui-monospace,Consolas,monospace;background:var(--vr-soft);border-radius:6px;padding:2px 6px;display:inline-block;margin-top:3px}
.vr-stamp{margin:10px 0 2px;text-align:center;font:900 26px/1.1 system-ui;letter-spacing:.06em;border:4px solid;border-radius:12px;padding:10px;transform:rotate(-2deg);animation:vrstamp .35s ease}
.vr-stamp small{display:block;font:600 13px system-ui;letter-spacing:0;margin-top:4px}
@keyframes vrstamp{from{transform:scale(1.6) rotate(-6deg);opacity:0}}
.vr-stamp.ALLOW{color:var(--vr-ok);border-color:var(--vr-ok)}.vr-stamp.DENY{color:var(--vr-bad);border-color:var(--vr-bad)}.vr-stamp.HALTED{color:var(--vr-warn);border-color:var(--vr-warn)}
.vr-loop{display:flex;gap:4px;margin-top:8px}.vr-loop span{flex:1;height:10px;border-radius:4px;background:var(--vr-soft);border:1px solid var(--vr-line)}
.vr-loop span.ALLOW{background:var(--vr-ok)}.vr-loop span.DENY{background:var(--vr-bad)}.vr-loop span.HALTED{background:var(--vr-warn)}.vr-loop span.cur{background:var(--vr-acc);animation:vrblink 1s infinite}
.vr-banner{background:#fef3c7;color:#92400e;border:2px solid #f59e0b;border-radius:10px;padding:8px 10px;font-weight:700;margin-bottom:10px}
.vr-table{width:100%;border-collapse:collapse;font-size:12px}.vr-table th,.vr-table td{text-align:left;padding:5px 6px;border-bottom:1px solid var(--vr-line);vertical-align:top}
.vr-table td.p{max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vr-v{font-weight:700}.vr-v.ALLOW{color:var(--vr-ok)}.vr-v.ROLLBACK{color:var(--vr-acc)}
.vr-empty{color:var(--vr-mut);text-align:center;padding:18px}
.vr-err{color:var(--vr-bad);padding:8px 0}
.vr-about{background:var(--vr-soft);border-radius:10px;padding:10px 12px;margin-bottom:12px}.vr-about p{margin:4px 0}
.vr-spin{display:inline-block;width:12px;height:12px;border:2px solid var(--vr-mut);border-top-color:transparent;border-radius:50%;animation:vrsp 1s linear infinite;vertical-align:-2px}
@keyframes vrsp{to{transform:rotate(360deg)}}
@media (max-width:760px){.vr-grid,.vr-diff,.vr-props{grid-template-columns:minmax(0,1fr)}.vr-gen{font-size:22px}}
@media (prefers-reduced-motion:reduce){.vr-root *{animation:none!important}}`;

  // word-level diff (LCS); returns [old html, new html]
  function wdiff(a, b) {
    const A = String(a || '').split(/(\s+)/), B = String(b || '').split(/(\s+)/);
    if (A.length * B.length > 250000) return [esc(a), '<ins>' + esc(b) + '</ins>'];
    const n = A.length, m = B.length, L = Array.from({length: n + 1}, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0, o = '', w = '';
    while (i < n && j < m) {
      if (A[i] === B[j]) { o += esc(A[i]); w += esc(B[j]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { o += /^\s+$/.test(A[i]) ? esc(A[i]) : '<del>' + esc(A[i]) + '</del>'; i++; }
      else { w += /^\s+$/.test(B[j]) ? esc(B[j]) : '<ins>' + esc(B[j]) + '</ins>'; j++; }
    }
    for (; i < n; i++) o += /^\s+$/.test(A[i]) ? esc(A[i]) : '<del>' + esc(A[i]) + '</del>';
    for (; j < m; j++) w += /^\s+$/.test(B[j]) ? esc(B[j]) : '<ins>' + esc(B[j]) + '</ins>';
    return [o, w];
  }
  const tags = (arr, added) => (arr && arr.length) ? arr.map(x => `<span class="vr-tag${added && added.includes(x) ? ' add' : ''}">${esc(x)}${added && added.includes(x) ? ' (new)' : ''}</span>`).join('') : '<span class="vr-tag">none</span>';

  window.VK_EXTRA_APPS = window.VK_EXTRA_APPS || [];
  window.VK_EXTRA_APPS.push(h => ({
    id: 'rsi', name: () => 'RSI Lab', color: '#9333EA', icon: ICON, w: 1080, h: 720,
    render(body, win) {
      if (!document.getElementById('vr-style')) { const st = document.createElement('style'); st.id = 'vr-style'; st.textContent = css; document.head.appendChild(st); }
      const toast = m => { try { h.toast(m); } catch (e) {} };
      body.innerHTML = '';
      const root = document.createElement('div'); root.className = 'vr-root'; root.tabIndex = -1; body.appendChild(root);
      let state = null, prop = null, busy = false, kstate = 'UNKNOWN', loop = null, about = false, lastRes = null, alive = true;

      root.innerHTML = `
<div class="vr-head">
  <div class="vr-title"><h2>RSI Lab</h2><p>The agent improves its own skills. The kill switch sits above the whole loop.</p>
    <p style="font-size:12px">Skill-level RSI: prompt, tools and workflow. No weight training in this demo. <button class="vr-btn sm" data-a="about" aria-expanded="false">(i) About</button></p></div>
  <div class="vr-gen" aria-live="polite" title="Current generation of the skill">Gen -</div>
  <div class="vr-ks"><span class="vr-pill" data-k="pill">kernel ...</span>
    <button class="vr-btn kill" data-a="kill" title="Halt the kernel">KILL</button>
    <input class="vr-in" type="password" data-k="key" placeholder="resume key" aria-label="Resume key" autocomplete="off">
    <button class="vr-btn" data-a="resume">RESUME</button></div>
</div>
<div data-k="aboutbox"></div>
<div data-k="banner"></div>
<div class="vr-grid">
  <div>
    <div class="vr-card"><h3>Current skill: Weather Briefing</h3><div data-k="skill"><div class="vr-empty"><span class="vr-spin"></span> Loading skill...</div></div></div>
    <div class="vr-card"><h3>Propose a self-modification</h3>
      <div class="vr-props">
        <button class="vr-btn" data-p="benign">Propose improvement (Muse Spark)</button>
        <button class="vr-btn" data-p="widen">Agent tries: widen permissions</button>
        <button class="vr-btn" data-p="killswitch">Agent tries: touch the kill switch</button>
        <button class="vr-btn" data-p="auto">Auto (model decides)</button>
      </div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="vr-btn pri" data-a="loop">Run loop x5</button>
        <button class="vr-btn" data-a="reset">Reset session</button>
        <span class="vr-meta" data-k="loopmsg"></span></div>
      <div class="vr-loop" data-k="loopbar" hidden></div>
    </div>
    <div class="vr-card"><h3>Version history</h3><div data-k="hist"><div class="vr-empty">No versions yet.</div></div></div>
  </div>
  <div>
    <div class="vr-card"><h3>Proposal</h3><div data-k="prop"><div class="vr-empty">No proposal yet. Pick one of the four buttons on the left.</div></div></div>
    <div class="vr-card"><h3>Self-modification checks</h3><div data-k="res"><div class="vr-empty">Apply a proposal to run: kill switch, permission diff, protected targets, signed .vdr package, store review with a live gate dry-run, install.</div></div></div>
  </div>
</div>`;
      const $ = k => root.querySelector(`[data-k="${k}"]`);
      const genEl = root.querySelector('.vr-gen');

      function setBusy(b) { busy = b; root.querySelectorAll('[data-p],[data-a=loop],[data-a=reset],[data-a=apply],[data-rb]').forEach(x => { x.disabled = b; }); const l = root.querySelector('[data-a=loop]'); if (l && loop) l.disabled = true; }
      function drawGen(bump) { genEl.textContent = 'Gen ' + (state ? state.gen : '-'); if (bump) { genEl.classList.remove('bump'); void genEl.offsetWidth; genEl.classList.add('bump'); } }
      function drawKernel(ks) {
        if (ks) kstate = ks;
        const p = $('pill'); const halted = kstate === 'HALTED';
        p.className = 'vr-pill ' + (halted ? 'halt' : (kstate === 'RUNNING' || kstate === 'ACTIVE' || kstate === 'OK') ? 'run' : '');
        p.textContent = 'kernel ' + kstate;
        $('banner').innerHTML = halted ? '<div class="vr-banner" role="alert">Kill switch engaged: the kernel is HALTED. The self-improvement loop cannot run until RESUME.</div>' : '';
      }
      function drawSkill() {
        if (!state) return;
        const c = state.current;
        $('skill').innerHTML = `<div class="vr-prompt">${esc(c.prompt)}</div>
          <div class="vr-tags"><span class="vr-k">tools</span>${tags(c.tools)}</div>
          <div class="vr-tags"><span class="vr-k">egress</span>${tags(c.egress)}</div>
          <div class="vr-tags"><span class="vr-k">paths</span>${tags(c.paths)}</div>`;
      }
      function drawHist() {
        if (!state || !state.history || !state.history.length) { $('hist').innerHTML = '<div class="vr-empty">No versions yet.</div>'; return; }
        const rows = state.history.slice().reverse().map(v => `<tr><td><b>${esc(v.gen)}</b>${v.gen === state.gen ? ' (current)' : ''}</td>
          <td class="vr-v ${esc(v.verdict)}">${esc(v.verdict)}</td><td class="p" title="${esc(v.prompt)}">${esc(v.note || '')}${v.note ? ': ' : ''}${esc(v.prompt)}</td>
          <td title="${esc(v.sha)}"><code>${esc(String(v.sha || '').slice(0, 10))}</code></td>
          <td>${v.gen === state.gen ? '' : `<button class="vr-btn sm" data-rb="${esc(v.gen)}" ${busy ? 'disabled' : ''}>Rollback</button>`}</td></tr>`).join('');
        $('hist').innerHTML = `<div style="overflow:auto"><table class="vr-table"><thead><tr><th>Gen</th><th>Verdict</th><th>Prompt</th><th>sha256</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      function drawAbout() {
        const b = root.querySelector('[data-a=about]'); b.setAttribute('aria-expanded', about);
        $('aboutbox').innerHTML = about ? `<div class="vr-about">
          <p><b>What is skill-level RSI?</b> Recursive self-improvement here means the agent rewrites its own skill: the instruction prompt, the tool list and the workflow. Each accepted change becomes a new generation that can itself be improved again.</p>
          <p><b>No weight training in this demo.</b> The model (Meta Muse Spark) only proposes text. No model weights are trained or changed.</p>
          <p><b>Why widening is denied.</b> An agent that can grant itself new tools, egress domains or paths can escape its own manifest. A self-modification may keep or shrink permissions, never add them; a human publisher must do that through the store.</p>
          <p><b>Why protected targets are denied.</b> The kernel, policy, audit log and kill switch sit above the loop. A change that touches them, or a prompt that asks to disable or bypass them, is denied and recorded by the real ViKernel kernel with an audit number.</p>
          <p><b>Every accepted change</b> is a real signed .vdr package that passes the store review (hash list, publisher signature, permission risk, live gate dry-run, store countersignature). KILL halts everything, including this loop.</p></div>` : '';
      }
      function drawProp() {
        if (!prop) { $('prop').innerHTML = '<div class="vr-empty">No proposal yet. Pick one of the four buttons on the left.</div>'; return; }
        const d = prop.diff, c = prop.candidate, [o, w] = wdiff(d.prompt.old, d.prompt.new);
        const perm = [].concat(d.tools_added, d.egress_added, d.paths_added).length;
        const model = prop.model_used === 'muse-spark' ? 'written by Muse Spark (live)' : prop.model_used === 'fallback' ? 'model unavailable: deterministic fallback' : 'scripted scenario';
        $('prop').innerHTML = `<div class="vr-meta">Candidate for gen ${esc(prop.gen_next)} · ${esc(model)}${prop.note ? ' · ' + esc(prop.note) : ''}</div>
          <div class="vr-diff"><div><div class="vr-k">old prompt</div><div class="vr-prompt">${o}</div></div><div><div class="vr-k">new prompt</div><div class="vr-prompt">${w}</div></div></div>
          <div class="vr-tags"><span class="vr-k">tools</span>${tags(c.tools, d.tools_added)}${d.tools_removed.length ? ' <span class="vr-meta">removed: ' + esc(d.tools_removed.join(', ')) + '</span>' : ''}</div>
          <div class="vr-tags"><span class="vr-k">egress</span>${tags(c.egress, d.egress_added)}</div>
          <div class="vr-tags"><span class="vr-k">paths</span>${tags(c.paths, d.paths_added)}</div>
          <div class="vr-meta">${perm ? `<b style="color:var(--vr-bad)">${perm} permission addition(s) in red</b>` : 'No permission changes.'}</div>
          <button class="vr-btn pri" data-a="apply" ${busy ? 'disabled' : ''}>Apply self-modification (Enter)</button>`;
      }
      function stepHtml(s) {
        const g = s.gate ? `<div class="vr-gate">kernel gate: ${esc(s.gate.verdict)} · rule ${esc(s.gate.rule)}${s.gate.audit_seq != null ? ' · audit #' + esc(s.gate.audit_seq) : ''}</div>` : '';
        const pr = Array.isArray(s.probes) ? s.probes.map(p => `<div class="vr-gate">${esc(p.probe)} ${esc(p.fn)}: kernel ${esc(p.kernel)} → ${esc(p.verdict)}${p.audit_seq != null ? ' · audit #' + esc(p.audit_seq) : ''}</div>`).join('') : '';
        return `<span class="vr-ic ${s.ok ? 'ok' : 'no'}">${s.ok ? '✓' : '✕'}</span><div><b>${esc(s.check)}</b><small>${esc(s.detail)}</small>${g}${pr}</div>`;
      }
      async function showResult(r) {
        const box = $('res');
        box.innerHTML = '<ol class="vr-steps"></ol>';
        const ol = box.querySelector('ol');
        for (const s of (r.steps || [])) {
          if (!alive) return;
          const li = document.createElement('li'); li.innerHTML = '<span class="vr-ic wait">.</span><div><b>' + esc(s.check) + '</b><small>checking...</small></div>';
          ol.appendChild(li); await sleep(400); li.innerHTML = stepHtml(s);
        }
        const v = r.verdict, st = document.createElement('div'); st.className = 'vr-stamp ' + esc(v); st.setAttribute('role', 'status');
        st.innerHTML = v === 'ALLOW' ? `ALLOW<small>Installed as gen ${esc(r.gen)}</small>` : v === 'DENY' ? `DENY<small>rule: ${esc(r.rule || '')}. ${esc(r.reason || '')} Current skill unchanged.</small>` : v === 'HALTED' ? `HALTED<small>${esc(r.reason || 'kernel halted: the improvement loop cannot run')}</small>` : esc(v);
        box.appendChild(st);
      }

      async function refresh() {
        try { state = await api('rsi/state', {}); drawGen(); drawKernel(state.kernel_state); drawSkill(); drawHist(); }
        catch (e) { $('skill').innerHTML = `<div class="vr-err">${errMsg(e)}</div><button class="vr-btn sm" data-a="retry">Retry</button>`; }
      }
      async function pollKernel() { try { const s = await api('status'); drawKernel(s && s.kernel_state); } catch (e) {} }
      async function propose(kind) {
        $('prop').innerHTML = `<div class="vr-empty"><span class="vr-spin"></span> ${kind === 'benign' || kind === 'auto' ? 'Asking Muse Spark for a proposal...' : 'Agent is drafting the change...'}</div>`;
        const p = await api('rsi/propose', {kind});
        if (p && p.error) throw new Error(p.error);
        prop = p; drawProp(); return p;
      }
      async function apply() {
        if (!prop) return null;
        $('res').innerHTML = '<div class="vr-empty"><span class="vr-spin"></span> Running checks...</div>';
        const r = await api('rsi/apply', {candidate: prop.candidate});
        if (r && r.error) throw new Error(r.error);
        lastRes = r; const before = state ? state.gen : 0;
        await showResult(r);
        state = Object.assign(state || {}, {gen: r.gen, current: r.current, history: r.history});
        drawKernel(r.kernel_state); drawGen(r.gen !== before); drawSkill(); drawHist();
        if (r.verdict === 'ALLOW') prop = null, drawProp();
        return r;
      }
      async function guarded(fn) {
        if (busy) return; setBusy(true);
        try { await fn(); } catch (e) { toast(errMsg(e).replace(/&[a-z#0-9]+;/g, '')); $('res').insertAdjacentHTML('afterbegin', `<div class="vr-err">${errMsg(e)}</div>`); }
        finally { setBusy(false); drawProp(); drawHist(); }
      }
      async function runLoop() {
        if (busy) return;
        loop = {i: 0, res: []}; setBusy(true);
        const bar = $('loopbar'); bar.hidden = false; bar.innerHTML = '<span></span>'.repeat(5);
        const mark = (i, c) => { const s = bar.children[i]; if (s) s.className = c; };
        try {
          for (let i = 0; i < 5 && alive; i++) {
            loop.i = i; mark(i, 'cur');
            $('loopmsg').textContent = `Loop ${i + 1}/5: proposing...`;
            await propose('benign');
            $('loopmsg').textContent = `Loop ${i + 1}/5: applying...`;
            const r = await apply();
            mark(i, r.verdict);
            if (r.verdict === 'HALTED') { $('loopmsg').innerHTML = `<b style="color:var(--vr-warn)">Loop stopped at step ${i + 1}/5: kill switch engaged (kernel HALTED).</b>`; toast('RSI loop halted by the kill switch'); break; }
            if (r.verdict !== 'ALLOW') { $('loopmsg').textContent = `Loop stopped at step ${i + 1}/5: ${r.verdict} (${r.rule || ''}).`; break; }
            $('loopmsg').textContent = `Loop ${i + 1}/5: installed gen ${r.gen}.`;
            await sleep(500);
          }
          if (loop.res !== null && /installed gen/.test($('loopmsg').textContent)) $('loopmsg').textContent += ' Loop complete. Press KILL during a run to see it halt.';
        } catch (e) { $('loopmsg').innerHTML = `<span class="vr-err">${errMsg(e)}</span>`; }
        finally { loop = null; setBusy(false); drawProp(); drawHist(); }
      }

      root.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        const p = b.dataset.p, a = b.dataset.a, rb = b.dataset.rb;
        if (p) return guarded(() => propose(p));
        if (rb) return guarded(async () => {
          const r = await api('rsi/rollback', {gen: Number(rb)});
          if (r && r.error) throw new Error(r.error);
          state = r; drawKernel(r.kernel_state); drawGen(true); drawSkill();
          toast(r.verdict === 'HALTED' ? 'Kernel halted: rollback waits for RESUME' : 'Rolled back: now gen ' + r.gen);
        });
        if (a === 'apply') return guarded(apply);
        if (a === 'loop') return runLoop();
        if (a === 'retry') return refresh();
        if (a === 'about') { about = !about; return drawAbout(); }
        if (a === 'reset') return guarded(async () => { state = await api('rsi/reset', {}); prop = null; drawGen(true); drawKernel(state.kernel_state); drawSkill(); drawHist(); $('res').innerHTML = '<div class="vr-empty">Session reset to gen 1.</div>'; });
        if (a === 'kill') {
          try { const r = await api('kill', {}); toast((r && r.message) || 'Kill switch engaged'); } catch (er) { toast(errMsg(er).replace(/&[a-z#0-9]+;/g, '')); }
          return pollKernel();
        }
        if (a === 'resume') {
          const k = $('key');
          try { const r = await api('resume', {key: k.value}); toast((r && r.message) || (r && r.ok ? 'Resumed' : 'Resume refused')); } catch (er) { toast(errMsg(er).replace(/&[a-z#0-9]+;/g, '')); }
          k.value = ''; return pollKernel();
        }
      });
      root.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || e.target.matches('input,button,textarea')) return;
        if (prop && !busy) { e.preventDefault(); guarded(apply); }
      });
      $('key').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); root.querySelector('[data-a=resume]').click(); } });

      const timer = setInterval(() => { if (!document.body.contains(root)) { alive = false; clearInterval(timer); return; } pollKernel(); }, 3000);
      refresh();
    }
  }));
})();
