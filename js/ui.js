// ── Component library ─────────────────────────────────────────────────────
// Every visual primitive the app uses. Screens compose these and never write
// raw markup or raw hex values. Adding a component means adding a builder here
// AND a class in styles/components.css. See DESIGN.md.
import { esc, data, weekOf } from './state.js';

/* ── attribute helpers ─────────────────────────────────────────────────── */

/** Turn { act:'go', tab:'home' } into `data-act="go" data-tab="home"`. */
export function attrs(o = {}) {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${esc(v)}"`)
    .join(' ');
}
const cls = (...xs) => xs.filter(Boolean).join(' ');

/* ── text ──────────────────────────────────────────────────────────────── */

export const label = t => `<div class="label">${esc(t)}</div>`;
export const title = t => `<h2 class="section-title">${esc(t)}</h2>`;
export const subheading = t => `<h3 class="subheading">${esc(t)}</h3>`;
export const hint = t => `<p class="hint">${esc(t)}</p>`;
export const small = t => `<span class="small">${esc(t)}</span>`;
/** Glitchy RGB-split text. `data-text` is what the pseudo-elements echo. */
export const glitch = (t, tag = 'span', extraClass = '') =>
  `<${tag} class="${cls('glitch', extraClass)}" data-text="${esc(t)}">${esc(t)}</${tag}>`;

export const empty = (line, sub = '') =>
  `<div class="empty">${esc(line)}${sub ? `<br><span class="small">${esc(sub)}</span>` : ''}</div>`;

/* ── containers ────────────────────────────────────────────────────────── */

/** accent: 'cyan' | 'lime' | 'magenta' | 'violet' | undefined */
export const card = (body, { accent, extraClass = '' } = {}) =>
  `<section class="${cls('card', accent && 'accent-' + accent, extraClass)}">${body}</section>`;

export const row = (left, right = '', extraClass = '') =>
  `<div class="${cls('row', extraClass)}">${left}${right}</div>`;

export const stack = (...parts) => `<div class="stack">${parts.join('')}</div>`;

/** `title`, `sub` and `right` are raw HTML — callers escape their own values. */
export const item = ({ title: t, sub = '', right = '', meta = '' }) =>
  `<div class="item">${row(`<div>${meta ? label(meta) : ''}<h3>${t}</h3>${sub ? `<p>${sub}</p>` : ''}</div>`, right)}</div>`;

/* ── controls ──────────────────────────────────────────────────────────── */

/**
 * button('เริ่ม', { variant:'primary', act:'startPlanned', full:true, data:{ i:3 } })
 * `act` and anything in `data` become data-* attributes read by actions.js.
 */
export function button(text, { variant = 'secondary', act, data: payload = {}, full, disabled, extraClass = '', raw } = {}) {
  return `<button class="${cls(variant, full && 'full', extraClass)}" ${attrs({ act, ...payload })} ${disabled ? 'disabled' : ''}>${raw ? text : esc(text)}</button>`;
}

export const iconButton = (text, opts = {}) => button(text, { ...opts, variant: 'icon' });
export const buttonRow = (...buttons) => `<div class="btn-row">${buttons.join('')}</div>`;

/**
 * field('น้ำหนัก (kg)', { id:'weight', type:'number', value:72, span:true })
 * Rendered inside form(...).
 */
export function field(labelText, { id, type = 'text', value = '', placeholder = '', span, attrs: extra = '', min, max, step, inputmode, disabled } = {}) {
  const a = [
    `id="${esc(id)}"`, `type="${esc(type)}"`,
    value !== '' && value !== undefined && value !== null ? `value="${esc(value)}"` : '',
    placeholder ? `placeholder="${esc(placeholder)}"` : '',
    min !== undefined ? `min="${esc(min)}"` : '', max !== undefined ? `max="${esc(max)}"` : '',
    step !== undefined ? `step="${esc(step)}"` : '', inputmode ? `inputmode="${esc(inputmode)}"` : '',
    disabled ? 'disabled' : '', extra,
  ].filter(Boolean).join(' ');
  return `<label class="${span ? 'full-span' : ''}">${esc(labelText)}<input ${a}></label>`;
}

export function selectField(labelText, { id, options = [], value = '', span } = {}) {
  const opts = options.map(o => {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(t)}</option>`;
  }).join('');
  return `<label class="${span ? 'full-span' : ''}">${esc(labelText)}<select id="${esc(id)}">${opts}</select></label>`;
}

export const textareaField = (labelText, { id, value = '', placeholder = '' } = {}) =>
  `<label class="full-span">${esc(labelText)}<textarea id="${esc(id)}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;

export const checkField = (labelText, { id, checked, note = '' } = {}) =>
  `<label class="full-span"><span class="check-line"><input id="${esc(id)}" type="checkbox" ${checked ? 'checked' : ''}><span>${esc(labelText)}${note ? `<br>${small(note)}` : ''}</span></span></label>`;

export const form = (...fields) => `<div class="form">${fields.join('')}</div>`;

/* ── indicators ────────────────────────────────────────────────────────── */

/** tone: '' (lime) | 'cyan' | 'magenta' | 'violet' */
export const metric = (labelText, value, sub = '', tone = '') =>
  `<div class="${cls('metric', tone && 'k-' + tone)}">${label(labelText)}<b>${esc(value)}</b>${sub ? `<span class="small">${esc(sub)}</span>` : ''}</div>`;

export const metricGrid = (...metrics) => `<div class="grid">${metrics.join('')}</div>`;

export const pill = (text, tone = '') => `<span class="${cls('pill', tone)}">${esc(text)}</span>`;
export const dot = on => `<i class="${cls('dot', on && 'on')}"></i>`;

export function progress(pct, { thin, cyan } = {}) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return `<div class="${cls('progress', thin && 'thin', cyan && 'cyan')}"><i style="width:${p}%"></i></div>`;
}

/**
 * segmented([['friends','เพื่อน'],['ranking','อันดับ']], 'ranking', 'go')
 * A two-or-more way switch. Each option dispatches `act` with data-tab.
 */
export const segmented = (options, active, act = 'go', key = 'tab') =>
  `<div class="segmented">${options.map(([value, text]) =>
    `<button class="${value === active ? 'on' : ''}" ${attrs({ act, [key]: value })}>${esc(text)}</button>`).join('')}</div>`;

/**
 * rankRow({ place:1, name:'Alex', handle:'alex_runs', value:'86%', ratio:.86, me:false, live:true })
 * Top three get a medal instead of a number; `me` highlights your own row.
 */
export function rankRow({ place, name, handle = '', value, sub = '', ratio = 0, me = false, live = false }) {
  const medal = ['🥇', '🥈', '🥉'][place - 1];
  return `<div class="${cls('rank-row', me && 'is-me', live && 'is-live')}">
    <span class="rank-place${medal ? ' medal' : ''}">${medal || place}</span>
    <span class="rank-who">
      <b>${esc(name)}${me ? ' <em>คุณ</em>' : ''}</b>
      <small>${handle ? '@' + esc(handle) : ''}${sub ? ` · ${esc(sub)}` : ''}</small>
      ${progress(ratio * 100, { thin: true })}
    </span>
    <span class="rank-value">${esc(value)}</span>
  </div>`;
}

export const steps = (total, current) =>
  `<div class="steps">${Array.from({ length: total }, (_, i) => `<i class="${i <= current ? 'on' : ''}"></i>`).join('')}</div>`;

/* ── charts (inline SVG, no library) ───────────────────────────────────── */

/**
 * barChart([{ label:'1', value:5, max:7, mark:true }], { height, unit })
 * `mark` draws a violet tick under the bar (used for deload weeks).
 */
export function barChart(rows, { height = 108, unit = '' } = {}) {
  if (!rows.length) return empty('ยังไม่มีข้อมูล');
  const w = 300, pad = 14, gap = 3;
  const bw = (w - pad * 2 - gap * (rows.length - 1)) / rows.length;
  const h = height - 22;
  const bars = rows.map((r, i) => {
    const x = pad + i * (bw + gap);
    const ratio = r.max ? Math.min(1, (r.value || 0) / r.max) : 0;
    const bh = Math.max(ratio * h, r.value ? 2 : 0);
    return [
      `<rect class="bar bg" x="${x}" y="0" width="${bw}" height="${h}" rx="2"/>`,
      bh ? `<rect class="${cls('bar', ratio >= 1 && 'full')}" x="${x}" y="${h - bh}" width="${bw}" height="${bh}" rx="2"/>` : '',
      `<text class="axis" x="${x + bw / 2}" y="${h + 11}" text-anchor="middle">${esc(r.label)}</text>`,
      r.mark ? `<circle class="mark" cx="${x + bw / 2}" cy="${h + 17}" r="1.8"/>` : '',
    ].join('');
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${height}" role="img" aria-label="แผนภูมิแท่ง${unit ? ' ' + unit : ''}">${bars}</svg>`;
}

/**
 * lineChart([{ values:[…], plan:false }], { labels:[…] })
 * Series with `plan:true` render as a dashed violet reference line.
 */
export function lineChart(series, { labels = [], height = 120 } = {}) {
  const all = series.flatMap(s => s.values).filter(v => Number.isFinite(v));
  if (!all.length) return empty('ยังไม่มีข้อมูล');
  const w = 300, pad = 16, h = height - 20;
  const max = Math.max(...all, 1), n = Math.max(...series.map(s => s.values.length), 2);
  const x = i => pad + (i * (w - pad * 2)) / (n - 1);
  const y = v => h - (Math.max(0, v) / max) * (h - 6);
  const grid = [0, .5, 1].map(f => `<line class="grid-line" x1="${pad}" x2="${w - pad}" y1="${y(max * f)}" y2="${y(max * f)}"/>`).join('');
  const paths = series.map(s => {
    const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const dots = s.plan ? '' : s.values.map((v, i) => `<circle class="pt" cx="${x(i)}" cy="${y(v)}" r="2.2"/>`).join('');
    return `<polyline class="${cls('line', s.plan && 'plan')}" points="${pts}"/>${dots}`;
  }).join('');
  const axis = labels.map((t, i) => `<text class="axis" x="${x(i)}" y="${h + 13}" text-anchor="middle">${esc(t)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${height}" role="img" aria-label="กราฟเส้น">${grid}${paths}${axis}</svg>`;
}

export function sparkline(values, { height = 34, tone = 'cyan' } = {}) {
  const vs = values.filter(v => Number.isFinite(v));
  if (vs.length < 2) return `<div class="small">ต้องมีอย่างน้อย 2 จุด</div>`;
  const w = 120, min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1;
  const pts = vs.map((v, i) => `${(i * w) / (vs.length - 1)},${height - 3 - ((v - min) / span) * (height - 8)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none" style="height:${height}px" role="img" aria-label="แนวโน้ม"><polyline class="line" points="${pts}" style="stroke:var(--${tone})"/></svg>`;
}

export const chartLegend = (...entries) =>
  `<div class="chart-legend">${entries.map(([text, tone]) => `<span><i style="background:var(--${tone})"></i>${esc(text)}</span>`).join('')}</div>`;

/* ── chrome ────────────────────────────────────────────────────────────── */

export function header(programName) {
  return `<header class="top">
    <div>
      <div class="brand">${glitch('HYBRID', 'span')} <span>//</span> ${glitch('TRAIN', 'span')}</div>
      <div class="sub">Aesthetic calisthenics + marathon</div>
    </div>
    <button class="week" ${attrs({ act: 'openPrograms' })}>
      <span>WEEK ${weekOf()}</span>
      <small>${esc(programName || 'โปรแกรมในเครื่อง')}</small>
    </button>
  </header>`;
}

const TABS = [
  ['home', '⌂', 'วันนี้'],
  ['dashboard', '◱', 'แดชบอร์ด'],
  ['plan', '▤', 'โปรแกรม'],
  ['log', '✚', 'บันทึก'],
  ['more', '•••', 'เพิ่มเติม'],
];

export function nav() {
  return `<nav class="nav">${TABS.map(([id, icon, text]) =>
    `<button class="${data.tab === id ? 'active' : ''}" ${attrs({ act: 'go', tab: id })}><i>${icon}</i>${text}</button>`
  ).join('')}</nav>`;
}

/* ── overlays ──────────────────────────────────────────────────────────── */

export function modal(html, { showClose = true } = {}) {
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    `<div class="modal" id="modal"><div class="modal-box">${showClose ? button('×', { variant: 'icon', act: 'closeModal', extraClass: 'close' }) : ''}${html}</div></div>`);
}
export const closeModal = () => document.getElementById('modal')?.remove();

let toastTick;
export function toast(message) {
  document.getElementById('toast')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div id="toast" class="toast">${esc(message)}</div>`);
  clearTimeout(toastTick);
  toastTick = setTimeout(() => document.getElementById('toast')?.remove(), 3200);
}
