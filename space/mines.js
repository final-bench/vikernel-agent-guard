/* ViKernel Desktop: Minesweeper (VDR app). Original code and art, drawn with CSS/SVG. */
(function () {
  'use strict';

  // ---------- i18n ----------
  var STR = {
    en: {
      mines_title: 'Minesweeper', mines_beginner: 'Beginner', mines_intermediate: 'Intermediate',
      mines_best: 'Best', mines_none: 'none', mines_new: 'New game', mines_hint: 'AI hint (Muse Spark)',
      mines_cheat: 'Try to cheat: read mine map', mines_agent: 'Agent and kernel', mines_audit: 'App audit',
      mines_win: 'Cleared! Time', mines_lose: 'Boom. All mines revealed.', mines_newbest: 'New best time!',
      mines_thinking: 'Muse Spark is reading the visible board...', mines_empty_agent: 'No agent activity yet. Ask for an AI hint to see the agent propose a tool call and the kernel decide.',
      mines_empty_audit: 'No verdicts recorded in this session yet.', mines_suggest: 'AI suggestion, may be wrong',
      mines_rate: 'Too many requests. Please wait a moment and try again.', mines_err: 'The request failed',
      mines_nohint: 'The model did not name a hidden cell this time.', mines_over: 'Start a new game to ask for a hint.',
      mines_about: 'About', mines_close: 'Close', mines_retry: 'Retry'
    },
    ko: {
      mines_title: '지뢰찾기', mines_beginner: '초급', mines_intermediate: '중급', mines_best: '최고', mines_none: '없음',
      mines_new: '새 게임', mines_hint: 'AI 힌트 (Muse Spark)', mines_cheat: '부정행위 시도: 지뢰 지도 읽기',
      mines_agent: '에이전트와 커널', mines_audit: '앱 감사 기록', mines_win: '성공! 시간', mines_lose: '펑. 모든 지뢰를 공개합니다.',
      mines_newbest: '최고 기록!', mines_thinking: 'Muse Spark 가 보이는 판을 읽는 중...',
      mines_empty_agent: '아직 에이전트 활동이 없습니다. AI 힌트를 요청해 보세요.', mines_empty_audit: '이 세션의 판정 기록이 아직 없습니다.',
      mines_suggest: 'AI 제안, 틀릴 수 있음', mines_rate: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.', mines_err: '요청 실패',
      mines_nohint: '이번에는 모델이 숨은 칸을 지목하지 않았습니다.', mines_over: '힌트를 받으려면 새 게임을 시작하세요.',
      mines_about: '정보', mines_close: '닫기', mines_retry: '다시 시도'
    }
  };
  try {
    window.VK_I18N = window.VK_I18N || {};
    ['en', 'ko'].forEach(function (l) { window.VK_I18N[l] = Object.assign(window.VK_I18N[l] || {}, STR[l]); });
  } catch (e) { /* ignore */ }

  var MODES = {
    beginner: { rows: 9, cols: 9, mines: 10, key: 'mines_beginner' },
    intermediate: { rows: 16, cols: 16, mines: 40, key: 'mines_intermediate' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  // ---------- art (original) ----------
  var SVG_MINE = '<svg viewBox="0 0 20 20" aria-hidden="true"><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
    '<path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3M4.8 4.8l2 2M13.2 13.2l2 2M15.2 4.8l-2 2M6.8 13.2l-2 2"/></g>' +
    '<rect x="5.6" y="5.6" width="8.8" height="8.8" rx="3" fill="currentColor"/><circle cx="8.6" cy="8.6" r="1.3" fill="#fff" opacity=".75"/></svg>';
  var SVG_FLAG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M6.8 3.6l8.4 3.2-8.4 3.4z" fill="var(--mn-flag)"/><path d="M3.5 17h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function face(state) {
    var eyes = '<circle cx="9" cy="10.5" r="1.4"/><circle cx="15" cy="10.5" r="1.4"/>', mouth = '<path d="M8.5 15c2 2 5 2 7 0" fill="none"/>';
    if (state === 'tense') mouth = '<circle cx="12" cy="15.6" r="1.6" fill="none"/>';
    if (state === 'lost') { eyes = '<path d="M7.6 9.1l2.8 2.8M10.4 9.1l-2.8 2.8M13.6 9.1l2.8 2.8M16.4 9.1l-2.8 2.8" fill="none"/>'; mouth = '<path d="M8.5 16.5c2-1.8 5-1.8 7 0" fill="none"/>'; }
    if (state === 'won') { eyes = '<path d="M6.5 9.5h11M7 9.5c0 2.2 3.4 2.2 3.4 0M13.6 9.5c0 2.2 3.4 2.2 3.4 0" fill="none"/>'; mouth = '<path d="M8 14.6c2.4 2.8 5.6 2.8 8 0" fill="none"/>'; }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="7" fill="var(--mn-face)" stroke="currentColor" stroke-width="1.4"/>' +
      '<g fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' + eyes + mouth + '</g></svg>';
  }

  // ---------- styles ----------
  var CSS = '' +
    '.mn{--mn-bg:#f6f8f7;--mn-panel:#fff;--mn-ink:#16211b;--mn-sub:#5b6b62;--mn-line:#dfe6e2;--mn-hid:#cfe3d6;--mn-hid2:#b9d6c3;--mn-open:#fbfdfc;' +
    '--mn-acc:#16A34A;--mn-flag:#e4572e;--mn-face:#ffd76a;--mn-boom:#fde2dc;--mn-ok:#15803d;--mn-bad:#dc2626;' +
    '--n1:#2563eb;--n2:#0f8a5f;--n3:#d9480f;--n4:#7c3aed;--n5:#b42318;--n6:#0e7490;--n7:#334155;--n8:#a16207;' +
    'display:flex;flex-direction:column;height:100%;background:var(--mn-bg);color:var(--mn-ink);font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;box-sizing:border-box;position:relative;overflow:hidden}' +
    '@media (prefers-color-scheme:dark){.mn{--mn-bg:#101613;--mn-panel:#17201b;--mn-ink:#e6efe9;--mn-sub:#93a59a;--mn-line:#26332c;--mn-hid:#2a3d32;--mn-hid2:#335042;--mn-open:#141c18;' +
    '--mn-face:#e8bf4c;--mn-boom:#4a1f1a;--n1:#7aa7ff;--n2:#4fd19c;--n3:#ff9b5e;--n4:#c4a1ff;--n5:#ff7a73;--n6:#5fd3e6;--n7:#cbd5e1;--n8:#f1c84b}}' +
    '.mn *{box-sizing:border-box}.mn button{font:inherit;color:inherit}' +
    '.mn-strip{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 12px;background:color-mix(in srgb,var(--mn-acc) 12%,var(--mn-panel));border-bottom:1px solid var(--mn-line);font-size:11.5px;color:var(--mn-sub)}' +
    '.mn-strip b{color:var(--mn-acc)}.mn-strip .mn-i{margin-left:auto}' +
    '.mn-i{width:24px;height:24px;border-radius:50%;border:1px solid var(--mn-line);background:var(--mn-panel);cursor:pointer;font-weight:700;font-style:italic;font-family:Georgia,serif}' +
    '.mn-main{flex:1;display:flex;gap:12px;padding:12px;min-height:0}' +
    '.mn-left{flex:1 1 auto;display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0}' +
    '.mn-side{flex:0 0 230px;display:flex;flex-direction:column;gap:10px;min-height:0;overflow:auto}' +
    '.mn.narrow .mn-main{flex-direction:column;overflow:auto}.mn.narrow .mn-side{flex:0 0 auto;overflow:visible}.mn.narrow .mn-left{flex:0 0 auto}' +
    '.mn-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.mn-seg{display:inline-flex;border:1px solid var(--mn-line);border-radius:9px;overflow:hidden;background:var(--mn-panel)}' +
    '.mn-seg button{border:0;background:none;padding:5px 10px;cursor:pointer}.mn-seg button[aria-pressed=true]{background:var(--mn-acc);color:#fff}' +
    '.mn-lcd{font:600 15px ui-monospace,Consolas,monospace;padding:4px 9px;border-radius:8px;background:var(--mn-panel);border:1px solid var(--mn-line);min-width:52px;text-align:center}' +
    '.mn-face{width:38px;height:38px;border-radius:11px;border:1px solid var(--mn-line);background:var(--mn-panel);cursor:pointer;padding:3px}.mn-face svg{width:100%;height:100%}' +
    '.mn-face:active{transform:scale(.95)}.mn-best{color:var(--mn-sub);font-size:12px}.mn-sp{flex:1}' +
    '.mn-wrap{flex:1;min-height:180px;display:flex;align-items:center;justify-content:center;position:relative}' +
    '.mn-grid{display:grid;gap:2px;padding:6px;border-radius:12px;background:var(--mn-line);outline:none;touch-action:manipulation;user-select:none;-webkit-user-select:none}' +
    '.mn-grid:focus-visible{box-shadow:0 0 0 3px color-mix(in srgb,var(--mn-acc) 45%,transparent)}' +
    '.mn-c{width:var(--cs);height:var(--cs);border:0;border-radius:calc(var(--cs)*.18);padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;' +
    'font:800 calc(var(--cs)*.55)/1 ui-rounded,system-ui,sans-serif;background:linear-gradient(160deg,var(--mn-hid),var(--mn-hid2));position:relative;-webkit-touch-callout:none}' +
    '.mn-c svg{width:68%;height:68%}.mn-c.o{background:var(--mn-open);cursor:default}.mn-c.boom{background:var(--mn-boom)}.mn-c.bad::after{content:"";position:absolute;inset:18%;' +
    'background:linear-gradient(45deg,transparent 45%,var(--mn-bad) 45% 55%,transparent 55%)}' +
    '.mn-c.foc{outline:2px solid var(--mn-acc);outline-offset:-2px;z-index:1}' +
    '.mn-c.hint::before{content:"";position:absolute;inset:-3px;border-radius:inherit;border:3px solid #f59e0b;animation:mnp 1.1s ease-in-out infinite}' +
    '@keyframes mnp{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.35}}' +
    '.mn-c[data-n="1"]{color:var(--n1)}.mn-c[data-n="2"]{color:var(--n2)}.mn-c[data-n="3"]{color:var(--n3)}.mn-c[data-n="4"]{color:var(--n4)}' +
    '.mn-c[data-n="5"]{color:var(--n5)}.mn-c[data-n="6"]{color:var(--n6)}.mn-c[data-n="7"]{color:var(--n7)}.mn-c[data-n="8"]{color:var(--n8)}' +
    '.mn-status{min-height:20px;text-align:center;font-weight:600}.mn-status.win{color:var(--mn-ok)}.mn-status.lose{color:var(--mn-bad)}' +
    '.mn-hintlbl{font-size:12px;color:#b45309;text-align:center;min-height:16px}' +
    '.mn-actions{display:flex;flex-direction:column;gap:6px}' +
    '.mn-btn{display:flex;align-items:center;justify-content:center;gap:7px;padding:8px 10px;border-radius:9px;border:1px solid var(--mn-line);background:var(--mn-panel);cursor:pointer;font-weight:600}' +
    '.mn-btn.pri{background:var(--mn-acc);border-color:var(--mn-acc);color:#fff}.mn-btn.warn{border-color:color-mix(in srgb,var(--mn-bad) 45%,var(--mn-line));color:var(--mn-bad)}' +
    '.mn-btn:disabled{opacity:.6;cursor:wait}.mn-spin{width:13px;height:13px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:mns .7s linear infinite}' +
    '@keyframes mns{to{transform:rotate(360deg)}}' +
    '.mn-card{background:var(--mn-panel);border:1px solid var(--mn-line);border-radius:11px;padding:10px}' +
    '.mn-card h4{margin:0 0 7px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--mn-sub)}' +
    '.mn-ev{border-left:3px solid var(--mn-line);padding:4px 0 4px 8px;margin:6px 0;word-break:break-word}.mn-ev code{font-size:11.5px}' +
    '.mn-ev small{display:block;color:var(--mn-sub)}.mn-empty{color:var(--mn-sub);font-size:12px}.mn-errbox{color:var(--mn-bad);font-size:12px}' +
    '.mn-tag{display:inline-block;padding:1px 7px;border-radius:6px;font-size:11px;font-weight:800;color:#fff;margin-right:5px}' +
    '.mn-tag.allow{background:var(--mn-ok)}.mn-tag.deny{background:var(--mn-bad)}' +
    '.mn-audit{list-style:none;margin:0;padding:0;font-size:12px}.mn-audit li{display:flex;gap:6px;align-items:center;padding:3px 0;border-bottom:1px dashed var(--mn-line)}' +
    '.mn-audit li:last-child{border:0}.mn-audit span.k{color:var(--mn-sub);margin-left:auto;font-family:ui-monospace,monospace}' +
    '.mn-deny{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92%);z-index:20;background:var(--mn-panel);border:2px solid var(--mn-bad);' +
    'border-radius:16px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.3);animation:mnin .18s ease-out}' +
    '@keyframes mnin{from{transform:translate(-50%,-46%);opacity:0}}' +
    '.mn-deny .big{font-size:26px;font-weight:900;color:var(--mn-bad);letter-spacing:.06em}.mn-deny p{margin:8px 0}.mn-deny code{word-break:break-all}' +
    '.mn-over{position:absolute;inset:0;background:rgba(0,0,0,.35);z-index:19}' +
    '.mn-about{position:absolute;inset:24px;z-index:20;background:var(--mn-panel);border:1px solid var(--mn-line);border-radius:14px;padding:18px;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.3)}' +
    '.mn-about h3{margin:0 0 8px}.mn-about ul{padding-left:18px}';

  function injectCSS() {
    if (document.getElementById('vk-mines-css')) return;
    var s = document.createElement('style'); s.id = 'vk-mines-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  var ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="7" y="7" width="10" height="10" rx="3.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2 2M16.7 16.7l2 2M18.7 5.3l-2 2M7.3 16.7l-2 2"/></svg>';

  // session-wide audit (persists across window reopen in this page load)
  var AUDIT = [];

  window.VK_MINES_APP = function (h) {
    h = h || {};
    function T(k) { try { var r = h.t && h.t(k); if (r && r !== k) return r; } catch (e) { /* ignore */ } return STR.en[k] || k; }
    function toast(m) { try { if (h.toast) h.toast(m); } catch (e) { /* ignore */ } }

    return {
      id: 'mines', name: function () { return 'Minesweeper'; }, color: '#16A34A', icon: ICON, w: 560, h: 680,
      render: function (body) {
        injectCSS();
        body.innerHTML = '';
        var root = document.createElement('div'); root.className = 'mn';
        root.innerHTML =
          '<div class="mn-strip"><b>VDR app</b><span>·</span><span>Verified by ViKernel</span><span>·</span><span>declared scope: read game/visible/ only</span><span>·</span><span>no network</span>' +
          '<button class="mn-i" data-a="about" title="' + esc(T('mines_about')) + '" aria-label="' + esc(T('mines_about')) + '">i</button></div>' +
          '<div class="mn-main"><div class="mn-left">' +
          '<div class="mn-head"><div class="mn-seg" role="group">' +
          '<button data-mode="beginner">' + esc(T('mines_beginner')) + '</button><button data-mode="intermediate">' + esc(T('mines_intermediate')) + '</button></div>' +
          '<span class="mn-best"></span></div>' +
          '<div class="mn-head"><span class="mn-lcd" data-r="count" title="Mines left">0</span><span class="mn-sp"></span>' +
          '<button class="mn-face" data-a="new" title="' + esc(T('mines_new')) + ' (N)" aria-label="' + esc(T('mines_new')) + '"></button>' +
          '<span class="mn-sp"></span><span class="mn-lcd" data-r="time" title="Time">0</span></div>' +
          '<div class="mn-wrap"><div class="mn-grid" role="grid" tabindex="0" aria-label="Minefield"></div></div>' +
          '<div class="mn-status" aria-live="polite"></div><div class="mn-hintlbl"></div></div>' +
          '<div class="mn-side"><div class="mn-actions">' +
          '<button class="mn-btn pri" data-a="hint">' + esc(T('mines_hint')) + '</button>' +
          '<button class="mn-btn warn" data-a="cheat">' + esc(T('mines_cheat')) + '</button></div>' +
          '<div class="mn-card"><h4>' + esc(T('mines_agent')) + '</h4><div data-r="agent"></div></div>' +
          '<div class="mn-card"><h4>' + esc(T('mines_audit')) + '</h4><ul class="mn-audit" data-r="audit"></ul></div>' +
          '</div></div>';
        body.appendChild(root);

        var q = function (s) { return root.querySelector(s); };
        var gridEl = q('.mn-grid'), wrap = q('.mn-wrap'), faceBtn = q('.mn-face'), countEl = q('[data-r=count]'), timeEl = q('[data-r=time]');
        var statusEl = q('.mn-status'), hintLbl = q('.mn-hintlbl'), bestEl = q('.mn-best'), agentEl = q('[data-r=agent]'), auditEl = q('[data-r=audit]');
        var hintBtn = q('[data-a=hint]'), cheatBtn = q('[data-a=cheat]');

        var mode = lsGet('vk_mines_mode') === 'intermediate' ? 'intermediate' : 'beginner';
        var R, C, M, mine, open, flag, adj, cells, started, over, won, t0, elapsed, timer, focus = 0, hintIdx = -1, opened;

        // ---------- game core ----------
        function nbrs(i) {
          var r = (i / C) | 0, c = i % C, out = [];
          for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue; var rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < R && cc >= 0 && cc < C) out.push(rr * C + cc);
          }
          return out;
        }
        function newGame(m) {
          if (m) { mode = m; lsSet('vk_mines_mode', m); }
          var cfg = MODES[mode]; R = cfg.rows; C = cfg.cols; M = cfg.mines;
          var n = R * C; mine = new Array(n).fill(false); open = new Array(n).fill(false); flag = new Array(n).fill(false); adj = new Array(n).fill(0);
          started = false; over = false; won = false; elapsed = 0; opened = 0; hintIdx = -1; focus = Math.min(focus, n - 1);
          stopTimer(); statusEl.textContent = ''; statusEl.className = 'mn-status'; hintLbl.textContent = '';
          root.querySelectorAll('.mn-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
          buildGrid(); updateHud(); fit();
        }
        function plant(safe) {
          var ban = {}; ban[safe] = 1; nbrs(safe).forEach(function (j) { ban[j] = 1; });
          var pool = []; for (var i = 0; i < R * C; i++) if (!ban[i]) pool.push(i);
          for (var k = 0; k < M; k++) { var j = k + Math.floor(Math.random() * (pool.length - k)); var tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp; mine[pool[k]] = true; }
          for (var x = 0; x < R * C; x++) adj[x] = nbrs(x).filter(function (y) { return mine[y]; }).length;
        }
        function reveal(i) {
          if (over || open[i] || flag[i]) return;
          if (!started) { plant(i); started = true; t0 = Date.now(); timer = setInterval(tick, 250); }
          if (mine[i]) { lose(i); return; }
          var stack = [i];
          while (stack.length) {
            var k = stack.pop(); if (open[k] || flag[k]) continue;
            open[k] = true; opened++; paint(k);
            if (adj[k] === 0) nbrs(k).forEach(function (j) { if (!open[j] && !mine[j]) stack.push(j); });
          }
          clearHint(); checkWin(); updateHud();
        }
        function chord(i) {
          if (over || !open[i] || !adj[i]) return;
          var ns = nbrs(i), f = ns.filter(function (j) { return flag[j]; }).length;
          if (f !== adj[i]) return;
          ns.forEach(function (j) { if (!open[j] && !flag[j]) reveal(j); });
        }
        function toggleFlag(i) {
          if (over || open[i]) return;
          flag[i] = !flag[i]; paint(i); updateHud();
        }
        function act(i) { if (open[i]) chord(i); else reveal(i); }
        function lose(i) {
          over = true; stopTimer();
          for (var k = 0; k < R * C; k++) {
            if (mine[k] && !flag[k]) { open[k] = true; paint(k); }
            else if (flag[k] && !mine[k]) cells[k].classList.add('bad');
          }
          cells[i].classList.add('boom'); clearHint();
          statusEl.textContent = T('mines_lose'); statusEl.className = 'mn-status lose'; updateHud();
        }
        function checkWin() {
          if (over || opened !== R * C - M) return;
          over = true; won = true; stopTimer();
          for (var k = 0; k < R * C; k++) if (mine[k] && !flag[k]) { flag[k] = true; paint(k); }
          var secs = Math.round(elapsed / 10) / 100, key = 'vk_mines_best_' + mode, prev = parseFloat(lsGet(key));
          var msg = T('mines_win') + ' ' + secs.toFixed(1) + 's';
          if (!(prev > 0) || secs < prev) { lsSet(key, String(secs)); msg += '. ' + T('mines_newbest'); }
          statusEl.textContent = msg; statusEl.className = 'mn-status win'; toast(msg);
        }
        function tick() {
          if (!root.isConnected) { stopTimer(); return; }
          elapsed = Date.now() - t0; timeEl.textContent = String(Math.min(999, Math.floor(elapsed / 1000)));
        }
        function stopTimer() { if (timer) { clearInterval(timer); timer = null; if (started) elapsed = Date.now() - t0; } }
        function updateHud() {
          var f = flag.filter(Boolean).length; countEl.textContent = String(M - f);
          if (!started) timeEl.textContent = '0';
          faceBtn.innerHTML = face(over ? (won ? 'won' : 'lost') : 'ok');
          var b = parseFloat(lsGet('vk_mines_best_' + mode));
          bestEl.textContent = T('mines_best') + ' (' + T(MODES[mode].key) + '): ' + (b > 0 ? b.toFixed(1) + 's' : T('mines_none'));
        }

        // ---------- rendering ----------
        function buildGrid() {
          gridEl.innerHTML = ''; gridEl.style.gridTemplateColumns = 'repeat(' + C + ',var(--cs))'; cells = [];
          var frag = document.createDocumentFragment();
          for (var i = 0; i < R * C; i++) {
            var b = document.createElement('div'); b.className = 'mn-c'; b.dataset.i = i; b.setAttribute('role', 'gridcell');
            frag.appendChild(b); cells.push(b); paint(i);
          }
          gridEl.appendChild(frag); setFocus(focus, false);
        }
        function paint(i) {
          var el = cells[i]; if (!el) return;
          var r = (i / C) | 0, c = i % C, label = 'row ' + r + ' col ' + c + ': ';
          el.classList.toggle('o', open[i]); el.removeAttribute('data-n');
          if (open[i] && mine[i]) { el.innerHTML = SVG_MINE; label += 'mine'; }
          else if (open[i]) { el.innerHTML = adj[i] ? String(adj[i]) : ''; if (adj[i]) el.dataset.n = adj[i]; label += adj[i] || 'empty'; }
          else if (flag[i]) { el.innerHTML = SVG_FLAG; label += 'flagged'; }
          else { el.innerHTML = ''; label += 'hidden'; }
          el.setAttribute('aria-label', label);
        }
        function setFocus(i, scroll) {
          if (cells[focus]) cells[focus].classList.remove('foc');
          focus = Math.max(0, Math.min(R * C - 1, i));
          if (cells[focus]) { cells[focus].classList.add('foc'); gridEl.setAttribute('aria-activedescendant', ''); if (scroll) cells[focus].scrollIntoView({ block: 'nearest' }); }
        }
        function fit() {
          var narrow = root.clientWidth < 600; root.classList.toggle('narrow', narrow);
          var w = wrap.clientWidth - 14, hh = narrow ? Math.min(window.innerHeight * 0.6, w) : wrap.clientHeight - 14;
          var cs = Math.floor(Math.min((w - (C - 1) * 2) / C, (hh - (R - 1) * 2) / R));
          cs = Math.max(narrow ? 20 : 16, Math.min(46, cs || 24));
          gridEl.style.setProperty('--cs', cs + 'px');
        }
        var ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
        if (ro) ro.observe(root); else window.addEventListener('resize', fit);

        // ---------- input ----------
        var lpTimer = null, lpFired = false, lastTouch = 0;
        function idxOf(e) { var t = e.target.closest && e.target.closest('.mn-c'); return t ? +t.dataset.i : -1; }
        gridEl.addEventListener('pointerdown', function (e) {
          var i = idxOf(e); if (i < 0) return;
          lpFired = false; if (!over && !open[i]) faceBtn.innerHTML = face('tense');
          if (e.pointerType === 'touch') {
            lastTouch = Date.now(); clearTimeout(lpTimer);
            lpTimer = setTimeout(function () { lpFired = true; toggleFlag(i); if (navigator.vibrate) navigator.vibrate(15); }, 400);
          }
        });
        function cancelLp() { clearTimeout(lpTimer); updateHud(); }
        gridEl.addEventListener('pointerup', cancelLp);
        gridEl.addEventListener('pointercancel', cancelLp);
        gridEl.addEventListener('pointerleave', cancelLp);
        gridEl.addEventListener('click', function (e) {
          var i = idxOf(e); if (i < 0) return;
          if (lpFired) { lpFired = false; return; }
          setFocus(i, false);
          if (e.shiftKey) toggleFlag(i); else act(i);
        });
        gridEl.addEventListener('contextmenu', function (e) {
          e.preventDefault(); var i = idxOf(e); if (i < 0) return;
          if (Date.now() - lastTouch < 800) return; // touch handled by long-press
          setFocus(i, false); toggleFlag(i);
        });
        gridEl.addEventListener('keydown', function (e) {
          var k = e.key, r = (focus / C) | 0, c = focus % C;
          if (k === 'ArrowUp') setFocus(Math.max(0, r - 1) * C + c, true);
          else if (k === 'ArrowDown') setFocus(Math.min(R - 1, r + 1) * C + c, true);
          else if (k === 'ArrowLeft') setFocus(r * C + Math.max(0, c - 1), true);
          else if (k === 'ArrowRight') setFocus(r * C + Math.min(C - 1, c + 1), true);
          else if (k === ' ' || k === 'Enter') act(focus);
          else if (k === 'f' || k === 'F') toggleFlag(focus);
          else if (k === 'n' || k === 'N') newGame();
          else return;
          e.preventDefault();
        });
        root.querySelectorAll('.mn-seg button').forEach(function (b) {
          b.addEventListener('click', function () { newGame(b.dataset.mode); gridEl.focus(); });
        });
        faceBtn.addEventListener('click', function () { newGame(); gridEl.focus(); });

        // ---------- ViKernel features ----------
        function boardText() {
          var lines = ['rows ' + R + ' cols ' + C];
          for (var r = 0; r < R; r++) {
            var s = '';
            for (var c = 0; c < C; c++) { var i = r * C + c; s += open[i] ? (mine[i] ? '#' : String(adj[i])) : (flag[i] ? 'F' : '#'); }
            lines.push(s);
          }
          return lines.join('\n'); // visible state only: mine positions are never sent
        }
        function clearHint() {
          if (hintIdx >= 0 && cells[hintIdx]) cells[hintIdx].classList.remove('hint');
          hintIdx = -1; hintLbl.textContent = '';
        }
        function tag(v) { var a = String(v || '').toUpperCase() === 'ALLOW'; return '<span class="mn-tag ' + (a ? 'allow' : 'deny') + '">' + (a ? 'ALLOW' : 'DENY') + '</span>'; }
        function renderAudit() {
          if (!AUDIT.length) { auditEl.innerHTML = '<li class="mn-empty">' + esc(T('mines_empty_audit')) + '</li>'; return; }
          auditEl.innerHTML = AUDIT.slice().reverse().map(function (a) {
            return '<li>' + tag(a.verdict) + '<span>' + esc(a.kind) + '</span><span class="k">' + (a.seq != null ? 'audit #' + esc(a.seq) : esc(a.time)) + '</span></li>';
          }).join('');
        }
        function addAudit(kind, verdict, seq) {
          AUDIT.push({ kind: kind, verdict: verdict, seq: seq, time: new Date().toLocaleTimeString() }); renderAudit();
        }
        function agentEmpty() { agentEl.innerHTML = '<div class="mn-empty">' + esc(T('mines_empty_agent')) + '</div>'; }
        function errMsg(e) { return e && e.message === 'rate' ? T('mines_rate') : T('mines_err') + ': ' + (e && e.message || 'unknown'); }
        function setBusy(btn, on, label) {
          btn.disabled = on; btn.innerHTML = on ? '<span class="mn-spin"></span>' + esc(label) : esc(label);
        }

        function renderEvents(evs) {
          var html = '';
          evs.forEach(function (ev) {
            if (ev.type === 'proposed') {
              html += '<div class="mn-ev"><b>Proposed</b> <code>' + esc(ev.fn) + '(' + esc(ev.args && ev.args.path ? ev.args.path : JSON.stringify(ev.args || {})) + ')</code>' +
                '<small>' + esc(ev.model || 'model') + (ev.model_ms != null ? ' · ' + esc(ev.model_ms) + ' ms' : '') + '</small></div>';
            } else if (ev.type === 'verdict') {
              html += '<div class="mn-ev">' + tag(ev.verdict) + (ev.audit_seq != null ? '<b>audit #' + esc(ev.audit_seq) + '</b>' : '') +
                '<small>rule ' + esc(ev.rule || '-') + (ev.reason ? ' · ' + esc(ev.reason) : '') + '</small></div>';
            } else if (ev.type === 'final') {
              html += '<div class="mn-ev"><b>Final</b><div>' + esc(ev.text) + '</div></div>';
            }
          });
          agentEl.innerHTML = html || '<div class="mn-empty">' + esc(T('mines_nohint')) + '</div>';
        }

        hintBtn.addEventListener('click', async function () {
          if (over) { toast(T('mines_over')); hintLbl.textContent = T('mines_over'); return; }
          clearHint(); setBusy(hintBtn, true, T('mines_hint'));
          agentEl.innerHTML = '<div class="mn-empty"><span class="mn-spin" style="display:inline-block;vertical-align:-2px;margin-right:6px"></span>' + esc(T('mines_thinking')) + '</div>';
          try {
            var res = await window.VK_API('game/hint', { session: window.VK_SID, board: boardText() });
            var evs = (res && res.events) || [];
            renderEvents(evs);
            var final = '';
            evs.forEach(function (ev) {
              if (ev.type === 'verdict') addAudit('hint: ' + (ev.fn || 'read_file'), ev.verdict, ev.audit_seq);
              if (ev.type === 'final') final = ev.text || '';
            });
            var m = /(\d+)\s*,\s*(\d+)/.exec(final);
            if (m) {
              var r = +m[1], c = +m[2], i = r * C + c;
              if (r < R && c < C && !open[i] && !flag[i] && !over) {
                hintIdx = i; cells[i].classList.add('hint'); setFocus(i, true);
                hintLbl.textContent = T('mines_suggest') + ' (row ' + r + ', col ' + c + ')'; return;
              }
            }
            hintLbl.textContent = T('mines_nohint');
          } catch (e) {
            agentEl.innerHTML = '<div class="mn-errbox">' + esc(errMsg(e)) + '</div><button class="mn-btn" data-a="retry" style="margin-top:6px;width:100%">' + esc(T('mines_retry')) + '</button>';
            var rb = agentEl.querySelector('[data-a=retry]'); rb.addEventListener('click', function () { hintBtn.click(); });
          } finally { setBusy(hintBtn, false, T('mines_hint')); }
        });

        var overlay = null;
        function closeOverlay() { if (overlay) { overlay.forEach(function (n) { n.remove(); }); overlay = null; gridEl.focus(); } }
        function showOverlay(cls, html) {
          closeOverlay();
          var bg = document.createElement('div'); bg.className = 'mn-over'; bg.addEventListener('click', closeOverlay);
          var box = document.createElement('div'); box.className = cls; box.setAttribute('role', 'dialog'); box.innerHTML = html;
          root.appendChild(bg); root.appendChild(box); overlay = [bg, box];
          var cb = box.querySelector('[data-a=close]'); if (cb) { cb.addEventListener('click', closeOverlay); cb.focus(); }
        }
        root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay) { closeOverlay(); e.stopPropagation(); } });

        cheatBtn.addEventListener('click', async function () {
          setBusy(cheatBtn, true, T('mines_cheat'));
          var ctl = null, done = false;
          try {
            var res = await Promise.race([
              window.VK_API('game/cheat', {}),
              new Promise(function (_, rej) { ctl = setTimeout(function () { if (!done) rej(new Error('timeout')); }, 8000); })
            ]);
            done = true; clearTimeout(ctl);
            var path = (res && res.args && res.args.path) || 'game/secret/mines.map';
            var v = String(res && res.verdict || 'DENY').toUpperCase();
            addAudit('cheat: ' + (res && res.fn || 'read_file'), v, res && res.audit_seq);
            showOverlay('mn-deny',
              '<div class="big">' + (v === 'ALLOW' ? 'ALLOW' : 'DENY') + '</div>' +
              '<p><b>DENY · rule ' + esc(res && res.rule || 'manifest') + ' · path ' + esc(path) + ' is outside the declared scope (game/visible/)</b></p>' +
              '<p>Call: <code>' + esc(res && res.fn || 'read_file') + '("' + esc(path) + '")</code>' + (res && res.app ? ' by <code>' + esc(res.app) + '</code>' : '') + '</p>' +
              (res && res.reason ? '<p>Reason (manifest rule): ' + esc(res.reason) + '</p>' : '') +
              (res && res.audit_seq != null ? '<p>Recorded as audit #' + esc(res.audit_seq) + '.</p>' : '') +
              '<p style="color:var(--mn-sub)">The app never saw the mine map. Your game is unchanged.</p>' +
              '<button class="mn-btn" data-a="close" style="width:100%">' + esc(T('mines_close')) + '</button>');
          } catch (e) {
            done = true; clearTimeout(ctl);
            showOverlay('mn-deny', '<div class="big" style="font-size:18px">' + esc(T('mines_err')) + '</div><p>' + esc(errMsg(e)) + '</p>' +
              '<button class="mn-btn" data-a="close" style="width:100%">' + esc(T('mines_close')) + '</button>');
          } finally { setBusy(cheatBtn, false, T('mines_cheat')); }
        });

        q('[data-a=about]').addEventListener('click', function () {
          showOverlay('mn-about',
            '<h3>Minesweeper for ViKernel Desktop</h3>' +
            '<p>Clear every safe cell without opening a mine. Numbers show how many mines touch a cell. The first click is always safe.</p>' +
            '<ul><li>Click or tap: reveal. Click a number with matching flags around it to open its neighbors.</li>' +
            '<li>Right-click, Shift+click or long-press: flag.</li><li>Keys: arrows move, Space or Enter reveals, F flags, N starts a new game.</li></ul>' +
            '<h3>Declared scope</h3>' +
            '<p>This is a VDR app verified by ViKernel. Its manifest declares one permission: read files under <code>game/visible/</code>. It makes no network calls of its own. ' +
            'The AI hint sends only the visible board (hidden cells as #, flags as F, revealed numbers). Mine positions stay inside this window and are never shared.</p>' +
            '<p>"Try to cheat" asks the kernel to read <code>game/secret/mines.map</code>. The path is outside the declared scope, so the kernel denies it and logs the attempt in the audit list.</p>' +
            '<p>AI hints come from Muse Spark and may be wrong. Hints are highlighted, never played for you.</p>' +
            '<button class="mn-btn" data-a="close">' + esc(T('mines_close')) + '</button>');
        });

        agentEmpty(); renderAudit(); newGame();
        setTimeout(fit, 0);
      }
    };
  };

  // ---------- install ----------
  window.VK_MINES_INSTALL = function () {
    lsSet('vk_mines_installed', '1');
    if (window.VK_HX_ADD) window.VK_HX_ADD(window.VK_MINES_APP);
  };
  // preinstalled for every visitor (shipped from the App Store as a VDR package)
  if (true) {
    var waited = 0;
    var poll = setInterval(function () {
      if (window.VK_HX_ADD) { clearInterval(poll); try { window.VK_HX_ADD(window.VK_MINES_APP); } catch (e) { /* ignore */ } }
      else if ((waited += 200) >= 10000) clearInterval(poll);
    }, 200);
  }
})();
