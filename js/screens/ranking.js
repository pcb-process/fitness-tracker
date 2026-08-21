// Leaderboard across you and your accepted friends. Everything shown here
// comes from training_progress_summary, which is the same friends-only shape
// the friend cards already use — no extra data is exposed by ranking.
import { $, esc } from '../state.js';
import { SESSIONS_PER_WEEK } from '../program.js';
import { session } from '../cloud.js';
import { summary as mySummary } from '../stats.js';
import { loadRanking, watchFriends, unwatchFriends } from '../social.js';
import { register } from '../actions.js';
import * as ui from '../ui.js';

/** Each metric knows how to read a summary row and how to print it. */
const METRICS = {
  completion: {
    label: 'สัปดาห์นี้',
    read: s => s.completion_pct ?? 0,
    print: (v, s) => `${Math.round(v)}%`,
    sub: s => `${s.sessions_done_week ?? 0}/${s.sessions_planned_week ?? SESSIONS_PER_WEEK} เซสชัน`,
  },
  streak: {
    label: 'สตรีค',
    read: s => s.streak_days ?? 0,
    print: v => `${v} วัน`,
    sub: s => (s.last_session_name ? `ล่าสุด ${s.last_session_name}` : ''),
  },
  distance: {
    label: 'ระยะวิ่ง',
    read: s => Number(s.total_run_km || 0),
    print: v => `${v.toFixed(1)} กม.`,
    sub: s => (s.longest_run_km ? `ไกลสุด ${Number(s.longest_run_km).toFixed(1)} กม.` : ''),
  },
  week: {
    label: 'บล็อก',
    read: s => s.current_week ?? 0,
    print: v => `สัปดาห์ ${v}`,
    sub: s => s.program_name || '',
  },
};

let metric = 'completion';
let cache = null;

export function rankingScreen() {
  return [
    ui.header(session.program?.name),
    ui.title('อันดับ'),
    ui.segmented([['friends', 'เพื่อน'], ['ranking', 'อันดับ']], 'ranking'),
    ui.card(`
      ${ui.label('จัดอันดับตาม')}
      ${ui.segmented(Object.entries(METRICS).map(([k, m]) => [k, m.label]), metric, 'rankBy', 'metric')}
    `),
    `<div id="rankingBody">${ui.card(ui.empty('กำลังโหลด…'))}</div>`,
    ui.nav(),
  ].join('');
}

function buildRows() {
  const m = METRICS[metric];
  const rows = [];

  // You are always in the list, computed locally so it is live even before the
  // debounced summary upload lands.
  const mine = mySummary(session.program?.name);
  const myName = session.profile?.display_name
    || session.user?.user_metadata?.display_name
    || session.profile?.handle
    || 'ฉัน';
  rows.push({ id: session.user?.id || 'me', name: myName, handle: session.profile?.handle || '', summary: mine, me: true });

  const byId = Object.fromEntries((cache?.summaries || []).map(s => [s.user_id, s]));
  for (const p of cache?.profiles || []) {
    rows.push({
      id: p.user_id,
      name: p.display_name || p.handle || 'นักฝึก',
      handle: p.handle || '',
      summary: byId[p.user_id] || null,
      me: false,
    });
  }

  // Friends who share nothing have no summary; they sort last, never above someone with data.
  rows.sort((a, b) => {
    const av = a.summary ? m.read(a.summary) : -1;
    const bv = b.summary ? m.read(b.summary) : -1;
    return bv - av;
  });

  const top = rows.reduce((n, r) => Math.max(n, r.summary ? m.read(r.summary) : 0), 0) || 1;
  return { rows, top, m };
}

function bodyHtml() {
  const { rows, top, m } = buildRows();

  if (rows.length < 2) {
    return ui.card(ui.empty('ยังไม่มีเพื่อนให้เทียบ', 'เพิ่มเพื่อนก่อน แล้วอันดับจะแสดงที่นี่')) +
      ui.button('ไปหน้าเพื่อน', { variant: 'primary', full: true, act: 'go', data: { tab: 'friends' } });
  }

  const podium = rows.slice(0, 3).map((r, i) => ui.metric(
    ['อันดับ 1', 'อันดับ 2', 'อันดับ 3'][i],
    r.summary ? m.print(m.read(r.summary), r.summary) : '—',
    r.name,
    ['', 'cyan', 'violet'][i],
  )).join('');

  const list = rows.map((r, i) => ui.rankRow({
    place: i + 1,
    name: r.name,
    handle: r.handle,
    me: r.me,
    value: r.summary ? m.print(m.read(r.summary), r.summary) : '—',
    sub: r.summary ? m.sub(r.summary) : 'ไม่ได้แชร์ความคืบหน้า',
    ratio: r.summary ? m.read(r.summary) / top : 0,
  })).join('');

  return `<div class="rank-podium">${podium}</div>${ui.card(list)}`;
}

async function refresh() {
  const box = $('#rankingBody');
  if (!box) return;
  if (!session.user) {
    box.innerHTML = ui.card(ui.empty('ต้องเข้าสู่ระบบก่อน', 'อันดับใช้ได้เมื่อเชื่อมบัญชีคลาวด์'));
    return;
  }
  try {
    cache = await loadRanking();
  } catch (e) {
    box.innerHTML = ui.card(ui.empty('โหลดอันดับไม่สำเร็จ', e.message));
    return;
  }
  box.innerHTML = bodyHtml();
}

export function rankingMount() {
  refresh();
  watchFriends(refresh);
}
export function rankingUnmount() { unwatchFriends() }

register({
  rankBy: ({ metric: next }) => {
    if (!METRICS[next]) return;
    metric = next;
    document.querySelectorAll('[data-act="rankBy"]').forEach(b =>
      b.classList.toggle('on', b.dataset.metric === metric));
    const box = $('#rankingBody');
    if (box && cache) box.innerHTML = bodyHtml();
  },
});
