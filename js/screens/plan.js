import { data, save, esc, weekOf, dateFor, $ } from '../state.js';
import { DAYS, PROGRAM, targetFor } from '../program.js';
import { session } from '../cloud.js';
import { register } from '../actions.js';
import { go } from '../router.js';
import * as ui from '../ui.js';

export function planScreen() {
  const w = weekOf();

  const days = DAYS.map(([day, name], i) => {
    const d = dateFor(w, i);
    const ex = PROGRAM[name] || [];
    const sub = /Run$/.test(name) ? targetFor(name, w) : ex.map(x => x[0]).join(' · ');
    return ui.item({
      meta: `${day} · ${d}`,
      title: esc(name),
      sub: esc(sub),
      right: ui.button('เปิด', { act: 'openSession', data: { s: name, d } }),
    });
  }).join('');

  const custom = data.custom.length
    ? data.custom.map((c, i) => ui.item({
        title: esc(c.name),
        sub: `${c.items.length} ท่า · ${c.items.map(x => esc(x.name)).join(', ')}`,
        right: ui.button('เริ่ม', { act: 'openCustomSession', data: { i } }),
      })).join('')
    : ui.empty('ยังไม่มีโปรแกรมส่วนตัว', 'กด “ออกแบบเอง” เพื่อเริ่มสร้าง');

  return [
    ui.header(session.program?.name),
    ui.row(`<h2 class="section-title">โปรแกรมสัปดาห์ ${w}</h2>`,
      ui.button('+ ออกแบบเอง', { act: 'openCustom' })),
    ui.hint('ดึงมาจากไฟล์ Hybrid Aesthetic Calisthenics + Marathon ของคุณ แก้ไขโปรแกรมเองได้จากปุ่มด้านบน'),
    ui.card(days),
    ui.title('โปรแกรมที่ออกแบบเอง'),
    ui.card(custom),
    ui.nav(),
  ].join('');
}

register({
  openCustom: () => ui.modal(`
    <h2>ออกแบบโปรแกรม</h2>
    ${ui.hint('เพิ่มท่าทีละบรรทัด รูปแบบ: ชื่อท่า | จำนวนเซ็ต | reps/เวลา | เวลาพัก')}
    ${ui.form(
      ui.field('ชื่อโปรแกรม', { id: 'cname', span: true, placeholder: 'เช่น Home strength 30 นาที' }),
      ui.textareaField('ท่าออกกำลังกาย', { id: 'citems', placeholder: 'Push-up | 3 | 10–15 | 60 sec\nSquat | 3 | 12 | 60 sec' }),
    )}
    ${ui.button('บันทึกโปรแกรม', { variant: 'primary', full: true, act: 'saveCustom' })}`),

  saveCustom: () => {
    const name = $('#cname').value.trim();
    const rows = $('#citems').value.trim().split('\n').filter(Boolean).map(r => {
      const a = r.split('|').map(x => x.trim());
      return { name: a[0], sets: Number(a[1]) || 3, reps: a[2] || '8–12', rest: a[3] || '60 sec' };
    });
    if (!name || !rows.length) { ui.toast('กรอกชื่อและอย่างน้อย 1 ท่า'); return }
    data.custom.push({ name, items: rows });
    save();
    ui.closeModal();
    go('plan');
  },
});
