import { data, save, esc, today, $ } from '../state.js';
import { session } from '../cloud.js';
import { register } from '../actions.js';
import { go } from '../router.js';
import * as ui from '../ui.js';

export function logScreen() {
  const entries = data.logs.slice().reverse().slice(0, 30);
  const list = entries.length
    ? entries.map(x => ui.item({
        title: x.type === 'run' ? `🏃 ${esc(x.session)}` : `💪 ${esc(x.session)}`,
        sub: x.type === 'run'
          ? `${esc(x.date)} · ${esc(x.distance)} km · ${esc(x.duration)} min · RPE ${esc(x.rpe || '—')}`
          : `${esc(x.date)} · ${esc(x.summary)}`,
        right: ui.button('×', { variant: 'icon', act: 'deleteLog', data: { id: x.id } }),
      })).join('')
    : ui.empty('ยังไม่มีบันทึก', 'ทำเซสชันหรือกด “บันทึกวิ่ง”');

  return [
    ui.header(session.program?.name),
    ui.row(`<h2 class="section-title">บันทึกผล</h2>`,
      ui.button('+ บันทึกวิ่ง', { act: 'openRun' })),
    ui.card(`${ui.label('ประวัติล่าสุด')}${list}`),
    ui.nav(),
  ].join('');
}

register({
  openRun: () => ui.modal(`
    <h2>บันทึกการวิ่ง</h2>
    ${ui.form(
      ui.field('วันที่', { id: 'rdate', type: 'date', value: today() }),
      ui.selectField('ประเภท', { id: 'rtype', options: ['Easy Run', 'Quality Run', 'Long Run', 'Custom Run'] }),
      ui.field('ระยะทาง (km)', { id: 'rdist', type: 'number', step: 0.01, inputmode: 'decimal', placeholder: '5.0' }),
      ui.field('เวลา (นาที)', { id: 'rdur', type: 'number', step: 0.1, inputmode: 'decimal', placeholder: '30' }),
      ui.field('RPE (1–10)', { id: 'rrpe', type: 'number', min: 1, max: 10, inputmode: 'numeric' }),
      ui.textareaField('โน้ต', { id: 'rnote', placeholder: 'เส้นทาง, รองเท้า, ความรู้สึก...' }),
    )}
    ${ui.button('บันทึกการวิ่ง', { variant: 'primary', full: true, act: 'saveRun' })}`),

  saveRun: () => {
    const entry = {
      id: crypto.randomUUID(), type: 'run',
      date: $('#rdate').value, session: $('#rtype').value,
      distance: $('#rdist').value, duration: $('#rdur').value,
      rpe: $('#rrpe').value, note: $('#rnote').value,
    };
    if (!entry.distance || !entry.duration) { ui.toast('กรอกระยะทางและเวลาให้ครบ'); return }
    data.logs.push(entry);
    save();
    ui.closeModal();
    go('log');
  },

  deleteLog: ({ id }) => {
    data.logs = data.logs.filter(x => x.id !== id);
    save();
    go('log');
  },
});
