import { $, esc } from '../state.js';
import { signUp, signIn, startCloudSession } from '../cloud.js';
import { register } from '../actions.js';
import * as ui from '../ui.js';

let mode = 'signin';

export function authView(message = '') {
  $('#app').innerHTML = `<section class="auth-shell"><div class="auth-card">
    <div class="brand">${ui.glitch('HYBRID', 'span')} <span>//</span> ${ui.glitch('TRAIN', 'span')}</div>
    <p class="sub">ซิงก์การฝึกของคุณข้ามอุปกรณ์อย่างปลอดภัย</p>
    ${message ? `<p class="auth-message">${esc(message)}</p>` : ''}
    <div class="auth-tabs">
      <button class="${mode === 'signin' ? 'active' : ''}" ${ui.attrs({ act: 'showAuth', mode: 'signin' })}>เข้าสู่ระบบ</button>
      <button class="${mode === 'signup' ? 'active' : ''}" ${ui.attrs({ act: 'showAuth', mode: 'signup' })}>สมัครใหม่</button>
    </div>
    <div id="authForm">${authForm()}</div>
  </div></section>`;
}

function authForm() {
  const signup = mode === 'signup';
  return `<div class="auth-form">
    ${signup ? `<label>ชื่อ<input id="authName" autocomplete="name" placeholder="ชื่อของคุณ"></label>` : ''}
    <label>อีเมล<input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com" data-enter="submitAuth"></label>
    <label>รหัสผ่าน<input id="authPassword" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" placeholder="อย่างน้อย 6 ตัวอักษร" data-enter="submitAuth"></label>
    ${ui.button(signup ? 'สร้างบัญชี' : 'เข้าสู่ระบบ', { variant: 'primary', full: true, act: 'submitAuth' })}
  </div>`;
}

register({
  showAuth: ({ mode: next }) => { mode = next; authView() },

  submitAuth: async () => {
    const email = $('#authEmail').value.trim();
    const password = $('#authPassword').value;
    if (!email || password.length < 6) { ui.toast('กรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร'); return }
    const name = $('#authName')?.value.trim();
    const result = mode === 'signup' ? await signUp(email, password, name) : await signIn(email, password);
    if (result.error) { authView(result.error.message); return }
    if (mode === 'signup' && !result.data.session) {
      authView('ตรวจอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ');
      return;
    }
    await startCloudSession(result.data.user || result.data.session?.user);
  },
});
