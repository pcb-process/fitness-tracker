// The built-in 12-week block, transcribed from
// hybrid_aesthetic_calisthenics_marathon_tracker.xlsx (Program + Weekly Plan).
// Exercise tuple: [name, sets, reps/duration, rest]
import { data, weekOf } from './state.js';

export const PROGRAM = {
  'Upper A': [
    ['L-Sit Practice', 4, '10–20 sec', '60–90 sec'],
    ['Pull-up', 4, '5–8', '2–3 min'],
    ['Parallel Bar Dip', 4, '6–10', '2–3 min'],
    ['One-arm DB Row', 3, '8–12 / side', '90 sec'],
    ['Pike Push-up', 3, '6–12', '90–120 sec'],
    ['DB Lateral Raise', 4, '12–20', '45–75 sec'],
    ['DB Curl', 3, '10–15', '60 sec'],
    ['Hanging Knee Raise', 3, '10–15', '60 sec'],
  ],
  'Lower + Core': [
    ['DB Squat', 3, '6–10', '2 min'],
    ['DB Romanian Deadlift', 3, '8–12', '2 min'],
    ['Reverse Lunge', 2, '8–10 / side', '90 sec'],
    ['Single-leg Calf Raise', 3, '12–20 / side', '60 sec'],
    ['Tibialis Raise', 2, '15–25', '45–60 sec'],
    ['Hanging Leg Raise', 3, '8–15', '60 sec'],
    ['Side Plank', 2, '30–60 sec / side', '45 sec'],
  ],
  // Corrected against the Program sheet: the last three exercises were missing.
  'Upper B': [
    ['Handstand Practice', 1, '5–10 min', 'as needed'],
    ['Chin-up', 4, '6–10', '2 min'],
    ['Pseudo Planche Push-up', 3, '6–12', '90–120 sec'],
    ['DB Floor Press', 3, '8–12', '90 sec'],
    ['DB Shoulder Press', 3, '8–12', '90 sec'],
    ['DB Lateral Raise', 4, '15–25', '45–60 sec'],
    ['DB Rear Delt Fly', 3, '15–20', '60 sec'],
    ['Hammer Curl', 3, '10–15', 'superset'],
    ['DB Overhead Triceps Extension', 3, '10–15', '60–90 sec'],
  ],
  'Recovery': [['Mobility / Recovery', 1, '15–25 min', '—']],
  'Quality Run': [['Quality Run', 1, 'See plan', '—']],
  'Easy Run': [['Easy Run', 1, '30–60 min', '—']],
  'Long Run': [['Long Run', 1, 'Easy distance', '—']],
};

export const DAYS = [
  ['Mon', 'Upper A'], ['Tue', 'Lower + Core'], ['Wed', 'Recovery'],
  ['Thu', 'Upper B'], ['Fri', 'Quality Run'], ['Sat', 'Easy Run'], ['Sun', 'Long Run'],
];

export const QUALITY = [
  'Easy 30–40 min (re-entry)',
  'Tempo: 10–15 min WU + 20 min tempo + 10 min CD',
  'Intervals: 5×3 min hard-controlled / 2 min jog',
  'Easy 30 min — DELOAD',
  'Tempo: 25 min continuous',
  'Intervals: 6×3 min / 2 min jog',
  'Easy 35–45 min',
  'Easy 30 min — DELOAD',
  'Tempo: 30 min',
  'Intervals: 5×4 min / 2 min jog',
  'Easy 35–45 min',
  'Easy 30 min — DELOAD',
];

export const LONG = [8, 10, 12, 8, 14, 16, 18, 12, 20, 22, 24, 16];

export const BLOCK_WEEKS = 12;
export const DELOAD_WEEKS = [4, 8, 12];
export const SESSIONS_PER_WEEK = DAYS.length;

/** Accent token per session type — drives the constellation star colours. */
export const SESSION_ACCENT = {
  'Upper A': 'lime', 'Upper B': 'lime', 'Lower + Core': 'cyan',
  'Recovery': 'violet', 'Quality Run': 'magenta', 'Easy Run': 'cyan', 'Long Run': 'amber',
};

const clampWeek = w => Math.min(Math.max(w, 1), BLOCK_WEEKS) - 1;

export function longRunKm(w) { return LONG[clampWeek(w)] ?? 8 }
export function qualityRun(w) { return QUALITY[clampWeek(w)] ?? QUALITY[0] }

/** Short target line for a session in a given week. */
export function targetFor(session, w) {
  switch (session) {
    case 'Long Run': return `${longRunKm(w)} km easy`;
    case 'Quality Run': return qualityRun(w);
    case 'Easy Run': return '30–60 min easy, RPE 2–4';
    case 'Recovery': return '15–25 min mobility';
    case 'Upper A': return 'RIR 1–3';
    case 'Lower + Core': return 'RIR 2–3; เลี่ยง DOMS';
    default: return 'Aesthetic + skill';
  }
}

/** What is scheduled on a given date. */
export function planned(date) {
  const day = new Date((date || new Date().toISOString().slice(0, 10)) + 'T12:00');
  const i = (day.getDay() + 6) % 7;
  const d = date || day.toISOString().slice(0, 10);
  const w = weekOf(d);
  const [name, session] = DAYS[i];
  return { date: d, name, session, target: targetFor(session, w), w };
}

export const sessionKey = (date, session) => `${date}-${session}`;
export const isDone = (date, session) => Boolean(data.sessions[sessionKey(date, session)]?.done);
