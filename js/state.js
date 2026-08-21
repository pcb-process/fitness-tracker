// Local state, persistence, and the small helpers every module needs.
// `data` is exported as a live binding: importers see reassignments made by
// setData(), so cloud.js can swap the whole document on program switch.

const KEY = 'hybrid-train-data';

export const store = {
  get: () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } },
  set: d => localStorage.setItem(KEY, JSON.stringify(d)),
};

export const $ = s => document.querySelector(s);
export const $$ = s => Array.from(document.querySelectorAll(s));
export const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]
));

export const today = () => new Date().toISOString().slice(0, 10);
export const fmt = sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
export const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 };

/** Monday of the week containing `date`, as YYYY-MM-DD. */
export function mondayOf(date = today()) {
  const d = new Date(date + 'T12:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - (d.getDay() || 7)) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export function defaults(seed = {}) {
  return {
    start: seed.start || nextMonday(),
    logs: seed.logs || [],
    sessions: seed.sessions || {},
    custom: seed.custom || [],
    body: seed.body || [],
    benchmarks: seed.benchmarks || [],
    tab: 'home',
  };
}

export let data = defaults(store.get());
store.set(data);

/** Replace the whole state document (program switch, import, onboarding). */
export function setData(next) {
  data = next;
  store.set(data);
  emit();
}

const hooks = [];
/** Register a listener fired after every save. Used by cloud sync and the sky. */
export const onSave = fn => { hooks.push(fn); return fn };
function emit() { for (const fn of hooks) { try { fn(data) } catch (e) { console.error(e) } } }

export function save() { store.set(data); emit() }

export function weekOf(date = today()) {
  const n = Math.floor((new Date(date + 'T12:00') - new Date(data.start + 'T12:00')) / 6048e5) + 1;
  return Math.max(1, n);
}

/** Date of day `i` (0=Mon) in week `w` of the current program. */
export function dateFor(w, i) {
  const d = new Date(data.start + 'T12:00');
  d.setDate(d.getDate() + (w - 1) * 7 + i);
  return d.toISOString().slice(0, 10);
}

export function daysAgo(dateish) {
  if (!dateish) return null;
  const then = new Date(dateish);
  if (Number.isNaN(+then)) return null;
  return Math.floor((Date.now() - +then) / 864e5);
}
