// Body measurements and calisthenics/running benchmarks — the two spreadsheet
// sheets that had no home in the app. Both ride inside the owner-only
// training_program_state document, so friends never see them.
import { data, save, today, weekOf, $, num } from '../state.js';
import { register } from '../actions.js';
import { render } from '../router.js';
import * as ui from '../ui.js';

export const BODY_FIELDS = [
  ['weight', 'น้ำหนัก (kg)', 0.1],
  ['waist', 'รอบเอว (cm)', 0.1],
  ['chest', 'รอบอก (cm)', 0.1],
  ['shoulders', 'ไหล่ (cm)', 0.1],
  ['arm', 'ต้นแขน (cm)', 0.1],
  ['thigh', 'ต้นขา (cm)', 0.1],
  ['bodyfat', 'ไขมัน (%)', 0.1],
];

export const BENCH_FIELDS = [
  ['pullup', 'Pull-up สูงสุด', 1],
  ['dip', 'Dip สูงสุด', 1],
  ['pushup', 'Push-up สูงสุด', 1],
  ['lsit', 'L-Sit (วินาที)', 1],
  ['handstand', 'Handstand (วินาที)', 1],
];

const numberFields = (fields, prefix, seed = {}) =>
  fields.map(([key, labelText, step]) =>
    ui.field(labelText, { id: prefix + key, type: 'number', step, min: 0, inputmode: 'decimal', value: seed[key] ?? '' }));

const collect = (fields, prefix) => Object.fromEntries(
  fields.map(([key]) => {
    const raw = $('#' + prefix + key)?.value.trim();
    return [key, raw === '' || raw === undefined ? null : num(raw)];
  }));

/** Build a body row from the currently open form. Reused by onboarding. */
export function readBodyForm(prefix = 'b_') {
  const values = collect(BODY_FIELDS, prefix);
  if (Object.values(values).every(v => v === null)) return null;
  return { id: crypto.randomUUID(), date: $('#' + prefix + 'date')?.value || today(), week: weekOf(), ...values };
}
export function readBenchForm(prefix = 'k_') {
  const values = collect(BENCH_FIELDS, prefix);
  const run5k = $('#' + prefix + 'run5k')?.value.trim() || null;
  if (Object.values(values).every(v => v === null) && !run5k) return null;
  return { id: crypto.randomUUID(), date: $('#' + prefix + 'date')?.value || today(), week: weekOf(), ...values, run5k };
}

export const bodyFormFields = (prefix = 'b_', seed = {}) => [
  ui.field('วันที่', { id: prefix + 'date', type: 'date', value: seed.date || today() }),
  ...numberFields(BODY_FIELDS, prefix, seed),
];

export const benchFormFields = (prefix = 'k_', seed = {}) => [
  ui.field('วันที่', { id: prefix + 'date', type: 'date', value: seed.date || today() }),
  ...numberFields(BENCH_FIELDS, prefix, seed),
  ui.field('5K (mm:ss)', { id: prefix + 'run5k', value: seed.run5k || '', placeholder: '25:30' }),
];

register({
  openBody: () => ui.modal(`
    <h2>บันทึกร่างกาย</h2>
    ${ui.hint('วัดทุก 1–2 สัปดาห์ ในสภาพเดียวกัน (เช่น ตอนเช้าก่อนอาหาร) เพื่อให้เทียบกันได้')}
    ${ui.form(...bodyFormFields())}
    ${ui.button('บันทึก', { variant: 'primary', full: true, act: 'saveBody' })}`),

  saveBody: () => {
    const row = readBodyForm();
    if (!row) { ui.toast('กรอกอย่างน้อย 1 ช่อง'); return }
    data.body.push(row);
    data.body.sort((a, b) => (a.date < b.date ? -1 : 1));
    save();
    ui.closeModal();
    ui.toast('บันทึกร่างกายแล้ว');
    render();
  },

  openBench: () => ui.modal(`
    <h2>บันทึกเบนช์มาร์ก</h2>
    ${ui.hint('ทดสอบเดือนละครั้ง ไม่ต้องทดสอบทุกครั้งที่ซ้อม')}
    ${ui.form(...benchFormFields())}
    ${ui.button('บันทึก', { variant: 'primary', full: true, act: 'saveBench' })}`),

  saveBench: () => {
    const row = readBenchForm();
    if (!row) { ui.toast('กรอกอย่างน้อย 1 ช่อง'); return }
    data.benchmarks.push(row);
    data.benchmarks.sort((a, b) => (a.date < b.date ? -1 : 1));
    save();
    ui.closeModal();
    ui.toast('บันทึกเบนช์มาร์กแล้ว');
    render();
  },
});
