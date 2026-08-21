// Event delegation. Screens emit `data-act="name"` (plus any `data-*` payload)
// instead of inline onclick handlers, because ES modules are scoped and
// inline handlers can only reach globals.
//
//   ui.button('เริ่ม', { act: 'startPlanned' })      -> <button data-act="startPlanned">
//   register({ startPlanned: () => { ... } })
//
// The handler receives (dataset, element, event).

const clicks = new Map();
const changes = new Map();

export function register(map) {
  for (const [name, fn] of Object.entries(map)) clicks.set(name, fn);
}
export function registerChange(map) {
  for (const [name, fn] of Object.entries(map)) changes.set(name, fn);
}

function dispatch(map, attr, e) {
  const el = e.target.closest(`[data-${attr}]`);
  if (!el) return;
  const fn = map.get(el.dataset[attr]);
  if (!fn) { console.warn(`No handler for data-${attr}="${el.dataset[attr]}"`); return }
  if (attr === 'act') e.preventDefault();
  Promise.resolve(fn(el.dataset, el, e)).catch(err => console.error(err));
}

export function bindActions() {
  document.addEventListener('click', e => dispatch(clicks, 'act', e));
  document.addEventListener('change', e => dispatch(changes, 'change', e));
  // Enter inside a form-ish field fires the nearest data-act="submit-target"
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    const target = e.target.dataset.enter;
    if (!target) return;
    e.preventDefault();
    const fn = clicks.get(target);
    if (fn) Promise.resolve(fn(e.target.dataset, e.target, e)).catch(err => console.error(err));
  });
}
