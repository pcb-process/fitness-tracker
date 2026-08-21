// Friends: who they are, what they are doing right now, and how their block
// is going. Read-only summaries — never their set data.
import { $, esc, daysAgo } from '../state.js';
import { BLOCK_WEEKS, DELOAD_WEEKS, SESSIONS_PER_WEEK } from '../program.js';
import { session } from '../cloud.js';
import {
  loadFriends, searchProfiles, sendFriendRequest, acceptFriend, removeFriendship,
  watchFriends, unwatchFriends,
} from '../social.js';
import { register } from '../actions.js';
import * as ui from '../ui.js';

let cache = { friends: [], incoming: [], outgoing: [] };

export function friendsScreen() {
  return [
    ui.header(session.program?.name),
    ui.row(`<h2 class="section-title">เพื่อน</h2>`,
      ui.button('← กลับ', { act: 'go', data: { tab: 'more' } })),
    ui.segmented([['friends', 'เพื่อน'], ['ranking', 'อันดับ']], 'friends'),
    ui.card(`
      ${ui.hint('ค้นหาเจอเฉพาะคนที่เปิดให้ค้นหาด้วยชื่อผู้ใช้ อีเมลไม่เคยถูกแสดง')}
      <div class="friend-search">
        <input id="friendSearch" placeholder="ค้นหาชื่อผู้ใช้" data-enter="searchFriends">
        ${ui.button('ค้นหา', { act: 'searchFriends' })}
      </div>
      <div id="friendResults"></div>`),
    `<div id="friendsBody">${ui.card(ui.empty('กำลังโหลด…'))}</div>`,
    ui.nav(),
  ].join('');
}

function elapsed(startedAt) {
  if (!startedAt) return '';
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (mins < 1) return 'เพิ่งเริ่ม';
  if (mins < 60) return `${mins} นาที`;
  return `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
}

function statusLine(f) {
  const a = f.activity;
  if (f.live && a) {
    const bits = [];
    bits.push(a.status === 'resting' ? 'กำลังพัก' : 'กำลังทำ');
    if (a.session_name) bits.push(esc(a.session_name));
    if (a.exercise_name) bits.push(esc(a.exercise_name));
    if (a.set_index && a.set_total) bits.push(`เซ็ต ${a.set_index}/${a.set_total}`);
    const since = elapsed(a.started_at);
    return `${ui.dot(true)}${bits.join(' · ')}${since ? ` · ${since}` : ''}`;
  }
  const s = f.summary;
  if (s?.last_session_name) {
    const d = daysAgo(s.last_session_at);
    const when = d === null ? '' : d === 0 ? 'วันนี้' : d === 1 ? 'เมื่อวาน' : `${d} วันที่แล้ว`;
    return `${ui.dot(false)}ล่าสุด: ${esc(s.last_session_name)}${when ? ` · ${when}` : ''}`;
  }
  return `${ui.dot(false)}ยังไม่มีข้อมูลการฝึก`;
}

function friendCard(f) {
  const p = f.profile;
  const s = f.summary;
  const name = p.display_name || p.handle || 'นักฝึก';
  const stats = s ? `<div class="friend-stats">
      <span>สัปดาห์ <b>${s.current_week ?? '—'}</b></span>
      <span>เซสชัน <b>${s.sessions_done_week ?? 0}/${s.sessions_planned_week ?? SESSIONS_PER_WEEK}</b></span>
      <span>วิ่ง <b>${Number(s.total_run_km || 0).toFixed(1)}</b> กม.</span>
      <span>สตรีค <b>${s.streak_days ?? 0}</b> วัน</span>
    </div>${ui.progress(s.completion_pct || 0, { thin: true })}`
    : `<div class="friend-stats"><span>ยังไม่ได้แชร์ความคืบหน้า</span></div>`;

  return `<button class="friend-card ${f.live ? 'is-live' : ''}" ${ui.attrs({ act: 'viewFriend', id: f.id })}>
    ${ui.row(`<span class="name">${esc(name)}</span>`, `<span class="handle">@${esc(p.handle || '')}</span>`)}
    <p class="friend-status">${statusLine(f)}</p>
    ${stats}
  </button>`;
}

function bodyHtml() {
  const { friends, incoming, outgoing } = cache;
  const requests = incoming.length ? `${ui.subheading('คำขอเป็นเพื่อน')}${ui.card(
    incoming.map(f => {
      const name = f.profile?.display_name || f.profile?.handle || 'ผู้ใช้';
      return `<div class="friend-row">
        <span><b>${esc(name)}</b><small>@${esc(f.profile?.handle || '')}</small></span>
        <span class="btn-row">
          ${ui.button('รับ', { variant: 'primary', act: 'acceptFriend', data: { id: f.id } })}
          ${ui.button('ปฏิเสธ', { variant: 'ghost', act: 'removeFriend', data: { id: f.id } })}
        </span></div>`;
    }).join(''))}` : '';

  const pending = outgoing.length ? `${ui.subheading('คำขอที่ส่งไป')}${ui.card(
    outgoing.map(f => `<div class="friend-row"><span class="small">รอการตอบรับ</span>
      ${ui.button('ยกเลิก', { variant: 'ghost', act: 'removeFriend', data: { id: f.id } })}</div>`).join(''))}` : '';

  const list = friends.length
    ? friends.map(friendCard).join('')
    : ui.card(ui.empty('ยังไม่มีเพื่อน', 'ค้นหาด้วยชื่อผู้ใช้ด้านบนเพื่อส่งคำขอ'));

  return `${requests}${pending}${ui.subheading('เพื่อนของคุณ')}${list}`;
}

async function refresh() {
  const box0 = $('#friendsBody');
  if (!session.user) {
    if (box0) box0.innerHTML = ui.card(ui.empty('ต้องเข้าสู่ระบบก่อน', 'เพื่อนใช้ได้เมื่อเชื่อมบัญชีคลาวด์'));
    return;
  }
  try {
    cache = await loadFriends();
  } catch (e) {
    const box = $('#friendsBody');
    if (box) box.innerHTML = ui.card(ui.empty('โหลดรายชื่อเพื่อนไม่สำเร็จ', e.message));
    return;
  }
  const box = $('#friendsBody');
  if (box) box.innerHTML = bodyHtml();
}

export function friendsMount() {
  refresh();
  watchFriends(refresh);
}
export function friendsUnmount() { unwatchFriends() }

register({
  searchFriends: async () => {
    const q = $('#friendSearch').value.trim().toLowerCase();
    if (q.length < 3) { ui.toast('พิมพ์อย่างน้อย 3 ตัวอักษร'); return }
    try {
      const found = await searchProfiles(q);
      $('#friendResults').innerHTML = found.length
        ? found.map(p => `<div class="friend-row">
            <span><b>${esc(p.display_name || p.handle)}</b><small>@${esc(p.handle)}</small></span>
            ${ui.button('เพิ่ม', { act: 'addFriend', data: { id: p.user_id } })}</div>`).join('')
        : ui.hint('ไม่พบผู้ใช้ที่เปิดให้ค้นหา');
    } catch (e) { ui.toast(e.message) }
  },

  addFriend: async ({ id }) => {
    try { await sendFriendRequest(id); ui.toast('ส่งคำขอเป็นเพื่อนแล้ว'); refresh() }
    catch (e) { ui.toast(e.message) }
  },
  acceptFriend: async ({ id }) => {
    try { await acceptFriend(id); ui.toast('เป็นเพื่อนกันแล้ว'); refresh() }
    catch (e) { ui.toast(e.message) }
  },
  removeFriend: async ({ id }) => {
    try { await removeFriendship(id); refresh() }
    catch (e) { ui.toast(e.message) }
  },

  viewFriend: ({ id }) => {
    const f = cache.friends.find(x => x.id === id);
    if (!f) return;
    const p = f.profile, s = f.summary;
    const name = p.display_name || p.handle || 'นักฝึก';
    const weeks = s?.weeks || null;

    const completion = weeks?.completion?.length
      ? ui.barChart(weeks.completion.map((done, i) => ({
          label: String(i + 1), value: done, max: SESSIONS_PER_WEEK, mark: DELOAD_WEEKS.includes(i + 1),
        })), { height: 110 })
      : ui.empty('ยังไม่มีข้อมูลรายสัปดาห์');

    const runs = weeks?.runKm?.some(v => v > 0)
      ? ui.lineChart([{ values: weeks.runKm }], { labels: Array.from({ length: BLOCK_WEEKS }, (_, i) => String(i + 1)), height: 118 })
      : ui.empty('ยังไม่มีการวิ่ง');

    ui.modal(`
      <h2>${esc(name)}</h2>
      <p class="profile-handle">@${esc(p.handle || '')}</p>
      ${p.bio ? ui.hint(p.bio) : ''}
      <p class="friend-status">${statusLine(f)}</p>
      ${s ? ui.metricGrid(
        ui.metric('สัปดาห์', s.current_week ?? '—', s.program_name || '', 'violet'),
        ui.metric('วิ่งสะสม', Number(s.total_run_km || 0).toFixed(1), 'กม.', 'cyan'),
        ui.metric('สตรีค', s.streak_days ?? 0, 'วัน', 'magenta'),
      ) : ui.hint('เพื่อนคนนี้ปิดการแชร์ความคืบหน้า')}
      ${ui.subheading('ความสำเร็จรายสัปดาห์')}${completion}
      ${ui.subheading('ระยะวิ่งต่อสัปดาห์ (กม.)')}${runs}
      ${f.friendshipId ? ui.button('ลบออกจากเพื่อน', { variant: 'danger', full: true, act: 'removeFriendAndClose', data: { id: f.friendshipId } }) : ''}
    `);
  },

  removeFriendAndClose: async ({ id }) => {
    try { await removeFriendship(id); ui.closeModal(); ui.toast('ลบเพื่อนแล้ว'); refresh() }
    catch (e) { ui.toast(e.message) }
  },
});
