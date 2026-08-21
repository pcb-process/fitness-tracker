import { data, esc, weekOf } from '../state.js';
import { BLOCK_WEEKS, DELOAD_WEEKS } from '../program.js';
import {
  allWeeks, runTotals, runKmByWeek, plannedLongRuns, streakDays,
  latestBody, firstBody, latestBenchmark, firstBenchmark,
} from '../stats.js';
import { session } from '../cloud.js';
import { drawInline } from '../sky.js';
import { BODY_FIELDS, BENCH_FIELDS } from './body.js';
import * as ui from '../ui.js';

const fixed = (v, n = 1) => (Number.isFinite(Number(v)) ? Number(v).toFixed(n) : '—');

function kpis() {
  const w = weekOf();
  const wk = allWeeks()[Math.min(w, BLOCK_WEEKS) - 1] || { done: 0, planned: 7 };
  const runs = runTotals();
  return [
    ui.metricGrid(
      ui.metric('สัปดาห์', `${Math.min(w, BLOCK_WEEKS)}/${BLOCK_WEEKS}`, 'ของบล็อก', 'violet'),
      ui.metric('เซสชัน', `${wk.done}/${wk.planned}`, 'สัปดาห์นี้'),
      ui.metric('สตรีค', streakDays(), 'วัน', 'magenta'),
    ),
    ui.metricGrid(
      ui.metric('วิ่งสะสม', fixed(runs.totalKm), 'กม.', 'cyan'),
      ui.metric('ไกลสุด', fixed(runs.longestKm), 'กม.', 'cyan'),
      ui.metric('บันทึก', data.logs.length, 'รายการ'),
    ),
  ].join('');
}

function constellation() {
  return ui.card(`
    ${ui.label('กลุ่มดาวสัปดาห์นี้')}
    ${ui.hint('แต่ละดวงคือหนึ่งเซสชันของสัปดาห์ ทำเสร็จแล้วดาวจะสว่างและเส้นจะเชื่อมถึงกัน')}
    <canvas id="skyInline" class="sky-inline" aria-hidden="true"></canvas>
    ${ui.chartLegend(['กำลัง / ผลัก', 'lime'], ['ขา / วิ่งเบา', 'cyan'], ['ฟื้นฟู', 'violet'], ['วิ่งคุณภาพ', 'magenta'], ['Long Run', 'amber'])}
  `, { accent: 'violet' });
}

function completion() {
  const rows = allWeeks().map(w => ({
    label: String(w.week), value: w.done, max: w.planned, mark: DELOAD_WEEKS.includes(w.week),
  }));
  return ui.card(`
    ${ui.label('ความสำเร็จรายสัปดาห์')}
    ${ui.hint('เทียบเซสชันที่ทำเสร็จกับ 7 เซสชันที่วางแผนไว้ จุดสีม่วงคือสัปดาห์ deload')}
    ${ui.barChart(rows, { height: 118 })}
  `);
}

function running() {
  const actual = runKmByWeek();
  const plan = plannedLongRuns();
  if (!actual.some(v => v > 0)) {
    return ui.card(`${ui.label('ระยะวิ่งต่อสัปดาห์')}${ui.empty('ยังไม่มีการวิ่ง', 'บันทึกการวิ่งจากแท็บ “บันทึก”')}`);
  }
  return ui.card(`
    ${ui.label('ระยะวิ่งต่อสัปดาห์')}
    ${ui.lineChart([
      { values: actual },
      { values: plan, plan: true },
    ], { labels: Array.from({ length: BLOCK_WEEKS }, (_, i) => String(i + 1)), height: 130 })}
    ${ui.chartLegend(['ระยะจริง (กม.)', 'lime'], ['Long Run ตามแผน', 'violet'])}
  `, { accent: 'cyan' });
}

function bodySection() {
  const rows = data.body || [];
  const latest = latestBody(), first = firstBody();
  if (!rows.length) {
    return ui.card(`
      ${ui.label('ร่างกาย')}
      ${ui.empty('ยังไม่มีการวัด', 'บันทึกน้ำหนักและรอบตัวทุก 1–2 สัปดาห์')}
      ${ui.button('+ บันทึกร่างกาย', { variant: 'primary', full: true, act: 'openBody' })}`);
  }
  const tiles = BODY_FIELDS.map(([key, labelText]) => {
    const now = latest[key], was = first[key];
    if (now === null || now === undefined) return '';
    // Only show a delta once there is something to compare against.
    const diff = Number.isFinite(was) && was !== null ? now - was : 0;
    return `<div class="measure">${ui.label(labelText)}<b>${fixed(now)}</b>${
      diff ? `<span class="delta ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${fixed(diff)}</span>` : ''}</div>`;
  }).join('');

  const weights = rows.map(r => Number(r.weight)).filter(Number.isFinite);
  const waists = rows.map(r => Number(r.waist)).filter(Number.isFinite);

  return ui.card(`
    ${ui.row(ui.label('ร่างกาย'), `<span class="small">ล่าสุด ${esc(latest.date)}</span>`)}
    <div class="measure-grid">${tiles}</div>
    ${weights.length > 1 ? `${ui.subheading('น้ำหนัก')}${ui.sparkline(weights, { tone: 'lime' })}` : ''}
    ${waists.length > 1 ? `${ui.subheading('รอบเอว')}${ui.sparkline(waists, { tone: 'cyan' })}` : ''}
    ${ui.button('+ บันทึกร่างกาย', { full: true, act: 'openBody' })}
  `);
}

function benchSection() {
  const rows = data.benchmarks || [];
  if (!rows.length) {
    return ui.card(`
      ${ui.label('เบนช์มาร์ก')}
      ${ui.empty('ยังไม่มีการทดสอบ', 'ทดสอบ Pull-up / Dip / L-Sit เดือนละครั้ง')}
      ${ui.button('+ บันทึกเบนช์มาร์ก', { variant: 'primary', full: true, act: 'openBench' })}`, { accent: 'magenta' });
  }
  const latest = latestBenchmark(), first = firstBenchmark();
  const tiles = BENCH_FIELDS.map(([key, labelText]) => {
    const now = latest[key];
    if (now === null || now === undefined) return '';
    const was = first[key];
    const diff = Number.isFinite(was) && was !== null ? now - was : null;
    return `<div class="measure">${ui.label(labelText)}<b>${fixed(now, 0)}</b>${
      diff ? `<span class="delta ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${fixed(diff, 0)}</span>` : ''}</div>`;
  }).join('');
  const run5k = latest.run5k
    ? `<div class="measure">${ui.label('5K')}<b>${esc(latest.run5k)}</b></div>` : '';

  return ui.card(`
    ${ui.row(ui.label('เบนช์มาร์ก'), `<span class="small">ล่าสุด ${esc(latest.date)}</span>`)}
    <div class="measure-grid">${tiles}${run5k}</div>
    ${ui.button('+ บันทึกเบนช์มาร์ก', { full: true, act: 'openBench' })}
  `, { accent: 'magenta' });
}

export function dashboardScreen() {
  return [
    ui.header(session.program?.name),
    ui.title('แดชบอร์ด'),
    kpis(),
    constellation(),
    completion(),
    running(),
    bodySection(),
    benchSection(),
    ui.nav(),
  ].join('');
}

/** Called by app.js after the dashboard markup is in the DOM. */
export function dashboardMount() {
  drawInline(document.getElementById('skyInline'));
}
