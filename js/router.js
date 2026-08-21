// Indirection so screen modules can trigger a re-render without importing
// app.js (which imports them) and creating a cycle.
import { data, save } from './state.js';

let renderer = () => {};
export function setRenderer(fn) { renderer = fn }
export function render() { renderer() }

export function go(tab) {
  data.tab = tab;
  save();
  render();
}
