"use strict";
/* game.js: the game engine (timer, hints, puzzle components, screens).
   Questions and text live in content.js. */
/* ============ HELPERS ============ */
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const fmt = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };

const fillText = s => String(s || '').replace(/\{minutes\}/g, GAME.timeMinutes);
const titleParts = () => { const t = String(GAME.title || '').trim() || 'Escape Room'; const i = t.lastIndexOf(' '); return i < 0 ? ['', t] : [t.slice(0, i + 1), t.slice(i + 1)]; };
const statusLine = () => (typeof SheetStatus === 'undefined' || SheetStatus.source === 'builtin' && !SheetStatus.requested) ? null :
  h('span', { style: 'display:block;margin-top:8px;opacity:.85' }, SheetStatus.source === 'sheet' ? 'Content loaded from the group\u2019s Google Sheet.' : 'Showing the built-in content (the Google Sheet could not be read).',
    SheetStatus.error ? ' ' + SheetStatus.error : '', SheetStatus.warnings.length ? ' Notes: ' + SheetStatus.warnings.join(' ') : '');

/* ============ STATE ============ */
const S = { screen: 'intro', mode: 'timed', i: 0, remaining: TIME_LIMIT, last: 0, paused: true, hints: 0, wrong: 0, revealed: {}, solved: false, comp: null, elapsedPaused: 0 };
let tick = null;

/* ============ COMPONENTS ============ */
function hotspot(st, api) {
  const fig = h('div', { class: 'fig', html: st.cfg.svg() });
  fig.append(h('p', { class: 'fig-note' }, 'Schematic drawing, not to scale. Click or press Enter on a region.'));
  const pick = g => {
    const id = g.dataset.id;
    if (st.cfg.correct.includes(id)) api.success();
    else api.fail(st.cfg.names[id]);
  };
  fig.querySelectorAll('.region').forEach(g => {
    g.addEventListener('click', () => pick(g));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g); } });
  });
  return { el: fig, immediate: true };
}

function selectMatch(st, api) {
  const c = st.cfg;
  const rows = h('div', { class: 'rows' });
  const sels = c.rows.map((r, i) => {
    const sel = h('select', { id: `m${i}`, 'aria-labelledby': `ml${i}` }, h('option', { value: '' }, 'Choose…'), c.options.slice().sort().map(o => h('option', { value: o }, o)));
    const lab = c.badge ? h('span', { class: 'badge', id: `ml${i}` }, r.label) : h('span', { class: 'txt', id: `ml${i}` }, r.label);
    rows.append(h('div', { class: 'mrow' + (c.badge ? ' has-badge' : ''), 'data-i': i }, lab, sel));
    return sel;
  });
  const root = c.svg ? h('div', { class: 'match-layout' }, h('div', { class: 'fig', html: c.svg() }), rows) : rows;
  return { el: root, check() {
    let right = 0;
    sels.forEach((s, i) => { const ok = s.value === c.rows[i].ans; if (ok) right++; s.closest('.mrow').classList.toggle('bad', !!s.value && !ok); });
    if (sels.some(s => !s.value)) return { ok: false, msg: 'Choose an answer for every row first.' };
    return right === c.rows.length ? { ok: true } : { ok: false, msg: `${right} of ${c.rows.length} are correct. Rows outlined in pink need another look.` };
  } };
}

function multi(st) {
  const c = st.cfg, opts = shuffle(c.options);
  const wrap = h('div', { class: 'opts', role: 'group', 'aria-label': 'Findings' });
  const boxes = opts.map((o, i) => {
    const cb = h('input', { type: 'checkbox', id: `mc${i}` });
    wrap.append(h('label', { class: 'opt', for: `mc${i}` }, cb, h('span', {}, o.t)));
    return cb;
  });
  return { el: wrap, check() {
    const sel = boxes.map((b, i) => b.checked ? i : -1).filter(i => i >= 0);
    if (!sel.length) return { ok: false, msg: 'Select at least one finding.' };
    const good = sel.filter(i => opts[i].ok).length, bad = sel.length - good, total = opts.filter(o => o.ok).length;
    if (bad === 0 && good === total) return { ok: true };
    return { ok: false, msg: `You have ${good} of ${total} correct findings and ${bad} selection${bad === 1 ? '' : 's'} that do not belong.` };
  } };
}

function sequence(st) {
  const items = st.cfg.items.map((t, i) => ({ t, i }));
  let order; do { order = shuffle(items); } while (order.every((o, k) => o.i === k));
  const ul = h('ul', { class: 'seq' });
  let drag = null;
  const move = (a, b) => { if (b < 0 || b >= order.length || a === b) return; const [x] = order.splice(a, 1); order.splice(b, 0, x); draw(); };
  function draw(focusIdx, focusDir) {
    ul.replaceChildren();
    order.forEach((o, k) => {
      const up = h('button', { type: 'button', 'aria-label': 'Move up', onclick: () => { move(k, k - 1); focusBtn(k - 1, 0); }, disabled: k === 0 }, '↑');
      const dn = h('button', { type: 'button', 'aria-label': 'Move down', onclick: () => { move(k, k + 1); focusBtn(k + 1, 1); }, disabled: k === order.length - 1 }, '↓');
      const li = h('li', { draggable: 'true', 'data-k': k }, h('span', { class: 'n' }, String(k + 1)), h('span', {}, o.t), h('span', { class: 'mv' }, up, dn));
      li.addEventListener('dragstart', e => { drag = k; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(k)); } catch (_) {} });
      li.addEventListener('dragend', () => { li.classList.remove('drag'); ul.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
      li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('over'); });
      li.addEventListener('dragleave', () => li.classList.remove('over'));
      li.addEventListener('drop', e => { e.preventDefault(); if (drag !== null) move(drag, k); drag = null; });
      ul.append(li);
    });
  }
  function focusBtn(k, d) { const b = ul.querySelectorAll('li')[k]?.querySelectorAll('.mv button')[d]; if (b && !b.disabled) b.focus(); else ul.querySelectorAll('li')[k]?.querySelectorAll('.mv button')[1 - d]?.focus(); }
  draw();
  return { el: ul, check() {
    const right = order.filter((o, k) => o.i === k).length;
    if (right === order.length) return { ok: true };
    return { ok: false, msg: `${right} of ${order.length} panels are in the right position.` };
  } };
}

function sort(st) {
  const c = st.cfg;
  const items = shuffle(c.items.map((it, i) => ({ ...it, id: i, at: null })));
  let sel = null, dragId = null;
  const root = h('div', { class: 'sort' });
  function chip(it) {
    const b = h('button', { type: 'button', class: 'chip' + (sel === it.id ? ' sel' : '') + (it.back ? ' back' : ''), draggable: 'true', 'aria-pressed': sel === it.id ? 'true' : 'false' }, it.t);
    it.back = false;
    b.addEventListener('click', e => { e.stopPropagation(); if (sel !== null && sel !== it.id) { place(sel, it.at); return; } sel = sel === it.id ? null : it.id; draw(); });
    b.addEventListener('dragstart', e => { dragId = it.id; try { e.dataTransfer.setData('text/plain', String(it.id)); } catch (_) {} });
    return b;
  }
  const place = (id, where) => { const it = items.find(x => x.id === id); if (it) { it.at = where; sel = null; draw(); } };
  function zone(where, cls, head, kids) {
    const z = h('div', { class: 'zone ' + cls, 'data-z': where, role: 'group', 'aria-label': where || 'Unsorted' }, head, h('div', { class: 'chips' }, kids));
    z.addEventListener('click', () => { if (sel !== null) place(sel, where); });
    z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('target'); });
    z.addEventListener('dragleave', () => z.classList.remove('target'));
    z.addEventListener('drop', e => { e.preventDefault(); z.classList.remove('target'); if (dragId !== null) place(dragId, where); dragId = null; });
    return z;
  }
  function draw() {
    root.replaceChildren(
      zone(null, 'pool', h('small', { style: 'display:block;margin-bottom:8px;color:var(--ink2)' }, 'Unsorted: drag or tap a statement, then choose a box'), items.filter(x => x.at === null).map(chip)),
      h('div', { class: 'zones' }, c.buckets.map(b => zone(b.id, '', [h('h4', {}, b.label), h('small', {}, b.sub)], items.filter(x => x.at === b.id).map(chip))))
    );
  }
  draw();
  return { el: root, check() {
    if (items.some(x => x.at === null)) return { ok: false, msg: 'Place every statement in a box first.' };
    const wrong = items.filter(x => x.at !== x.b);
    if (!wrong.length) return { ok: true };
    wrong.forEach(x => { x.at = null; x.back = true; });
    draw();
    return { ok: false, msg: `${wrong.length} statement${wrong.length === 1 ? ' was' : 's were'} in the wrong box and returned to the unsorted area.` };
  } };
}

function quiz(st) {
  const c = st.cfg, root = h('div');
  if (c.case) root.append(h('div', { class: 'case', html: c.case }));
  const qs = c.qs.map((q, qi) => {
    const opts = shuffle(q.opts), name = `q${qi}`;
    const box = h('fieldset', { class: 'qblock', style: 'margin-inline:0;min-width:0' }, h('legend', { class: 'sr' }, `Question ${qi + 1}`), h('h4', {}, h('span', {}, `Q${qi + 1}`), q.q));
    const g = h('div', { class: 'opts' });
    opts.forEach((o, oi) => g.append(h('label', { class: 'opt' }, h('input', { type: 'radio', name, value: oi }), h('span', {}, o.t))));
    box.append(g); root.append(box);
    return { box, opts, name };
  });
  return { el: root, check() {
    let bad = [], blank = false;
    qs.forEach((q, i) => {
      const v = root.querySelector(`input[name="${q.name}"]:checked`);
      q.box.classList.remove('bad');
      if (!v) { blank = true; return; }
      if (!q.opts[+v.value].ok) { bad.push(i + 1); q.box.classList.add('bad'); }
    });
    if (blank) return { ok: false, msg: 'Answer every question first.' };
    return bad.length ? { ok: false, msg: `Question${bad.length > 1 ? 's' : ''} ${bad.length > 1 ? bad.slice(0, -1).join(', ') + ' and ' + bad[bad.length - 1] : bad[0]} need${bad.length > 1 ? '' : 's'} another look.` } : { ok: true };
  } };
}

function crossword(st) {
  const CWD = st.cfg.cw || CW;
  const E = CWD.entries, cells = {};
  E.forEach((e, idx) => { for (let k = 0; k < e.a.length; k++) { const r = e.r + (e.d === 'D' ? k : 0), c = e.c + (e.d === 'A' ? k : 0), key = r + ',' + c; (cells[key] ||= { r, c, ch: e.a[k], ents: [] }).ents.push(idx); if (k === 0) cells[key].num = e.n; } });
  const keysOf = idx => { const e = E[idx], out = []; for (let k = 0; k < e.a.length; k++) out.push((e.r + (e.d === 'D' ? k : 0)) + ',' + (e.c + (e.d === 'A' ? k : 0))); return out; };
  let act = 0;
  const grid = h('div', { class: 'cw-grid', style: `grid-template-columns:repeat(${CWD.w},var(--cell))`, role: 'group', 'aria-label': 'Crossword grid' });
  const clueBtns = [];
  function paint() {
    const on = new Set(keysOf(act));
    for (const [k, c] of Object.entries(cells)) c.box.classList.toggle('hl', on.has(k));
    clueBtns.forEach((b, i) => b.classList.toggle('on', i === act));
  }
  function focusKey(k) { cells[k]?.input.focus(); }
  for (let r = 0; r < CWD.h; r++) for (let c = 0; c < CWD.w; c++) {
    const key = r + ',' + c, cell = cells[key];
    if (!cell) { grid.append(h('div', { class: 'cw-cell', 'aria-hidden': 'true' })); continue; }
    const input = h('input', { type: 'text', maxlength: '2', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': `Row ${r + 1}, column ${c + 1}${cell.num ? ', clue ' + cell.num : ''}` });
    const box = h('div', { class: 'cw-cell' }, input, cell.num ? h('b', {}, String(cell.num)) : null);
    cell.input = input; cell.box = box;
    let was = false;
    input.addEventListener('mousedown', () => { was = document.activeElement === input; });
    input.addEventListener('focus', () => { if (!cell.ents.includes(act)) act = cell.ents[0]; paint(); });
    input.addEventListener('click', () => { if (was && cell.ents.length > 1) { act = cell.ents.find(x => x !== act); paint(); } });
    input.addEventListener('input', () => {
      const v = input.value.replace(/[^a-z]/gi, '').toUpperCase();
      input.value = v.slice(-1); box.classList.remove('bad');
      if (v) { const ks = keysOf(act), n = ks[ks.indexOf(key) + 1]; if (n) focusKey(n); }
    });
    input.addEventListener('keydown', e => {
      const ks = keysOf(act), p = ks.indexOf(key);
      if (e.key === 'Backspace' && !input.value && p > 0) { e.preventDefault(); cells[ks[p - 1]].input.value = ''; focusKey(ks[p - 1]); return; }
      const dir = { ArrowRight: [0, 1, 'A'], ArrowLeft: [0, -1, 'A'], ArrowDown: [1, 0, 'D'], ArrowUp: [-1, 0, 'D'] }[e.key];
      if (dir) {
        e.preventDefault();
        const nk = (cell.r + dir[0]) + ',' + (cell.c + dir[1]), nc = cells[nk];
        if (nc) { const ei = nc.ents.find(x => E[x].d === dir[2]); if (ei !== undefined) act = ei; focusKey(nk); paint(); }
      }
    });
    grid.append(box);
  }
  const clueList = d => h('ol', {}, E.map((e, i) => e.d === d ? i : -1).filter(i => i >= 0).map(i => {
    const b = h('button', { type: 'button', onclick: () => { act = i; const ks = keysOf(i); focusKey(ks.find(k => !cells[k].input.value) || ks[0]); paint(); } },
      h('span', { class: 'num' }, E[i].n + '.'), E[i].clue + ' ', h('span', { class: 'len' }, `(${E[i].a.length})`));
    clueBtns[i] = b; return h('li', {}, b);
  }));
  const clues = h('div', { class: 'clues' }, h('h4', {}, 'Across'), clueList('A'), h('h4', {}, 'Down'), clueList('D'));
  const root = h('div', { class: 'cw' }, h('div', { class: 'cw-scroll' }, grid), clues);
  paint();
  return { el: root, check() {
    let wrong = 0, empty = 0;
    for (const c of Object.values(cells)) { const v = c.input.value.toUpperCase(); const bad = v && v !== c.ch; c.box.classList.toggle('bad', !!bad); if (bad) wrong++; if (!v) empty++; }
    if (!wrong && !empty) return { ok: true };
    return { ok: false, msg: `${wrong} letter${wrong === 1 ? ' is' : 's are'} incorrect (shaded pink) and ${empty} cell${empty === 1 ? ' is' : 's are'} empty.` };
  } };
}

const BUILD = { hotspot, match: selectMatch, multi, sequence, sort, quiz, crossword };

/* ============ SCREENS ============ */
const app = $('#app');

function showIntro() {
  stopTick(); S.screen = 'intro';
  const rows = STAGES.map((s, i) => h('tr', {}, h('td', {}, String(i + 1).padStart(2, '0')), h('td', {}, s.room), h('td', {}, s.kind), h('td', {}, s.goal)));
  app.replaceChildren(
    h('header', { class: 'hero' }, h('div', { class: 'wrap' },
      h('p', { class: 'eyebrow' }, `${GAME.course} · Educational virtual escape room · ${GAME.group}`),
      h('h1', {}, titleParts()[0], h('span', { class: 'tremor' }, titleParts()[1])),
      h('p', { class: 'lede' }, fillText(GAME.lede)),
      h('p', { class: 'note' }, 'A resting tremor fades when you move voluntarily. Move your pointer over the title.'),
      h('div', { class: 'cta' },
        h('button', { class: 'btn hot start', type: 'button', onclick: () => startGame('timed') }, `Start the ${GAME.timeMinutes}-minute escape`),
        h('button', { class: 'btn ghost start', type: 'button', onclick: () => startGame('practice') }, 'Practice mode (no clock)')),
      h('div', { class: 'slides', 'aria-hidden': 'true' }, STAGES.map(() => h('i')))
    )),
    h('section', { class: 'section' }, h('div', { class: 'wrap' }, h('h2', {}, 'Mission briefing'),
      h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('h3', { style: 'font-size:1.4rem;margin-bottom:10px' }, 'Storyline'),
          h('p', {}, fillText(GAME.story1)),
          h('p', {}, fillText(GAME.story2))),
        h('div', { class: 'card' }, h('dl', { class: 'facts' },
          h('div', {}, h('dt', {}, 'Intended audience'), h('dd', {}, GAME.audience)),
          h('div', {}, h('dt', {}, 'Players'), h('dd', {}, GAME.players)),
          h('div', {}, h('dt', {}, 'Playing time'), h('dd', {}, `About ${GAME.timeMinutes} minutes, including Lab Notebook reading.`)),
          h('div', {}, h('dt', {}, 'Game type'), h('dd', {}, 'Sequential educational escape room with 10 activities, timer, hints and ranks.')))))
    )),
    h('section', { class: 'section' }, h('div', { class: 'wrap grid2' },
      h('div', {}, h('h2', {}, 'Learning goals'), h('p', {}, 'By the end of the escape, players should be able to:'),
        h('ul', { class: 'goals' }, LEARN.map(g => h('li', {}, h('span', {}, g[0]), h('span', { class: 'tag' }, g[1]))))),
      h('div', {}, h('h2', {}, 'Rules'),
        h('ol', { class: 'rules' },
          h('li', {}, `You have ${fmt(TIME_LIMIT)} to clear 10 rooms in order. A room stays locked until the previous one is solved.`),
          h('li', {}, 'Solving a room reveals a 4-digit passcode. Type it to open the next door.'),
          h('li', {}, 'Wrong answers cost no time, but the game counts them.'),
          h('li', {}, `Stuck? Open the Neurology Database. Each hint costs ${fmt(HINT_COST)} off the clock, and each room has two hints.`),
          h('li', {}, 'The clock pauses while you read each Lab Notebook entry, so you can learn without losing time.'),
          h('li', {}, 'Escape before the clock reaches 00:00 to earn a rank. Practice mode has no clock and free hints.'))))),
    h('section', { class: 'section' }, h('div', { class: 'wrap' }, h('h2', {}, 'The 10 rooms'),
      h('div', { class: 'table-scroll' }, h('table', { class: 'rooms' }, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Room'), h('th', {}, 'Activity'), h('th', {}, 'What you practise'))), h('tbody', {}, rows))))),
    h('section', { class: 'section' }, h('div', { class: 'wrap' }, h('h2', {}, 'Ranks'),
      h('p', {}, 'Your rank depends on the time left on the clock when you escape. Hints reduce that time.'),
      h('div', { class: 'ranks' },
        h('div', { class: 'rank' }, h('b', {}, 'Chief of Neurology'), h('span', {}, '15:00 or more left')),
        h('div', { class: 'rank' }, h('b', {}, 'Consultant'), h('span', {}, '8:00 or more left')),
        h('div', { class: 'rank' }, h('b', {}, 'Resident'), h('span', {}, '3:00 or more left')),
        h('div', { class: 'rank' }, h('b', {}, 'Medical student'), h('span', {}, 'Escaped with less than 3:00'))),
      h('div', { class: 'cta', style: 'margin-top:28px' },
        h('button', { class: 'btn hot start', type: 'button', onclick: () => startGame('timed') }, `Start the ${GAME.timeMinutes}-minute escape`),
        h('button', { class: 'btn ghost start', type: 'button', onclick: () => startGame('practice') }, 'Practice mode (no clock)')))),
    h('footer', { class: 'fine' }, h('div', { class: 'wrap' }, `Educational game created by ${GAME.group} (${GAME.credits}) for ${GAME.course}. Patient 07 is fictional. Diagrams are schematic and not to scale. This game does not give medical advice.`, statusLine()))
  );
  window.scrollTo(0, 0);
}

function startGame(mode) {
  Object.assign(S, { mode, i: 0, remaining: TIME_LIMIT, hints: 0, wrong: 0, revealed: {}, solved: false });
  buildShell(); loadStage(0); startTick();
}

function buildShell() {
  S.screen = 'play';
  app.replaceChildren(
    h('div', { class: 'bar' }, h('div', { class: 'wrap' },
      h('div', { class: 'brand' }, titleParts()[0], h('em', {}, titleParts()[1]), h('span', { class: 'mode' }, S.mode === 'timed' ? 'Timed' : 'Practice')),
      h('div', { class: 'prog', id: 'prog', role: 'list', 'aria-label': 'Room progress' }),
      h('div', { class: 'clock' },
        h('div', {}, h('div', { class: 'time', id: 'time', role: 'timer', 'aria-live': 'off' }, S.mode === 'timed' ? fmt(S.remaining) : 'No clock'), h('small', { id: 'hintcount' }, '')),
        h('button', { class: 'btn ghost sm', type: 'button', id: 'dbbtn', onclick: openHints }, 'Neurology Database')))),
    h('main', { class: 'play' }, h('div', { class: 'wrap', id: 'stagehost' }))
  );
}

function updateBar() {
  const prog = $('#prog'); if (!prog) return;
  prog.replaceChildren(...STAGES.map((s, i) => h('span', { role: 'listitem', class: i < S.i || (i === S.i && S.solved) ? 'done' : i === S.i ? 'now' : '', title: s.room, 'aria-label': `Room ${i + 1}: ${i < S.i || (i === S.i && S.solved) ? 'cleared' : i === S.i ? 'current' : 'locked'}` }, String(i + 1))));
  $('#hintcount').textContent = S.mode === 'timed' ? `${S.hints} hint${S.hints === 1 ? '' : 's'} used` : `${S.hints} hint${S.hints === 1 ? '' : 's'} (free)`;
}

function loadStage(i) {
  S.i = i; S.solved = false; S.paused = false; S.last = performance.now();
  const st = STAGES[i], host = $('#stagehost');
  const api = {
    success: () => onSolved(),
    fail: msg => { S.wrong++; feedback(msg, 'bad'); },
  };
  const comp = BUILD[st.type](st, api); S.comp = comp;
  const fb = h('div', { class: 'feedback', id: 'fb', role: 'status', 'aria-live': 'polite' });
  const work = h('div', { class: 'work', id: 'work' }, comp.el);
  const actions = h('div', { class: 'actions', id: 'actions' },
    comp.check ? h('button', { class: 'btn', type: 'button', id: 'checkbtn', onclick: () => { const r = comp.check(); if (r.ok) onSolved(); else { S.wrong++; feedback(r.msg, 'bad'); } } }, 'Check answer') : null,
    h('button', { class: 'btn ghost', type: 'button', onclick: openHints }, 'Open Neurology Database'));
  host.replaceChildren(h('article', { class: 'stage', 'aria-labelledby': 'stitle' },
    h('div', { class: 'stage-head' }, h('div', { class: 'eyebrow', style: 'margin:0' }, `Room ${i + 1} of ${STAGES.length} · ${st.room} · ${st.kind}`), h('h2', { id: 'stitle' }, st.title), h('p', { class: 'story' }, st.story)),
    h('div', { class: 'stage-body' }, h('p', { class: 'prompt' }, st.prompt), work, actions, fb, h('div', { id: 'solvedhost' }))));
  updateBar(); updateTime();
  window.scrollTo(0, 0);
}

function feedback(msg, kind) { const f = $('#fb'); if (f) { f.className = 'feedback ' + kind; f.textContent = msg || ''; } }

function onSolved() {
  if (S.solved) return;
  S.solved = true; S.paused = true;
  const st = STAGES[S.i], last = S.i === STAGES.length - 1;
  $('#work').classList.add('done'); $('#work').setAttribute('inert', '');
  const cb = $('#checkbtn'); if (cb) cb.hidden = true;
  feedback(S.comp.immediate ? 'Correct. That is the substantia nigra.' : 'Correct!', 'good');
  const input = h('input', { id: 'pass', type: 'text', inputmode: 'numeric', maxlength: '4', autocomplete: 'off', 'aria-describedby': 'passmsg' });
  const msg = h('p', { id: 'passmsg', role: 'status', 'aria-live': 'polite', style: 'margin:0;flex-basis:100%;color:var(--eosin-ink)' });
  const go = () => {
    if (input.value.trim() === st.code) { last ? showWin() : (loadStage(S.i + 1)); }
    else { msg.textContent = 'That passcode does not match. Check the digits shown above.'; input.select(); }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  const panel = h('section', { class: 'solved', 'aria-label': 'Room solved' },
    h('div', { class: 'top' }, h('h3', {}, last ? 'Final lock revealed' : 'Room unlocked'),
      h('div', { class: 'codebox' }, h('span', { class: 'lbl' }, last ? 'Escape key' : 'Passcode'), h('output', { class: 'code' }, st.code))),
    h('div', { class: 'note-entry' }, h('h4', {}, `Lab notebook · ${st.room}`), h('div', { html: st.notebook })),
    h('div', { class: 'door' }, h('label', { for: 'pass' }, last ? 'Enter the escape key to open the laboratory door' : 'Enter the passcode to open the next door', input),
      h('button', { class: 'btn hot', type: 'button', onclick: go }, last ? 'Unlock the laboratory' : 'Unlock next room'), msg));
  $('#solvedhost').replaceChildren(panel);
  updateBar(); updateTime();
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => input.focus({ preventScroll: true }), 350);
}

/* hints */
function openHints() {
  if (S.screen !== 'play') return;
  const st = STAGES[S.i], timed = S.mode === 'timed';
  const veil = h('div', { class: 'veil' }), modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dbt' });
  const close = () => { veil.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  const draw = () => {
    const shown = S.revealed[S.i] || 0;
    modal.replaceChildren(
      h('h3', { id: 'dbt' }, 'Neurology Database'),
      h('p', { style: 'color:var(--ink2)' }, timed ? `Each hint costs ${fmt(HINT_COST)} off the clock.` : 'Practice mode: hints are free.'),
      ...st.hints.map((t, k) => {
        const open = k < shown;
        const can = k === shown && (!timed || S.remaining > HINT_COST + 1000) && !S.solved;
        return h('div', { class: 'hint' }, h('b', {}, `Hint ${k + 1} of ${st.hints.length}`),
          open ? h('div', {}, t) : h('button', { class: 'btn sm hot', type: 'button', disabled: !can, onclick: () => reveal(k) },
            k > shown ? `Reveal hint ${shown + 1} first` : timed ? `Reveal hint (−${fmt(HINT_COST)})` : 'Reveal hint'));
      }),
      timed && S.remaining <= HINT_COST + 1000 ? h('p', { style: 'margin-top:12px;color:var(--eosin-ink)' }, 'Not enough time left to pay for a hint.') : null,
      h('div', { class: 'actions', style: 'margin-top:18px' }, h('button', { class: 'btn', type: 'button', onclick: close, id: 'closedb' }, 'Back to the room')));
  };
  const reveal = k => {
    S.revealed[S.i] = k + 1; S.hints++;
    if (timed) { S.remaining -= HINT_COST; toast('−' + fmt(HINT_COST)); }
    updateBar(); updateTime(); draw(); $('#closedb')?.focus();
  };
  draw(); veil.append(modal);
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  document.addEventListener('keydown', esc);
  document.body.append(veil);
  modal.querySelector('button:not([disabled])')?.focus();
}
function toast(t) { const c = $('.clock'); if (!c) return; const x = h('span', { class: 'toast' }, t); c.append(x); setTimeout(() => x.remove(), 1700); }

/* clock */
function startTick() { stopTick(); S.last = performance.now(); tick = setInterval(onTick, 200); }
function stopTick() { if (tick) clearInterval(tick); tick = null; }
function onTick() {
  const now = performance.now();
  if (S.screen === 'play' && S.mode === 'timed' && !S.paused) {
    S.remaining -= now - S.last;
    if (S.remaining <= 0) { S.remaining = 0; S.last = now; showLose(); return; }
  }
  S.last = now; updateTime();
}
function updateTime() {
  const t = $('#time'); if (!t || S.mode !== 'timed') return;
  t.textContent = fmt(S.remaining);
  t.classList.toggle('low', S.remaining < 5 * 60 * 1000 && !S.paused);
  t.classList.toggle('paused', S.paused);
}

/* end screens */
function rankOf(ms) { return ms >= 15 * 60e3 ? 'Chief of Neurology' : ms >= 8 * 60e3 ? 'Consultant' : ms >= 3 * 60e3 ? 'Resident' : 'Medical student'; }

function showWin() {
  stopTick(); S.screen = 'win';
  document.querySelectorAll('.veil').forEach(v => v.remove());
  const timed = S.mode === 'timed';
  app.replaceChildren(h('main', { class: 'end win' }, h('div', { class: 'wrap' },
    h('p', { class: 'eyebrow' }, 'Door open · All 10 rooms cleared'),
    h('h1', {}, 'Laboratory ', h('em', {}, 'unlocked')),
    h('p', { class: 'lede', style: 'max-width:60ch;font-size:1.15rem;color:var(--ink2)' }, 'Patient 07 has a diagnosis and a treatment plan, and your team is out. You traced Parkinson’s disease from alpha-synuclein and dopamine neuron loss to basal ganglia circuits, symptoms and therapy.'),
    h('div', { class: 'keybox' }, h('small', {}, 'Escape key'), h('b', {}, STAGES[STAGES.length - 1].code)),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('small', {}, 'Rank'), h('b', {}, timed ? rankOf(S.remaining) : 'Practice')),
      h('div', { class: 'stat' }, h('small', {}, 'Time left'), h('b', {}, timed ? fmt(S.remaining) : 'No clock')),
      h('div', { class: 'stat' }, h('small', {}, 'Hints used'), h('b', {}, String(S.hints))),
      h('div', { class: 'stat' }, h('small', {}, 'Wrong checks'), h('b', {}, String(S.wrong)))),
    h('h2', { style: 'font-size:1.8rem;margin:30px 0 12px' }, 'Rooms cleared'),
    h('ul', { class: 'cleared' }, STAGES.map((s, i) => h('li', {}, h('span', { class: 'n' }, String(i + 1).padStart(2, '0')), h('b', {}, s.room), ' · ', s.goal))),
    h('h2', { style: 'font-size:1.8rem;margin:30px 0 12px' }, 'Key takeaways'),
    h('ul', { class: 'rules', style: 'max-width:78ch' },
      h('li', {}, 'Dopamine neurons of the substantia nigra pars compacta project to the striatum. Their loss, with alpha-synuclein Lewy pathology, defines Parkinson’s disease.'),
      h('li', {}, 'Less dopamine under-activates the direct pathway and over-activates the indirect pathway, so GPi/SNr inhibits the thalamus more and cortical drive falls.'),
      h('li', {}, 'Bradykinesia plus rest tremor or rigidity are the core motor signs. Non-motor features can come first.'),
      h('li', {}, 'Levodopa with carbidopa replaces dopamine. Deep brain stimulation of the STN or GPi helps selected patients with complications. Neither stops the neurodegeneration.')),
    h('h2', { style: 'font-size:1.8rem;margin:30px 0 12px' }, 'Sources'),
    h('ul', { class: 'src', style: 'padding-left:1.2em;max-width:78ch' }, SOURCES.map(s => h('li', {}, s[1] ? h('a', { href: s[1], target: '_blank', rel: 'noopener' }, s[0]) : s[0]))),
    h('div', { class: 'cta', style: 'margin-top:28px' },
      h('button', { class: 'btn hot', type: 'button', onclick: () => startGame('timed') }, 'Play again (timed)'),
      h('button', { class: 'btn ghost', type: 'button', onclick: showIntro }, 'Back to briefing')))));
  window.scrollTo(0, 0);
}

function showLose() {
  stopTick(); S.screen = 'lose';
  document.querySelectorAll('.veil').forEach(v => v.remove());
  const reached = S.i + (S.solved ? 1 : 0);
  app.replaceChildren(h('main', { class: 'end lose' }, h('div', { class: 'wrap' },
    h('p', { class: 'eyebrow' }, 'Clock reached 00:00'),
    h('h1', {}, 'Lockdown ', h('em', {}, 'complete')),
    h('p', { class: 'lede', style: 'max-width:60ch;font-size:1.15rem;color:var(--ink2)' }, `Time ran out in room ${S.i + 1} of 10 (${STAGES[S.i].room}). You cleared ${reached} room${reached === 1 ? '' : 's'} with ${S.hints} hint${S.hints === 1 ? '' : 's'} and ${S.wrong} wrong check${S.wrong === 1 ? '' : 's'}. The doors reset, and the puzzles are all still here.`),
    h('div', { class: 'cta' },
      h('button', { class: 'btn hot', type: 'button', onclick: () => startGame('timed') }, 'Try again (timed)'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => startGame('practice') }, 'Practice mode (no clock)'),
      h('button', { class: 'btn ghost', type: 'button', onclick: showIntro }, 'Back to briefing')))));
  window.scrollTo(0, 0);
}

/* ============ BOOT ============ */
window.claude?.hot?.snapshot?.(() => ({ screen: S.screen, mode: S.mode, i: S.i, remaining: S.remaining, hints: S.hints, wrong: S.wrong }));
const boot = async d => {
  if (typeof loadSheetContent === 'function') {
    const id = sheetIdFromText(new URLSearchParams(location.search).get('sheet')) || sheetIdFromText(GAME.sheetId);
    if (id) { app.replaceChildren(h('main', { class: 'end' }, h('div', { class: 'wrap' }, h('p', { class: 'eyebrow', role: 'status' }, 'Loading the lab data\u2026')))); await loadSheetContent(id); }
  }
  document.title = GAME.title;
  if (d && d.screen === 'play') { Object.assign(S, { mode: d.mode, remaining: d.remaining, hints: d.hints, wrong: d.wrong, revealed: {} }); buildShell(); loadStage(d.i); startTick(); }
  else showIntro();
};
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
