// ── The sky ───────────────────────────────────────────────────────────────
// A canvas behind the app. Every session in the current training week is a
// star; finishing a session lights it, and a segment between two neighbouring
// stars lights once both are done — so the constellation draws itself across
// the week. Positions come from a deterministic hash of the session key, so a
// star never jumps between renders.
import { data, weekOf, dateFor } from './state.js';
import { DAYS, SESSION_ACCENT, sessionKey } from './program.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Small deterministic string hash → 32-bit unsigned. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0;
}
/** Stable pseudo-random in [0,1) from a key and a salt. */
const rand = (key, salt) => (hash(key + '|' + salt) % 100000) / 100000;

let tokens = {};
function readTokens() {
  const s = getComputedStyle(document.documentElement);
  tokens = Object.fromEntries(['cyan', 'magenta', 'lime', 'violet', 'amber']
    .map(n => [n, s.getPropertyValue('--' + n).trim() || '#6bd7ff']));
}

/** The current week's sessions as constellation nodes, in day order. */
function weekNodes() {
  const w = weekOf();
  return DAYS.map(([day, session], i) => {
    const date = dateFor(w, i);
    const key = sessionKey(date, session);
    return {
      key, day, session, date,
      done: Boolean(data.sessions[key]?.done),
      colour: tokens[SESSION_ACCENT[session] || 'cyan'],
      jitter: rand(key, 'y'),
      jitterX: rand(key, 'x'),
      phase: rand(key, 'p') * Math.PI * 2,
    };
  });
}

/** Background dust — fixed field, independent of training data. */
function dustField(count, seed) {
  return Array.from({ length: count }, (_, i) => ({
    x: rand(seed + i, 'dx'), y: rand(seed + i, 'dy'),
    r: 0.3 + rand(seed + i, 'dr') * 1.1,
    a: 0.18 + rand(seed + i, 'da') * 0.55,
    depth: 0.3 + rand(seed + i, 'dz') * 0.7,
  }));
}

function paint(ctx, W, H, nodes, dust, t, layout) {
  ctx.clearRect(0, 0, W, H);

  // Dust, with slow parallax drift.
  for (const s of dust) {
    const dx = ((s.x + t * 0.000004 * s.depth) % 1) * W;
    const dy = ((s.y + t * 0.0000022 * s.depth) % 1) * H;
    ctx.globalAlpha = s.a * (0.75 + 0.25 * Math.sin(t * 0.0004 + s.x * 40));
    ctx.fillStyle = '#dceaff';
    ctx.beginPath(); ctx.arc(dx, dy, s.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Constellation node positions.
  const { left, top, width, height } = layout;
  const pts = nodes.map((n, i) => ({
    ...n,
    px: left + width * ((i + 0.5) / nodes.length) + (n.jitterX - 0.5) * (width / nodes.length) * 0.45,
    py: top + height * (0.18 + n.jitter * 0.64),
  }));

  // Segments: lit only when both endpoints are complete.
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], lit = a.done && b.done;
    ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py);
    ctx.strokeStyle = lit ? a.colour : '#2a3556';
    ctx.globalAlpha = lit ? 0.7 : 0.22;
    ctx.lineWidth = lit ? 1.4 : 0.8;
    if (lit) { ctx.shadowColor = a.colour; ctx.shadowBlur = 9 }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // Stars.
  for (const p of pts) {
    if (p.done) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 0.0016 + p.phase);
      ctx.shadowColor = p.colour; ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = p.colour;
      ctx.beginPath(); ctx.arc(p.px, p.py, 3.1 * pulse, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.28 * pulse;
      ctx.beginPath(); ctx.arc(p.px, p.py, 8 * pulse, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#63739d'; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.arc(p.px, p.py, 1.5, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  return pts;
}

/* ── Full-screen background ─────────────────────────────────────────────── */

let canvas, ctx, raf, dust, nodes, dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame(t) {
  const W = innerWidth, H = innerHeight;
  // Keep the constellation clear of the app column on wide screens by biasing
  // it into the full viewport; on mobile it simply sits behind the content.
  paint(ctx, W, H, nodes, dust, t, { left: W * 0.06, top: H * 0.1, width: W * 0.88, height: H * 0.78 });
}

function loop(t) { frame(t); raf = requestAnimationFrame(loop) }

// Paint one frame now and only then start the loop: requestAnimationFrame does
// not fire while the tab is hidden, and an unpainted sky is a black rectangle.
function start() {
  cancelAnimationFrame(raf);
  frame(performance.now());
  if (!reduced() && !document.hidden) raf = requestAnimationFrame(loop);
}

export function mountSky() {
  if (canvas) return;
  readTokens();
  canvas = document.createElement('canvas');
  canvas.id = 'sky';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  ctx = canvas.getContext('2d');
  dust = dustField(150, 'bg');
  nodes = weekNodes();
  resize();
  addEventListener('resize', () => { resize(); start() });
  document.addEventListener('visibilitychange', () => {
    document.hidden ? cancelAnimationFrame(raf) : start();
  });
  start();
}

/** Recompute which stars are lit. Called after every save. */
export function refreshSky() {
  if (!canvas) return;
  readTokens();
  nodes = weekNodes();
  frame(performance.now());
}

export function unmountSky() {
  cancelAnimationFrame(raf);
  canvas?.remove();
  canvas = null;
}

/* ── Inline version for the dashboard ───────────────────────────────────── */

let inlineRaf;
export function drawInline(el) {
  if (!el) return;
  cancelAnimationFrame(inlineRaf);
  readTokens();
  const c = el.getContext('2d');
  const localDust = dustField(60, 'inline');
  const localNodes = weekNodes();
  const d = Math.min(window.devicePixelRatio || 1, 2);
  const W = el.clientWidth, H = el.clientHeight;
  el.width = Math.floor(W * d); el.height = Math.floor(H * d);
  c.setTransform(d, 0, 0, d, 0, 0);
  const layout = { left: W * 0.08, top: H * 0.08, width: W * 0.84, height: H * 0.84 };
  const step = t => {
    paint(c, W, H, localNodes, localDust, t, layout);
    if (!reduced() && !document.hidden) inlineRaf = requestAnimationFrame(step);
  };
  step(performance.now());
}
