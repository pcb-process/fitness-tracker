# HYBRID // TRAIN — design system

A neon-space dark theme built from tokens and a small component library. There
is no build step and no framework: native ES modules, plain CSS custom
properties, and string templates.

**Three rules keep it coherent:**

1. **Never write a raw colour, radius, or spacing value in a screen file.** Use
   a token from `styles/tokens.css`. That includes inline `style="margin…"`.
2. **Never hand-roll markup in a screen file.** Compose from `js/ui.js`. If a
   pattern shows up in two screens, it graduates into `ui.js` + `components.css`.
3. **Components carry no outer margin.** Spacing between things is owned by the
   rhythm rules below, not by the components themselves.

---

## Vertical rhythm

A box is always the same distance from its contents on **every** edge: `.card`
uses a single `padding: var(--s-4)`, never separate vertical and horizontal
values. Gaps between elements come from two rules in `components.css`:

```css
#app  > * + *   { margin-top: var(--s-4) }   /* 16 — between top-level blocks */
.card > * + *   { margin-top: var(--s-3) }   /* 12 — inside a box            */
```

with four deliberate exceptions:

| Rule | Gap | Why |
|---|---|---|
| `#app > .section-title` | 32 | a new section needs more air than a sibling card |
| `.card > .label + *` | 8 | a caption should hug the thing it captions |
| `.card > .form / .full / .btn-row / .progress` | 16 | inputs and full-width actions need separation from the text above |
| `.card > .item + .item` | 0 | list items own their padding and divider |

`.modal-box` mirrors the card rules. `h1`,`h2`,`h3` and `p` are margin-reset in
`base.css` so browser defaults never leak an off-scale value into a box.

**When adding a component**, give it no `margin`. If it needs a gap other than
12 inside a card, add it to the exception list above rather than to the
component.

---

## File layout

```
styles/
  tokens.css        design tokens — the only place literal colours live
  base.css          reset, page shell, nebula + scanlines, glitch primitive
  components.css    every reusable component class (one per ui.js builder)
  screens.css       styles that belong to exactly one screen
js/
  state.js          data document, persistence, save hooks, helpers
  program.js        the 12-week block, day split, per-week targets
  stats.js          every derived number (dashboard + friend summaries)
  ui.js             the component library
  sky.js            the constellation canvas
  cloud.js          Supabase auth, programs, state sync
  social.js         friend summaries and live presence
  actions.js        click/change delegation registry
  router.js         render indirection (avoids an app.js <-> screens cycle)
  app.js            wiring only
  screens/*.js      one screen per file
```

---

## Tokens

| Group | Tokens |
|---|---|
| Ground | `--void` `--deep` `--panel` `--panel-2` `--line` `--line-soft` |
| Neon | `--cyan` `--magenta` `--lime` `--violet` `--amber` |
| Semantic | `--accent` (primary/done) `--accent-2` (info) `--accent-3` (live) `--accent-4` (deload) |
| Text | `--ink` `--ink-dim` `--muted` `--muted-2` |
| Glow | `--glow-lime` `--glow-cyan` `--glow-magenta` `--glow-violet` |
| Radius | `--r-xs` 6 · `--r-sm` 9 · `--r-md` 13 · `--r-lg` 18 · `--r-xl` 24 · `--r-pill` |
| Space | `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 32 · `--s-7` 48 |
| Type | `--font` (Inter + Noto Sans Thai) · `--mono` (JetBrains Mono, all numbers) · `--t-xs` … `--t-3xl` |
| Motion | `--fast` .16s · `--mid` .3s · `--slow` .55s · `--ease` |

**Colour meaning is fixed.** Lime = done / primary action. Cyan = informational
and in-progress. Magenta = live presence and alerts. Violet = deload weeks and
plan-vs-actual reference lines. Amber = long run. Do not repurpose them.

All numbers — timers, metrics, chart axes — render in `--mono` so digits stay
aligned as they change.

---

## Components (`js/ui.js`)

| Builder | Renders |
|---|---|
| `label(t)` | uppercase tracked caption |
| `title(t)` / `subheading(t)` | section headings |
| `hint(t)` / `small(t)` | muted body text |
| `glitch(t, tag)` | RGB-split text with an occasional flicker |
| `empty(line, sub)` | empty state |
| `card(body, {accent})` | panel; `accent` adds a neon border + glow |
| `row(left, right)` / `stack(...)` | layout |
| `item({meta, title, sub, right})` | one row in a list |
| `button(text, {variant, act, data, full})` | `primary` \| `secondary` \| `ghost` \| `danger` \| `icon` |
| `field` / `selectField` / `textareaField` / `checkField` / `form(...)` | inputs |
| `metric(label, value, sub, tone)` / `metricGrid(...)` | KPI tiles |
| `pill(text, tone)` / `dot(on)` | badges; `dot(true)` pulses magenta |
| `progress(pct, {thin, cyan})` | bar |
| `steps(total, current)` | onboarding indicator |
| `segmented(options, active, act, key)` | two-or-more-way switch (เพื่อน/อันดับ, ranking metric) |
| `rankRow({place, name, handle, value, sub, ratio, me, live})` | leaderboard row; top three get a medal, `me` highlights your own |
| `barChart(rows, {height})` | vertical bars; `row.mark` adds a violet tick |
| `lineChart(series, {labels})` | series with `plan:true` render dashed violet |
| `sparkline(values, {tone})` | inline trend |
| `chartLegend([text, tone], …)` | legend swatches |
| `header(programName)` / `nav()` | app chrome |
| `modal(html, {showClose})` / `closeModal()` / `toast(msg)` | overlays |

`title`, `sub` and `right` on `item()` are **raw HTML** — escape values with
`esc()` yourself. Everything else escapes for you.

Charts are inline SVG built here. There is no chart library, and adding one
would break the no-build constraint.

---

## Events: no inline `onclick`

ES modules are scoped, so inline handlers cannot reach them. Screens emit
`data-act` attributes and register handlers instead:

```js
ui.button('เริ่ม', { act: 'startPlanned' })
ui.button('เปิด',  { act: 'openSession', data: { s: 'Upper A', d: '2026-08-24' } })

register({ openSession: ({ s, d }) => { … } });      // clicks
registerChange({ setStart: (_d, el) => { … } });     // change events
```

The handler receives `(dataset, element, event)`. `data-enter="name"` on an
input fires the same handler on Enter.

---

## The sky (`js/sky.js`)

The background canvas is not decoration alone: **each session in the current
training week is a star**. Position comes from a deterministic FNV hash of
`` `${date}-${session}` ``, so a star never moves between renders. A pending
session is a dim point; a completed one is bright, tinted by session type
(`SESSION_ACCENT` in `program.js`), and pulses. The segment between two
neighbouring stars lights only when both are done, so the constellation draws
itself across the week.

`refreshSky()` runs on every `save()`. `drawInline(canvas)` renders the same
scene into the dashboard card.

---

## Motion and accessibility

Every animation is decorative. `prefers-reduced-motion: reduce` freezes CSS
animations, hides the glitch pseudo-elements, and makes `sky.js` paint a single
static frame instead of running a RAF loop. Check any new animation against it.

---

## Adding a screen

1. Create `js/screens/thing.js` exporting `thingScreen()` (and optionally
   `mount()` / `unmount()` for canvas or subscriptions).
2. Compose the view from `ui.js`. End with `ui.nav()` if it is a tab.
3. `register({ … })` its actions in the same file.
4. Add it to `SCREENS` in `js/app.js`.
5. Add the file to `FILES` in `sw.js` and bump `CACHE`.

---

## Ranking

`js/screens/ranking.js` ranks you and your accepted friends on one of four
metrics — สัปดาห์นี้ (completion %), สตรีค, ระยะวิ่ง, บล็อก. Each metric is a
small object declaring how to `read` a summary row, how to `print` the value,
and what to show as the row's `sub` line, so adding a metric is one entry in
`METRICS`.

It reads **only** `training_progress_summary` — the same friends-only shape the
friend cards already use — so ranking exposes nothing new. Your own row is
computed locally from `stats.summary()` so it stays correct before the debounced
upload lands. Friends who have turned sharing off have no row and always sort
last.

Reachable from the เพื่อน/อันดับ switch on both social screens, and from
ตั้งค่า → อันดับ.

---

## Privacy boundary

`training_program_state` — sessions, sets, loads, body measurements,
benchmarks — is owner-only at the RLS level and is never read by anyone else.
What friends can see is exactly the shape built by `stats.summary()` and
`social.publishActivity()`: weekly completion, run totals, streak, last session
name, and a coarse current status. Turning off **ให้เพื่อนเห็นความคืบหน้า**
stops publishing and deletes both shared rows.
