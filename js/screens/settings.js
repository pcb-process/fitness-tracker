import { data, save, setData, esc, today, weekOf, $ } from '../state.js';
import {
  cloudEnabled, session, signOut, refreshPrograms, createProgram, switchProgram,
  loadProfile, saveProfile, HANDLE_RE,
} from '../cloud.js';
import { publishSummary, clearShared, goIdle } from '../social.js';
import { register, registerChange } from '../actions.js';
import { render } from '../router.js';
import * as ui from '../ui.js';

export function settingsScreen() {
  const account = cloudEnabled ? [
    ui.card(`
      ${ui.label('โปรไฟล์และเพื่อน')}
      ${ui.hint('ตั้งชื่อผู้ใช้สาธารณะเพื่อให้เพื่อนค้นหาเจอ อีเมลและรายละเอียดการฝึกยังเป็นส่วนตัว')}
      <div class="settings-actions">
        ${ui.button('แก้ไขโปรไฟล์', { act: 'editProfile' })}
        ${ui.button('เพื่อน', { act: 'go', data: { tab: 'friends' } })}
        ${ui.button('อันดับ', { act: 'go', data: { tab: 'ranking' } })}
      </div>`, { accent: 'cyan' }),
    ui.card(`
      ${ui.label('บัญชี')}
      ${ui.hint(`เข้าสู่ระบบด้วย ${esc(session.user?.email || '')}`)}
      <div class="settings-actions">
        ${ui.button('ตั้งค่าเริ่มต้นใหม่', { act: 'restartOnboarding' })}
        ${ui.button('ออกจากระบบ', { variant: 'danger', act: 'signOut' })}
      </div>`),
  ].join('') : '';

  return [
    ui.header(session.program?.name),
    ui.title('ตั้งค่า'),
    ui.card(`
      ${ui.label('โปรแกรมที่ใช้อยู่')}
      <h3 class="settings-title">${esc(session.program?.name || 'โปรแกรมในเครื่อง')}</h3>
      ${ui.hint(cloudEnabled
        ? 'เลือกโปรแกรม สร้างบล็อกใหม่ หรือกำหนดวันเริ่ม แต่ละโปรแกรมเก็บประวัติแยกกัน'
        : 'เชื่อม Supabase เพื่อใช้บัญชีและโปรแกรมบนคลาวด์')}
      ${ui.button('เลือกโปรแกรม', { variant: 'primary', act: 'openPrograms' })}`, { accent: 'lime' }),
    ui.card(`
      ${ui.label('ตารางโปรแกรม')}
      ${ui.form(
        `<label>วันเริ่ม<input type="date" value="${esc(data.start)}" data-change="setStart"></label>`,
        ui.field('สัปดาห์ปัจจุบัน', { id: 'currentWeek', value: weekOf(), disabled: true }),
      )}`),
    account,
    ui.card(`
      ${ui.label('สำรองข้อมูล')}
      ${ui.hint('Export ไฟล์สำรองก่อนเปลี่ยนเครื่อง บัญชีที่เชื่อมคลาวด์จะซิงก์อัตโนมัติทุกครั้งที่บันทึก')}
      <div class="settings-actions">
        ${ui.button('Export ข้อมูล', { act: 'exportData' })}
        ${ui.button('Import ข้อมูล', { act: 'pickImport' })}
      </div>
      <input id="importFile" hidden type="file" accept="application/json" data-change="importData">`),
    ui.nav(),
  ].join('');
}

register({
  openPrograms: async () => {
    if (!cloudEnabled) { ui.toast('เพิ่ม Supabase URL และ key ใน supabase-config.js ก่อน'); return }
    try { await refreshPrograms() } catch (e) { ui.toast(e.message); return }
    ui.modal(`
      <h2>เลือกโปรแกรม</h2>
      ${ui.hint('การสลับโปรแกรมจะเปลี่ยนตารางและประวัติที่แสดงในแอป')}
      <div class="program-list">${session.programs.map(p =>
        `<button class="program-option ${p.id === session.program?.id ? 'selected' : ''}" ${ui.attrs({ act: 'switchProgram', id: p.id })}>
          <span><b>${esc(p.name)}</b><small>เริ่ม ${esc(p.start_date)}</small></span>
        </button>`).join('')}</div>
      ${ui.form(
        ui.field('ชื่อโปรแกรมใหม่', { id: 'newProgramName', span: true, placeholder: 'เช่น Aesthetic Calisthenics' }),
        ui.field('วันเริ่ม', { id: 'newProgramStart', type: 'date', value: today() }),
        ui.field('เป้าหมาย (ไม่บังคับ)', { id: 'newProgramGoal', placeholder: 'เช่น วิ่ง 10K' }),
      )}
      ${ui.button('สร้างโปรแกรม', { variant: 'primary', full: true, act: 'createProgram' })}`);
  },

  switchProgram: async ({ id }) => {
    if (id === session.program?.id) { ui.closeModal(); return }
    await switchProgram(id);
    ui.closeModal();
    publishSummary();
    render();
  },

  createProgram: async () => {
    const name = $('#newProgramName').value.trim();
    if (!name) { ui.toast('ตั้งชื่อโปรแกรมก่อน'); return }
    try {
      await createProgram({
        name, start: $('#newProgramStart').value || today(),
        goal: $('#newProgramGoal').value.trim(),
      });
    } catch (e) { ui.toast(e.message); return }
    setData({ start: $('#newProgramStart').value || today(), logs: [], sessions: {}, custom: [], body: [], benchmarks: [], tab: 'home' });
    ui.closeModal();
    render();
  },

  editProfile: async () => {
    const profile = await loadProfile();
    ui.modal(`
      <h2>โปรไฟล์ของคุณ</h2>
      ${ui.hint('เพื่อนเห็นได้เฉพาะชื่อ ชื่อผู้ใช้ และ bio เท่านั้น อีเมลไม่เคยถูกแสดง')}
      ${ui.form(
        ui.field('ชื่อ', { id: 'profileName', value: profile?.display_name || session.user?.user_metadata?.display_name || '', attrs: 'maxlength="60"' }),
        ui.field('ชื่อผู้ใช้', { id: 'profileHandle', value: profile?.handle || '', placeholder: 'lowercase_name', attrs: 'maxlength="24"' }),
        ui.field('Bio', { id: 'profileBio', span: true, value: profile?.bio || '', placeholder: 'เป้าหมายการฝึกสั้น ๆ', attrs: 'maxlength="160"' }),
        ui.checkField('ให้คนอื่นค้นหาฉันด้วยชื่อผู้ใช้', { id: 'profilePublic', checked: profile?.is_profile_public }),
        ui.checkField('ให้เพื่อนเห็นความคืบหน้าและสถานะสด', { id: 'profileShare', checked: profile?.share_progress !== false, note: 'เพื่อนเห็นสรุปรายสัปดาห์และสิ่งที่คุณกำลังทำ แต่ไม่เห็นน้ำหนัก จำนวนครั้ง หรือการวัดร่างกาย' }),
      )}
      ${ui.button('บันทึกโปรไฟล์', { variant: 'primary', full: true, act: 'saveProfile' })}`);
  },

  saveProfile: async () => {
    const handle = $('#profileHandle').value.trim().toLowerCase();
    if (handle && !HANDLE_RE.test(handle)) {
      ui.toast('ชื่อผู้ใช้ต้องเป็น a–z, 0–9 หรือ _ ความยาว 3–24 ตัว');
      return;
    }
    const share = $('#profileShare').checked;
    try {
      await saveProfile({
        display_name: $('#profileName').value.trim(),
        handle: handle || null,
        bio: $('#profileBio').value.trim() || null,
        is_profile_public: $('#profilePublic').checked,
        share_progress: share,
      });
    } catch (e) { ui.toast(e.message); return }
    share ? publishSummary() : await clearShared();
    ui.closeModal();
    ui.toast('บันทึกโปรไฟล์แล้ว');
  },

  restartOnboarding: async () => {
    await saveProfile({ onboarded_at: null });
    location.reload();
  },

  signOut: async () => { await goIdle(); await signOut() },

  exportData: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `hybrid-train-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  pickImport: () => $('#importFile').click(),
});

registerChange({
  setStart: (_d, el) => { data.start = el.value; save(); render() },

  importData: (_d, el) => {
    const file = el.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(reader.result);
        setData({ ...next, tab: 'home' });
        render();
        ui.toast('นำเข้าข้อมูลเรียบร้อย');
      } catch { ui.toast('ไฟล์ไม่ถูกต้อง') }
    };
    reader.readAsText(file);
  },
});
