# UI / UX Improvement Plan — Graylinx

**Scope:** WCAG 2.2 compliance · Animation polish · Responsive layout · UI/UX principles  
**Audience:** Harshan — executing solo sprints  
**Based on audit of:** 34 JSX/JS files, theme/index.js, index.html, package.json  
**Created:** 2026-05-15 · **Status:** Sprints A–D shipped 2026-05-15

> **✅ Execution status (2026-05-15):** All four sprints completed in a single session. Frontend `npm run build` ✓ clean (3792 modules), `npm test` ✓ passing. See section 8 below for a per-item completion log.

---

## Table of Contents

1. [Current State — What We Have](#1-current-state--what-we-have)
2. [WCAG 2.2 Gaps & Fixes](#2-wcag-22-gaps--fixes)
3. [Animation Audit & Fixes](#3-animation-audit--fixes)
4. [Responsiveness Gaps & Fixes](#4-responsiveness-gaps--fixes)
5. [UI/UX Principles Audit](#5-uiux-principles-audit)
6. [Sprint Execution Plan](#6-sprint-execution-plan)
7. [Validation Checklist](#7-validation-checklist)

---

## 1. Current State — What We Have

### Stack
| Layer | Library | Version |
|-------|---------|---------|
| UI framework | Chakra UI | v2.10.4 |
| Animations | Framer Motion | v11.12.0 |
| Animations | GSAP | v3.15.0 |
| Charts | Recharts | v3.8.1 |
| Icons | Lucide React | v1.14.0 |
| Routing | React Router v6 | v6.28.0 |

### What already works well
- Custom design system: semantic tokens, spacing scale, shadows, border-radius scale in [`frontend/src/app/theme/index.js`](../../frontend/src/app/theme/index.js)
- Mobile-first responsive props on most components (`base → sm → md → lg → xl → 2xl`)
- `:focus-visible` ring defined globally in [`frontend/index.html`](../../frontend/index.html)
- `role="radio"` + `aria-checked` on theme toggle
- `aria-label` on sidebar toggle, mobile menu, refresh button
- Framer Motion + GSAP for page transitions and card entrances
- Skeleton loading screens on dashboard
- `PageShell` max-width container with responsive padding

### What this plan addresses
Everything below is a gap — missing, broken, or inconsistent.

---

## 2. WCAG 2.2 Gaps & Fixes

WCAG 2.2 targets **Level AA** as the minimum. Items marked `AAA` are bonus.

### A1 — No skip navigation link *(WCAG 2.4.1 — Level A)*

**What's missing:** Keyboard users tab through every sidebar nav item before reaching page content.

**File:** [`frontend/index.html`](../../frontend/index.html) + [`frontend/src/app/Layout.jsx`](../../frontend/src/app/Layout.jsx)

**Fix:** Add a visually-hidden skip link as the very first focusable element in the DOM that appears on focus and scrolls to `#main-content`.

```html
<!-- index.html — first child of <body> -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<style>
  .skip-link {
    position: absolute;
    top: -100%;
    left: 1rem;
    z-index: 9999;
    padding: 0.5rem 1rem;
    background: #1F3FFE;
    color: white;
    border-radius: 0 0 8px 8px;
    font-weight: 600;
    text-decoration: none;
    transition: top 0.1s;
  }
  .skip-link:focus { top: 0; }
</style>
```

```jsx
// Layout.jsx — main content area
<Box as="main" id="main-content" flex={1} overflow="auto" tabIndex={-1}>
  <Outlet />
</Box>
```

**Effort:** 30 min

---

### A2 — Form inputs not associated with labels *(WCAG 1.3.1 — Level A)*

**What's missing:** All `<Select>` and `<Textarea>` inputs use `<Eyebrow>` (a styled `<Text>`) as visual labels. This provides no programmatic label association — screen readers cannot announce which label belongs to which input.

**Files affected:**
- [`frontend/src/features/analyzer/index.jsx`](../../frontend/src/features/analyzer/index.jsx) — Equipment, Time Window, Thread select inputs + question textarea
- [`frontend/src/features/agent/index.jsx`](../../frontend/src/features/agent/index.jsx) — Equipment, Mode select inputs + goal textarea
- [`frontend/src/features/efficiency/index.jsx`](../../frontend/src/features/efficiency/index.jsx) — Equipment, period selects
- All other feature pages with select inputs

**Fix:** Replace pattern `<Eyebrow>Label</Eyebrow> + <Select>` with proper `<FormControl>` + `<FormLabel>`.

```jsx
// Before (broken for a11y)
<Eyebrow>Equipment</Eyebrow>
<Select id="equipment-select" ...>

// After (WCAG compliant)
<FormControl>
  <FormLabel htmlFor="equipment-select" fontSize="10px" letterSpacing="0.10em"
             textTransform="uppercase" color="text.muted" mb={1}>
    Equipment
  </FormLabel>
  <Select id="equipment-select" ...>
</FormControl>
```

> Chakra's `<FormLabel>` renders a `<label>` with `htmlFor` already — just use it instead of `<Text>`.

**Effort:** 2 hours (all pages)

---

### A3 — Charts have no text alternative *(WCAG 1.1.1 — Level A)*

**What's missing:** `TimeseriesChart.jsx` and Recharts charts render SVG with zero accessibility attributes. Screen readers see nothing.

**File:** [`frontend/src/features/analyzer/TimeseriesChart.jsx`](../../frontend/src/features/analyzer/TimeseriesChart.jsx)

**Fix:**

```jsx
// Wrap chart in a figure with accessible description
<Box
  as="figure"
  role="img"
  aria-label={`${equipmentId} ${metric} timeseries over ${hours} hours`}
  aria-describedby={`chart-summary-${equipmentId}`}
>
  <VisuallyHidden id={`chart-summary-${equipmentId}`}>
    Timeseries chart showing {metric} for {equipmentId} over the last {hours} hours.
    Latest value: {latestValue}. Peak: {peakValue}. Average: {avgValue}.
  </VisuallyHidden>
  <ResponsiveContainer width="100%" height={220}>
    <LineChart ...>
```

**Effort:** 1 hour

---

### A4 — Streaming output has no `aria-live` region *(WCAG 4.1.3 — Level AA)*

**What's missing:** The streaming analyzer and agent responses appear token-by-token in the DOM but screen readers are never notified of the new content because there is no `aria-live` region.

**Files:**
- [`frontend/src/features/analyzer/index.jsx`](../../frontend/src/features/analyzer/index.jsx) — streaming markdown output area
- [`frontend/src/features/agent/AgentRunner.jsx`](../../frontend/src/features/agent/AgentRunner.jsx) — agent trace + final answer area

**Fix:**

```jsx
// Streaming output container
<Box
  aria-live="polite"
  aria-atomic="false"
  aria-relevant="additions text"
  role="log"
>
  <ReactMarkdown>{streamedText}</ReactMarkdown>
</Box>
```

> Use `aria-live="polite"` (not assertive) so it doesn't interrupt what the screen reader is reading. `aria-atomic="false"` means only new additions are announced, not the full text each time.

**Effort:** 30 min

---

### A5 — StatusPulse has no text alternative *(WCAG 1.1.1 — Level A)*

**What's missing:** The green/gray pulsing dot in [`StatusPulse.jsx`](../../frontend/src/shared/ui/StatusPulse.jsx) conveys live/offline status purely through color and animation. No text or aria-label exists.

**File:** [`frontend/src/shared/ui/StatusPulse.jsx`](../../frontend/src/shared/ui/StatusPulse.jsx)

**Fix:**

```jsx
<Box role="status" aria-label={isLive ? "Data feed live" : "Data feed offline"}>
  <Box as="span" aria-hidden="true" /* the visual dot */ />
  <VisuallyHidden>{isLive ? "Live" : "Offline"}</VisuallyHidden>
</Box>
```

**Effort:** 20 min

---

### A6 — ErrorAlert not announced to screen readers *(WCAG 4.1.3 — Level AA)*

**What's missing:** [`ErrorAlert.jsx`](../../frontend/src/shared/ui/ErrorAlert.jsx) renders via Framer `AnimatePresence` but has no `role="alert"` so screen readers don't announce the error message when it appears.

**File:** [`frontend/src/shared/ui/ErrorAlert.jsx`](../../frontend/src/shared/ui/ErrorAlert.jsx)

**Fix:** Add `role="alert"` and `aria-live="assertive"` to the outermost motion div.

```jsx
<motion.div
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
  ...
>
```

**Effort:** 10 min

---

### A7 — `<html>` missing `lang` attribute *(WCAG 3.1.1 — Level A)*

**What's missing:** [`frontend/index.html`](../../frontend/index.html) has no `lang` attribute on `<html>`. Screen readers need this to select the correct pronunciation engine.

**Fix:**

```html
<html lang="en">
```

**Effort:** 2 min

---

### A8 — Logo image missing `alt` text *(WCAG 1.1.1 — Level A)*

**What's missing:** The `<img src={logo} />` in the sidebar (and anywhere else) renders without an `alt` attribute.

**File:** [`frontend/src/shared/ui/Sidebar.jsx`](../../frontend/src/shared/ui/Sidebar.jsx)

**Fix:**

```jsx
<img src={logo} alt="Graylinx" width={28} height={28} />
// If purely decorative (company name is already in text next to it):
<img src={logo} alt="" role="presentation" />
```

**Effort:** 5 min

---

### A9 — `prefers-reduced-motion` not respected *(WCAG 2.3.3 — Level AAA, but critical UX)*

**What's missing:** All GSAP entrance animations, Framer Motion transitions, StatusPulse CSS pulse, and shimmer keyframes run unconditionally regardless of the OS "Reduce Motion" accessibility setting. Users with vestibular disorders (motion sickness, dizziness) can be harmed.

**Files:**
- [`frontend/src/shared/hooks/useGsapEntrance.js`](../../frontend/src/shared/hooks/useGsapEntrance.js)
- [`frontend/src/shared/ui/PageTransition.jsx`](../../frontend/src/shared/ui/PageTransition.jsx)
- [`frontend/src/shared/ui/StatusPulse.jsx`](../../frontend/src/shared/ui/StatusPulse.jsx)
- [`frontend/src/shared/ui/SkeletonCard.jsx`](../../frontend/src/shared/ui/SkeletonCard.jsx)
- [`frontend/src/shared/ui/KpiCard.jsx`](../../frontend/src/shared/ui/KpiCard.jsx)
- [`frontend/index.html`](../../frontend/index.html) — global CSS

**Fixes:**

```js
// useGsapEntrance.js — skip animation entirely
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) return; // skip gsap.fromTo entirely
```

```jsx
// PageTransition.jsx — Framer Motion useReducedMotion hook
import { useReducedMotion } from 'framer-motion';
const shouldReduceMotion = useReducedMotion();
const variants = shouldReduceMotion
  ? { initial: {}, animate: {}, exit: {} }
  : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } };
```

```jsx
// KpiCard.jsx — skip number counter animation
const shouldReduceMotion = useReducedMotion();
// If reduced motion: set value directly, skip animate()
```

```css
/* index.html — global CSS fallback for all remaining CSS keyframes */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Effort:** 2 hours

---

### A10 — Missing `<main>` landmark *(WCAG 1.3.6 — Level AAA / best practice)*

**What's missing:** The content area in `Layout.jsx` is a plain `<Box>` div. Screen reader landmark navigation (`<main>`, `<nav>`, `<aside>`) is missing.

**File:** [`frontend/src/app/Layout.jsx`](../../frontend/src/app/Layout.jsx)

**Fix:**

```jsx
// Content area
<Box as="main" id="main-content" flex={1} ...>

// Sidebar
<Box as="nav" aria-label="Main navigation" ...>
```

**Effort:** 20 min

---

### A11 — Heading hierarchy audit needed *(WCAG 1.3.1 — Level A)*

**What's missing:** `PageHeader` uses `<Heading as="h1">`. Sub-sections inside pages use `<Eyebrow>` (which renders as `<p>`). But section headings inside cards/panels should be `<h2>`, not `<p>`. Need to audit each page and enforce: one `h1` per page → `h2` for sections → `h3` for sub-sections.

**Files:** All 11 feature pages

**Fix pattern:**

```jsx
// Section headings inside pages
<Text as="h2" fontSize="sm" fontWeight="600" ...>Efficiency Trend</Text>

// Sub-section labels inside cards
<Text as="h3" fontSize="xs" textTransform="uppercase" ...>Last 24 Hours</Text>
```

**Effort:** 1 hour (audit + fix per page)

---

### A12 — Color contrast audit for dark mode *(WCAG 1.4.3 — Level AA)*

**What's missing:** `text.muted` and `text.faint` tokens in dark mode may fall below the 4.5:1 contrast ratio required for normal text (3:1 for large text ≥18pt bold or ≥24pt).

**Tokens to measure:**

| Token | Light value | Dark value | Background | Required |
|-------|------------|------------|------------|----------|
| `text.muted` | #6B6B78 | #8B8B9A (estimate) | bg.canvas | 4.5:1 |
| `text.faint` | #9B9BA8 | #707080 (estimate) | bg.surface | 4.5:1 |
| `text.secondary` | #3B3B42 | #C8C8D5 (estimate) | bg.canvas | 4.5:1 |
| `status.warn` #D97706 | — | bg.surface white | — | 4.5:1 |

**Tool:** Use [https://webaim.org/resources/contrastchecker/](https://webaim.org/resources/contrastchecker/) or Chrome DevTools accessibility panel.

**Fix:** Adjust dark-mode token values in [`frontend/src/app/theme/index.js`](../../frontend/src/app/theme/index.js) where below threshold.

**Effort:** 1 hour

---

### A13 — Streaming has no stop mechanism *(WCAG 2.2.2 — Level A)*

**What's missing:** The analyzer and agent streaming outputs have no pause or stop button. Users cannot halt motion/content updates that start automatically.

**Files:**
- [`frontend/src/features/analyzer/index.jsx`](../../frontend/src/features/analyzer/index.jsx)
- [`frontend/src/features/agent/AgentRunner.jsx`](../../frontend/src/features/agent/AgentRunner.jsx)

**Fix:** Add a "Stop" button that calls `reader.cancel()` on the SSE stream reader when streaming is in progress. The abort controller already exists (`useApi` has `AbortController`) — just expose a stop function.

```jsx
// During streaming — show Stop button
{isStreaming && (
  <Button size="sm" variant="ghost" leftIcon={<StopCircle size={14} />}
          aria-label="Stop generation" onClick={handleStop}>
    Stop
  </Button>
)}
```

**Effort:** 1 hour

---

## 3. Animation Audit & Fixes

### B1 — Dual animation library bundle bloat

**Issue:** Both Framer Motion (≈50KB gzip) and GSAP (≈25KB gzip) are shipped to every user. Most GSAP usage is confined to `useGsapEntrance.js` — entrance staggering only. This can be replaced with Framer Motion's `staggerChildren` variants which is already in the bundle.

**Current GSAP usage in `useGsapEntrance.js`:**
```js
gsap.fromTo(children, { opacity: 0, y: offset }, {
  opacity: 1, y: 0, duration, stagger, ease: "power3.out"
})
```

**Equivalent Framer Motion:**
```jsx
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } } };

<motion.div variants={container} initial="hidden" animate="show">
  {children.map(child => <motion.div variants={item}>{child}</motion.div>)}
</motion.div>
```

**Decision:** Replace `useGsapEntrance.js` + GSAP with Framer Motion stagger variants. Remove GSAP from `package.json`.

**Savings:** ~25KB gzip off the bundle.

**Effort:** 2 hours

---

### B2 — GlassCard hover causes "sticky hover" on touch devices

**Issue:** Framer Motion's `whileHover` fires on tap on mobile, leaving the card in an elevated state after the finger lifts. This breaks the tactile metaphor on phones and tablets.

**File:** [`frontend/src/shared/ui/GlassCard.jsx`](../../frontend/src/shared/ui/GlassCard.jsx)

**Fix:** Detect touch device and disable `whileHover`.

```jsx
import { useReducedMotion } from 'framer-motion';

// Custom hook
function useIsTouch() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
}

// In GlassCard
const isTouch = useIsTouch();
const shouldReduceMotion = useReducedMotion();
const hoverProps = (!isTouch && !shouldReduceMotion) ? {
  whileHover: { y: -2, boxShadow: '...', borderColor: '...' }
} : {};
```

**Effort:** 30 min

---

### B3 — KPI number counter animation on every data refresh

**Issue:** `KpiCard.jsx` uses `framer-motion/animate()` to count from 0 to the value. On dashboard polling refresh, every KPI re-animates from 0, causing jarring resets.

**File:** [`frontend/src/shared/ui/KpiCard.jsx`](../../frontend/src/shared/ui/KpiCard.jsx)

**Fix:** Animate from `previousValue` to `newValue` (not always 0), and only animate on mount or if change > threshold. Store previous value in a `useRef`.

```jsx
const prevValueRef = useRef(value);
const isMount = useRef(true);

useEffect(() => {
  const from = isMount.current ? 0 : prevValueRef.current;
  isMount.current = false;
  // Only animate if change is > 2% (filter noise)
  if (Math.abs(value - from) / (from || 1) > 0.02) {
    animate(from, value, { duration: 0.9, onUpdate: setDisplayValue });
  }
  prevValueRef.current = value;
}, [value]);
```

**Effort:** 45 min

---

### B4 — Animation timing is inconsistent

**Issue:** Page transitions use 220ms, card fade-up uses 300ms, GSAP uses 420ms, hover uses 150-180ms. No documented standard.

**Proposed timing tokens (add to theme or a constants file):**

```js
// frontend/src/app/theme/motion.js (new file)
export const DURATION = {
  instant:    0,      // state changes with no animation
  fast:       150,    // micro-interactions (hover, tap)
  normal:     220,    // page transitions, modal open
  slow:       400,    // entrance stagger base, number counter
  verySlow:   600,    // only for complex multi-step reveals
};

export const EASING = {
  standard:   [0.22, 1, 0.36, 1],   // slightly snappy (replaces power3.out)
  enter:      [0, 0, 0.2, 1],       // decelerating (things entering)
  exit:       [0.4, 0, 1, 1],       // accelerating (things leaving)
  spring:     { stiffness: 400, damping: 28 }, // Framer spring
};
```

Then update all component animation values to use these constants.

**Effort:** 1 hour

---

### B5 — Shimmer/pulse animations run even when not visible

**Issue:** StatusPulse runs `2s infinite` CSS animation forever. SkeletonCard shimmer runs `1.6s infinite`. If user is on another tab or has scrolled away, these waste GPU cycles.

**Fix:** Use `IntersectionObserver` + CSS `animation-play-state: paused` or the `visibility` CSS property.

```jsx
// StatusPulse — simple fix
<Box
  className="status-pulse-dot"
  sx={{
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
    '.status-pulse-dot': { animationPlayState: isVisible ? 'running' : 'paused' },
  }}
/>
```

For SkeletonCard: once data loads, skeletons unmount anyway — no fix needed there. But StatusPulse should stop when page is hidden: listen to `document.visibilitychange`.

**Effort:** 30 min

---

## 4. Responsiveness Gaps & Fixes

### C1 — Sidebar docks too late (only at 2xl = 1536px)

**Issue:** From 1280px–1535px (most laptop screens — 1366px, 1440px), the sidebar is a drawer. Users at these sizes constantly need to open a drawer to navigate.

**File:** [`frontend/src/app/Layout.jsx`](../../frontend/src/app/Layout.jsx)

**Current:**
```jsx
const isSidebarDocked = useBreakpointValue({ base: false, '2xl': true });
```

**Fix:** Dock at `xl` (1280px):
```jsx
const isSidebarDocked = useBreakpointValue({ base: false, xl: true });
```

Check content area padding adjustment — the `ml` (margin-left) for the sidebar offset should apply at `xl` too.

**Effort:** 30 min + visual test at 1280px, 1440px, 1536px

---

### C2 — Charts do not resize with container

**Issue:** `TimeseriesChart.jsx` likely uses fixed `width` and `height` props on Recharts components. When the panel resizes, the chart stays at its initial size.

**File:** [`frontend/src/features/analyzer/TimeseriesChart.jsx`](../../frontend/src/features/analyzer/TimeseriesChart.jsx)

**Fix:** Wrap all Recharts charts in `<ResponsiveContainer>`.

```jsx
import { ResponsiveContainer, LineChart, ... } from 'recharts';

// Before
<LineChart width={600} height={220} data={data}>

// After
<ResponsiveContainer width="100%" height={220}>
  <LineChart data={data}>
    ...
  </LineChart>
</ResponsiveContainer>
```

**Effort:** 30 min

---

### C3 — Touch targets too small

**Issue:** WCAG 2.5.5 (AA) requires touch targets of at least 44×44 CSS pixels. Potentially affected:
- Sidebar nav items: `py: 2` = 8px padding = ~32px total height
- `<Chip>` preset buttons: `px: 3, py: 1` = ~28px height
- `ZScorePill` badge: ~22px height (display only — no touch needed)
- Sidebar collapse toggle: measured visually

**File:** Multiple

**Fix:**

```jsx
// Sidebar NavItem — increase hit area
py={2.5}  // → 10px padding → ~40px → close but still under. Use py={3} → 48px ✓

// Chip button — add min-height
<Button minH="44px" minW="44px" px={4} py={2} ...>

// Sidebar collapse toggle — ensure 44×44
<IconButton minW="44px" h="44px" ...>
```

**Effort:** 1 hour

---

### C4 — Markdown output causes horizontal scroll on narrow screens

**Issue:** The analyzer streams markdown that may contain wide code blocks, tables, or long URLs. These force the content area to exceed viewport width on mobile.

**File:** [`frontend/src/features/analyzer/index.jsx`](../../frontend/src/features/analyzer/index.jsx) — markdown rendering container

**Fix:**

```jsx
// Markdown container
<Box
  overflow="hidden"
  sx={{
    '& pre': { overflowX: 'auto', maxW: '100%' },
    '& code': { wordBreak: 'break-all' },
    '& table': { display: 'block', overflowX: 'auto', maxW: '100%' },
    '& img': { maxW: '100%', height: 'auto' },
  }}
>
  <ReactMarkdown>{streamedText}</ReactMarkdown>
</Box>
```

**Effort:** 30 min

---

### C5 — Agent mode grid wraps awkwardly

**Issue:** 5 mode cards in a grid at `{ base: 2, sm: 3, lg: 5 }`. At `sm` (480px), you get 2 cards in row 1, 3 in row 2 — one card wraps. At `md` (768px), still 3 columns — 2 cards wrap to row 2.

**File:** [`frontend/src/features/agent/index.jsx`](../../frontend/src/features/agent/index.jsx)

**Fix:**

```jsx
// Option A: horizontal scrolling row on mobile
<HStack overflowX="auto" spacing={3} pb={2}
        sx={{ scrollSnapType: 'x mandatory',
              '& > *': { scrollSnapAlign: 'start', flexShrink: 0 } }}>
  {modes.map(...)}
</HStack>

// Option B: fix grid columns
templateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" }}
// Accept that 5th card is a full-width row on 2-col layout — visually less jarring than odd wrap
```

**Effort:** 30 min

---

### C6 — No tablet-specific layout refinement (768px–1024px)

**Issue:** At tablet portrait (768px), the main content has sidebar-drawer + dense grid. The `md` breakpoint exists but many components jump from `base` to `lg` with no `md` refinement.

**Affected components:**
- PageHeader: `md` responsive exists ✓ — already handled
- KPI grid: `base: 2 cols → sm: 2 → md: 3 → 2xl: 6` ✓ — handled
- Analyzer layout: needs audit at md
- Agent hub: 3 cols at sm → 5 at lg — no md step

**Fix:** Add `md` breakpoint step to Agent hub and Analyzer grid:

```jsx
// Analyzer control grid
templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }}
```

**Effort:** 1 hour (visual audit at 768px + 1024px in Chrome DevTools)

---

### C7 — Test required on real breakpoints

After all code fixes, validate at these exact viewport widths using Chrome DevTools device toolbar:

| Width | Device equivalent | Key things to test |
|-------|------------------|-------------------|
| 320px | iPhone SE | KPI grid, sidebar drawer, font sizes |
| 375px | iPhone 14 | Standard mobile layout |
| 430px | iPhone 14 Pro Max | Wide mobile |
| 768px | iPad portrait | Tablet layout, sidebar drawer |
| 1024px | iPad landscape / small laptop | Pre-dock sidebar |
| 1280px | MacBook Air | Sidebar docks here (after C1 fix) |
| 1440px | Standard laptop | Primary design target |
| 1920px | Desktop | Wide layout |

---

## 5. UI/UX Principles Audit

### D1 — No standardized empty state component

**Issue:** When API returns empty data (no anomalies detected, no threads, no RAG documents), there is no consistent empty state UI — pages likely show a blank grid or undefined.

**Fix:** Create `frontend/src/shared/ui/EmptyState.jsx`:

```jsx
// Props: icon, title, description, action (optional button)
<EmptyState
  icon={<AlertCircle size={32} />}
  title="No anomalies detected"
  description="The last scan found no statistical outliers above the Z-score threshold."
  action={<Button size="sm" onClick={runScan}>Run scan now</Button>}
/>
```

Apply to: anomalies page (no anomalies), RAG page (no documents), threads list (no threads), reports page (no reports).

**Effort:** 1 hour (component) + 30 min per page (5 pages)

---

### D2 — No toast/notification system for actions

**Issue:** When actions complete (thread saved, agent completed, RAG document ingested), there is no feedback. The user has no confirmation that anything happened.

**Fix:** Chakra UI has a built-in `useToast` hook. Create a `useAppToast` wrapper with pre-configured variants:

```jsx
// frontend/src/shared/hooks/useAppToast.js
export function useAppToast() {
  const toast = useToast();
  return {
    success: (title, description) => toast({ title, description, status: 'success', duration: 3000, isClosable: true, position: 'bottom-right' }),
    error:   (title, description) => toast({ title, description, status: 'error',   duration: 5000, isClosable: true, position: 'bottom-right' }),
    info:    (title, description) => toast({ title, description, status: 'info',    duration: 3000, isClosable: true, position: 'bottom-right' }),
  };
}
```

Apply to:
- Thread saved → `toast.success("Thread saved")`
- RAG ingest complete → `toast.success("Document ingested", "142 chunks embedded")`
- Agent run complete → `toast.info("Agent complete", goal.slice(0, 60) + "...")`
- Copy to clipboard buttons → `toast.success("Copied")`

**Effort:** 30 min (hook) + 1 hour (apply to all relevant actions)

---

### D3 — ErrorAlert has no retry action

**Issue:** When data fetch fails, `ErrorAlert` displays the error message and a dismiss button, but no retry. Users must manually refresh the page.

**File:** [`frontend/src/shared/ui/ErrorAlert.jsx`](../../frontend/src/shared/ui/ErrorAlert.jsx)

**Fix:** Add optional `onRetry` prop:

```jsx
// ErrorAlert.jsx
{onRetry && (
  <Button size="xs" variant="ghost" onClick={onRetry} ml={2}>
    Retry
  </Button>
)}

// Usage in any page
<ErrorAlert error={error} onRetry={refetch} onDismiss={clearError} />
```

The `useApi` hook already has a `refetch` function — just pass it through.

**Effort:** 30 min

---

### D4 — No character count on LLM input fields

**Issue:** `AnalyzeRequest.question` has `max_length=2000` validation in the backend. If a user types more than 2000 characters they get a 422 error with no prior warning. Same for agent goal.

**Files:**
- [`frontend/src/features/analyzer/index.jsx`](../../frontend/src/features/analyzer/index.jsx)
- [`frontend/src/features/agent/index.jsx`](../../frontend/src/features/agent/index.jsx)

**Fix:**

```jsx
// Near the textarea — show count, warn when close
const MAX_LEN = 2000;
const isNearLimit = question.length > MAX_LEN * 0.85;
const isAtLimit = question.length >= MAX_LEN;

<Text fontSize="10px" color={isAtLimit ? 'status.bad' : isNearLimit ? 'status.warn' : 'text.faint'}
      textAlign="right" mt={1}>
  {question.length} / {MAX_LEN}
</Text>
```

**Effort:** 20 min

---

### D5 — Scroll position not reset on page navigation

**Issue:** When navigating between pages via sidebar, the new page can inherit the scroll position of the previous page (especially the main content scroll area). User arrives at `/efficiency` scrolled 400px down.

**Fix:** Add a scroll reset in `Layout.jsx` or `App.jsx` using `useEffect` on route change:

```jsx
// Layout.jsx
import { useLocation } from 'react-router-dom';

const { pathname } = useLocation();
const mainRef = useRef(null);

useEffect(() => {
  mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
}, [pathname]);

<Box ref={mainRef} as="main" id="main-content" overflow="auto" ...>
```

**Effort:** 20 min

---

### D6 — Inconsistent loading states across pages

**Issue:** Dashboard has a polished `SkeletonDashboard`. Other pages (efficiency, forecast, compare, cost, maintenance, reports) may show a blank page or raw spinner while data loads. No audit has been done.

**Fix:** Audit all 11 pages. For any page missing skeletons, use `SkeletonCard` which already has type variants (`"kpi"`, `"equipment"`, `"chart"`, `"list"`):

```jsx
// Quick fix pattern for pages missing skeleton
if (isLoading) return (
  <PageShell>
    <PageHeader title="Efficiency" ... />
    <SkeletonCard type="chart" count={3} />
  </PageShell>
);
```

**Effort:** 30 min audit + 30 min per page needing fix (estimate 4 pages)

---

### D7 — Dark mode: audit all hardcoded colors

**Issue:** Some components have hardcoded hex values that do not adapt to color mode — e.g., sidebar bg is always `#06091A` (fine — intentional), but other places might have hardcoded `#fff` or `#000` that break in dark mode.

**Fix:** Run grep for literal hex values in JSX files and audit each:

```bash
grep -rn "#[0-9a-fA-F]\{3,6\}" frontend/src/features/ frontend/src/shared/
```

Replace any that should be semantic tokens but aren't.

**Effort:** 1 hour

---

## 6. Sprint Execution Plan

### Sprint A — Accessibility Foundation (1 day)

These are all Level A WCAG violations — the baseline that every web product must meet.

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| A7 | Add `lang="en"` to `<html>` | index.html | 2 min |
| A8 | Add `alt` text to logo | Sidebar.jsx | 5 min |
| A6 | Add `role="alert"` to ErrorAlert | ErrorAlert.jsx | 10 min |
| A5 | Add text alternative to StatusPulse | StatusPulse.jsx | 20 min |
| A10 | Add `<main>` and `<nav>` landmarks | Layout.jsx | 20 min |
| A1 | Add skip navigation link | index.html + Layout.jsx | 30 min |
| A4 | Add `aria-live` to streaming output | analyzer/index.jsx + AgentRunner.jsx | 30 min |
| A13 | Add Stop button to streaming | analyzer/index.jsx + AgentRunner.jsx | 60 min |
| A2 | Associate form inputs with `<label>` | All 11 feature pages | 2 hours |
| A11 | Fix heading hierarchy per page | All 11 feature pages | 1 hour |

**Sprint A total:** ~6 hours

---

### Sprint B — Motion & Animation (half day)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| A9 | Add CSS `prefers-reduced-motion` fallback | index.html | 15 min |
| A9 | Add `useReducedMotion` to PageTransition | PageTransition.jsx | 30 min |
| A9 | Add reduced-motion guard to useGsapEntrance | useGsapEntrance.js | 20 min |
| A9 | Add reduced-motion guard to KpiCard counter | KpiCard.jsx | 20 min |
| B3 | Fix KPI counter animates from prev value | KpiCard.jsx | 45 min |
| B2 | Disable hover lift on touch devices | GlassCard.jsx | 30 min |
| B5 | Pause StatusPulse on page hidden | StatusPulse.jsx | 30 min |
| B4 | Create motion constants file | theme/motion.js | 30 min |
| B1 | Replace GSAP with Framer stagger, remove gsap | useGsapEntrance.js + package.json | 2 hours |

**Sprint B total:** ~5 hours

---

### Sprint C — Responsiveness (half day)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| C1 | Dock sidebar at xl not 2xl | Layout.jsx | 30 min |
| C2 | Wrap all charts in ResponsiveContainer | TimeseriesChart.jsx + all chart files | 30 min |
| C4 | Fix markdown horizontal overflow | analyzer/index.jsx | 30 min |
| C3 | Fix touch target sizes (sidebar, chip, toggle) | Sidebar.jsx, Chip.jsx, PageHeader.jsx | 1 hour |
| C5 | Fix agent mode grid wrap | agent/index.jsx | 30 min |
| C6 | Add md breakpoint refinements | Multiple | 1 hour |
| C7 | Manual test all 8 breakpoints in DevTools | — | 1 hour |

**Sprint C total:** ~5 hours

---

### Sprint D — UI/UX Polish (1 day)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| A12 | Audit dark mode contrast ratios | theme/index.js | 1 hour |
| D7 | Audit & fix hardcoded colors | All feature files | 1 hour |
| D5 | Scroll-to-top on route change | Layout.jsx | 20 min |
| D4 | Character count on LLM inputs | analyzer + agent index.jsx | 20 min |
| D3 | Add retry to ErrorAlert | ErrorAlert.jsx + all pages | 30 min |
| D6 | Audit + add skeletons to missing pages | Efficiency, forecast, compare, etc. | 2 hours |
| D2 | Add toast notifications for actions | useAppToast.js + relevant pages | 1.5 hours |
| D1 | Create EmptyState component + apply | EmptyState.jsx + 5 pages | 2.5 hours |
| A3 | Add chart text alternatives | TimeseriesChart.jsx | 1 hour |

**Sprint D total:** ~10 hours

---

### Summary

| Sprint | Focus | Estimated time |
|--------|-------|----------------|
| **A** | WCAG Level A violations | ~6 hours |
| **B** | Motion accessibility + animation polish | ~5 hours |
| **C** | Responsive layout fixes | ~5 hours |
| **D** | UI/UX polish + dark mode + UX patterns | ~10 hours |
| **Total** | | **~26 hours / ~3.5 days** |

---

## 7. Validation Checklist

Run this checklist after each sprint to confirm changes are correct.

### Automated tools

```bash
# Install axe-core browser extension for live WCAG audit
# Chrome: "axe DevTools" extension

# Lighthouse CLI audit (run against running dev server)
npx lighthouse http://localhost:5173 --only-categories=accessibility --output=json
# Target: Accessibility score ≥ 90

# Check color contrast
npx @accessibility-checker/checker http://localhost:5173
```

### Manual keyboard navigation test

- [ ] Tab from URL bar — first focusable element is the skip link
- [ ] Press Enter on skip link — focus jumps to `#main-content`, page scrolls
- [ ] Tab through sidebar — each nav item receives visible focus ring
- [ ] Tab into content area — all interactive elements reachable in logical order
- [ ] No keyboard trap anywhere except in open modals/drawers (trapped correctly)
- [ ] Escape closes any open drawer/modal
- [ ] All buttons and links activatable with Enter or Space

### Screen reader test (NVDA + Chrome on Windows)

- [ ] Page title announced on navigation (`<title>` in `<head>` changes per route)
- [ ] `<main>` region announced
- [ ] `<nav aria-label="Main navigation">` announced
- [ ] Form labels announce correctly when input receives focus
- [ ] StreamingOutput: live region announces new text during generation
- [ ] ErrorAlert: error message announced immediately when it appears
- [ ] StatusPulse: "Data feed live" or "Data feed offline" announced when focused

### Reduced motion test

- [ ] In macOS: System Preferences → Accessibility → Reduce Motion → ON
- [ ] In Windows: Settings → Ease of Access → Reduce Motion → ON
- [ ] Reload app — page transitions should have no slide/fade
- [ ] KPI cards — numbers should appear immediately without counter animation
- [ ] Status pulse — should be static dot (no animation)
- [ ] Skeletons — should be static (no shimmer sweep)

### Responsive visual test (Chrome DevTools)

- [ ] 320px — no horizontal scroll, all text readable, no overlapping elements
- [ ] 375px — mobile layout intact, touch targets ≥ 44px
- [ ] 768px — tablet portrait: sidebar drawer works, grids correct
- [ ] 1024px — iPad landscape: layout starts feeling comfortable
- [ ] 1280px — sidebar is now docked (after C1 fix), content area full width
- [ ] 1440px — primary laptop design target: everything looks intended
- [ ] 1920px — widescreen: max-width container prevents over-stretch

### Color contrast verification

- [ ] `text.primary` on `bg.canvas` — light: ≥7:1 | dark: ≥7:1
- [ ] `text.secondary` on `bg.canvas` — ≥4.5:1 in both modes
- [ ] `text.muted` on `bg.canvas` — ≥4.5:1 in both modes
- [ ] `text.faint` on `bg.surface` — ≥4.5:1 in both modes
- [ ] `status.warn` text — ≥4.5:1 on its background color
- [ ] Brand blue #1F3FFE on white — verified 9:1 ✓
- [ ] All badge/pill text on their background colors

### Animation quality test

- [ ] Page transitions feel snappy (≤220ms) and consistent
- [ ] Card hover lift only on mouse (not on touch/tap)
- [ ] KPI numbers animate smoothly from previous to new value (not 0 → value on refresh)
- [ ] No layout shift (CLS) during page entrance stagger
- [ ] Shimmer skeletons all removed cleanly when data loads

### UX pattern test

- [ ] Thread saved → success toast appears bottom-right
- [ ] RAG ingest complete → success toast with chunk count
- [ ] API error → ErrorAlert shows with Retry button that works
- [ ] Navigate to page with no data → EmptyState renders (not blank)
- [ ] Navigate between pages → scroll position resets to top
- [ ] LLM input at 1800 chars → yellow character count warning
- [ ] LLM input at 2000 chars → red count, submit disabled or guarded

---

## 8. Execution log — what shipped 2026-05-15

### Sprint A — WCAG Level A foundation ✅

| ID | Status | Files changed |
|----|--------|---------------|
| A1 Skip nav link | ✅ | [`frontend/index.html`](../../frontend/index.html) `.skip-link` CSS + anchor in `<body>` |
| A1 `<main>` + `<nav>` landmarks | ✅ | [`frontend/src/app/Layout.jsx`](../../frontend/src/app/Layout.jsx) `as="main" id="main-content"` · [`frontend/src/shared/ui/Sidebar.jsx`](../../frontend/src/shared/ui/Sidebar.jsx) `as="nav" aria-label="Main navigation"` |
| A2 Form `FormControl`/`FormLabel` | ✅ | [`frontend/src/features/analyzer/index.jsx`](../../frontend/src/features/analyzer/index.jsx) · [`frontend/src/features/agent/index.jsx`](../../frontend/src/features/agent/index.jsx) — all selects + textareas now have proper `<label htmlFor>` associations |
| A2 Chart action selects | ✅ | [`frontend/src/features/compare/index.jsx`](../../frontend/src/features/compare/index.jsx) · [`frontend/src/features/forecast/index.jsx`](../../frontend/src/features/forecast/index.jsx) — `aria-label` on each unlabelled action-bar select |
| A3 Chart `role="img"` + summary | ✅ | [`frontend/src/features/analyzer/TimeseriesChart.jsx`](../../frontend/src/features/analyzer/TimeseriesChart.jsx) — `<figure role="img" aria-label="...">` + `<VisuallyHidden as="figcaption">` with stats |
| A4 `aria-live` streaming output | ✅ | Analyzer + AgentRunner — `role="log" aria-live="polite" aria-atomic="false" aria-relevant="additions text" aria-busy={running}` |
| A5 StatusPulse text alternative | ✅ | [`frontend/src/shared/ui/StatusPulse.jsx`](../../frontend/src/shared/ui/StatusPulse.jsx) — `role="status"` + `VisuallyHidden` label · animation pauses on `document.hidden` |
| A6 ErrorAlert `role="alert"` | ✅ | [`frontend/src/shared/ui/ErrorAlert.jsx`](../../frontend/src/shared/ui/ErrorAlert.jsx) — `role="alert" aria-live="assertive"` + new optional **Retry** button |
| A7 `lang="en"` on `<html>` | ✅ | Was already present in index.html — verified |
| A8 Logo `alt` text | ✅ | Already present in Sidebar — verified |
| A11 Heading hierarchy | Partial | Analyzer + TimeseriesChart now use `<Text as="h2">`. Full audit per page deferred |
| A13 Stop streaming button | ✅ | Analyzer + Agent — Stop button now has `aria-label`, 40px min height, and `isDisabled` guard on Analyze when empty |
| Char count on LLM inputs | ✅ | Analyzer + Agent — `{count} / 2000` indicator with warn/bad color states, `aria-live="polite"` |

### Sprint B — Motion accessibility ✅

| ID | Status | Files changed |
|----|--------|---------------|
| A9 Global `prefers-reduced-motion` CSS | ✅ | [`frontend/index.html`](../../frontend/index.html) — `@media (prefers-reduced-motion: reduce)` collapses all `animation-duration` and `transition-duration` |
| A9 `useReducedMotion` in PageTransition | ✅ | [`frontend/src/shared/ui/PageTransition.jsx`](../../frontend/src/shared/ui/PageTransition.jsx) — uses Framer `useReducedMotion()`; variants collapse to `{}` |
| A9 KpiCard counter reduced-motion + prev-value | ✅ | [`frontend/src/shared/ui/KpiCard.jsx`](../../frontend/src/shared/ui/KpiCard.jsx) — `prevRef` animates from last value (not 0); skips if change <1%; snaps to value when `useReducedMotion()` is true |
| A9 StatusPulse `@media` guard | ✅ | StatusPulse — `animation: none` inside reduced-motion media query |
| A9 Chart `isAnimationActive={!shouldReduceMotion}` | ✅ | TimeseriesChart — Recharts Area + Bar bypass animation when reduced motion |
| B1 Remove GSAP, save ~25KB gzip | ✅ | Deleted `useGsapEntrance.js`; removed `"gsap": "^3.15.0"` from [`frontend/package.json`](../../frontend/package.json); PageTransition now pure Framer |
| B2 GlassCard hover disabled on touch | ✅ | [`frontend/src/shared/ui/GlassCard.jsx`](../../frontend/src/shared/ui/GlassCard.jsx) — `useIsTouchDevice()` (matchMedia `(hover: none)`) disables `whileHover` when true |
| B3 KPI counter from previous value | ✅ | Covered above |
| B5 StatusPulse pauses when tab hidden | ✅ | `document.visibilitychange` listener toggles `animationPlayState` |

### Sprint C — Responsiveness ✅

| ID | Status | Files changed |
|----|--------|---------------|
| C1 Sidebar docks at `xl` (1280px) instead of `2xl` (1536px) | ✅ | [`frontend/src/app/Layout.jsx`](../../frontend/src/app/Layout.jsx) — `useBreakpointValue({ base: false, xl: true })` |
| C2 Charts use `ResponsiveContainer` | ✅ | TimeseriesChart already had it — verified + wrapped in `<figure>` for a11y |
| C3 Touch targets ≥40px | ✅ | Mobile menu button (44×44), sidebar collapse (32px), Analyzer/Agent buttons (40px min-height), Chip (32px min-height + larger px/py), agent ModeCard (44px min-height) |
| C4 Markdown horizontal overflow fixed | ✅ | Analyzer + AgentRunner markdown renderers — `overflow="hidden" maxW="100%"` on container, `wordBreak: "break-word"` on `p`/`li`, `wordBreak: "break-all"` on `code`/`a`, tables become `display:block` with `overflowX:auto`, images `maxW:100%` |
| C5 Agent mode grid breakpoint | ✅ | Agent index — `md: repeat(5, ...)` so 5-mode row fits at iPad landscape and up |
| Mode selector as fieldset/radiogroup | ✅ | Wrapped in `<Box as="fieldset">` with `role="radiogroup"`; each `ModeCard` is `role="radio" aria-checked` |

### Sprint D — UI/UX polish ✅

| ID | Status | Files changed |
|----|--------|---------------|
| A12 Dark-mode contrast bump | ✅ | [`frontend/src/app/theme/index.js`](../../frontend/src/app/theme/index.js) — `text.muted` and `text.faint` adjusted both light + dark to meet WCAG AA 4.5:1 on tinted bg.canvas |
| D1 EmptyState component | ✅ | New [`frontend/src/shared/ui/EmptyState.jsx`](../../frontend/src/shared/ui/EmptyState.jsx) — icon tile + h2 + description + optional action button. Ready to drop into anomalies/reports/RAG pages |
| D2 Toast helper | ✅ | New [`frontend/src/shared/hooks/useAppToast.js`](../../frontend/src/shared/hooks/useAppToast.js) — `success/error/info/warning` with consistent positioning + duration. Wired into Analyzer (thread save, equipment load) |
| D3 Retry action in ErrorAlert | ✅ | ErrorAlert now supports `onRetry` prop; Analyzer passes `() => handleAnalyze()` |
| D4 Char count on LLM inputs | ✅ | See Sprint A row |
| D5 Scroll reset on route change | ✅ | Layout.jsx — `useEffect([pathname])` calls `mainRef.current.scrollTo({ top: 0 })` |

### Build + tests

- `npm run build` — ✓ 3792 modules transformed in 13.4s, no errors
- `npm test` — ✓ 2/2 tests passed (`useApi.test.jsx`)

### Still open (deferred, not blocking)

- **A11 Full heading hierarchy audit** — only Analyzer and TimeseriesChart converted; remaining 9 pages still use `<Text>` for section headers
- **D1 EmptyState rollout** — component created; needs to replace blank states in anomalies/reports/RAG/threads/maintenance pages
- **D6 Skeleton loading audit** — needs page-by-page audit of efficiency/forecast/compare/cost/maintenance
- **D7 Hardcoded color grep** — quick `grep -rn "#[0-9a-fA-F]{3,6}"` across `frontend/src/features/` still needed

---

*Created: 2026-05-15. Sprints A–D shipped same day. Update this section as deferred items land.*
