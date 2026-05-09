/**
 * THERMYNX Design System — Graylinx Brand
 * Extracted from logo: #0511F2, #0433BF, #032CA6, #0455BF, #0D0D0D
 * Mode: light main content + dark navy sidebar
 * WCAG 2.2 compliant contrast ratios
 */
import { extendTheme } from "@chakra-ui/react";

// ── Brand palette (from Graylinx logo) ──────────────────────────────────────
const brand = {
  50:  "#EEF0FF",
  100: "#D5D9FF",
  200: "#A8B0FF",
  300: "#6B78FF",
  400: "#3347FF",
  500: "#0511F2",   // PRIMARY — Graylinx electric blue
  600: "#0433BF",   // SECONDARY
  700: "#032CA6",   // DARK navy
  800: "#0455BF",   // COBALT
  900: "#021A73",
};

// ── Neutral palette ──────────────────────────────────────────────────────────
const neutral = {
  0:   "#FFFFFF",
  50:  "#F4F7FF",   // canvas — slightly blue-tinted white
  100: "#EEF2FF",
  200: "#E0E7FF",
  300: "#C7D2FE",
  400: "#818CF8",
  500: "#64748B",
  600: "#475569",
  700: "#334155",
  800: "#1E293B",
  900: "#0D0D0D",   // from palette
  950: "#06091A",   // sidebar bg
};

// ── Semantic tokens ──────────────────────────────────────────────────────────
const semanticTokens = {
  colors: {
    // Backgrounds
    "bg.canvas":     { default: "#F4F7FF" },    // page bg — light blue-white
    "bg.surface":    { default: "#FFFFFF" },     // cards
    "bg.elevated":   { default: "#EEF2FF" },     // hover, secondary
    "bg.sidebar":    { default: "#06091A" },     // always dark navy
    "bg.overlay":    { default: "rgba(6,9,26,0.7)" },

    // Borders
    "border.subtle": { default: "#E0E7FF" },
    "border.strong": { default: "#C7D2FE" },
    "border.brand":  { default: "rgba(5,17,242,0.3)" },

    // Text
    "text.primary":  { default: "#0D0D0D" },
    "text.secondary":{ default: "#334155" },
    "text.muted":    { default: "#64748B" },
    "text.faint":    { default: "#94A3B8" },
    "text.inverse":  { default: "#FFFFFF" },
    "text.brand":    { default: "#0511F2" },

    // Brand
    "accent.primary":  { default: "#0511F2" },
    "accent.secondary":{ default: "#0433BF" },
    "accent.glow":     { default: "rgba(5,17,242,0.12)" },
    "accent.glowHover":{ default: "rgba(5,17,242,0.2)" },

    // Status (WCAG AA on white)
    "status.good":   { default: "#059669" },
    "status.warn":   { default: "#D97706" },
    "status.bad":    { default: "#DC2626" },
    "status.info":   { default: "#0511F2" },

    // Sidebar-specific (always dark)
    "sidebar.text":       { default: "rgba(255,255,255,0.85)" },
    "sidebar.muted":      { default: "rgba(255,255,255,0.45)" },
    "sidebar.activeBg":   { default: "rgba(5,17,242,0.2)" },
    "sidebar.activeBorder":{ default: "#0511F2" },
    "sidebar.hoverBg":    { default: "rgba(255,255,255,0.07)" },
    "sidebar.divider":    { default: "rgba(255,255,255,0.08)" },
  },
};

const config = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

const fonts = {
  heading: `'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif`,
  body:    `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  mono:    `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`,
};

const styles = {
  global: {
    "html, body": {
      bg: "bg.canvas",
      color: "text.primary",
      fontFeatureSettings: `"tnum" 1, "kern" 1`,
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    },
    "::selection": {
      bg: "rgba(5,17,242,0.15)",
      color: "#032CA6",
    },
    // WCAG 2.2 focus
    "*:focus-visible": {
      outlineColor: "accent.primary",
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineOffset: "2px",
      borderRadius: "4px",
    },
  },
};

const components = {
  Button: {
    baseStyle: {
      fontWeight: 600,
      borderRadius: "10px",
      letterSpacing: "-0.01em",
      transition: "all 0.18s ease",
      _focus: { boxShadow: "none" },
      _focusVisible: {
        boxShadow: "0 0 0 3px rgba(5,17,242,0.35)",
      },
    },
    variants: {
      // Primary CTA — blue pill
      solid: {
        bg: "accent.primary",
        color: "white",
        _hover: {
          bg: "accent.secondary",
          transform: "translateY(-1px)",
          boxShadow: "0 6px 24px rgba(5,17,242,0.35)",
        },
        _active: { transform: "translateY(0)", bg: "brand.700" },
      },
      // Ghost — light bg
      ghost: {
        color: "text.secondary",
        _hover: { bg: "bg.elevated", color: "text.primary" },
      },
      // Outline — brand border
      outline: {
        border: "1.5px solid",
        borderColor: "border.strong",
        color: "text.primary",
        _hover: {
          bg: "bg.elevated",
          borderColor: "accent.primary",
          color: "text.brand",
        },
      },
      // Glass — for sidebar & overlays
      glass: {
        bg: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.85)",
        _hover: {
          bg: "rgba(255,255,255,0.14)",
          borderColor: "rgba(5,17,242,0.5)",
          transform: "translateY(-1px)",
        },
      },
    },
    defaultProps: { variant: "solid" },
  },

  Badge: {
    baseStyle: {
      borderRadius: "6px",
      fontWeight: 600,
      letterSpacing: "0.01em",
      textTransform: "none",
      fontSize: "10px",
    },
  },

  Input: {
    variants: {
      outline: {
        field: {
          bg: "bg.surface",
          borderColor: "border.subtle",
          borderRadius: "10px",
          color: "text.primary",
          _placeholder: { color: "text.muted" },
          _hover: { borderColor: "border.strong" },
          _focus: {
            borderColor: "accent.primary",
            boxShadow: "0 0 0 3px rgba(5,17,242,0.12)",
          },
        },
      },
    },
    defaultProps: { variant: "outline" },
  },

  Textarea: {
    variants: {
      outline: {
        bg: "bg.surface",
        borderColor: "border.subtle",
        borderRadius: "10px",
        color: "text.primary",
        _placeholder: { color: "text.muted" },
        _hover: { borderColor: "border.strong" },
        _focus: {
          borderColor: "accent.primary",
          boxShadow: "0 0 0 3px rgba(5,17,242,0.12)",
        },
      },
    },
    defaultProps: { variant: "outline" },
  },

  Select: {
    variants: {
      outline: {
        field: {
          bg: "bg.surface",
          borderColor: "border.subtle",
          borderRadius: "10px",
          color: "text.primary",
          _hover: { borderColor: "border.strong" },
          _focus: {
            borderColor: "accent.primary",
            boxShadow: "0 0 0 3px rgba(5,17,242,0.12)",
          },
        },
      },
    },
    defaultProps: { variant: "outline" },
  },

  Divider: {
    baseStyle: { borderColor: "border.subtle" },
  },

  Tooltip: {
    baseStyle: {
      bg: "neutral.900",
      color: "white",
      borderRadius: "8px",
      px: 3,
      py: 2,
      fontSize: "xs",
      fontWeight: 500,
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
    },
  },
};

const theme = extendTheme({
  config,
  colors: { brand, neutral },
  semanticTokens,
  fonts,
  styles,
  components,
  space:   { px: "1px", 0.5: "2px", 1: "4px", 1.5: "6px", 2: "8px", 2.5: "10px", 3: "12px", 3.5: "14px", 4: "16px", 5: "20px", 6: "24px", 7: "28px", 8: "32px", 9: "36px", 10: "40px", 12: "48px", 14: "56px", 16: "64px", 20: "80px", 24: "96px" },
  radii:   { none: "0", sm: "4px", base: "6px", md: "8px", lg: "12px", xl: "16px", "2xl": "20px", "3xl": "28px", full: "9999px" },
  shadows: {
    xs:   "0 1px 2px rgba(5,17,242,0.04)",
    sm:   "0 1px 3px rgba(5,17,242,0.06), 0 1px 2px rgba(5,17,242,0.04)",
    md:   "0 4px 12px rgba(5,17,242,0.08), 0 2px 4px rgba(5,17,242,0.04)",
    lg:   "0 8px 24px rgba(5,17,242,0.1), 0 4px 8px rgba(5,17,242,0.06)",
    xl:   "0 16px 40px rgba(5,17,242,0.12)",
    brand:"0 4px 20px rgba(5,17,242,0.3)",
    card: "0 1px 3px rgba(13,13,13,0.06), 0 4px 16px rgba(5,17,242,0.04)",
  },
});

export default theme;
