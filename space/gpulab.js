/* GPU Lab: run a small GPU kernel on the GPU unit wired into the weights of Meta Muse Glimmer 30B (option 3 backend).
   The result is checked against the reference executor and plain Python. Honors the sleep/wake of the GPU backend. */
(() => {
'use strict';
const K = {
  vadd: {label:'Vector add', make:n => ({a:rnd(n, 50), b:rnd(n, 50)}), py:d => ({c:d.a.map((v, i) => v + d.b[i])})},
  dot: {label:'Dot product', make:n => ({a:rnd(n, 12), b:rnd(n, 12)}), py:d => ({out:[d.a.reduce((s, v, i) => s + v * d.b[i], 0)]})},
  reduce: {label:'Reduce (sum)', make:n => ({x:rnd(n, 99)}), py:d => ({out:[d.x.reduce((s, v) => s + v, 0)]})},
  histogram: {label:'Histogram (16 bins)', make:n => ({x:rnd(n, 15)}), py:d => ({bins:Array.from({length:16}, (_, i) => d.x.filter(v => v === i).length)})},
};
function rnd(n, m) { return Array.from({length:n}, () => Math.floor(Math.random() * (m + 1))); }
async function gpu(path, body, ms) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms || 300000);
  try {
    const r = await fetch('api/agx/' + path, body === undefined ? {cache:'no-store', signal:ctl.signal, headers:{'X-VK-Session':window.VK_SID}} : {method:'POST', headers:{'Content-Type':'application/json', 'X-VK-Session':window.VK_SID}, body:JSON.stringify(body), signal:ctl.signal});
    if (r.status === 429) throw new Error('rate');
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}
const css = document.createElement('style');
css.textContent = `.gl{padding:14px;font-family:system-ui,'Segoe UI',sans-serif;display:flex;flex-direction:column;gap:12px;height:100%;overflow:auto}
.gl h3{margin:0;font-size:18px}.gl .mut{color:var(--muted);font-size:13px}.gl .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.gl .card{border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--card)}.gl pre{margin:6px 0 0;white-space:pre-wrap;word-break:break-word;font:12px ui-monospace,Consolas,monospace;background:var(--bg);border-radius:8px;padding:8px}
.gl .ok{color:#16A34A;font-weight:800}.gl .bad{color:#E11D48;font-weight:800}.gl .tag{font:800 11px system-ui;padding:3px 8px;border-radius:999px;background:#EEF2FF;color:#4338CA}
.gl select,.gl input[type=range]{height:32px}.gl .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.gl .kv b{display:block;font-size:20px;white-space:nowrap}.gl .note{font-size:12px;color:var(--muted);border-left:3px solid #F59E0B;padding:4px 8px;background:var(--bg);border-radius:6px}`;
document.head.append(css);
window.VK_EXTRA_APPS = window.VK_EXTRA_APPS || [];
window.VK_EXTRA_APPS.push(h => ({id:'gpulab', name:() => 'GPU Lab', color:'#0F766E',
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>',
  w:820, h:640, render(body) {
    body.style.padding = '0';
    const root = document.createElement('div'); root.className = 'gl'; body.append(root);
    root.innerHTML = `<div><h3>GPU Lab</h3><div class="mut">A GPU unit wired into the weights of Meta Muse Glimmer 30B runs a small kernel inside the model's own forward pass. The result is checked token by token against the reference executor and against plain Python.</div>
      <div class="note" style="margin-top:8px">Exact and auditable, not a GPU replacement: a real GPU is roughly a trillion times faster in raw throughput.</div></div>
      <div class="card row"><label>Kernel <select data-k="k">${Object.entries(K).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>
        <label>Length n <input type="range" min="4" max="16" value="8" data-k="n"> <b data-k="nv">8</b></label>
        <label>Mode <select data-k="mode"><option value="verify">Verify in the weights</option><option value="reference">Reference executor only</option></select></label>
        <button class="btn" data-k="rand">Random inputs</button><button class="btn pri" data-k="run">Run on the GPU in the weights</button><span class="tag" data-k="state">checking backend...</span></div>
      <div class="card"><b>Inputs</b><pre data-k="in"></pre></div>
      <div class="card" data-k="out"><span class="mut">Pick a kernel and press Run. A run takes from a few seconds to about a minute, because every GPU step is computed by the model.</span></div>`;
    const q = k => root.querySelector(`[data-k="${k}"]`);
    let data = null, waking = false;
    const fresh = () => { data = K[q('k').value].make(+q('n').value); q('in').textContent = JSON.stringify(data); };
    q('k').onchange = fresh; q('n').oninput = () => { q('nv').textContent = q('n').value; fresh(); }; q('rand').onclick = fresh; fresh();
    async function health() {
      try { const r = await gpu('health', undefined, 10000); return !!(r && r.live); } catch (e) { return false; }
    }
    async function ensureAwake() {
      if (await health()) { q('state').textContent = 'GPU backend ready'; return true; }
      q('state').textContent = 'waking the in-weights model (about 4 min)...';
      if (waking) return false; waking = true;
      for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 15000)); if (!root.isConnected) return false; if (await health()) { waking = false; q('state').textContent = 'GPU backend ready'; h.toast('GPU Lab: the in-weights model is awake'); return true; } }
      waking = false; q('state').textContent = 'still waking; try again shortly'; return false;
    }
    ensureAwake();
    q('run').onclick = async () => {
      const out = q('out'), k = q('k').value, n = +q('n').value;
      if (!(await health())) { out.innerHTML = '<span class="mut">The in-weights model is asleep to save cost. It is waking now (about 4 min). Agent Guard option 1 stays live meanwhile.</span>'; ensureAwake(); return; }
      q('run').disabled = true; out.innerHTML = '<span class="mut">Running inside the model...</span>';
      const t0 = performance.now();
      try {
        const mode = q('mode').value;
        const r = await gpu('gpu', {kernel:k, data, n, mode});
        if (r.error) throw new Error(r.error);
        const py = K[k].py(data), wall = (performance.now() - t0) / 1000;
        const okPy = JSON.stringify(r.outputs) === JSON.stringify(py);
        const fms = v => v == null ? 'n/a' : (+v).toFixed(1) + ' ms';
        const parity = r.parity == null ? `<div class="note" style="margin-top:8px">Parity: not checked in this mode. Reference executor only, ${fms(r.ms_reference)}.</div>`
          : `<div class="note" style="margin-top:8px">Parity: in-weights ${r.parity ? '&#10003; equals' : '&#10007; differs from'} reference. In the weights ${fms(r.ms_verify)}, reference ${fms(r.ms_reference)}.</div>`;
        out.innerHTML = `${parity}<div class="grid"><div class="kv"><span class="mut">exact vs reference</span><b class="${r.equals_reference ? 'ok' : 'bad'}">${r.equals_reference ? '&#10003; exact' : '&#10007; differs'}</b></div>
          <div class="kv"><span class="mut">token-exact vs executor</span><b class="${r.token_exact == null ? '' : r.token_exact ? 'ok' : 'bad'}">${r.token_exact == null ? 'n/a' : r.token_exact ? '&#10003;' : '&#10007;'}</b></div>
          <div class="kv"><span class="mut">matches plain Python</span><b class="${okPy ? 'ok' : 'bad'}">${okPy ? '&#10003;' : '&#10007;'}</b></div>
          <div class="kv"><span class="mut">model tokens</span><b>${(r.tokens || 0).toLocaleString('en-US')}</b></div>
          <div class="kv"><span class="mut">GPU time in the model</span><b>${r.sec == null ? 'n/a' : r.sec + ' s'}</b></div><div class="kv"><span class="mut">round trip</span><b>${wall.toFixed(1)} s</b></div></div>
          <b style="display:block;margin-top:10px">Output</b><pre>${JSON.stringify(r.outputs)}</pre><b>Plain Python</b><pre>${JSON.stringify(py)}</pre>`;
      } catch (e) {
        out.innerHTML = `<span class="mut">${e.message === 'rate' ? 'Too many requests from your network; try again in a few minutes.' : 'The in-weights model is busy or waking. Please try again in a minute.'}</span>`;
        ensureAwake();
      } finally { q('run').disabled = false; }
    };
  }}));
})();
