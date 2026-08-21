import { data, esc, dateFor } from '../state.js';
import { DAYS, planned, targetFor, sessionKey } from '../program.js';
import { weekStats, runTotals, streakDays } from '../stats.js';
import { session } from '../cloud.js';
import * as ui from '../ui.js';

export function homeScreen() {
  const p = planned();
  const wk = weekStats(p.w);
  const runs = runTotals();

  const hero = ui.card(`
    ${ui.label(`วันนี้ · ${p.name}`)}
    <h1>${ui.glitch(p.session, 'span')}</h1>
    <p class="detail">${esc(p.target)}</p>
    ${ui.button('เริ่มเซสชัน', { variant: 'primary', act: 'startPlanned' })}
  `, { extraClass: 'hero' });

  const metrics = ui.metricGrid(
    ui.metric('สัปดาห์นี้', `${wk.done}/${wk.planned}`, 'เซสชันเสร็จ'),
    ui.metric('วิ่งสะสม', runs.totalKm.toFixed(1), 'กม.', 'cyan'),
    ui.metric('สตรีค', streakDays(), 'วันติดกัน', 'magenta'),
  );

  const week = DAYS.map(([day, sessionName], i) => {
    const d = dateFor(p.w, i);
    const done = Boolean(data.sessions[sessionKey(d, sessionName)]?.done);
    return ui.item({
      title: `${esc(day)} · ${esc(sessionName)}`,
      sub: `${esc(d)} · ${esc(targetFor(sessionName, p.w))}`,
      right: ui.pill(done ? 'เสร็จแล้ว' : 'รอทำ', done ? 'done' : ''),
    });
  }).join('');

  return [
    ui.header(session.program?.name),
    hero,
    metrics,
    ui.title('สัปดาห์นี้'),
    ui.card(week),
    ui.nav(),
  ].join('');
}
