# THERMYNX × Graylinx — Design System

A design system for **THERMYNX**, an AI Operations Intelligence Platform built by **Graylinx** for HVAC plant analytics. Today THERMYNX is deployed at a Unicharm manufacturing facility, where it monitors chillers, cooling towers, condenser pumps, and runs AI-assisted root-cause / efficiency / maintenance agents on top of plant telemetry.

THERMYNX is the **product**. Graylinx is the **parent brand** — the wordmark and trademark live on every login page and in the sidebar footer ("THERMYNX · by Graylinx").

---

## Sources

This system was reverse-engineered from a single source:

- **`frontend/`** — Local Vite + React 18 SPA (mounted via the user's file system). Stack: Chakra UI 2 + Framer Motion + GSAP + Recharts + lucide-react.
- Theme source-of-truth: `frontend/src/app/theme/index.js`, header-commented as "Graylinx Brand v2 — Palette: colorpallete.txt (Figma export 2026-05-09), WCAG 2.2 verified".

No Figma file, no slide template, and no marketing site were provided — so this kit focuses on **the in-app product** plus the foundational tokens.

---

## What's in this folder

| File / folder | What it is |
|---|---|
| `colors_and_type.css` | All CSS custom properties — colors, type, spacing, radii, shadows, motion |
| `SKILL.md` | Cross-compatible skill manifest for Claude Code |
| `assets/` | Brand assets (logo PNG; logo SVG and product wordmarks generated from copy) |
| `preview/` | Static HTML cards that populate the Design System tab (one card per concept) |
| `ui_kits/thermynx-app/` | UI kit recreation of the THERMYNX product (sidebar shell + dashboard + AI Analyzer + Anomaly Detector + AI Agents) |

---

## CONTENT FUNDAMENTALS

**Audience.** The user is a **plant operator** or **facility manager** — technically literate, time-pressured, working an actual shift. Every screen is built around "what should I do in the next hour?" The brief defaults to `Unicharm HVAC Plant · Last 24 hours` and the daily-brief agent literally calls itself "shift handover".

**Voice.** Technical, calm, declarative. Sentences are short. No marketing fluff, no exclamation points, no "Welcome back!". The product is comfortable with industry jargon and uses it without softening — `kW/TR`, `delta-T`, `chiller load`, `condenser water`, `z-score`, `RAG`. It assumes the reader knows what those mean and links a Knowledge tab for when they don't.

**Person.** Mostly **third person, agentless** ("Statistical z-score detection · auto-scan every 5 min"). When it addresses the user it uses **second person, imperative** ("Ask anything about your HVAC plant", "Scan now", "Stop"). Never first person — there is no "we", no "our".

**Casing.**
- **Page titles & headings:** Title Case ("Operations Dashboard", "AI Analyzer", "Daily Brief", "Root Cause").
- **Eyebrows, badges, kicker labels:** UPPERCASE with 0.1em tracking ("EQUIPMENT OVERVIEW", "RUNNING", "STANDBY", "CRITICAL").
- **Buttons:** Sentence case ("Scan now", "New thread", "Stop", "Analyze").
- **Sentences in helper text and tooltips:** Sentence case with no trailing period unless multi-sentence.

**Tone examples (verbatim from product).**
- Subtitle: "Unicharm HVAC Plant · Last 24 hours" — middle-dot separator, no verbs.
- Agent tagline: "Deep-dive into any equipment issue autonomously" — fragment, no period.
- Empty state: "No anomalies detected" / "All equipment is operating within normal statistical range" — factual, reassuring, no emoji.
- Loading: "Generating analysis…" / "Agent is working…" / "Gathering data…" — single ellipsis (one char, `…`), no "please wait".
- Error: "Cannot reach backend. Is the server running?" — short, direct, ends with a diagnostic question.
- Quick prompts: full operator questions in plain English, no quotes — "Why is kW/TR outside optimal range?", "Compare Chiller 1 vs Chiller 2 performance".

**Numbers.** Always `tabular-nums`. kW/TR shown to **3 decimals** (`0.732`). Percentages to **1 decimal** (`62.4%`). Temperatures to **1 decimal** (`28.5 °C`). Time of day in **24-hour, IST** (`en-IN` locale, `14:30`). Missing data is always `—` (em-dash), never `N/A` or `null`.

**Emoji.** **Never**. Not in copy, not in buttons. The only "emoji-like" thing in the product is the dotted status pulse, which is a real animated DOM element, not a character.

**Separators.** Middle dot `·` for inline metadata ("Statistical z-score detection · auto-scan every 5 min · last scanned 14:32"). En-dash for ranges ("2PM–4PM"). Never a vertical bar `|`.

**Vibe in one line.** A serious instrument panel with one decisive accent color. It's not "delightful", it's not "playful" — it's **calm, fast, and confident**, like a flight deck.

---

## VISUAL FOUNDATIONS

### Color
- **Two themes — light and dark.** Toggle by setting `data-theme="light"` or `data-theme="dark"` on the root `<html>` element. Light is the default. The brand color stays the same in both modes; what flips is surfaces (`#EFF0FF` ↔ `#0A0E1F`), text (`#1D1D21` ↔ `#F1F1F4`), and borders (faint lavender ↔ translucent white). The sidebar is dark in **both** themes by design. In the THERMYNX app kit there's a segmented `Light / Dark` toggle in the sidebar footer; preference is persisted to `localStorage` under `thermynx-theme`.
- **One brand color, used decisively.** Electric blue **`#1F3FFE`** (`--accent-primary`) drives every primary action, active nav state, link, focus ring, chart line, and shadow tint. The whole product feels like one hue.
- **Two blues in the wild.** The Chakra theme says `#1F3FFE`; `index.html` and `rgba(5,17,242,…)` everywhere say `#0511F2`. They're visually almost identical (deep electric blue). Treat `#1F3FFE` as canonical (Brand v2 in Figma) and `#0511F2` as the legacy in-code value still found in many `rgba()` calls. **All shadows are tinted with `rgba(31,63,254, …)` or `rgba(5,17,242, …)` — never plain black.**
- **Neutrals are warm-cool grays**, not pure gray. `#1D1D21` for primary text, `#3B3B42` secondary, `#808087` muted.
- **Status uses red/amber/green** (`#DC2626`, `#D97706`, `#059669`) but only inside data — anomaly cards, kW/TR efficiency bands. Never in chrome. The product UI itself stays mono-blue.
- **Sidebar is the inverse:** near-black `#06091A` with white-translucent text. It's the only "dark mode" surface in the product.

### Type
- **Headings: Plus Jakarta Sans**, weight 800, letter-spacing `-0.03em`, line-height `1.15`. Tight and decisive.
- **Body: Inter**, weight 400/500, with `font-feature-settings: "tnum", "kern"` on the whole document so digits align in tables.
- **Mono: JetBrains Mono** (with Fira / Cascadia fallback) — code blocks, JSON tool traces.
- **Eyebrow / overline labels:** Inter 10px, weight 700, UPPERCASE, letter-spacing `0.10em`, `text.muted`. This single pattern is repeated 50+ times across the product to label sections.
- **KPI numbers** are heading-family at 20–24px, weight 800, letter-spacing `-0.03em`, `tabular-nums`, colored by brand-primary or by efficiency band.

### Spacing
- Chakra's 4px-scale. Cards have `p={4}` (16px) or `p={5}` (20px) internally. Page gutters are responsive: `p={3,4,6,8}` from base→xl. Card gaps in grids are `gap={3,4}`.
- Max content width is **1400px**, centered (`PageShell`).

### Background
- **Flat brand-tinted off-white `#EFF0FF` everywhere.** No gradients on backgrounds. No textures. No hand-drawn illustrations. No photography. The canvas is silent so the data can speak.
- The **only** gradient in the product is the AI Analyzer header tile (`linear-gradient(135deg, #00c4f4, #7c3aed)`) and a 2px top-edge glow on the brand color (`linear(to-r, transparent, brand.500, transparent)`) used on cards with `glow={true}`.

### Cards (`GlassCard`)
- `bg: #FFFFFF`, `border: 1px solid #C7C9FF` (the `--border-subtle` brand-tint), `border-radius: 16px`, `box-shadow: 0 1px 3px rgba(29,29,33,0.06), 0 4px 16px rgba(31,63,254,0.04)`.
- **Hover state:** card lifts `y: -2px`, shadow grows to `0 8px 32px rgba(31,63,254,0.1)`, border deepens to `rgba(31,63,254,0.28)`. Animated via Framer Motion `whileHover` over 180ms.
- Optional **`glow` prop** adds a 2px top-edge gradient bar (transparent → brand → transparent). Used on completion states (e.g. "Analysis complete").
- Optional **`accent` prop** adds a 3px left-edge solid brand bar. **Used sparingly** — only when a card needs an in-line emphasis treatment. (This is the one allowed "left-border accent" pattern; do not invent more.)

### Borders & radii
- Default border is **1px solid `#C7C9FF`** — a faint brand-tint, not gray.
- Card radius **16px**. Inputs / buttons **10px**. Badges **6px**. Pills (chips) **`full` (9999px)**. Pulse dots, status circles **`full`**.

### Shadows — **brand-tinted, never neutral**
Every shadow uses `rgba(31,63,254, …)` so the depth itself reads as blue. See `--shadow-card`, `--shadow-lg`, `--shadow-brand`. No `rgba(0,0,0,…)` shadows exist in product code except inside the tooltip component.

### Buttons & hover/press states
- **Primary (`solid`):** brand-blue fill, white text, radius 10px, weight 600.
  - Hover: bg darkens to `--brand-600` (`#0123B4`), `transform: translateY(-1px)`, shadow `0 6px 24px rgba(31,63,254,0.35)`.
  - Active/press: `transform: translateY(0)`, bg `--brand-700` (`#000F64`).
- **Ghost:** transparent → `bg.elevated` on hover, text muted → primary.
- **Outline:** 1.5px brand-tint border → on hover border becomes `accent.primary` and text becomes `text.brand`.
- **Glass** (only on dark surfaces — sidebar, agent output header): `rgba(255,255,255,0.08)` + `backdrop-filter: blur(12px)` + 1px white-translucent border.
- **Press scale:** chips and icon-buttons use `whileTap={{ scale: 0.95–0.97 }}`. No "shrink + darken" pattern.

### Focus rings
- WCAG 2.2: **2px solid `#1F3FFE` outline, 2px offset, 4px corner radius.** This is global and non-negotiable. On buttons specifically, focus is a 3px ring at `rgba(31,63,254,0.35)`.

### Animation
- Two libraries: **Framer Motion** (component-level) and **GSAP** (page-entrance staggers via `useGsapEntrance`).
- **Page transition:** fade + slide `y: 8px → 0`, 220ms, `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.
- **Card entrance:** `opacity 0 / y 14 → 1 / 0`, 420ms with 60ms stagger between siblings (`PageTransition` wraps every route).
- **KPI number count-up:** 1.1s `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo) via Framer `animate()`.
- **Status pulse:** 2s linear infinite scale 1→1.8 + opacity 1→0 — a soft "halo" ring around a solid dot.
- **Thinking dots:** three 5px dots, `y: [0,-5,0]` + `opacity: [0.5,1,0.5]`, 0.9s loop, 0.15s delay between siblings.
- **Skeleton shimmer:** 60%-wide white-translucent gradient sweeping `x: -100% → 100%`, 1.6s easeInOut infinite. Bars sit on `#EFF0FF` (canvas tint).
- **No bounces.** No elastic. No spring overshoot. Everything decelerates smoothly into place — the brand reads as **precise**, not playful.

### Transparency & blur
- **Backdrop blur is rare.** Two places only:
  1. The mobile sidebar overlay (`rgba(6,9,26,0.75)` + `backdrop-filter: blur(8px)`).
  2. The `glass` button variant (12px blur, on dark sidebar only).
- **Translucent overlays** on the sidebar use `rgba(255,255,255, 0.05–0.22)` for hover / active states. On the light canvas, hover uses opaque `--bg-elevated` (`#EFF0FF`).

### Imagery
- **There is none.** No photos, no illustrations, no full-bleed images. The "warmth" of the product comes entirely from the brand-tinted canvas and the electric blue accent. If a placeholder image is ever required, it should be a soft brand-tinted rectangle with a 1px `--border-subtle` border and a small `lucide-react` icon centered in `text.muted`.

### Layout rules
- Sidebar is fixed on `2xl` breakpoints (`>= 1536px`), drawer-overlay below. Sidebar width: **230px expanded / 68px collapsed / 260px overlay**.
- All routes share `PageShell`: `maxW: 1400px`, centered, responsive padding `3 → 4 → 6 → 8`.
- All routes share `PageHeader`: title (size lg, weight 800, `-0.03em` tracking) + subtitle (xs/sm, muted) + optional left icon (40×40 rounded square with brand-gradient fill) + right actions cluster.
- Grids always use `minmax(0, 1fr)` to prevent blowout from long content.

### Charts (Recharts)
- One brand line + faint white bars layered. `CartesianGrid` is `strokeDasharray: "3 3"` at `rgba(5,17,242,0.06)` — barely visible.
- Reference lines on charts use `strokeDasharray: "5 3"` at status color, 35% opacity.
- Axis text: 10px, color `#334155`, no axis line, no tick line.
- Area fill on the primary metric is a top-to-bottom brand gradient at 15% → 0%.

---

## ICONOGRAPHY

**Library: `lucide-react`** (v1.14, pinned in `package.json`) is used **everywhere**. Every icon you see in the product — nav, KPI cards, anomaly metadata, agent mode cards, the refresh button, page-header icons — is a Lucide stroke icon.

**Sizing & weight.**
- **Nav icons:** size `18`, `strokeWidth: 1.65` (active state bumps to `2`).
- **KPI / inline icons:** size `14–16`, `strokeWidth: 1.75` or `2`.
- **Page-header tile icons:** size `20`, `strokeWidth: 1.85`, inside a 40×40 rounded square with brand-gradient fill, white icon.
- **Trace-frame icons:** size `13`, `strokeWidth: 2`.

**Common icons used in product** (so the kit re-uses these by default):
`LayoutDashboard`, `MessageSquareText`, `Activity`, `TriangleAlert`, `TrendingUp`, `Columns2`, `Wrench`, `IndianRupee`, `FileText`, `Bot`, `BookOpen`, `ChevronLeft`, `ChevronRight`, `Wind`, `Zap`, `RefreshCw`, `Database`, `Cpu`, `Gauge`, `ThermometerSun`, `Droplets`, `Snowflake`, `Fan`, `Waves`, `ScanSearch`, `CalendarCheck`, `Microscope`, `Menu`, `List`, `BarChart2`, `History`, `CheckCircle2`.

**One Chakra-icons exception.** `CheckCircleIcon` from `@chakra-ui/icons` is used in the Anomaly "empty state" only. Lucide's `CheckCircle2` covers everything else.

**SVGs / sprites / icon fonts.** None. The only raster asset is `logo.png` (the Graylinx wordmark + winged glyph). No `@fontsource` icon fonts, no Heroicons, no custom SVG sprite.

**Emoji.** **Never used.** If you see emoji in a draft, replace it with a Lucide icon.

**Unicode glyphs.** Used sparingly and intentionally — only `↑` / `↓` (trend arrows on KPI cards) and `·` (middle-dot separator in subtitles). Em-dash `—` for missing data. `▲` / `▼` (BLACK UP/DOWN-POINTING TRIANGLE) on collapsible disclosure rows in `TraceStep`. **No other Unicode iconography.**

**Substitutions (when CDN-loaded outside the codebase).**
This kit and any artifact built on top of it should load Lucide from CDN if `lucide-react` isn't available:
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```
Stroke width should be set to `1.65–2` on every call to match the in-app look.

---

## CAVEATS & FLAGS

- **Fonts:** Plus Jakarta Sans, Inter, and JetBrains Mono are pulled from Google Fonts — no proprietary `.ttf`s were shipped in the codebase, so no local font files are bundled here. The Google version is the canonical one (the `index.html` already uses Google Fonts directly).
- **Two-blue inconsistency:** the Chakra theme says `#1F3FFE` while many components inline `rgba(5,17,242,…)` (`#0511F2`). I treat **`#1F3FFE`** as canonical because the theme file is explicitly tagged "Brand v2 / Figma export". You may want a quick pass to reconcile.
- **Sidebar bg discrepancy:** theme tokens declare `--bg-sidebar: #000F64` but live `Sidebar.jsx` paints `#06091A`. The kit uses **`#06091A`** to match the live render.
- **No marketing assets:** no hero illustrations, slide template, or website were attached. The kit only covers the in-app product surface.
- **No Figma access:** the `colorpallete.txt` Figma reference is mentioned in the theme file but wasn't attached.

---

## Index

- `colors_and_type.css` — tokens
- `SKILL.md` — skill manifest
- `assets/logo.png` — Graylinx wordmark (PNG)
- `preview/` — Design System tab cards
- `ui_kits/thermynx-app/` — product UI kit (sidebar shell, dashboard, AI Analyzer, Anomaly Detector, AI Agents). Open `index.html` and click sidebar items to navigate.
- `ui_kits/thermynx-app/README.md` — kit-specific docs: file map, mocked-vs-real callouts, click-through behaviour
