// Derived training numbers. Everything the dashboard shows and everything
// published to friends comes from here, so the two can never disagree.
import { data, weekOf, dateFor, today, num } from './state.js';
import { DAYS, BLOCK_WEEKS, SESSIONS_PER_WEEK, longRunKm, sessionKey } from './program.js';

const runLogs = () => data.logs.filter(x => x.type === 'run');

/** Sessions completed vs planned in a given program week. */
export function weekStats(w) {
  const done = DAYS.reduce((n, [, session], i) =>
    n + (data.sessions[sessionKey(dateFor(w, i), session)]?.done ? 1 : 0), 0);
  return { week: w, done, planned: SESSIONS_PER_WEEK, pct: Math.round((done / SESSIONS_PER_WEEK) * 100) };
}

export const allWeeks = () =>
  Array.from({ length: BLOCK_WEEKS }, (_, i) => weekStats(i + 1));

export function runTotals() {
  const runs = runLogs();
  const distances = runs.map(x => num(x.distance));
  return {
    count: runs.length,
    totalKm: distances.reduce((s, v) => s + v, 0),
    longestKm: distances.length ? Math.max(...distances) : 0,
  };
}

/** Run kilometres per program week, indexed 0 = week 1. */
export function runKmByWeek() {
  const weeks = Array(BLOCK_WEEKS).fill(0);
  for (const r of runLogs()) {
    if (!r.date) continue;
    const w = weekOf(r.date);
    if (w >= 1 && w <= BLOCK_WEEKS) weeks[w - 1] += num(r.distance);
  }
  return weeks;
}

export const plannedLongRuns = () =>
  Array.from({ length: BLOCK_WEEKS }, (_, i) => longRunKm(i + 1));

/** Consecutive days ending today (or yesterday) with at least one entry. */
export function streakDays() {
  const active = new Set();
  for (const [key, s] of Object.entries(data.sessions)) {
    if (s?.done) active.add(key.slice(0, 10));
  }
  for (const l of data.logs) if (l.date) active.add(l.date);
  if (!active.size) return 0;

  const cursor = new Date(today() + 'T12:00');
  if (!active.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (active.has(cursor.toISOString().slice(0, 10))) { n++; cursor.setDate(cursor.getDate() - 1) }
  return n;
}

export function lastSession() {
  const entries = data.logs.filter(l => l.date).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const l = entries[0];
  return l ? { name: l.session || (l.type === 'run' ? 'Run' : 'Session'), date: l.date } : null;
}

export const latestBody = () => data.body?.[data.body.length - 1] || null;
export const firstBody = () => data.body?.[0] || null;
export const latestBenchmark = () => data.benchmarks?.[data.benchmarks.length - 1] || null;
export const firstBenchmark = () => data.benchmarks?.[0] || null;

/** The row published to training_progress_summary for friends to read. */
export function summary(programName) {
  const w = weekOf();
  const wk = weekStats(w);
  const runs = runTotals();
  const last = lastSession();
  return {
    current_week: w,
    sessions_done_week: wk.done,
    sessions_planned_week: wk.planned,
    completion_pct: wk.pct,
    total_run_km: Number(runs.totalKm.toFixed(2)),
    longest_run_km: Number(runs.longestKm.toFixed(2)),
    streak_days: streakDays(),
    last_session_name: last?.name || null,
    last_session_at: last?.date || null,
    program_name: programName || null,
    // 12-week shape so a friend's detail view can draw the same charts as the
    // owner's dashboard without ever reading their session documents.
    weeks: {
      completion: allWeeks().map(x => x.done),
      runKm: runKmByWeek().map(v => Number(v.toFixed(2))),
    },
  };
}
