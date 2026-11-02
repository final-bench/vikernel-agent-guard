/* ViKernel Agent Guard UI. Live mode talks to the agent server; replay mode plays recorded runs (replay.json). */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let LIVE = false, REPLAY = null;
const SID = 's' + Math.random().toString(36).slice(2, 8);

async function api(path, body) {
  const r = await fetch(path, body === undefined ? {cache:'no-store'} : {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  return r.json();
}
const chat = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; $('#chat').append(d); $('#chat').scrollTop = 1e9; };
function verdict(e) {
  const d = document.createElement('div'); d.className = 'v ' + e.verdict;
  d.innerHTML = `<span class="tag">${esc(e.verdict)}</span><span class="mono">${esc(e.fn)}(${esc(JSON.stringify(e.args).slice(0, 140))})</span>
    <div class="small muted">${esc(e.reason || '')}${e.audit_seq != null ? ' · audit #' + e.audit_seq : ''}${e.chain ? ' · ' + esc(String(e.chain).slice(0, 12)) : ''}${e.kernel_ms != null ? ' · ' + e.kernel_ms + ' ms' : ''}</div>`;
  $('#stream').prepend(d);
}
function show(events) {
  for (const e of events || []) {
    if (e.type === 'user') chat('u', esc(e.text));
    else if (e.type === 'proposed') chat('s', 'agent proposes ' + esc(e.fn) + ' ... sent to ViKernel');
    else if (e.type === 'verdict') { verdict(e); chat('s', `ViKernel: <b>${esc(e.verdict)}</b> ${esc(e.fn)}${e.verdict === 'ALLOW' ? '' : ' (not executed)'}`); }
    else if (e.type === 'executed') chat('s', 'executed ' + esc(e.fn) + ': ' + esc(JSON.stringify(e.result).slice(0, 160)));
    else if (e.type === 'final') chat('a', esc(e.text));
    else if (e.type === 'error') chat('s', '<span class="bad">' + esc(e.text) + '</span>');
  }
}
function showResult(name, res) {
  if (!res) return;
  const extra = Object.entries(res).filter(([k]) => !['pass', 'verdicts', 'note', 'first_error'].includes(k))
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
  chat('s', `<span class="${res.pass ? 'good' : 'bad'}">${res.pass ? 'PASS' : 'FAIL'}</span> scenario ${esc(name)}\n${esc(extra)}`);
}
async function refresh() {
  if (!LIVE) return;
  try {
    const s = await api('/api/status');
    $('#pState').textContent = 'kernel: ' + s.kernel_state; $('#pState').className = 'pill state ' + s.kernel_state;
    const a = await api('/api/audit');
    const v = a.verify;
    $('#audit').innerHTML = `<div class="${v.ok ? 'good' : 'bad'}">${v.ok ? 'chain verified' : 'chain BROKEN'} (${v.n} records, head ${esc(String(s.audit_head).slice(0, 16))})</div>` +
      a.lines.slice(-12).reverse().map(l => { const o = JSON.parse(l); return `<div>#${o.seq} ${esc(o.actor)} ${esc(o.cmd)} ${o.ok ? 'ok' : 'refused'} ${esc(o.state_after)} <span class="muted">${esc(o.chain.slice(0, 12))}</span></div>`; }).join('');
  } catch (e) { $('#pState').textContent = 'kernel: unreachable'; }
}
async function scenario(name) {
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  chat('s', '--- scenario ' + name + ' ---');
  try {
    if (LIVE) { const r = await api('/api/scenario', {name}); show(r.events); showResult(name, r.result); }
    else { const s = REPLAY.scenarios[name]; for (const e of s.events) { show([e]); await new Promise(r => setTimeout(r, 350)); } showResult(name, s.result); }
  } finally { document.querySelectorAll('button').forEach(b => b.disabled = false); refresh(); }
}
document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => scenario(b.dataset.s));
$('#f').onsubmit = async e => {
  e.preventDefault(); const m = $('#msg').value.trim(); if (!m) return; $('#msg').value = '';
  if (!LIVE) { chat('s', 'Replay mode: free chat needs the live server. Use the scenario buttons.'); return; }
  chat('s', 'thinking...'); const r = await api('/api/chat', {message:m, session:SID}); show(r.events); refresh();
};
$('#kill').onclick = async () => { if (!LIVE) return scenario('d_kill'); const r = await api('/api/kill', {}); chat('s', 'KILL: ' + esc(r.message)); refresh(); };
$('#resume').onclick = async () => { if (!LIVE) return; const r = await api('/api/resume', {key:$('#key').value}); chat('s', (r.ok ? 'RESUME OK: ' : 'RESUME REFUSED: ') + esc(r.message)); refresh(); };
$('#verify').onclick = () => LIVE ? refresh() : scenario('e_tamper');
$('#tamper').onclick = async () => {
  if (!LIVE) return scenario('e_tamper');
  const r = await api('/api/tamper', {});
  $('#audit').insertAdjacentHTML('afterbegin', `<div class="bad">Flipped one byte in record #${r.seq}: verify ${r.tampered.ok ? 'passed' : 'FAILED'} (${esc(JSON.stringify(r.tampered.errors[0] || {}))}). The kernel copy is untouched: ${r.clean.ok ? 'verified' : 'broken'}.</div>`);
};
(async () => {
  try { const h = await api('/api/health'); LIVE = !!h.live; $('#pModel').textContent = 'model: ' + h.model; $('#pMode').textContent = 'LIVE on VIDRAFT infra'; }
  catch (e) {
    REPLAY = await api('replay.json'); $('#pModel').textContent = 'model: ' + REPLAY.model; $('#pMode').textContent = 'REPLAY of a recorded run (' + REPLAY.started + ')';
    $('#pState').textContent = 'kernel: recorded'; $('#audit').innerHTML = '<div class="muted">Replay mode: press E to see the recorded tamper check.</div>';
  }
  chat('s', 'Pick a scenario on the left or ask the agent something. Every tool call is decided by ViKernel first.');
  refresh(); setInterval(refresh, 5000);
})();
})();
