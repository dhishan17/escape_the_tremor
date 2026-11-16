"use strict";
/* ===========================================================================
   sheet.js: optional Google Sheet connection.
   If the game URL ends in ?sheet=YOUR_SHEET_LINK_OR_ID (or GAME.sheetId is set in
   content.js), the game reads the Sheet's tabs when it starts and overrides the
   built-in text, questions, colours and timer with what it finds there.
   Every room is checked on its own. If a room's rows are incomplete or invalid,
   that room keeps its built-in content and a short note is shown in the footer.
   Nothing here can write to the Sheet.
   =========================================================================== */

const SheetStatus = { source: 'builtin', requested: false, warnings: [], error: '' };

const sheetIdFromText = s => {
  if (!s) return '';
  s = String(s).trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : '';
};

/* ---- reading a tab (script-tag JSONP, so no cross-origin restrictions) ---- */
function readTab(id, tab, timeoutMs) {
  timeoutMs = timeoutMs || 8000;
  return new Promise((resolve, reject) => {
    const cb = '__gviz_' + Math.random().toString(36).slice(2);
    const s = document.createElement('script');
    let done = false, timer;
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(timer); try { delete window[cb]; } catch (_) { window[cb] = undefined; } s.remove(); fn(v); };
    window[cb] = resp => {
      if (resp && resp.status === 'ok' && resp.table) finish(resolve, resp.table);
      else finish(reject, new Error('Google could not read the "' + tab + '" tab' + (resp && resp.errors && resp.errors[0] ? ' (' + resp.errors[0].message + ')' : '') + '.'));
    };
    timer = setTimeout(() => finish(reject, new Error('Timed out reading the "' + tab + '" tab. Check that the Sheet is shared as "Anyone with the link: Viewer" and the tab names are unchanged.')), timeoutMs);
    s.onerror = () => finish(reject, new Error('Could not reach Google Sheets for the "' + tab + '" tab.'));
    s.src = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=' + encodeURIComponent('out:json;responseHandler:' + cb) +
      '&sheet=' + encodeURIComponent(tab) + '&headers=1&_=' + Date.now();
    document.head.append(s);
  });
}
const tableRows = tbl => (tbl.rows || []).map(r => (r.c || []).map(c => c ? (c.v !== null && c.v !== undefined ? c.v : (c.f !== undefined ? c.f : null)) : null));
const str = v => v === null || v === undefined ? '' : String(v).trim();

/* ---- safe HTML for notebook text (only simple formatting survives) ---- */
const SAFE_TAGS = new Set(['p', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'br', 'sub', 'sup']);
const escHtml = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function safeHtml(src) {
  src = String(src || '');
  if (!/<[a-z\/]/i.test(src)) return src.split(/\n+/).filter(Boolean).map(p => '<p>' + escHtml(p) + '</p>').join('');
  const doc = new DOMParser().parseFromString('<body>' + src + '</body>', 'text/html');
  const walk = node => {
    let out = '';
    node.childNodes.forEach(ch => {
      if (ch.nodeType === 3) out += escHtml(ch.textContent);
      else if (ch.nodeType === 1) {
        const t = ch.tagName.toLowerCase();
        if (['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'].includes(t)) return;
        const inner = walk(ch);
        out += SAFE_TAGS.has(t) ? (t === 'br' ? '<br>' : '<' + t + '>' + inner + '</' + t + '>') : inner;
      }
    });
    return out;
  };
  return walk(doc.body);
}

/* ---- crossword layout from a plain word list ---- */
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function layoutCrossword(words) {
  const rnd = mulberry32(20261112);
  const tryOnce = order => {
    const grid = new Map(), placed = [], key = (r, c) => r + ',' + c;
    const can = (w, r, c, d) => {
      const dr = d === 'A' ? 0 : 1, dc = d === 'A' ? 1 : 0;
      if (grid.has(key(r - dr, c - dc)) || grid.has(key(r + dr * w.length, c + dc * w.length))) return false;
      let cross = 0;
      for (let i = 0; i < w.length; i++) {
        const rr = r + dr * i, cc = c + dc * i, g = grid.get(key(rr, cc));
        if (g !== undefined) { if (g !== w[i]) return false; cross++; }
        else if (d === 'A' ? (grid.has(key(rr - 1, cc)) || grid.has(key(rr + 1, cc))) : (grid.has(key(rr, cc - 1)) || grid.has(key(rr, cc + 1)))) return false;
      }
      return cross >= 1;
    };
    const put = (wd, r, c, d) => { const dr = d === 'A' ? 0 : 1, dc = d === 'A' ? 1 : 0; for (let i = 0; i < wd.a.length; i++) grid.set(key(r + dr * i, c + dc * i), wd.a[i]); placed.push({ a: wd.a, r, c, d, clue: wd.clue }); };
    put(order[0], 0, 0, 'A');
    for (const w of order.slice(1)) {
      const opts = [];
      for (const p of placed) {
        const nd = p.d === 'A' ? 'D' : 'A';
        for (let i = 0; i < w.a.length; i++) for (let j = 0; j < p.a.length; j++) if (w.a[i] === p.a[j]) {
          const r = p.d === 'A' ? p.r - i : p.r + j, c = p.d === 'A' ? p.c + j : p.c - i;
          if (can(w.a, r, c, nd)) opts.push([w, r, c, nd]);
        }
      }
      if (opts.length) put(...opts[Math.floor(rnd() * opts.length)]);
    }
    return { placed, grid };
  };
  let best = null;
  for (let it = 0; it < 1500; it++) {
    const order = words.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const res = tryOnce(order);
    const rs = [], cs = [];
    res.grid.forEach((_, k) => { const [r, c] = k.split(',').map(Number); rs.push(r); cs.push(c); });
    const gh = Math.max(...rs) - Math.min(...rs) + 1, gw = Math.max(...cs) - Math.min(...cs) + 1, area = gh * gw;
    // prefer: more words placed, then a compact grid that is not too wide for phones or too tall, then a smaller area
    const size = Math.max(gw, Math.ceil(gh * 0.75));
    const better = !best || res.placed.length > best.placed.length || (res.placed.length === best.placed.length && (size < best.size || (size === best.size && area < best.area)));
    if (better) best = { placed: res.placed, area, size, rs, cs };
    if (best.placed.length === words.length && it > 900) break;
  }
  const minR = Math.min(...best.rs), minC = Math.min(...best.cs);
  const entries = best.placed.map(e => ({ ...e, r: e.r - minR, c: e.c - minC }));
  const h = Math.max(...best.rs) - minR + 1, w = Math.max(...best.cs) - minC + 1;
  let n = 0; const nums = new Map();
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (entries.some(e => e.r === r && e.c === c)) nums.set(r + ',' + c, ++n);
  entries.forEach(e => { e.n = nums.get(e.r + ',' + e.c); });
  entries.sort((x, y) => x.d === y.d ? x.n - y.n : (x.d === 'A' ? -1 : 1));
  return { h, w, entries, unplaced: words.filter(w0 => !best.placed.some(p => p.a === w0.a)).map(w0 => w0.a) };
}

/* ---- room parsers: turn the Items rows for one room into that room's config ---- */
const yes = v => /^\s*(y|yes|true|correct|1)\b/i.test(String(v || ''));
const ITEM_PARSERS = {
  hotspot(rows, st, warn) {
    const names = { ...st.cfg.names };
    rows.filter(r => r.role === 'wrong-click-message').forEach(r => { const id = r.c.toLowerCase(); if (id in names) { if (r.d) names[id] = r.d; } else warn('Unknown region "' + r.c + '" in room 1.'); });
    return { names };
  },
  match(rows) {
    const rs = rows.filter(r => (r.role === 'label' || r.role === 'row') && r.c && r.d).map(r => ({ label: r.c, ans: r.d }));
    if (rs.length < 2) throw new Error('needs at least 2 rows with a name or finding and an answer');
    return { rows: rs, options: [...new Set(rs.map(r => r.ans))] };
  },
  multi(rows) {
    const options = rows.filter(r => r.role === 'option' && r.c).map(r => ({ t: r.c, ok: yes(r.d) }));
    if (options.length < 2 || !options.some(o => o.ok)) throw new Error('needs at least 2 options with at least one marked yes');
    return { options };
  },
  sequence(rows) {
    const items = rows.filter(r => r.role === 'step' && r.c).map(r => r.c);
    if (items.length < 3) throw new Error('needs at least 3 steps, listed in the correct order');
    return { items };
  },
  sort(rows) {
    const buckets = rows.filter(r => r.role === 'bucket' && r.c).map((r, i) => ({ id: 'b' + i, label: r.c, sub: r.d }));
    if (buckets.length !== 2) throw new Error('needs exactly 2 bucket rows');
    const items = [], bad = [];
    rows.filter(r => r.role === 'item' && r.c).forEach(r => {
      const b = buckets.find(x => x.label.toLowerCase() === r.d.toLowerCase());
      if (b) items.push({ t: r.c, b: b.id }); else bad.push(r.c);
    });
    if (bad.length) throw new Error('these items name a bucket that does not exist: "' + bad.slice(0, 2).join('", "') + '"');
    if (items.length < 4 || buckets.some(b => !items.some(i => i.b === b.id))) throw new Error('needs at least 4 items, with some in each bucket');
    return { buckets, items };
  },
  crossword(rows, st, warn) {
    const seen = new Set(), words = [];
    rows.filter(r => r.role === 'word' && r.c).forEach(r => {
      const a = r.c.replace(/[^A-Za-z]/g, '').toUpperCase();
      if (a.length >= 3 && !seen.has(a)) { seen.add(a); words.push({ a, clue: r.d || '(no clue)' }); }
    });
    if (words.length < 4) throw new Error('needs at least 4 words (letters only, 3 or more letters each)');
    const lay = layoutCrossword(words);
    if (lay.entries.length < 4) throw new Error('the words do not share enough letters to cross');
    if (lay.unplaced.length) warn('Crossword: could not fit ' + lay.unplaced.join(', ') + '. Try changing a word so it shares letters with the others.');
    return { cw: { h: lay.h, w: lay.w, entries: lay.entries } };
  },
  quiz(rows, st) {
    const qs = []; let cse = null;
    rows.forEach(r => {
      if (r.role === 'case' && r.c) cse = safeHtml(r.c);
      else if (r.role === 'question' && r.c) qs.push({ q: r.c, opts: [] });
      else if (r.role === 'option' && r.c) { if (!qs.length) throw new Error('an option appears before any question'); qs[qs.length - 1].opts.push({ t: r.c, ok: yes(r.d) }); }
    });
    if (!qs.length) throw new Error('needs at least one question');
    qs.forEach((q, i) => { if (q.opts.length < 2 || q.opts.filter(o => o.ok).length !== 1) throw new Error('question ' + (i + 1) + ' needs at least 2 options and exactly one marked yes'); });
    return cse !== null ? { case: cse, qs } : { qs };
  }
};

/* ---- apply everything ---- */
const COLOR_VARS = { colorPrimary: '--hema', colorAccent: '--eosin', colorBackground: '--paper', colorCard: '--surface', colorText: '--ink' };
const TEXT_KEYS = ['title', 'course', 'group', 'credits', 'lede', 'story1', 'story2', 'audience', 'players'];

function applySettings(rows, warn) {
  rows.forEach(r => {
    const key = str(r[0]), text = str(r[1]), num = r[2];
    if (!key) return;
    if (TEXT_KEYS.includes(key)) { if (text) GAME[key] = text; return; }
    if (key === 'timeMinutes') { const n = Number(num); if (n >= 1 && n <= 180) { GAME.timeMinutes = n; TIME_LIMIT = n * 60000; } else if (num !== null && num !== '') warn('timeMinutes must be between 1 and 180.'); return; }
    if (key === 'hintCostMinutes') { const n = Number(num); if (n >= 0.5 && n <= 10) { GAME.hintCostMinutes = n; HINT_COST = n * 60000; } else if (num !== null && num !== '') warn('hintCostMinutes must be between 0.5 and 10.'); return; }
    if (COLOR_VARS[key] && text) {
      const hex = text.replace(/^#?/, '#');
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) document.documentElement.style.setProperty(COLOR_VARS[key], hex);
      else warn('"' + text + '" is not a colour like #43328A (' + key + ').');
    }
  });
}

function applyRooms(rows, warn) {
  let count = 0;
  rows.forEach(r => {
    const n = Number(r[0]); if (!Number.isInteger(n) || n < 1 || n > STAGES.length) return;
    const st = STAGES[n - 1]; count++;
    const set = (field, v) => { if (v) st[field] = v; };
    set('room', str(r[1])); set('title', str(r[2])); set('kind', str(r[3])); set('goal', str(r[4])); set('story', str(r[5])); set('prompt', str(r[6]));
    let code = str(r[7]); if (/^\d{1,3}$/.test(code)) code = code.padStart(4, '0');
    if (code) { if (/^\d{4}$/.test(code)) st.code = code; else warn('Room ' + n + ': the passcode must be 4 digits.'); }
    const h1 = str(r[8]), h2 = str(r[9]);
    if (h1 || h2) st.hints = [h1 || st.hints[0], h2 || st.hints[1]];
    if (str(r[10])) st.notebook = safeHtml(str(r[10]));
  });
  if (!count) throw new Error('The Rooms tab has no rows numbered 1 to ' + STAGES.length + '.');
}

function applyItems(rows, warn) {
  const byRoom = {};
  rows.forEach(r => {
    const n = Number(r[0]); if (!Number.isInteger(n)) return;
    (byRoom[n] = byRoom[n] || []).push({ role: str(r[1]).toLowerCase(), c: str(r[2]), d: str(r[3]) });
  });
  STAGES.forEach((st, i) => {
    const rs = byRoom[i + 1]; if (!rs || !ITEM_PARSERS[st.type]) return;
    try { st.cfg = { ...st.cfg, ...ITEM_PARSERS[st.type](rs, st, m => warn(m)) }; }
    catch (e) { warn('Room ' + (i + 1) + ' (' + st.room + ') kept its built-in puzzle: ' + e.message + '.'); }
  });
}

async function loadSheetContent(id) {
  SheetStatus.requested = true; SheetStatus.warnings = []; SheetStatus.error = ''; SheetStatus.source = 'builtin';
  const warn = m => SheetStatus.warnings.push(m);
  let t;
  try {
    const must = ['Settings', 'Rooms', 'Items'].map(n => readTab(id, n));
    const opt = ['Goals', 'Sources'].map(n => readTab(id, n).catch(() => null));
    const got = await Promise.all([...must, ...opt]);
    t = { Settings: tableRows(got[0]), Rooms: tableRows(got[1]), Items: tableRows(got[2]), Goals: got[3] && tableRows(got[3]), Sources: got[4] && tableRows(got[4]) };
  } catch (e) { SheetStatus.error = e.message; return SheetStatus; }
  try {
    applySettings(t.Settings, warn);
    applyRooms(t.Rooms, warn);
    applyItems(t.Items, warn);
    if (t.Goals) { const g = t.Goals.filter(r => str(r[0])).map(r => [str(r[0]), str(r[1])]); if (g.length) { LEARN.length = 0; g.forEach(x => LEARN.push(x)); } }
    if (t.Sources) { const s = t.Sources.filter(r => str(r[0])).map(r => [str(r[0]), /^https?:\/\//i.test(str(r[1])) ? str(r[1]) : null]); if (s.length) { SOURCES.length = 0; s.forEach(x => SOURCES.push(x)); } }
    SheetStatus.source = 'sheet';
  } catch (e) { SheetStatus.error = e.message; }
  return SheetStatus;
}
