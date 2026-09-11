# Style Guide: CerebroKognit Web

Canonical design reference for every page, component, and line of CSS in this
repository. If a decision here conflicts with an old habit, this file wins.
Source of truth for tokens: `web/src/index.css` (`:root` and
`html[data-theme='dark']`).

---

## 1. Design Philosophy

- Google-grade minimalist, flat, and restrained. Surfaces are tonal, not
  decorative. No noise, no clutter.
- Theme-aware always. Every surface and every text color must come from CSS
  variables so Light and Dark themes both work with zero per-element overrides.
- Brand color is Intelligent Indigo followed by DeepMind Violet. Accent tones
  (emerald, cyan, amber) are semantic indicators, never decorative rainbow.
- One bold accent per screen. Gradients are reserved for the brand surface
  (buttons, the brand tile, gradient headings) and are silently disabled where
  a flat fill reads better.
- Everything must work at 100% zoom from 320px wide up to large desktop. Every
  grid track is `minmax(min(100%, Npx), 1fr)` and every grid child is
  `min-width: 0`.
- Respect the user. Respect `prefers-reduced-motion`. Never hide interactive
  meaning in color alone.

---

## 2. Color System

All colors below are defined as tokens in `web/src/index.css`. New work must
reference tokens, never hard-coded hex values.

### 2.1 Primary Brand: Indigo / Violet

| Token | Hex | Usage |
|---|---|---|
| `--c-violet` | `#6366f1` | Primary actions, active nav, focus accents, monochrome icons |
| `--c-violet-light` | `#818cf8` | Light indigo accent, highlights, node fills |
| `--c-violet-dark` | `#4f46e5` | Indigo hover |
| `--c-violet-soft` | `rgba(99,102,241,0.08)` | Tinted icon tiles and chip backgrounds |
| `--c-violet-glow` | `rgba(99,102,241,0.22)` | Restrained ring/glow |
| `--c-indigo` | `#4f46e5` | Secondary brand tone |
| `--c-indigo-soft` | `rgba(79,70,229,0.1)` | Tint surface |
| DeepMind Violet | `#7c3aed` | Gradient endpoint in `--grad-primary` |
| Lavender | `#a5b4fc` / `#c7d2fe` | Soft pulses, muted markers |

The purple family is the default accent for: buttons (`.btn-primary`), the
brand tile (`.brand-logo`), logo mark, gradient headings (`.gradient-text`,
`.lp-hero h1 em`), active states, `sys-label--violet`, stat numbers, waveform
strokes, and links on hover.

### 2.2 Semantic Status: Light Greenish and Light Orangish

| Token | Hex | Usage |
|---|---|---|
| `--c-emerald` | `#10b981` | Success, healthy, online, completed, "ARMED/ON" states |
| `--c-emerald-soft` | `rgba(16,185,129,0.1)` | Badge chips, icon tiles |
| `--c-cyan` | `#06b6d4` | Secondary informational metric, echo/teal traces |
| `--c-cyan-soft` | `rgba(6,182,212,0.1)` | Tint tile |
| `--c-amber` | `#f59e0b` | Attention, "RING/NEXT" states, warnings |
| `--c-amber-soft` | `rgba(245,158,11,0.1)` | Tint tile |

Emerald and cyan are the only "green-ish" tones allowed. Amber is the only
"orange-ish" tone allowed. Use them for status, not ornament.

### 2.3 Destructive: Rose (Critical Only)

| Token | Hex | Usage |
|---|---|---|
| `--c-rose` | `#ef4444` | Deletion, destructive-actions ONLY |
| `--c-rose-dark` | `#dc2626` | Rose hover |

Rose never decorates. If an element is not destructive, it must not be rose.

### 2.4 Surfaces (Theme-Aware)

| Token | Light (Porcelain) | Dark (Obsidian Slate) |
|---|---|---|
| `--bg` | `#f8fafc` | `#111826` |
| `--bg-soft` | `#f1f5f9` | `#182133` |
| `--surface` | `#ffffff` | `rgba(31,42,62,0.8)` |
| `--surface-2` | `#f1f5f9` | `rgba(49,64,90,0.5)` |
| `--surface-3` | `#e2e8f0` | `rgba(64,82,112,0.45)` |
| `--border` | `#e2e8f0` | `rgba(255,255,255,0.1)` |
| `--border-strong` | `#cbd5e1` | `rgba(255,255,255,0.16)` |
| `--border-focus` | `rgba(99,102,241,0.5)` | `rgba(99,102,241,0.6)` |

Background page color: `--bg`. Cards and forms: `--surface`. Lifted chips and
insets: `--surface-2` / `--surface-3`. Hairlines: `--border` / `--border-strong`.
Every hairline on the auth/live pages uses these tokens exactly.

### 2.5 Text (Theme-Aware)

| Token | Light | Dark |
|---|---|---|
| `--text` | `#0f172a` | `#f1f5f9` |
| `--text-muted` | `#64748b` | `#94a3b8` |
| `--text-faint` | `#94a3b8` | `#64748b` |

Headings, body and labels use `--text`. Secondary copy, captions and leads use
`--text-muted`. Micro-labels and disabled hints use `--text-faint`. Never set
heading/body color to an arbitrary hex.

### 2.6 Tint Bands & Footer Surfaces

- Light: `--c-tint-band #eef1ff`, `--c-tint-section #eef2fa`,
  `--c-tint-bandfade rgba(238,241,255,0)`.
- Dark: `--c-tint-band #1c2136`, `--c-tint-section #1a2032`,
  `--c-tint-bandfade rgba(28,33,54,0)`.
- Use for the hero band (`linear-gradient(180deg, var(--c-tint-band) 0%, var(--c-tint-bandfade) 100%)`)
  and alternating section washes.
- Footer: `--lp-footer-bg` (subtle indigo-tinted gradient), `--lp-footer-border`
  (`rgba(99,102,241,0.16)` light / `rgba(129,140,248,0.2)` dark).

### 2.7 Gradients (Brand Surfaces Only)

- `--grad-primary`: `135deg #6366f1 -> #7c3aed` (light) and `#6366f1 -> #818cf8`
  (dark). Used for `.btn-primary`, `.brand-logo`, gradient text.
- `--grad-violet`, `--grad-emerald`, `--grad-cyan`, `--grad-sunset`: only where
  semantically justified.
- No gradient-as-glow backgrounds on large surfaces. A flat fill with the tint
  band is the default.

---

## 3. Typography

### 3.1 Families

| Role | Family | Weights |
|---|---|---|
| Display / Body | Plus Jakarta Sans | 300, 400, 500, 600, 700, 800 |
| Mono (labels, numbers, data) | JetBrains Mono | 400, 500, 600, 700 |

Loaded once from Google Fonts at the top of `index.css`. Do not add other fonts.

- Display and body use `var(--font-display)` / `var(--font-body)`.
- Micro-labels, stats, timestamps, code, and "system language" strings use
  `var(--font-mono)`.

### 3.2 Type Scale (measured in the landing page)

| Element | Size | Weight | Notes |
|---|---|---|---|
| Landing hero h1 | `clamp(2.25rem, 4.6vw, 3.5rem)` | 800 | `line-height 1.06`, `letter-spacing -0.035em` |
| Auth hero h1 | `clamp(2.1rem, 3.4vw, 2.85rem)` | 800 | `line-height 1.13` |
| Section heading (`.lp-section__head h2`, final CTA h2) | `clamp(1.75rem, 3.4vw, 2.5rem)` | 800 | `letter-spacing -0.03em`, `text-wrap: balance` |
| Steps panel heading | `1.4rem` | 800 | |
| Feature card h3 | `1.22rem` | 700 | |
| Insights chart title | `1.1rem` | 700 | |
| Brand wordmark | `1.15rem` | 800 | `letter-spacing -0.02em` |
| Hero lead | `1.15rem` | 400 | `--text-muted`, `line-height 1.7` |
| Section intro p | `1.06rem` | 400 | `line-height 1.65` |
| Card body | `1rem` | 400 | `line-height 1.6` |
| Nav links | `0.95rem` | 500 | hover turns violet |
| Buttons | `0.875rem` | 600 | |
| Brand links | `0.925rem` | 500 | |
| Sys-labels | `0.75rem` | 600 | mono, uppercase, `letter-spacing 0.06em` |
| Badges / mono chips | `0.78rem` | 600 | mono |
| Visual captions | `0.72rem` | 600 | mono, uppercase, `letter-spacing 0.14em` |
| Stat meta | `0.7rem` | 400 | `--text-muted` |

Body base remains `16px` (user default). Never set `px` fonts below `0.68rem`.

### 3.3 Mono Micro-Label Convention

System-style labels are mono, uppercase, small (`0.62-0.78rem`), with wide
letter-spacing (`0.10-0.18em`). Examples: `NEXT WAKE WINDOW`, `ARMED`,
`ADAPTIVE PROTOCOL`, `SYSTEM ONLINE`.

### 3.4 Numbers

All metrics, clocks, scores, and timestamps use
`font-variant-numeric: tabular-nums` (class `.tabular`) so digits never jitter.
Use `--font-mono` for clocks and strong numeric emphasis.

---

## 4. Spacing, Radii, Elevation

- Spacing is multiples of `0.25rem` / `0.5rem` (4px / 8px rhythm). Page and
  section padding uses `clamp(...)` so it breathes on every viewport.
- Headings: negative letter-spacing; body: relaxed `1.6-1.7` line-height.

### 4.1 Radii (tokens only)

| Token | Value |
|---|---|
| `--radius-xs` | 6px |
| `--radius-sm` | 8px |
| `--radius-md` | 12px |
| `--radius-lg` | 16px |
| `--radius-xl` | 20px |
| `--radius-full` | 9999px |

Chips and pills: `--radius-full`. Cards: `--radius-lg`/`--radius-xl`. Buttons
and form fields: `--radius-md`.

### 4.2 Shadows & Elevation

| Token | Purpose |
|---|---|
| `--shadow-sm` | resting cards, list rows |
| `--shadow-md` | hover elevation |
| `--shadow-lg` | hero demo / command center |

Dark theme shadows are deep and soft; light theme shadows are light and short.
Never use neon glow shadows or gradient drop-shadows.

---

## 5. Component Conventions (from the landing page)

- **Buttons**: `.btn` base (0.875rem, 600, radius-md); `.btn-primary`
  (grad indigo-violet background, white text), `.btn-secondary`, `.btn-ghost`,
  `.btn-danger` (rose only). Hover lifts `-1px` and deepens shadow.
- **Focus**: every focusable element shows `outline: 2px solid var(--accent);
  outline-offset: 2px` via `:focus-visible`.
- **Cards**: flat `--surface`, 1px `--border`, `--radius-lg`, restrained hover
  lift. Icon tiles (`.lp-card__icon`) are 50px, radius-md, soft-tint background
  with a matching icon tone (violet/indigo/emerald/cyan/blue variants).
- **Sys-label chips**: mono micro-labels with a tone modifier
  (`--indigo/--violet/--mint/--blue`).
- **Status dots / LEDs**: small full-radius dots; "on" states are emerald;
  "attention" states are amber; idle dots are `--surface-3`. Pulse animations
  are simple opacity blinks, not glows.
- **Decorative waveforms/SVG scenes**: stroke lines use solid brand tones,
  never rainbow. Traveling pulses ride the primary trace; everything is
  `aria-hidden` and animation-free under `prefers-reduced-motion`.
- **Composition**: hero sections follow the landing rhythm: brand, headline,
  lead, points/badges, stats, note, visual. The visual is bottom-pinned.

---

## 6. Writing & Copy Rules

- **Never use em dashes (U+2014) in user-visible copy.** Use commas, hyphens,
  colons, or periods instead. (Em dashes may appear only in code comments.)
- **In mono/system strings use the middle dot `·` as a separator**
  (example: `Mach 1 · protocol`, `Adaptive protocol · cognitive wake`).
- **Sentence case, not Title Case**, for headings, buttons, and labels
  (example: "Next wake window", "Sign in to stay sharp every morning").
- Use the curly apostrophe in copy (you're, morning's) consistently.
- Keep micro-copy terse and factual. No fluff ("simply", "just", boasted claims).
- Numbers in copy read naturally; numbers in UI use tabular digits.

---

## 7. Accessibility & Motion

- All controls reachable and operable by keyboard; visible focus ring.
- Decorative graphics get `aria-hidden="true"` (and `role="presentation"` +
  `focusable="false"` on SVGs).
- Respect `prefers-reduced-motion`: disable every animation/transition
  (waveforms, pulses, LEDs, nodepulses, hover lifts) via a media query.
  Example pattern already in `index.css`:
  `@media (prefers-reduced-motion: reduce) { ... animation: none !important; ... }`.
- Color is never the only signal: status rows carry icon + label + tone.
- Text colors must keep the token contrast (muted/faint only for secondary
  copy, never for primary action text).

---

## 8. Theming Rules

- Every new component must be tested in Light and Dark by construction (tokens,
  no hard-coded colors).
- Theme persistence: `localStorage["ck-theme"]` + `data-theme` on `<html>`.
  Theme controls (sidebar switcher, auth toggle, settings) stay in sync via
  `web/src/theme.js`.
- The auth brand panel mirrors the landing palette: lavender tint band, violet
  hairlines, indigo-violet brand tile, violet/cyan/amber status tones.

---

## 9. Iconography

- Lucide-style stroke icons at 1.5px stroke width, currentColor-driven so tone
  follows text/state.
- Icon set lives in `web/src/components/ui/Icons.jsx`. Add new icons there and
  re-export from `ui/index.js`; never inline hand-built SVGs in pages.
- Icons in tiles use the tile tone (e.g. violet icon on violet-soft tile).

---

## 10. Canonical "Do Not" List

- Do NOT use the removed retro palette: `#f4a442`, `#3e7c17`, `#125c13`,
  `#e8e1d9`, `#0b0d11`, `#141a1e`, `#b97a2b`, `#5db130`.
- Do NOT hard-code hex colors in components or pages. Tokens only.
- Do NOT use rose/red except for destructive actions.
- Do NOT use em dashes in copy.
- Do NOT add new font families or font sizes outside the scale above.
- Do NOT add glow effects, gradients-as-ornament, or neon shadows.
- Do NOT escape the 8px spacing rhythm with arbitrary px values.
- Do NOT place new colors in mobile `theme/tokens.js` unless they mirror this
  system (indigo/violet/emerald/cyan/amber).

---

## 11. Verifying the Design

Before marking UI work done, run:

```
npm test        # Vitest suite (currently 49 passing)
npm run build   # must be clean (CSS + JS emitted)
```

Then spot-check Light and Dark at narrow (320-480px), tablet (768-1024px), and
desktop (>=1280px) widths, and check the live dev server refresh
(`http://localhost:5173`) reflects the change.