/**
 * Shared brand color constants — single source for the hex values that have to
 * live outside the Chakra theme (canvas/gradient effects, SVG, animations that
 * can't read semantic tokens).
 *
 * THERMYNX keeps the shared Graylinx electric-blue foundation (same as OMNYX)
 * and adds a thermal-cyan SIGNATURE so the sibling product reads as distinct.
 * Use THERMAL_CYAN sparingly — wordmark, page-header icons, accent glows — not
 * as a primary.
 */

// Graylinx Brand v2 — shared with OMNYX
export const BRAND_500 = "#1F3FFE"; // primary electric blue
export const BRAND_300 = "#6671FF"; // light brand
export const BRAND_100 = "#C7C9FF"; // soft tint
export const BRAND_700 = "#000F64"; // ultra-dark

// THERMYNX sibling signature — thermal cyan (cooling/HVAC cue)
export const THERMAL_CYAN = "#06B6D4";      // light-mode cyan
export const THERMAL_CYAN_BRIGHT = "#22D3EE"; // dark-mode / glow cyan
export const THERMAL_CYAN_DEEP = "#0E7490";   // deep cyan for gradient ends

// Common lockup: blue → cyan → blue sheen for the THERMYNX wordmark
export const THERMYNX_SHEEN =
  `linear-gradient(90deg, ${BRAND_500} 0%, ${THERMAL_CYAN} 50%, ${BRAND_500} 100%)`;
