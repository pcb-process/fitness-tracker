// First-run stepper. Replaces the old behaviour where the first cloud login
// silently created a program called "My first program" with today's date.
import { $, esc, today, nextMonday, setData, defaults } from '../state.js';
import { session, createProgram, completeOnboarding, HANDLE_RE } from '../cloud.js';
import { publishSummary } from '../social.js';
import { register } from '../actions.js';
import { render } from '../router.js';
import { bodyFormFields, benchFormFields, readBodyForm, readBenchForm } from './body.js';
import * as ui from '../ui.js';

const TOTAL = 6;
let step = 0;
let draft = {};

export function startOnboarding(user, profile) {
  step = 0;
  draft = {
    name: profile?.display_name || user?.user_metadata?.display_name || '',
    handle: profile?.handle || '',
    kind: 'builtin',
    start: nextMonday(),
    body: null,
    bench: null,
    isPublic: profile?.is_profile_public ?? true,
    share: profile?.share_progress !== false,
  };
  paint();
}

function shell(inner) {
  $('#app').innerHTML = `<section class="onb-shell">
    <div class="brand">${ui.glitch('HYBRID', 'span')} <span>//</span> ${ui.glitch('TRAIN', 'span')}</div>
    ${ui.steps(TOTAL, step)}
    <div class="step">${inner}</div>
  </section>`;
}

const nav = (nextLabel = 'ถัดไป', { skip = false } = {}) => `<div class="onb-actions">
  ${step > 0 ? ui.button('ย้อนกลับ', { variant: 'ghost', act: 'onbBack' }) : ''}
  ${skip ? ui.button('ข้าม', { variant: 'ghost', act: 'onbSkip' }) : ''}
  ${ui.button(nextLabel, { variant: 'primary', act: 'onbNext' })}
</div>`;

function weekPreview(startDate) {
  const d = new Date(startDate + 'T12:00');
  const end = new Date(d); end.setDate(end.getDate() + 6);
  return `สัปดาห์ที่ 1: ${d.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`;
}

function paint() {
  switch (step) {
    case 0: return shell(`
      <h1 class="onb-title">เริ่มกันเลย</h1>
      <p class="onb-lead">ตั้งชื่อที่จะแสดง และชื่อผู้ใช้สำหรับให้เพื่อนค้นหา ชื่อผู้ใช้เปลี่ยนภายหลังได้</p>
      ${ui.form(
        ui.field('ชื่อที่แสดง', { id: 'onbName', span: true, value: draft.name, placeholder: 'ชื่อของคุณ' }),
        ui.field('ชื่อผู้ใช้', { id: 'onbHandle', span: true, value: draft.handle, placeholder: 'lowercase_name', attrs: 'maxlength="24"' }),
      )}
      ${ui.hint('ใช้ a–z, 0–9 หรือ _ ความยาว 3–24 ตัว')}
      ${nav()}`);

    case 1: return shell(`
      <h1 class="onb-title">เลือกโปรแกรม</h1>
      <p class="onb-lead">เริ่มจากบล็อกสำเร็จรูป หรือสร้างโปรแกรมของคุณเองตั้งแต่ต้น</p>
      <div class="choice-list">
        <button class="choice ${draft.kind === 'builtin' ? 'selected' : ''}" ${ui.attrs({ act: 'onbPick', kind: 'builtin' })}>
          <b>Hybrid Aesthetic Calisthenics + Marathon</b>
          <small>12 สัปดาห์ · Upper A / Lower + Core / Recovery / Upper B แล้วต่อด้วย Quality, Easy และ Long Run · deload สัปดาห์ที่ 4, 8, 12</small>
        </button>
        <button class="choice ${draft.kind === 'custom' ? 'selected' : ''}" ${ui.attrs({ act: 'onbPick', kind: 'custom' })}>
          <b>ออกแบบเอง</b>
          <small>เริ่มจากโปรแกรมเปล่า แล้วเพิ่มท่าของคุณเองจากแท็บ “โปรแกรม”</small>
        </button>
      </div>
      ${nav()}`);

    case 2: return shell(`
      <h1 class="onb-title">วันเริ่ม</h1>
      <p class="onb-lead">สัปดาห์เริ่มนับจากวันนี้ เลือกวันจันทร์เพื่อให้ตรงกับตารางรายสัปดาห์</p>
      ${ui.form(ui.field('วันเริ่มโปรแกรม', { id: 'onbStart', type: 'date', span: true, value: draft.start }))}
      <p class="hint" id="onbPreview">${esc(weekPreview(draft.start))}</p>
      ${nav()}`);

    case 3: return shell(`
      <h1 class="onb-title">จุดเริ่มต้นของร่างกาย</h1>
      <p class="onb-lead">บันทึกค่าตั้งต้นไว้เทียบความเปลี่ยนแปลง ข้ามได้ถ้ายังไม่ได้วัด</p>
      ${ui.form(...bodyFormFields('b_', { date: today() }))}
      ${nav('ถัดไป', { skip: true })}`);

    case 4: return shell(`
      <h1 class="onb-title">เบนช์มาร์กเริ่มต้น</h1>
      <p class="onb-lead">ทดสอบครั้งเดียวตอนนี้ แล้วทดสอบซ้ำเดือนละครั้ง ข้ามได้</p>
      ${ui.form(...benchFormFields('k_', { date: today() }))}
      ${nav('ถัดไป', { skip: true })}`);

    default: return shell(`
      <h1 class="onb-title">ความเป็นส่วนตัว</h1>
      <p class="onb-lead">คุณควบคุมได้ว่าเพื่อนเห็นอะไร เปลี่ยนได้ทุกเมื่อในหน้าตั้งค่า</p>
      ${ui.form(
        ui.checkField('ให้คนอื่นค้นหาฉันด้วยชื่อผู้ใช้', { id: 'onbPublic', checked: draft.isPublic, note: 'ถ้าปิด จะไม่มีใครค้นหาคุณเจอ' }),
        ui.checkField('ให้เพื่อนเห็นความคืบหน้าและสถานะสด', { id: 'onbShare', checked: draft.share, note: 'เพื่อนเห็นสรุปรายสัปดาห์และสิ่งที่คุณกำลังทำ ไม่เห็นจำนวนครั้ง น้ำหนัก หรือการวัดร่างกาย' }),
      )}
      ${nav('เริ่มฝึก')}`);
  }
}

/** Pull the current step's inputs into `draft`. Returns false if invalid. */
function capture() {
  switch (step) {
    case 0: {
      draft.name = $('#onbName').value.trim();
      draft.handle = $('#onbHandle').value.trim().toLowerCase();
      if (draft.handle && !HANDLE_RE.test(draft.handle)) {
        ui.toast('ชื่อผู้ใช้ต้องเป็น a–z, 0–9 หรือ _ ความยาว 3–24 ตัว');
        return false;
      }
      return true;
    }
    case 2: {
      draft.start = $('#onbStart').value || nextMonday();
      return true;
    }
    case 3: draft.body = readBodyForm('b_'); return true;
    case 4: draft.bench = readBenchForm('k_'); return true;
    case 5: {
      draft.isPublic = $('#onbPublic').checked;
      draft.share = $('#onbShare').checked;
      return true;
    }
    default: return true;
  }
}

async function finish() {
  const programName = draft.kind === 'builtin'
    ? 'Hybrid Aesthetic Calisthenics + Marathon'
    : 'โปรแกรมของฉัน';

  const state = defaults({ start: draft.start });
  if (draft.body) state.body = [draft.body];
  if (draft.bench) state.benchmarks = [draft.bench];
  setData(state);

  try {
    await createProgram({ name: programName, start: draft.start, goal: draft.kind === 'builtin' ? 'Aesthetic Calisthenics + Marathon' : null });
    await completeOnboarding({
      display_name: draft.name || null,
      handle: draft.handle || null,
      is_profile_public: draft.isPublic,
      share_progress: draft.share,
    });
  } catch (e) {
    ui.toast(e.message);
    return;
  }
  session.booted = true;
  publishSummary();
  render();
  ui.toast('พร้อมแล้ว เริ่มฝึกได้เลย');
}

register({
  onbPick: ({ kind }) => { draft.kind = kind; paint() },
  onbBack: () => { capture(); step = Math.max(0, step - 1); paint() },
  onbSkip: () => { if (step === 3) draft.body = null; if (step === 4) draft.bench = null; step++; paint() },
  onbNext: () => {
    if (!capture()) return;
    if (step === TOTAL - 1) { finish(); return }
    step++;
    paint();
  },
});
