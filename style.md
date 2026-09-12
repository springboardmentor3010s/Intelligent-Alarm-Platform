# Style Guide: CerebroKognit (Web + Mobile)

Canonical design reference for every page, component, and line of CSS in this
repository. If a decision here conflicts with an old habit, this file wins.
Source of truth for web tokens: `web/src/index.css` (`:root` and
`html[data-theme='dark']`). Source of truth for mobile tokens:
`mobile/src/theme/tokens.js` + `mobile/src/theme/ThemeContext.jsx`.

---

## 1. Design Philosophy

- Google-grade minimalist, flat, and restrained. Surfaces are tonal, not
  decorative. No noise, no clutter.
- Theme-aware always. Every surface and every text color must come from CSS
  variables so Light and Dark themes both work with zero per-element overrides.
- Brand colors follow the logo: Primary Violet (`#6844FD`), Primary Dark Violet
  (`#4E28E0`), and Secondary Mint (`#58F6CA`). These three are the ONLY brand
  colors — everywhere, in both themes.
- No deep violet (`#7C3AED`), no indigo (`#4F46E5`), no orange/amber and no
  blue/cyan anywhere. Green is reserved strictly for semantics: online/offline,
  up/down, good/bad. Emerald (`#10B981`) and rose (`#EF4444`) are indicators,
  never decorative rainbow.
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

### 2.1 Primary Brand: Violet, Violet-Dark + Mint (logo palette)

| Token | Hex | Usage |
|---|---|---|
| `--c-violet` | `#6844FD` | Primary brand action, active nav, focus accents, buttons, icon glyphs |
| `--c-violet-light` | `#58F6CA` | Secondary mint accent, highlights, node fills, pillar fills |
| `--c-violet-dark` | `#4E28E0` | Violet hover/pressed, dark-theme gradient end, dark tiles |
| `--c-violet-soft` | `rgba(104,68,253,0.08)` | Tinted icon tiles and chip backgrounds |
| `--c-violet-glow` | `rgba(104,68,253,0.22)` | Restrained ring/glow (dark theme: mint `rgba(88,246,202,…)`) |
| `--c-mint-soft` | `rgba(88,246,202,0.14)` | Tint tile for mint surfaces |

The violet family is the default accent for: buttons (`.btn-primary`), the
brand tile (`.brand-logo`), logo mark, gradient headings (`.gradient-text`,
`.lp-hero h1 em` — mint->violet sunrise), active states, `sys-label--violet`,
stat numbers, waveform strokes, and links on hover. Mint (`#58F6CA`) is the
secondary brand accent and pairs with violet exactly as in the logo.

### 2.2 Semantic Status: Emerald and Rose (Indicators Only)

| Token | Hex | Usage |
|---|---|---|
| `--c-emerald` | `#10b981` | Success, healthy, online, completed, "ARMED/ON" states |
| `--c-emerald-soft` | `rgba(16,185,129,0.1)` | Badge chips, icon tiles |

Emerald is used ONLY to communicate state: online/offline, up/down, good/bad,
completed/in-progress. It is never used for decoration, branding, or emphasis.
Attention reads violet-dark; success reads emerald; failure reads rose. There
is no amber, no blue/cyan, no deep violet, and no indigo in the system.

**Landing pairing**: Product modules and dashboard pillars use a fixed violet
pairing. Brand = violet or violet-dark; accent = mint.
- Modules: Intelligent Alarms (violet) · Cognitive Challenges (mint) ·
  Habit Tracking (violet-dark) · Personal Insights (mint).
- Pillars: Wake-up (violet) · Challenges (mint) · Snooze cut (violet-dark) ·
  Sleep (mint).

**Emerald is the "system is on" indicator**: the landing hero wordmark badge
("Cognitive alarm system") sits on an `--c-emerald-soft` pill with
`--c-emerald` text to match the blinking green LED beside it (`.lp-hero__badge`).
This is semantic (live/on), not decoration; it is the ONLY emerald wordmark in
the system.

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
| `--border-focus` | `rgba(104,68,253,0.5)` | `rgba(104,68,253,0.6)` |

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
- Footer: `--lp-footer-bg` (subtle violet-tinted gradient), `--lp-footer-border`
  (`rgba(104,68,253,0.16)` light / `rgba(88,246,202,0.2)` dark).

### 2.7 Gradients (Brand Surfaces Only)

- `--grad-primary`: `135deg #6844FD -> #4E28E0` (light)
  (dark). Used for `.btn-primary`, `.brand-logo` (white text stays readable).
- `--grad-violet`: `135deg #58F6CA -> #6844FD` (logo sunrise). Used for
  `.gradient-text`, `.lp-hero h1 em`. Emerald gradient only for verified
  success surfaces; no amber, cyan or sunset gradients.
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
| Auth hero stat numbers (`7`/`5`/`ML`) | `1.6rem` | 700 | mono, violet, `line-height 1` |
| Auth hero stat labels | `0.875rem` | 400 | `--text-muted` |
| Stat meta (landing) | `0.7rem` | 400 | `--text-muted` |

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
  (grad violet background, white or near-black text), `.btn-secondary`,
  `.btn-ghost`, `.btn-danger` (rose only). Hover lifts `-1px` and deepens
  shadow.
- **Focus**: every focusable element shows `outline: 2px solid var(--accent);
  outline-offset: 2px` via `:focus-visible`.
- **Cards**: flat `--surface`, 1px `--border`, `--radius-lg`, restrained hover
  lift. Icon tiles (`.lp-card__icon`) are 50px, radius-md, soft-tint background
  with a matching icon tone (violet/mint/dark variants).
- **Sys-label chips**: mono micro-labels with a tone modifier
  (`--violet/--mint/--dark`). No emerald/rose chips except literal status.
- **Status dots / LEDs**: small full-radius dots; "on" states are emerald;
  "attention" states are violet; idle dots are `--surface-3`. Pulse animations
  are simple opacity blinks, not glows.
- **Decorative waveforms/SVG scenes**: stroke lines use solid brand tones,
  never rainbow. The auth "cognitive wake" waveform (`.auth-visual`) spans the
  full panel width: two ghost guide rails under both traces (violet/mint at
  ~0.16/0.22 alpha, lighter in light theme), a violet primary snake + mint echo
  with `stroke-dashoffset` draw, a faint dotted parallel line, neuron nodes with
  a soft mint halo, a leading traveler pulse on each trace (violet + mint) with
  two fading comet-tail followers (delay 0.5s/1.05s; echo delayed -4.5s), subtle
  `drop-shadow` halos on the leaders (stronger in dark). Static constellation
  dots (mint accents) complete the scene. Everything is `aria-hidden`, carries
  no answer, and is animation-free under `prefers-reduced-motion`.
- **Auth form workspace geometry (pill)**: `.auth-form .form-control`,
  `.auth-form__actions .btn`, `.auth-tabs`, `.auth-tab`, `.auth-top .theme-toggle`
  and `.auth-back` all use `border-radius: var(--radius-full)`. The theme toggle
  is a 38x38 full circle; the Back pill is exactly 38px tall to sit flush
  beside it (`.auth-top` fixed cluster top-right of the auth panel).
  The demo-account button (`.auth-form > .btn-secondary`) is `48px` tall,
  `0.95rem`/600, full pill, full-width.
- **Auth left panel composition (structured rhythm)**: brand → headline →
  benefit ticks → 3 uniform stat cards (`min-height:86px`, flex column,
  centered, `radius-lg`; equal heights regardless of label length) → note
  (full-width, no horizontal cap) → "Next wake window" card (full-width,
  edge-to-edge with the stats grid) → bottom-pinned waveform. Every block uses
  the same ~`0.4rem`/`1.5rem` spacing rhythm so nothing floats or strays.
- **Benefit ticks are theme-aware**: three plain check marks (no circles) that
  stay mint (`--c-violet-light`) in dark theme and switch to violet
  (`--c-violet`) in light theme (`html[data-theme='light'] .benefit-dot`).
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
  Theme controls (topbar toggle, auth toggle, settings) stay in sync via
  `web/src/theme.js`.
- The auth brand panel mirrors the landing palette: violet tint band, violet
  hairlines, violet brand tile, violet/mint status tones, full-width waveform,
  and theme-aware benefit ticks (mint dark / violet light).
- Buttons and form fields are pills; the top-right theme toggle is a full
  circle and the Back pill matches its 38px height. The authenticated topbar
  reuses the same 38px circular toggle in its right cluster next to the live
  clock (`.app-topbar .theme-toggle`), so theming is one tap on every page.
- LEDs are semantic indicators that blink via opacity only; never add glow
  box-shadows (`.led--on` is a flat emerald blink).

## 8.1 App shell & navigation

- Sidebar nav IA: **Overview** (Dashboard · Analytics), **Wake** (Alarms ·
  Challenges), **Insights** (History), **Account** (Profile · Settings),
  **Administration** (Admin) — defined in `web/src/navSections.js`; the mobile
  drawer and topbar breadcrumb tag derive from the same source.
- Sidebar header: expanded shows the full brand lockup (mark + wordmark + LED)
  with the collapse chevron; collapsed shows only the brand mark, centered, and
  the expand chevron crossfades in over the mark on hover / keyboard focus
  (`:focus-within`). No logo is shown in the topbar.
- Topbar: left cluster is the breadcrumb tag (section / page), right cluster is
  `[live clock] [theme toggle]` — the theme control lives here, not in the
  sidebar footer.

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
  system (violet/violet-dark/mint). Never add amber, orange, cyan, blue, deep
  violet or indigo to any token layer.

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

For mobile work, also run `./mobile` gates:

```
npm test                     # jest-expo suite (currently 47 passing)
npx expo export --platform android   # must bundle cleanly
npx expo export --platform ios
```

---

## 12. Mobile (React Native) Expression

The mobile app renders the same system with React Native. Tokens live in
`mobile/src/theme/tokens.js`; consume them through `useTheme()` from
`mobile/src/theme/ThemeContext.jsx`, never hard-coded hex.

### 12.1 Token Mapping

| System (web CSS) | Mobile (`useTheme()` → `colors`) |
|---|---|
| `--c-violet` | `colors.violet` (`#6844FD`) |
| `--c-violet-dark` | `colors.violetDark` (`#4E28E0`) |
| `--c-violet-light` | `colors.violetLight` (`#58F6CA`, secondary mint) |
| `--c-violet-soft` | `colors.violetSoft` (`rgba(104,68,253,0.12)`) |
| `--c-violet-glow` | `colors.violetGlow` (`rgba(104,68,253,0.28)`; dark `rgba(88,246,202,0.22)`) |
| `--c-rose` / `--c-rose-dark` | `colors.rose` (`#ef4444`) / `colors.roseDark` (`#dc2626`) |
| `--c-emerald` / `--c-emerald-soft` | `colors.emerald` (light `#10b981`, dark `#34d399`) / `colors.emeraldSoft` |
| `--bg` / `--surface` | `colors.bg` / `colors.surface` |
| `--surface-2` / `--surface-3` | `colors.surface2` / `colors.surface3` |
| `--border` / `--border-strong` | `colors.border` / `colors.borderStrong` |
| nav strip (floating tab bar) | `colors.tabBar` (bar fill) / `colors.tabBarBorder` (bar hairline) |
| `--text` / `--text-muted` / `--text-faint` | `colors.text` / `colors.textMuted` / `colors.textFaint` |
| `--font-display` / `--font-body` | `fonts.display*` / `fonts.body*` (Plus Jakarta Sans) |
| `--font-mono` | `fonts.mono*` (JetBrains Mono) |
| shadows `--shadow-*` | `useTheme()` → `shadows` |
| radii `--radius-*` (6/8/12/16/20/full) | `radii.md` / `radii.lg` / `radii.xl` in tokens |
| `prefers-reduced-motion` query | `useTheme()` → `reduceMotion` (via `AccessibilityInfo`) |

### 12.2 Theming

- `ThemeProvider` (wraps the app in `mobile/App.js`) resolves `dark`, `light`,
  or `system`; `dark` is the default. Selection persists to AsyncStorage under
  `ck-theme` (mirrors web `localStorage["ck-theme"]`).
- `useTheme()` returns `{ mode, resolved, isDark, colors, ui, shadows,
  reduceMotion, setMode }`. `ui` is a prebuilt StyleSheet of shared patterns
  (`card`, `btnPrimary`, `input`, `center`, `inputPlaceholder`, etc.).
- Fonts load once via `useBrandFonts()` in `App.js` and are safe to mock in
  jest (see `mobile/jest.setup.js`).

### 12.3 Shared Components

Build on `mobile/src/components/ui/`: `BrandMark`/`BrandLockup`, `SysLabel`
(mono micro-label chips), `StatusPill` (LED pulse; respects `reduceMotion`),
`ChipRow` (pill selectors, `accessibilityState.selected`), `ScoreRing`,
`ConnectRow` (link rows opening via `Linking`), `SectionHeader`. Prefer these
over ad-hoc styles in screens.

### 12.4 Mobile Copy Rules

Same rules as Section 6: sentence case everywhere, no em dashes in UI copy, `·`
(middle dot) separators in mono strings, tabular digits for scores/clocks
(`fontVariant: ['tabular-nums']` on text styles with numbers or `mono` labels),
no emoji as UI decoration. Retro palette is banned here too (Section 10).