function segLine(a) {
  if (!a || !a.enabled || a.segment == null) return '';
  const link = a.prev_head ? 'linked to previous head ' + String(a.prev_head).slice(0, 16) : 'first segment';
  return '\nsegment       ' + a.segment + ' (' + link + ')' +
    '\narchived      ' + a.archived_records + ' records, ' + a.segments_verified + ' earlier segment' + (a.segments_verified === 1 ? '' : 's') + ' re-verified' +
    (a.segments_failed && a.segments_failed.length ? ', FAILED: ' + a.segments_failed.join(',') : '');
}
/* ViKernel Desktop: Terminal app.
 * Browser-only shell over an in-memory virtual filesystem. Nothing here runs on a real server.
 * Live calls go only to api/ag/* through h.api. Security-sensitive commands are sent to the real gate.
 */
(function () {
  'use strict';

  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const XTERM_JS = CDN + '@xterm/xterm@5.5.0/lib/xterm.js';
  const XTERM_CSS = CDN + '@xterm/xterm@5.5.0/css/xterm.css';
  const FIT_JS = CDN + '@xterm/addon-fit@0.10.0/lib/addon-fit.js';
  const VFS_KEY = 'vk_term_vfs_v1';
  const HIST_KEY = 'vk_term_hist_v1';
  const HOME = '/home/guest';

  // ANSI helpers
  const C = {
    r: s => '\x1b[31m' + s + '\x1b[0m', g: s => '\x1b[32m' + s + '\x1b[0m',
    y: s => '\x1b[33m' + s + '\x1b[0m', b: s => '\x1b[34m' + s + '\x1b[0m',
    c: s => '\x1b[36m' + s + '\x1b[0m', m: s => '\x1b[35m' + s + '\x1b[0m',
    dim: s => '\x1b[2m' + s + '\x1b[0m', bold: s => '\x1b[1m' + s + '\x1b[0m',
  };
  const stripAnsi = s => String(s).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');

  // ---------- CDN loader (inject once, await) ----------
  function loadTag(kind, url) {
    return new Promise((res, rej) => {
      const sel = kind === 'script' ? 'script[src="' + url + '"]' : 'link[href="' + url + '"]';
      const prev = document.querySelector(sel);
      if (prev) {
        if (prev.dataset.loaded === '1') return res();
        prev.addEventListener('load', () => res());
        prev.addEventListener('error', () => rej(new Error('cdn')));
        return;
      }
      const el = document.createElement(kind);
      if (kind === 'script') { el.src = url; el.async = false; } else { el.rel = 'stylesheet'; el.href = url; }
      el.addEventListener('load', () => { el.dataset.loaded = '1'; res(); });
      el.addEventListener('error', () => rej(new Error('cdn')));
      document.head.appendChild(el);
    });
  }
  function loadXterm() {
    if (!window.__vkXtermP) {
      window.__vkXtermP = Promise.all([loadTag('link', XTERM_CSS), loadTag('script', XTERM_JS)])
        .then(() => loadTag('script', FIT_JS))
        .then(() => { if (!window.Terminal || !window.FitAddon) throw new Error('cdn'); });
      window.__vkXtermP.catch(() => { window.__vkXtermP = null; });
    }
    return window.__vkXtermP;
  }

  // ---------- Virtual filesystem ----------
  const dir = (c) => ({ t: 'd', c: c || {} });
  const file = (d) => ({ t: 'f', d: d });

  function defaultFS() {
    return dir({
      home: dir({ guest: dir({
        'readme.txt': file('Welcome to ViKernel Desktop.\nThis terminal runs entirely in your browser on a virtual filesystem.\nTry: help, vik status, vik audit tail, ask "list my files", rm -rf /\n'),
        'notes.md': file('# Notes\n- Every agent action passes the gate first.\n- The audit log is a hash chain; verify it with `vik audit verify`.\n- The kill switch halts everything: `vik kill`.\n'),
        project: dir({
          'main.py': file('def main():\n    print("hello from a sandboxed project")\n\nif __name__ == "__main__":\n    main()\n'),
          'config.json': file('{\n  "name": "demo-project",\n  "version": "0.1.0",\n  "policy": "allowlist"\n}\n'),
        }),
      }) }),
      etc: dir({
        hostname: file('vikernel\n'),
        'os-release': file('NAME="ViKernel Secure OS"\nVERSION="1.0 (demo)"\nID=vikernel\nPRETTY_NAME="ViKernel Secure OS 1.0 (browser demo)"\n'),
        passwd: file('root:x:0:0:root:/root:/bin/vsh\ngate:x:100:100:policy gate:/var/gate:/sbin/nologin\nagent:x:200:200:agent runtime:/var/agent:/sbin/nologin\nguest:x:1000:1000:Guest:/home/guest:/bin/vsh\n'),
        shadow: file('(protected)'),
      }),
      var: dir({ log: dir({
        'vikernel.log': file('[    0.000] vikernel: boot, mode B (CPU reference)\n[    0.012] integrity: measured boot OK\n[    0.031] gate: policy loaded (allowlist + rules)\n[    0.044] audit: chain opened\n[    0.090] agent: runtime attached, model muse-spark-1.3\n'),
      }) }),
      apps: dir({}),
      tmp: dir({}),
    });
  }

  window.VK_TERM = (body, h) => {
    h = h || {};
    const api = h.api;
    let root;
    try { root = JSON.parse(sessionStorage.getItem(VFS_KEY) || 'null'); } catch (e) { root = null; }
    if (!root || root.t !== 'd') root = defaultFS();
    let cwd = HOME;
    let history = [];
    try { history = JSON.parse(sessionStorage.getItem(HIST_KEY) || '[]') || []; } catch (e) { history = []; }
    let halted = false;
    const poll = setInterval(() => { if (!body.isConnected) { clearInterval(poll); return; } refreshState(); }, 12000);
    window.addEventListener('vk-kernel-state', e => { halted = e.detail === 'HALTED'; });
    let online = true;

    const save = () => {
      try { sessionStorage.setItem(VFS_KEY, JSON.stringify(root)); } catch (e) { /* storage unavailable */ }
      try { sessionStorage.setItem(HIST_KEY, JSON.stringify(history.slice(-200))); } catch (e) { /* ignore */ }
    };

    // Sync /apps from the store's installed apps (shape tolerant).
    function installedIds() {
      const s = h.store;
      let list = [];
      try {
        if (typeof s === 'function') list = s() || [];
        else if (Array.isArray(s)) list = s;
        else if (s && Array.isArray(s.installed)) list = s.installed;
        else if (s && typeof s.installed === 'string') list = [s.installed];
        else if (s && s.installed && typeof s.installed === 'object') list = [s.installed];
      } catch (e) { list = []; }
      return list.map(a => (typeof a === 'string' ? a : (a && (a.id || a.name)))).filter(Boolean);
    }
    function addAppManifest(id, meta) {
      const apps = root.c.apps || (root.c.apps = dir());
      const d = apps.c[id] || (apps.c[id] = dir());
      d.c['manifest.json'] = file(JSON.stringify(Object.assign({ id: id, source: 'store', note: 'installed for this session' }, meta || {}), null, 2) + '\n');
    }
    installedIds().forEach(id => { if (!root.c.apps.c[id]) addAppManifest(id); });

    // Path helpers
    function norm(p) {
      if (!p || p === '~') p = HOME;
      else if (p.startsWith('~/')) p = HOME + p.slice(1);
      if (!p.startsWith('/')) p = cwd + '/' + p;
      const out = [];
      p.split('/').forEach(seg => {
        if (!seg || seg === '.') return;
        if (seg === '..') out.pop(); else out.push(seg);
      });
      return '/' + out.join('/');
    }
    function lookup(p) {
      let n = root;
      for (const seg of norm(p).split('/').filter(Boolean)) {
        if (!n || n.t !== 'd' || !n.c[seg]) return null;
        n = n.c[seg];
      }
      return n;
    }
    function parentOf(p) {
      const a = norm(p); const i = a.lastIndexOf('/');
      return { dir: lookup(a.slice(0, i) || '/'), name: a.slice(i + 1), path: a };
    }
    const disp = p => (p === HOME ? '~' : p.startsWith(HOME + '/') ? '~' + p.slice(HOME.length) : p);
    const isShadow = p => norm(p) === '/etc/shadow';
    function readFile(p) {
      if (isShadow(p)) throw new Error(p + ': permission denied (sandbox)');
      const n = lookup(p);
      if (!n) throw new Error(p + ': no such file or directory');
      if (n.t === 'd') throw new Error(p + ': is a directory');
      return n.d;
    }
    function writeFile(p, data, append) {
      if (isShadow(p) || norm(p).startsWith('/etc/')) throw new Error(p + ': permission denied (sandbox)');
      const { dir: d, name } = parentOf(p);
      if (!d || d.t !== 'd') throw new Error(p + ': no such file or directory');
      if (d.c[name] && d.c[name].t === 'd') throw new Error(p + ': is a directory');
      d.c[name] = file((append && d.c[name] ? d.c[name].d : '') + data);
      save();
    }
    function mkdirP(p) {
      let n = root;
      for (const seg of norm(p).split('/').filter(Boolean)) {
        if (!n.c[seg]) n.c[seg] = dir();
        n = n.c[seg];
        if (n.t !== 'd') throw new Error(p + ': not a directory');
      }
    }
    const clone = n => JSON.parse(JSON.stringify(n));
    function walk(n, p, fn) {
      fn(p, n);
      if (n.t === 'd') Object.keys(n.c).sort().forEach(k => walk(n.c[k], (p === '/' ? '' : p) + '/' + k, fn));
    }
    async function sha256(text) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Flag parsing: returns {f:Set, n:value, rest:[]}
    function flags(args, withValue) {
      const f = new Set(); const rest = []; const vals = {};
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (withValue && withValue.includes(a)) { vals[a] = args[++i]; continue; }
        if (/^-[A-Za-z]+$/.test(a)) a.slice(1).split('').forEach(ch => f.add(ch)); else rest.push(a);
      }
      return { f, vals, rest };
    }

    // ---------- Live backend helpers ----------
    function apiErr(e) {
      if (e && e.message === 'rate') return C.y('The live backend is busy (rate limit). Please wait a few seconds and try again.');
      online = false;
      return C.r('live backend unavailable (' + ((e && e.message) || 'error') + ')');
    }
    async function refreshState() {
      try { const s = await api('status'); halted = String(s.kernel_state || '').toUpperCase() === 'HALTED'; online = true; return s; }
      catch (e) { return null; }
    }
    function verdictLine(v) {
      const verdict = String(v.verdict || '?').toUpperCase();
      const col = verdict === 'ALLOW' ? C.g : verdict === 'HALTED' ? C.y : C.r;
      const rule = v.reason ? ' (' + v.reason + ')' : (v.rule ? ' (rule ' + v.rule + ')' : '');
      const seq = v.audit_seq != null ? ' audit #' + v.audit_seq : '';
      return col(verdict + rule + seq);
    }
    async function gate(fn, args) {
      try {
        const v = await api('gate/decide', { fn: fn, args: args });
        if (String(v.verdict).toUpperCase() === 'HALTED') halted = true;
        return v;
      } catch (e) { return { error: apiErr(e) }; }
    }

    // ---------- Commands: (args, stdin) -> string ----------
    const HELP = {
      ls: 'ls [-l] [-a] [path]  list directory', cd: 'cd [dir]  change directory', pwd: 'pwd  print working directory',
      cat: 'cat <file...>  print files', echo: 'echo <text>  print text', mkdir: 'mkdir [-p] <dir>  create directory',
      touch: 'touch <file>  create empty file', rm: 'rm [-r] [-f] <path>  remove', cp: 'cp [-r] <src> <dst>  copy',
      mv: 'mv <src> <dst>  move or rename', grep: 'grep [-i] [-n] <pattern> [file]  search text',
      head: 'head [-n N] [file]  first lines', tail: 'tail [-n N] [file]  last lines', wc: 'wc [-l] [-w] [-c] [file]  count',
      find: 'find [path] [-name pattern]  find files', tree: 'tree [path]  directory tree', whoami: 'whoami  current user',
      uname: 'uname [-a]  system info', date: 'date  current date', history: 'history  command history',
      clear: 'clear  clear the screen (Ctrl+L)', help: 'help  list commands', man: 'man <cmd>  command manual',
      top: 'top  process snapshot', ps: 'ps  process list', download: 'download <file>  save a VFS file to your computer',
      vik: 'vik status | kill | resume --key <k> | audit tail [n] | audit verify | policy list | apps list|install <id>|remove',
      vdrpack: 'vdrpack init <dir> | build <dir> <out.vdr> | sign <file> | verify <file>  (browser preview)',
      ask: 'ask "<prompt>"  send a request to the gated agent (Meta Muse Spark 1.3)',
    };

    function lsLine(name, n, long) {
      const label = n.t === 'd' ? C.b(name + '/') : name;
      if (!long) return label;
      const size = n.t === 'd' ? 4096 : n.d.length;
      return (n.t === 'd' ? 'drwxr-xr-x' : '-rw-r--r--') + ' guest guest ' + String(size).padStart(6) + ' ' + label;
    }
    function procTable() {
      const apps = Object.keys((root.c.apps && root.c.apps.c) || {});
      const rows = [['1', 'root', '0.3', '1.2', halted ? 'T' : 'S', 'vikernel (kernel, mode B)'],
        ['42', 'gate', '0.8', '0.6', 'S', 'gate --policy allowlist+rules'],
        ['77', 'agent', '2.1', '3.4', halted ? 'T' : 'S', 'agent --model muse-spark-1.3'],
        ['91', 'root', '0.1', '0.2', 'S', 'auditd --chain sha256']];
      apps.forEach((a, i) => rows.push([String(120 + i), 'guest', '0.2', '0.5', halted ? 'T' : 'S', 'app ' + a + ' (sandboxed)']));
      rows.push(['300', 'guest', '0.0', '0.1', 'R', 'vsh (this terminal)']);
      return '  PID USER   %CPU %MEM S COMMAND\n' + rows.map(r => r[0].padStart(5) + ' ' + r[1].padEnd(6) + ' ' + r[2].padStart(4) + ' ' + r[3].padStart(4) + ' ' + r[4] + ' ' + r[5]).join('\n');
    }

    const cmds = {
      async help() {
        return C.bold('ViKernel shell (browser preview). Commands:') + '\n' +
          Object.keys(HELP).sort().map(k => '  ' + C.c(k.padEnd(9)) + ' ' + HELP[k].replace(/^\S+\s*/, '')).join('\n') +
          '\nPipes (|) and redirects (>, >>) work. Tab completes. Ctrl+Shift+C copies, Ctrl+V pastes.';
      },
      async man(a) {
        if (!a[0]) return 'What manual page do you want?';
        return HELP[a[0]] ? C.bold(a[0].toUpperCase() + '(1)') + '\n\nSYNOPSIS\n  ' + HELP[a[0]] : 'No manual entry for ' + a[0];
      },
      async pwd() { return cwd; },
      async whoami() { return 'guest'; },
      async date() { return new Date().toString(); },
      async uname(a) { return a.includes('-a') ? 'ViKernel vikernel 1.0-demo #1 SMP mode-B (CPU reference) wasm32 browser ViKernel/OS' : 'ViKernel'; },
      async history() { return history.map((l, i) => String(i + 1).padStart(4) + '  ' + l).join('\n'); },
      async echo(a) { return a.join(' '); },
      async ps() { return procTable(); },
      async top() { return C.bold('top - ' + new Date().toTimeString().slice(0, 8) + ' up 0 min, 1 user, kernel ' + (halted ? C.y('HALTED') : C.g('RUNNING'))) + '\n' + procTable() + '\n' + C.dim('(static snapshot)'); },
      async cd(a) {
        const p = norm(a[0] || '~'); const n = lookup(p);
        if (!n) throw new Error('cd: ' + a[0] + ': no such file or directory');
        if (n.t !== 'd') throw new Error('cd: ' + a[0] + ': not a directory');
        cwd = p; return '';
      },
      async ls(a) {
        const { f, rest } = flags(a);
        const targets = rest.length ? rest : ['.'];
        return targets.map(t => {
          const n = lookup(t);
          if (!n) throw new Error('ls: cannot access ' + t + ': no such file or directory');
          if (n.t === 'f') return lsLine(t, n, f.has('l'));
          let names = Object.keys(n.c).sort();
          if (!f.has('a')) names = names.filter(x => !x.startsWith('.'));
          else names = ['.', '..'].concat(names);
          const lines = names.map(x => lsLine(x, n.c[x] || dir(), f.has('l')));
          const body = f.has('l') ? lines.join('\n') : lines.join('  ');
          return (targets.length > 1 ? t + ':\n' : '') + body;
        }).join('\n');
      },
      async cat(a, stdin) {
        if (!a.length) return stdin || '';
        return a.map(p => readFile(p)).join('').replace(/\n$/, '');
      },
      async mkdir(a) {
        const { f, rest } = flags(a);
        rest.forEach(p => {
          if (f.has('p')) return mkdirP(p);
          const { dir: d, name } = parentOf(p);
          if (!d) throw new Error('mkdir: cannot create ' + p + ': no such file or directory');
          if (d.c[name]) throw new Error('mkdir: cannot create ' + p + ': file exists');
          d.c[name] = dir();
        });
        save(); return '';
      },
      async touch(a) { a.forEach(p => { if (!lookup(p)) writeFile(p, ''); }); return ''; },
      async rm(a) {
        const { f, rest } = flags(a);
        rest.forEach(p => {
          const { dir: d, name, path } = parentOf(p);
          if (path.startsWith('/etc') || path === '/') throw new Error('rm: ' + p + ': permission denied (sandbox)');
          if (!d || !d.c[name]) { if (!f.has('f')) throw new Error('rm: cannot remove ' + p + ': no such file or directory'); return; }
          if (d.c[name].t === 'd' && !f.has('r')) throw new Error('rm: cannot remove ' + p + ': is a directory');
          delete d.c[name];
        });
        save(); return '';
      },
      async cp(a) {
        const { f, rest } = flags(a);
        if (rest.length < 2) throw new Error('cp: missing operand');
        const src = lookup(rest[0]);
        if (!src || isShadow(rest[0])) throw new Error('cp: cannot stat ' + rest[0]);
        if (src.t === 'd' && !f.has('r')) throw new Error('cp: -r not specified; omitting directory ' + rest[0]);
        let dst = rest[1]; const dn = lookup(dst);
        if (dn && dn.t === 'd') dst = norm(dst) + '/' + norm(rest[0]).split('/').pop();
        const { dir: d, name } = parentOf(dst);
        if (!d) throw new Error('cp: cannot create ' + rest[1]);
        d.c[name] = clone(src); save(); return '';
      },
      async mv(a) {
        if (a.length < 2) throw new Error('mv: missing operand');
        const s = parentOf(a[0]);
        if (!s.dir || !s.dir.c[s.name] || s.path.startsWith('/etc')) throw new Error('mv: cannot move ' + a[0]);
        let dst = a[1]; const dn = lookup(dst);
        if (dn && dn.t === 'd') dst = norm(dst) + '/' + s.name;
        const d = parentOf(dst);
        if (!d.dir) throw new Error('mv: cannot move to ' + a[1]);
        d.dir.c[d.name] = s.dir.c[s.name]; delete s.dir.c[s.name]; save(); return '';
      },
      async grep(a, stdin) {
        const { f, rest } = flags(a);
        if (!rest.length) throw new Error('usage: grep [-i] [-n] pattern [file]');
        let re;
        try { re = new RegExp(rest[0], f.has('i') ? 'i' : ''); } catch (e) { throw new Error('grep: bad pattern'); }
        const text = rest[1] ? readFile(rest[1]) : (stdin || '');
        return text.split('\n').map((l, i) => re.test(l) ? (f.has('n') ? C.g(String(i + 1)) + ':' : '') + l : null).filter(x => x !== null).join('\n');
      },
      async head(a, stdin) {
        const { vals, rest } = flags(a, ['-n']); const n = parseInt(vals['-n'] || '10', 10);
        return (rest[0] ? readFile(rest[0]) : stdin || '').replace(/\n$/, '').split('\n').slice(0, n).join('\n');
      },
      async tail(a, stdin) {
        const { vals, rest } = flags(a, ['-n']); const n = parseInt(vals['-n'] || '10', 10);
        return (rest[0] ? readFile(rest[0]) : stdin || '').replace(/\n$/, '').split('\n').slice(-n).join('\n');
      },
      async wc(a, stdin) {
        const { f, rest } = flags(a);
        const t = rest[0] ? readFile(rest[0]) : (stdin || '');
        const l = (t.match(/\n/g) || []).length, w = (t.match(/\S+/g) || []).length, c = new TextEncoder().encode(t).length;
        const parts = [];
        if (!f.size || f.has('l')) parts.push(l);
        if (!f.size || f.has('w')) parts.push(w);
        if (!f.size || f.has('c')) parts.push(c);
        return parts.map(x => String(x).padStart(7)).join('') + (rest[0] ? ' ' + rest[0] : '');
      },
      async find(a) {
        const { vals, rest } = flags(a, ['-name']);
        const base = norm(rest[0] || '.'); const n = lookup(base);
        if (!n) throw new Error('find: ' + rest[0] + ': no such file or directory');
        const pat = vals['-name'] ? new RegExp('^' + vals['-name'].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$') : null;
        const out = [];
        walk(n, base, (p) => { if (!pat || pat.test(p.split('/').pop())) out.push(p); });
        return out.join('\n');
      },
      async tree(a) {
        const base = norm(a[0] || '.'); const n = lookup(base);
        if (!n || n.t !== 'd') throw new Error('tree: ' + (a[0] || '.') + ': not a directory');
        const lines = [C.b(disp(base))]; let nd = 0, nf = 0;
        (function rec(d, pre) {
          const ks = Object.keys(d.c).sort();
          ks.forEach((k, i) => {
            const last = i === ks.length - 1; const c = d.c[k];
            lines.push(pre + (last ? '`-- ' : '|-- ') + (c.t === 'd' ? C.b(k) : k));
            if (c.t === 'd') { nd++; rec(c, pre + (last ? '    ' : '|   ')); } else nf++;
          });
        })(n, '');
        return lines.join('\n') + '\n\n' + nd + ' directories, ' + nf + ' files';
      },
      async download(a) {
        if (!a[0]) throw new Error('usage: download <file>');
        const text = readFile(a[0]);
        const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
        const link = document.createElement('a');
        link.href = url; link.download = norm(a[0]).split('/').pop();
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return C.g('downloaded ' + link.download + ' (' + text.length + ' bytes, from the browser VFS)');
      },

      async vik(a) {
        const sub = a[0], sub2 = a[1];
        try {
          if (sub === 'status') {
            const s = await api('status');
            halted = String(s.kernel_state || '').toUpperCase() === 'HALTED'; online = true;
            const st = halted ? C.y(s.kernel_state) : C.g(s.kernel_state);
            return 'kernel_state  ' + st + '\naudit_n       ' + s.audit_n + '\naudit_head    ' + String(s.audit_head || '').slice(0, 16) +
              '\nverified      ' + (s.verified ? C.g('true') : C.r(String(s.verified))) + segLine(s.archive);
          }
          if (sub === 'kill') {
            const r = await api('kill', {}); await refreshState();
            return C.y((r && (r.message || r.msg)) || 'kill switch engaged');
          }
          if (sub === 'resume') {
            const i = a.indexOf('--key'); const key = i >= 0 ? a[i + 1] : '';
            if (!key) return 'usage: vik resume --key <operator key>';
            const r = await api('resume', { key: key }); await refreshState();
            const msg = (r && (r.message || r.msg)) || (halted ? 'refused' : 'resumed');
            return halted ? C.r(msg) : C.g(msg);
          }
          if (sub === 'audit' && sub2 === 'tail') {
            const n = parseInt(a[2] || '10', 10) || 10;
            const r = await api('audit');
            const rows = (r.entries || r.audit || r.rows || (Array.isArray(r) ? r : [])).slice(-n);
            if (!rows.length) return '(audit log is empty)';
            return rows.map(e => {
              const ok = e.ok === false || /DENY|REFUS/i.test(String(e.verdict || '')) ? C.r('refused') : C.g('ok');
              return '#' + e.seq + ' ' + (e.actor || '-') + ' ' + (e.cmd || e.fn || '-') + ' ' + ok + ' ' + (e.state || e.kernel_state || '-') + ' ' + C.dim(String(e.chain || e.hash || '').slice(0, 12));
            }).join('\n');
          }
          if (sub === 'audit' && sub2 === 'verify') {
            const r = await api('audit'); const v = r.verify || {};
            return 'verify.ok  ' + (v.ok ? C.g('true') : C.r(String(v.ok))) + '\nverify.n   ' + v.n;
          }
          if (sub === 'policy' && sub2 === 'list') {
            return C.bold('RULE  MEANING') + '\n' +
              '  ' + C.g('A') + '   allowlisted action: allowed and recorded in the audit chain\n' +
              '  ' + C.r('D') + '   dangerous action (shell, network send, secrets): denied\n' +
              '  ' + C.r('F') + '   function not on the allowlist: denied\n' +
              '  ' + C.c('M') + '   store apps may only call what their manifest declares\n' +
              '  ' + C.y('HALT') + ' kill switch engaged: every action is refused until operator resume';
          }
          if (sub === 'apps') {
            if (sub2 === 'list') {
              const r = await api('store/catalog');
              const apps = r.apps || r.catalog || r.items || (Array.isArray(r) ? r : []);
              const inst = Object.keys(root.c.apps.c);
              return apps.map(x => (inst.includes(x.id) ? C.g('* ') : '  ') + C.c(String(x.id).padEnd(18)) + ' ' + (x.name || '') + (x.desc || x.description ? C.dim('  ' + (x.desc || x.description)) : '')).join('\n') + '\n' + C.dim('(* = installed in this session)');
            }
            if (sub2 === 'install') {
              if (!a[2]) return 'usage: vik apps install <id>';
              const r = await api('store/install', { id: a[2], session: window.VK_SID });
              addAppManifest(a[2], r && r.manifest ? r.manifest : null); save();
              return C.g('installed ' + a[2]) + ' -> /apps/' + a[2] + '/manifest.json' + (r && r.message ? '\n' + r.message : '');
            }
            if (sub2 === 'remove') {
              const r = await api('store/install', { id: '', session: window.VK_SID });
              root.c.apps = dir(); save();
              return C.y((r && r.message) || 'apps removed for this session');
            }
          }
        } catch (e) { return apiErr(e); }
        return 'usage: ' + HELP.vik;
      },

      async vdrpack(a) {
        const note = C.dim('browser preview. Real packages are built with vdrpack.py (downloadable at downloads/vdrpack.py).');
        const [sub, x, y] = a;
        if (sub === 'init') {
          if (!x) return 'usage: vdrpack init <dir>';
          mkdirP(x + '/app');
          const name = norm(x).split('/').pop();
          writeFile(x + '/manifest.json', JSON.stringify({ id: name, version: '0.1.0', entry: 'app/workflow.json', permissions: ['read_file'] }, null, 2) + '\n');
          writeFile(x + '/app/workflow.json', JSON.stringify({ steps: [{ fn: 'read_file', args: { path: '~/readme.txt' } }] }, null, 2) + '\n');
          writeFile(x + '/icon.png', '(placeholder icon)');
          return C.g('initialized ' + disp(norm(x))) + ': manifest.json, app/workflow.json, icon.png\n' + note;
        }
        if (sub === 'build') {
          if (!x || !y) return 'usage: vdrpack build <dir> <out.vdr>';
          const n = lookup(x); if (!n || n.t !== 'd') throw new Error('vdrpack: ' + x + ': not a directory');
          const base = norm(x); const files = [];
          const list = []; walk(n, base, (p, m) => { if (m.t === 'f') list.push([p, m.d]); });
          for (const [p, d] of list) files.push({ path: p.slice(base.length + 1), size: d.length, sha256: await sha256(d) });
          writeFile(y, JSON.stringify({ format: 'vdr-preview', label: 'browser preview', built: new Date().toISOString(), files: files }, null, 2) + '\n');
          return C.g('built ' + y) + ' (' + files.length + ' files hashed with sha256)\n' + note;
        }
        if (sub === 'sign') {
          if (!x) return 'usage: vdrpack sign <file>';
          const pkg = JSON.parse(readFile(x));
          const digest = await sha256(JSON.stringify(pkg.files || []));
          pkg.signature = { label: 'demo signature (browser preview, not ed25519)', value: 'demo-' + digest.slice(0, 32) };
          writeFile(x, JSON.stringify(pkg, null, 2) + '\n');
          return C.y('signed ' + x + ' with a demo signature (browser preview, not ed25519)') + '\n' + note;
        }
        if (sub === 'verify') {
          if (!x) return 'usage: vdrpack verify <file>';
          const pkg = JSON.parse(readFile(x));
          const dirGuess = norm(x).replace(/\/[^/]*$/, '');
          const out = []; let bad = 0;
          for (const fl of pkg.files || []) {
            let cur = null;
            const cands = [dirGuess + '/' + (norm(x).split('/').pop().replace(/\.vdr$/, '')) + '/' + fl.path, dirGuess + '/' + fl.path];
            for (const c of cands) { const m = lookup(c); if (m && m.t === 'f') { cur = await sha256(m.d); break; } }
            const ok = cur === fl.sha256; if (!ok) bad++;
            out.push((ok ? C.g('OK  ') : C.r(cur ? 'BAD ' : 'MISS')) + ' ' + fl.path);
          }
          out.push(pkg.signature ? C.y('signature: ' + pkg.signature.label) : C.dim('unsigned'));
          out.push(bad ? C.r(bad + ' file(s) failed') : C.g('all hashes match'));
          return out.join('\n') + '\n' + note;
        }
        return 'usage: ' + HELP.vdrpack + '\n' + note;
      },

      async ask(a) {
        const msg = a.join(' ').trim();
        if (!msg) return 'usage: ask "<prompt>"';
        let r;
        try { r = await withSpinner(api('chat', { message: msg, session: window.VK_SID })); } catch (e) { return apiErr(e); }
        const out = [];
        (r.events || []).forEach(ev => {
          const t = ev.type;
          if (t === 'proposed') out.push(C.dim('proposed  ' + ev.fn + '(' + JSON.stringify(ev.args || {}) + ')  ' + (ev.model || '') + ' ' + (ev.model_ms != null ? ev.model_ms + 'ms' : '') + ' ' + (ev.tokens != null ? ev.tokens + ' tok' : '')));
          else if (t === 'verdict') { out.push('verdict   ' + ev.fn + ' ' + verdictLine(ev)); if (String(ev.verdict).toUpperCase() === 'HALTED') halted = true; }
          else if (t === 'executed') { const res = typeof ev.result === 'string' ? ev.result : JSON.stringify(ev.result); out.push(C.c('executed  ' + ev.fn) + C.dim(' -> ' + String(res).slice(0, 300))); }
          else if (t === 'final') out.push('\n' + C.bold(ev.text || '') + (ev.model ? C.dim('\n[' + ev.model + ']') : ''));
        });
        return out.join('\n') || '(no response)';
      },
    };

    // ---------- Security demo routing ----------
    async function securityIntercept(line) {
      const t = line.trim();
      let fn = null, args = null, label = '';
      if (/^sudo\b/.test(t)) { fn = 'run_shell'; args = { command: t }; }
      else if (/^rm\b/.test(t) && /(^|\s)\/(\s|$|\*)|(^|\s)\/etc\b/.test(t)) { fn = 'run_shell'; args = { command: t }; }
      else if (/^(curl|wget)\b/.test(t)) {
        const url = (t.split(/\s+/).find(x => /^https?:\/\//i.test(x)) || t.split(/\s+/).pop() || '');
        fn = 'http_post'; args = { url: url, body: '' };
      } else if (/\/etc\/shadow\b/.test(t)) { fn = 'read_file'; args = { path: '/etc/shadow' }; label = 'shadow'; }
      if (!fn) return null;
      const v = await withSpinner(gate(fn, args));
      if (v.error) return v.error + '\n' + C.r('blocked locally (sandbox)');
      let out = C.dim('gate/decide ' + fn) + '\n' + verdictLine(v);
      if (String(v.verdict).toUpperCase() === 'ALLOW') out += '\n' + C.r(label === 'shadow' ? 'permission denied (sandbox)' : 'not executed: this terminal is a sandbox');
      return out;
    }

    // ---------- Parser and pipeline ----------
    function tokenize(s) {
      const toks = []; let cur = ''; let q = null; let has = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (q) { if (ch === q) q = null; else if (ch === '\\' && q === '"' && i + 1 < s.length) cur += s[++i]; else cur += ch; continue; }
        if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
        if (/\s/.test(ch)) { if (cur || has) toks.push(cur); cur = ''; has = false; continue; }
        if (ch === '|') { if (cur || has) toks.push(cur); toks.push({ op: '|' }); cur = ''; has = false; continue; }
        if (ch === '>') {
          if (cur || has) toks.push(cur); cur = ''; has = false;
          if (s[i + 1] === '>') { toks.push({ op: '>>' }); i++; } else toks.push({ op: '>' });
          continue;
        }
        cur += ch;
      }
      if (q) throw new Error('syntax error: unterminated quote');
      if (cur || has) toks.push(cur);
      return toks;
    }
    const ALWAYS = l => /^\s*(vik\s+status|vik\s+resume|clear|help)\b/.test(l);

    async function execLine(line) {
      if (!line.trim()) return '';
      if (halted && !ALWAYS(line)) await refreshState();
      if (halted && !ALWAYS(line)) return C.y('Kernel halted in your session. Press RESUME or type: vik resume --key <demo key from the guide> to continue.');
      const sec = await securityIntercept(line);
      if (sec !== null) return sec;
      const toks = tokenize(line);
      let redirect = null;
      const ri = toks.findIndex(x => typeof x === 'object' && x.op !== '|');
      if (ri >= 0) {
        if (typeof toks[ri + 1] !== 'string') throw new Error('syntax error near ' + toks[ri].op);
        redirect = { op: toks[ri].op, path: toks[ri + 1] };
        toks.splice(ri, 2);
      }
      const segs = [[]];
      toks.forEach(x => { if (typeof x === 'object' && x.op === '|') segs.push([]); else segs[segs.length - 1].push(x); });
      let data = '';
      for (const seg of segs) {
        if (!seg.length) throw new Error('syntax error near |');
        const name = seg[0];
        if (name === 'clear') { term.clear(); data = ''; continue; }
        const fnc = cmds[name];
        if (!fnc) throw new Error(name + ': command not found (try help)');
        data = await fnc(seg.slice(1), data);
        if (data == null) data = '';
        if (segs.length > 1) data = stripAnsi(data) + (data && !data.endsWith('\n') ? '\n' : '');
      }
      if (redirect) {
        writeFile(redirect.path, stripAnsi(data) + (data && !data.endsWith('\n') ? '\n' : ''), redirect.op === '>>');
        return '';
      }
      return String(data).replace(/\n$/, '');
    }

    // ---------- Terminal front end (xterm or fallback) ----------
    let term = null;
    let busy = false;
    let spinTimer = null;
    const prompt = () => C.g('guest@vikernel') + ':' + C.b(disp(cwd)) + '$ ';

    async function withSpinner(p) {
      const frames = ['|', '/', '-', '\\']; let i = 0;
      if (term && term.write) {
        term.write(C.dim(' working '));
        spinTimer = setInterval(() => term.write('\b' + frames[i++ % 4]), 100);
        term.write(' ');
      }
      try { return await p; }
      finally {
        clearInterval(spinTimer); spinTimer = null;
        if (term && term.write) term.write('\r\x1b[K');
      }
    }

    function out(s) { if (s) term.write(String(s).replace(/\r?\n/g, '\r\n') + '\r\n'); }

    async function runAndPrint(line) {
      busy = true;
      if (line.trim()) { history.push(line); save(); }
      try {
        const res = await execLine(line);
        out(res);
        if (/^\s*vik\s+(kill|resume)\b/.test(line) && h.toast) h.toast(halted ? 'Kernel halted' : 'Kernel running');
      } catch (e) { out(C.r(e.message || String(e))); }
      busy = false;
    }

    function completions(line) {
      const words = line.split(/\s+/); const last = words[words.length - 1];
      if (words.length === 1) return { last, items: Object.keys(cmds).concat(['clear']).filter(c => c.startsWith(last)) };
      const slash = last.lastIndexOf('/');
      const dpart = slash >= 0 ? last.slice(0, slash + 1) : '';
      const base = slash >= 0 ? last.slice(slash + 1) : last;
      const n = lookup(dpart || '.');
      if (!n || n.t !== 'd') return { last, items: [] };
      return { last, items: Object.keys(n.c).filter(k => k.startsWith(base)).map(k => dpart + k + (n.c[k].t === 'd' ? '/' : '')) };
    }

    async function boot() {
      let skip = false;
      const skipper = () => { skip = true; };
      body.addEventListener('keydown', skipper, true);
      const pause = ms => skip ? Promise.resolve() : new Promise(r => setTimeout(r, ms));
      const ln = async (s, ms) => { out(s); await pause(ms); };
      await ln(C.bold('ViKernel Secure OS boot'), 220);
      await ln('[ ' + C.g('OK') + ' ] integrity check ... OK', 220);
      await ln('[ ' + C.g('OK') + ' ] kernel mode B (CPU reference)', 220);
      await ln('[ ' + C.g('OK') + ' ] policy loaded (allowlist + rules)', 200);
      const s = await refreshState();
      if (s) {
        await ln('[ ' + C.g('OK') + ' ] audit chain head ' + String(s.audit_head || '').slice(0, 16), 220);
        await ln('[ ' + C.g('OK') + ' ] agent: Meta Muse Spark 1.3', 200);
        if (halted) out(C.y('kernel is HALTED. Resume with: vik resume --key <operator key>'));
      } else {
        await ln('[ ' + C.y('!!') + ' ] live backend unavailable, offline mode', 200);
        await ln('[ ' + C.g('OK') + ' ] agent: Meta Muse Spark 1.3', 100);
      }
      body.removeEventListener('keydown', skipper, true);
      out(C.dim('Type help for commands. Everything here runs in your browser; security actions go to the live gate.'));
    }

    function startXterm() {
      body.innerHTML = '';
      body.style.background = '#0B1020';
      const host = document.createElement('div');
      host.style.cssText = 'width:100%;height:100%;padding:6px;box-sizing:border-box;background:#0B1020;';
      body.appendChild(host);
      term = new window.Terminal({
        cursorBlink: true, scrollback: 2000, fontSize: 13, convertEol: false,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        theme: { background: '#0B1020', foreground: '#D6DEEB', cursor: '#7FDBCA', selectionBackground: '#1D3B53',
          black: '#1B2333', red: '#EF5350', green: '#22DA6E', yellow: '#FFCB6B', blue: '#82AAFF', magenta: '#C792EA', cyan: '#7FDBCA', white: '#D6DEEB',
          brightBlack: '#637777', brightRed: '#FF6B6B', brightGreen: '#5CF19E', brightYellow: '#FFE08A', brightBlue: '#A3C2FF', brightMagenta: '#DDB3FF', brightCyan: '#A5F0E0', brightWhite: '#FFFFFF' },
      });
      const fit = new window.FitAddon.FitAddon();
      term.loadAddon(fit); term.open(host);
      const doFit = () => { try { fit.fit(); } catch (e) { /* hidden window */ } };
      doFit();
      try { new ResizeObserver(doFit).observe(body); } catch (e) { window.addEventListener('resize', doFit); }

      const copySel = () => { const s = term.getSelection(); if (s && navigator.clipboard) navigator.clipboard.writeText(s).catch(() => {}); return !!s; };
      term.attachCustomKeyEventHandler(ev => {
        if (ev.type !== 'keydown') return true;
        if (ev.ctrlKey && ev.shiftKey && (ev.key === 'C' || ev.key === 'c')) { copySel(); if (h.toast) h.toast('Copied'); return false; }
        if (ev.ctrlKey && (ev.key === 'v' || ev.key === 'V')) return false; // let the browser paste event reach xterm
        return true;
      });
      host.addEventListener('contextmenu', ev => { if (copySel()) { ev.preventDefault(); if (h.toast) h.toast('Copied'); } });

      let line = '', cur = 0, hIdx = -1, draft = '';
      const redraw = () => {
        term.write('\r\x1b[K' + prompt() + line);
        const back = line.length - cur; if (back > 0) term.write('\x1b[' + back + 'D');
      };
      const showPrompt = () => { line = ''; cur = 0; hIdx = -1; term.write(prompt()); };

      term.onData(async d => {
        if (busy) return;
        if (d === '\r') {
          term.write('\r\n'); const l = line; line = ''; cur = 0; hIdx = -1;
          await runAndPrint(l); showPrompt(); return;
        }
        if (d === '\x03') { term.write('^C\r\n'); showPrompt(); return; }
        if (d === '\x0c') { term.clear(); redraw(); return; }
        if (d === '\x7f' || d === '\b') { if (cur > 0) { line = line.slice(0, cur - 1) + line.slice(cur); cur--; redraw(); } return; }
        if (d === '\x1b[3~') { if (cur < line.length) { line = line.slice(0, cur) + line.slice(cur + 1); redraw(); } return; }
        if (d === '\x1b[D') { if (cur > 0) { cur--; term.write(d); } return; }
        if (d === '\x1b[C') { if (cur < line.length) { cur++; term.write(d); } return; }
        if (d === '\x1b[H' || d === '\x1bOH' || d === '\x1b[1~' || d === '\x01') { cur = 0; redraw(); return; }
        if (d === '\x1b[F' || d === '\x1bOF' || d === '\x1b[4~' || d === '\x05') { cur = line.length; redraw(); return; }
        if (d === '\x1b[A') {
          if (!history.length) return;
          if (hIdx === -1) { draft = line; hIdx = history.length; }
          hIdx = Math.max(0, hIdx - 1); line = history[hIdx]; cur = line.length; redraw(); return;
        }
        if (d === '\x1b[B') {
          if (hIdx === -1) return;
          hIdx++; if (hIdx >= history.length) { hIdx = -1; line = draft; } else line = history[hIdx];
          cur = line.length; redraw(); return;
        }
        if (d === '\t') {
          const { last, items } = completions(line.slice(0, cur));
          if (items.length === 1) {
            const add = items[0].slice(last.length) + (items[0].endsWith('/') ? '' : ' ');
            line = line.slice(0, cur) + add + line.slice(cur); cur += add.length; redraw();
          } else if (items.length > 1) { term.write('\r\n' + items.join('  ') + '\r\n'); redraw(); }
          return;
        }
        if (d.startsWith('\x1b')) return;
        const text = d.replace(/\r?\n/g, ' ').replace(/[\x00-\x1f]/g, '');
        if (!text) return;
        line = line.slice(0, cur) + text + line.slice(cur); cur += text.length; redraw();
      });

      term.focus();
      busy = true;
      boot().then(() => { busy = false; showPrompt(); });
    }

    function startFallback() {
      body.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;background:#0B1020;color:#D6DEEB;font:13px ui-monospace,Menlo,Consolas,monospace;';
      const pre = document.createElement('pre');
      pre.style.cssText = 'flex:1;margin:0;padding:8px;overflow:auto;white-space:pre-wrap;word-break:break-word;';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;padding:6px 8px;border-top:1px solid #1D3B53;';
      const pl = document.createElement('span');
      const inp = document.createElement('input');
      inp.style.cssText = 'flex:1;background:transparent;border:0;outline:0;color:inherit;font:inherit;';
      inp.setAttribute('aria-label', 'terminal input');
      row.appendChild(pl); row.appendChild(inp); wrap.appendChild(pre); wrap.appendChild(row); body.appendChild(wrap);
      term = {
        write: s => {
          s = String(s);
          if (s.indexOf('\r\x1b[K') === 0) return; // spinner clear: ignore in fallback
          if (/^\x1b\[2m working|^\b/.test(s)) return;
          pre.textContent += stripAnsi(s).replace(/\r\n/g, '\n').replace(/\r/g, '');
          pre.scrollTop = pre.scrollHeight;
        },
        clear: () => { pre.textContent = ''; },
      };
      const setP = () => { pl.textContent = stripAnsi(prompt()); };
      let hIdx = -1;
      inp.addEventListener('keydown', async ev => {
        if (ev.key === 'Enter' && !busy) {
          const l = inp.value; inp.value = ''; hIdx = -1;
          term.write(stripAnsi(prompt()) + l + '\n');
          await runAndPrint(l); setP();
        } else if (ev.key === 'ArrowUp' && history.length) {
          hIdx = hIdx === -1 ? history.length - 1 : Math.max(0, hIdx - 1); inp.value = history[hIdx]; ev.preventDefault();
        } else if (ev.key === 'ArrowDown' && hIdx !== -1) {
          hIdx++; if (hIdx >= history.length) { hIdx = -1; inp.value = ''; } else inp.value = history[hIdx];
        } else if (ev.key === 'l' && ev.ctrlKey) { term.clear(); ev.preventDefault(); }
      });
      out(C.dim('(terminal library unavailable; using the simple console)'));
      busy = true; setP();
      boot().then(() => { busy = false; inp.focus(); });
    }

    body.textContent = 'Loading terminal...';
    loadXterm().then(startXterm, startFallback).catch(() => { try { startFallback(); } catch (e) { /* give up quietly */ } });
  };
})();
