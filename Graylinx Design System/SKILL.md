---
name: Graylinx-design
description: Use this skill to generate well-branded interfaces and assets for Graylinx — HVAC intelligence and operations UX — either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping HVAC operations intelligence interfaces.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

Key files:
- `README.md` — full content fundamentals, visual foundations, iconography
- `colors_and_type.css` — every CSS custom property (drop into any project as a single import)
- `assets/logo.png` — Graylinx wordmark + glyph
- `ui_kits/graylinx-app/` — pixel-faithful recreation of the product (sidebar shell, dashboard, AI analyzer, anomalies, agents) — open `index.html` to see it; lift atoms/screens as starting points
- `preview/` — small HTML cards showing every token and component in isolation

If creating visual artifacts (slides, mocks, throwaway prototypes), copy the assets you need into your output and create static HTML files for the user to view. Always link or inline `colors_and_type.css` so tokens are available.

If working on production code, mirror the patterns from `frontend/src/app/theme/index.js` — Chakra UI with brand-tinted shadows and semantic tokens. The CSS file in this skill is the design-language spec; the Chakra theme is the implementation.

Core rules to never break:
- Primary brand color is **`#1F3FFE`** (or the legacy in-code `#0511F2`). One blue, used decisively for every primary action / focus ring / active state.
- Shadows are **always brand-tinted** (`rgba(31,63,254, …)`), never plain black.
- Iconography is **lucide-react**, stroke width 1.65–2. **Never emoji.**
- Type: **Plus Jakarta Sans** (heading 800, -0.03em), **Inter** (body, tnum), **JetBrains Mono** (code).
- Eyebrow labels are 10px / 700 / uppercase / 0.10em tracking / `text.muted`.
- Sidebar is the only dark surface (`#06091A`); everything else lives on a brand-tinted canvas `#EFF0FF`.
- Voice: technical, calm, declarative. No emoji. No marketing fluff. `·` for inline metadata. `—` for missing data.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions (especially: which product surface, fidelity, prototype vs production), and act as an expert designer who outputs HTML artifacts or production code, depending on the need.
