// Live session: total timer, per-set timer, rest countdown, and set logging.
import { data, save, esc, fmt, $, today } from '../state.js';
import { PROGRAM, planned, sessionKey } from '../program.js';
import { session as cloud } from '../cloud.js';
import { publishActivity, goIdle } from '../social.js';
import { register } from '../actions.js';
import { go } from '../router.js';
import * as ui from '../ui.js';

const REST_CHOICES = [45, 60, 90, 120, 180];

let tick, timer = { seconds: 0, running: false, startedAt: null };
let exTick, ex = { seconds: 0, running: false, mode: 'set', exercise: -1, rest: 90, endsAt: null, startedAt: null };
let audioContext, soundLoop;

/* ── Audio ─────────────────────────────────────────────────────────────── */

function armChime() {
  try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume() } catch {}
}
function playChime() {
  try {
    armChime();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      const at = audioContext.currentTime + i * 0.13;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(at); osc.stop(at + 0.36);
    });
  } catch {}
}

function completeRest() {
  ex.seconds = 0; ex.running = false; ex.endsAt = null;
  persistRuntime();
  // A minimized timer must not suddenly cover whichever menu the user is
  // viewing. The compact bar will show 00:00 and can be used to return.
  const showOverlay = data.tab === 'session' || document.getElementById('modal');
  if (!showOverlay) {
    playChime();
    ui.toast('พักครบแล้ว เลือกท่าถัดไปได้เลย');
    return;
  }
  renderExerciseModal();
  clearInterval(soundLoop);
  playChime();
  soundLoop = setInterval(playChime, 1300);
  document.body.insertAdjacentHTML('beforeend', `<div class="rest-complete" id="restComplete">
    <div class="rest-complete-card">
      ${ui.label('rest complete')}
      <div class="complete-mark">✓</div>
      <h2>พักครบแล้ว!</h2>
      <p>พร้อมสำหรับเซ็ตถัดไป</p>
      ${ui.button('เลือกท่าอื่น / ปิดเสียง', { variant: 'primary', act: 'dismissRestComplete' })}
    </div></div>`);
}

/* ── Views ─────────────────────────────────────────────────────────────── */

export function sessionScreen() {
  restoreRuntime();
  const a = data.active;
  if (!a) { go('home'); return '' }
  const { s, d, it } = a;
  const st = data.sessions[sessionKey(d, s)] || { sets: {} };
  const total = it.reduce((n, x) => n + x[1], 0);
  const done = it.reduce((n, _x, i) => n + (st.sets?.[i] || []).filter(v => v.done).length, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  const head = ui.card(`
    ${ui.row(`<div>${ui.label('mission progress')}<b>${done} / ${total} เซ็ต</b></div>`, `<div class="xp">${pct}%</div>`)}
    ${ui.progress(pct)}
    ${ui.row(`<span class="small">เวลารวม <b id="time">${fmt(timer.seconds)}</b></span>`,
      ui.button(timer.running ? 'หยุดเวลา' : 'เริ่มเวลา', { act: 'toggleTimer' }), 'gap')}
  `, { extraClass: 'game-head' });

  const menu = `<section class="exercise-menu">${it.map((x, i) => exerciseButton(x, i, st)).join('')}</section>`;

  return [
    ui.header(cloud.program?.name),
    ui.row(`<div>${ui.label(d)}<h2 class="section-title">${esc(s)}</h2></div>`,
      ui.button('← กลับ', { act: 'go', data: { tab: 'plan' } })),
    head,
    menu,
    ui.button('จบเซสชันของวันนี้ ✓', { variant: 'primary', full: true, act: 'finishSession' }),
    ui.nav(),
  ].join('');
}

/** A compact return control remains available while the user browses other tabs. */
export function activeSessionBar() {
  if (!data.active) return '';
  restoreRuntime();
  const rest = ex.mode === 'rest' && ex.running;
  return `<button class="active-session-bar" ${ui.attrs({ act: 'resumeSession' })}>
    <span><b>${rest ? 'พักอยู่' : 'กำลังฝึก'}</b><small>${esc(data.active.s)}</small></span>
    <strong id="miniSessionTime">${fmt(currentTimerSeconds())}</strong>
    <em>${rest ? fmt(currentRestSeconds()) : 'กลับไปที่เซสชัน →'}</em>
  </button>`;
}

function exerciseButton([name, n, reps, rest], i, st) {
  const done = (st.sets?.[i] || []).filter(v => v.done).length;
  const cleared = done === n;
  return `<button class="exercise-card ${cleared ? 'cleared' : ''}" ${ui.attrs({ act: 'openExercise', i })}>
    <span class="exercise-number">${String(i + 1).padStart(2, '0')}</span>
    <span class="exercise-info"><b>${esc(name)}</b><small>${n} × ${esc(reps)} · พัก ${esc(rest)}</small></span>
    <span class="exercise-status">${cleared ? '✓' : `${done}/${n}`}<em>${cleared ? 'CLEAR' : 'PLAY'}</em></span>
  </button>`;
}

export function renderSession() {
  const a = data.active;
  if (!a) { go('home'); return }
  $('#app').innerHTML = sessionScreen();
}

function renderExerciseModal() {
  const a = data.active, i = ex.exercise;
  const [name, n, reps, rest] = a.it[i];
  const st = data.sessions[sessionKey(a.d, a.s)] || { sets: {} };
  const vals = st.sets?.[i] || [];
  let j = 0; while (j < n && vals[j]?.done) j++;
  const allDone = j === n;
  if (allDone) j = n - 1;
  const current = vals[j] || {};
  const chosen = ex.rest || 90;
  const resting = ex.mode === 'rest';

  ui.modal(`<div class="game-modal">
    ${ui.row(`<div>${ui.label(`exercise ${String(i + 1).padStart(2, '0')} · set ${j + 1}/${n}`)}<h2>${esc(name)}</h2></div>`,
      ui.button('พับ', { variant: 'icon', act: 'minimizeExercise' }))}
    <p class="target">TARGET: ${esc(reps)} <span>•</span> REST: ${esc(rest)}</p>
    <div class="set-clock ${resting ? 'resting' : ''}">
      ${ui.label(resting ? 'พักฟื้น' : 'จับเวลาเซ็ต')}
      <div class="time" id="exerciseTime">${fmt(resting ? currentRestSeconds() : currentSetSeconds())}</div>
      <div class="small">${resting ? 'หายใจให้พร้อม แล้วไปต่อ' : 'กดเริ่มเมื่อเริ่มทำเซ็ต'}</div>
    </div>
    <div class="timer-actions">
      ${ui.button(ex.running ? (resting ? 'หยุดพัก' : 'หยุดเวลา') : (resting ? 'เริ่มพัก' : 'เริ่มเซ็ต'), { variant: 'primary', act: 'toggleExerciseTimer' })}
      ${ui.button('รีเซ็ต', { act: 'resetExerciseTimer' })}
    </div>
    <div class="form set-form">
      ${ui.field('จำนวนครั้ง', { id: 'modalReps', type: 'number', min: 0, step: 1, inputmode: 'numeric', placeholder: 'เช่น 10', value: current.reps || '', disabled: resting })}
      ${ui.field('น้ำหนัก (kg)', { id: 'modalLoad', type: 'number', min: 0, step: 0.25, inputmode: 'decimal', placeholder: 'เช่น 15', value: current.load || '', disabled: resting })}
      <label class="full-span">พักหลังจบเซ็ต
        <input id="modalRest" type="hidden" value="${chosen}">
        <span class="rest-picker">${REST_CHOICES.map(s =>
          `<button type="button" class="${s === chosen ? 'selected' : ''}" ${ui.attrs({ act: 'pickRest', rest: s })} ${resting ? 'disabled' : ''}>${s}s</button>`).join('')}</span>
        <button type="button" class="sound-test" ${ui.attrs({ act: 'soundTest' })}>🔊 ทดสอบเสียง</button>
      </label>
    </div>
    ${allDone || resting
      ? ui.button(allDone ? 'เลือกท่าอื่น →' : `ไปเซ็ต ${j + 1} →`, { variant: 'primary', full: true, act: allDone ? 'finishExercise' : 'skipRest' })
      : ui.button(`จบเซ็ต ${j + 1} + เริ่มพัก`, { variant: 'primary', full: true, extraClass: 'finish-set', act: 'finishExerciseSet', data: { i, j } })}
    <div class="set-dots">${Array.from({ length: n }, (_, k) =>
      `<i class="${vals[k]?.done ? 'done' : k === j ? 'active' : ''}">${k + 1}</i>`).join('')}</div>
  </div>`, { showClose: false });
}

/* ── Actions ───────────────────────────────────────────────────────────── */

function openSession(s, d, items) {
  const it = items || PROGRAM[s] || [];
  data.active = { s, d, it };
  timer = { seconds: 0, running: false, startedAt: null };
  ex = { seconds: 0, running: false, mode: 'set', exercise: -1, rest: 90, endsAt: null, startedAt: null };
  save();
  publishActivity({ status: 'in_session', session_name: s, exercise_name: null, set_index: null, set_total: null });
  go('session');
}

function stopRestSound() { clearInterval(soundLoop); document.getElementById('restComplete')?.remove() }

function currentTimerSeconds() {
  return timer.running && timer.startedAt
    ? timer.seconds + Math.floor((Date.now() - timer.startedAt) / 1000)
    : timer.seconds;
}
function currentRestSeconds() { return ex.endsAt ? Math.max(0, Math.ceil((ex.endsAt - Date.now()) / 1000)) : ex.seconds; }
function currentSetSeconds() {
  return ex.running && ex.startedAt
    ? ex.seconds + Math.floor((Date.now() - ex.startedAt) / 1000)
    : ex.seconds;
}
function persistRuntime() {
  if (!data.active) return;
  data.active.runtime = { timer, ex };
  save();
}
function restoreRuntime() {
  const runtime = data.active?.runtime;
  if (!runtime) return;
  timer = { ...timer, ...(runtime.timer || {}) };
  ex = { ...ex, ...(runtime.ex || {}) };
  if (timer.running) startTotalTimer();
  if (ex.running && ex.mode === 'rest') startRestCountdown();
}
function updateTimerDisplays() {
  const seconds = currentTimerSeconds();
  const text = fmt(seconds);
  const main = $('#time'); if (main) main.textContent = text;
  const mini = $('#miniSessionTime'); if (mini) mini.textContent = text;
}
function startTotalTimer() {
  clearInterval(tick);
  tick = setInterval(updateTimerDisplays, 1000);
  updateTimerDisplays();
}

function startRestCountdown() {
  clearInterval(exTick);
  exTick = setInterval(() => {
    ex.seconds = currentRestSeconds();
    const el = $('#exerciseTime');
    if (el) el.textContent = fmt(Math.max(ex.seconds, 0));
    if (ex.seconds <= 0) { ex.seconds = 0; ex.running = false; ex.endsAt = null; clearInterval(exTick); completeRest() }
  }, 1000);
}

register({
  startPlanned: () => { const p = planned(); openSession(p.session, p.date) },
  openSession: ({ s, d }) => openSession(s, d),
  openCustomSession: ({ i }) => {
    const c = data.custom[Number(i)];
    openSession(c.name, today(), c.items.map(x => [x.name, x.sets, x.reps, x.rest]));
  },

  toggleTimer: () => {
    if (timer.running) { timer.seconds = currentTimerSeconds(); timer.running = false; timer.startedAt = null; clearInterval(tick) }
    else { timer.running = true; timer.startedAt = Date.now(); startTotalTimer() }
    persistRuntime();
    renderSession();
  },

  openExercise: ({ i }) => {
    clearInterval(exTick);
    const idx = Number(i);
    ex = { seconds: 0, running: false, mode: 'set', exercise: idx, rest: 90, endsAt: null, startedAt: null };
    publishActivity({ status: 'in_session', session_name: data.active?.s, exercise_name: data.active?.it[idx]?.[0], set_index: null, set_total: data.active?.it[idx]?.[1] ?? null });
    renderExerciseModal();
  },
  closeExercise: () => { clearInterval(exTick); ui.closeModal(); renderSession() },
  minimizeExercise: () => { ui.closeModal(); persistRuntime(); },
  resumeSession: () => { go('session') },

  toggleExerciseTimer: () => {
    const wasRunning = ex.running;
    if (wasRunning && ex.mode === 'rest') {
      ex.seconds = currentRestSeconds();
      ex.endsAt = null;
    }
    if (wasRunning && ex.mode === 'set') {
      ex.seconds = currentSetSeconds();
      ex.startedAt = null;
    }
    ex.running = !wasRunning;
    clearInterval(exTick);
    if (ex.running) {
      if (ex.mode === 'rest') { ex.endsAt = Date.now() + ex.seconds * 1000; startRestCountdown() }
      else exTick = setInterval(() => {
        const el = $('#exerciseTime'); if (el) el.textContent = fmt(currentSetSeconds());
      }, 1000);
      if (ex.mode === 'set') ex.startedAt = Date.now();
    }
    persistRuntime();
    renderExerciseModal();
  },
  resetExerciseTimer: () => { ex.seconds = 0; ex.running = false; ex.endsAt = null; ex.startedAt = null; clearInterval(exTick); persistRuntime(); renderExerciseModal() },
  pickRest: ({ rest }) => {
    ex.rest = Number(rest);
    $('#modalRest').value = ex.rest;
    document.querySelectorAll('[data-rest]').forEach(b => b.classList.toggle('selected', Number(b.dataset.rest) === ex.rest));
  },
  soundTest: () => { armChime(); playChime() },

  finishExerciseSet: ({ i, j }) => {
    const reps = $('#modalReps').value.trim();
    const load = $('#modalLoad').value.trim();
    const rest = Number($('#modalRest').value);
    if (!reps) { ui.toast('กรอกจำนวนครั้งให้ครบก่อน'); return }
    armChime();
    const a = data.active, key = sessionKey(a.d, a.s);
    const st = data.sessions[key] || { sets: {} };
    st.sets[Number(i)] ||= [];
    st.sets[Number(i)][Number(j)] = { reps, load, done: true, duration: currentSetSeconds() };
    data.sessions[key] = st;
    save();
    ex = { seconds: rest, running: true, mode: 'rest', exercise: Number(i), rest, endsAt: Date.now() + rest * 1000, startedAt: null };
    publishActivity({ status: 'resting', session_name: a.s, exercise_name: a.it[Number(i)]?.[0], set_index: Number(j) + 1, set_total: a.it[Number(i)]?.[1] ?? null });
    startRestCountdown();
    persistRuntime();
    renderExerciseModal();
  },
  skipRest: () => {
    clearInterval(exTick);
    ex = { seconds: 0, running: false, mode: 'set', exercise: ex.exercise, rest: ex.rest || 90, endsAt: null, startedAt: null };
    persistRuntime();
    publishActivity({ status: 'in_session' });
    renderExerciseModal();
  },
  dismissRestComplete: () => { stopRestSound(); ui.closeModal(); renderSession() },
  finishExercise: () => { clearInterval(exTick); ex = { seconds: 0, running: false, mode: 'set', exercise: -1, rest: 90, endsAt: null, startedAt: null }; stopRestSound(); ui.closeModal(); persistRuntime(); renderSession() },

  finishSession: () => {
    const a = data.active;
    const key = sessionKey(a.d, a.s);
    const st = data.sessions[key] || { sets: {} };
    st.done = true;
    data.sessions[key] = st;
    const rows = a.it.map((x, i) => {
      const logged = (st.sets[i] || []).filter(z => z.done).map(z => `${z.reps || '?'} (${fmt(z.duration || 0)})`).join('/');
      return `${x[0]}: ${logged || '—'}`;
    }).join(' · ');
    data.logs.push({ id: crypto.randomUUID(), type: 'strength', date: a.d, session: a.s, summary: rows });
    delete data.active;
    save();
    timer = { seconds: 0, running: false };
    clearInterval(tick);
    goIdle();
    go('log');
  },
});
