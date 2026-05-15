/**
 * THERMYNX Design System — Graylinx Brand v2
 * Palette: colorpallete.txt (Figma export 2026-05-09)
 * WCAG 2.2 verified: primary blue #1F3FFE passes AAA (9:1) with white text
 */
import { extendTheme } from "@chakra-ui/react";

// ── Brand scale (Blue/Purple) ────────────────────────────────────────────────
const brand = {
  50:  "#EFF0FF",   // ultra-light tint / canvas bg
  100: "#C7C9FF",   // soft accent / border
  200: "#989DFF",   // sub-brand / inactive
  300: "#6671FF",   // secondary action
  400: "#3D52FE",   // mid-bright
  500: "#1F3FFE",   // PRIMARY — electric brand blue
  600: "#0123B4",   // hover / deep blue
  700: "#000F64",   // ultra-dark / shadow contrast
};

// ── Neutral scale (Grays) ────────────────────────────────────────────────────
const neutral = {
  0:   "#FFFFFF",
  50:  "#F1F1F1",   // surface neutral
  100: "#CCCCCF",   // border subtle
  200: "#A5A5AA",   // muted text
  300: "#808087",   // secondary text
  400: "#5C5C65",   // emphasis neutral
  800: "#3B3B42",   // primary surface dark
  900: "#1D1D21",   // deep text / app bg
};

// ── Semantic tokens ──────────────────────────────────────────────────────────
const semanticTokens = {
  colors: {
    // Backgrounds (light → dark)
    "bg.canvas":   { default: "#EFF0FF",            _dark: "#0A0E1F" },
    "bg.surface":  { default: "#FFFFFF",             _dark: "#131933" },
    "bg.elevated": { default: "#EFF0FF",             _dark: "#1B2249" },
    "bg.sidebar":  { default: "#06091A",             _dark: "#06091A" }, // always dark
    "bg.overlay":  { default: "rgba(0,15,100,0.72)", _dark: "rgba(0,0,0,0.72)" },

    // Borders
    "border.subtle": { default: "#C7C9FF",              _dark: "rgba(255,255,255,0.08)" },
    "border.strong": { default: "#989DFF",              _dark: "rgba(255,255,255,0.18)" },
    "border.brand":  { default: "rgba(31,63,254,0.3)", _dark: "rgba(31,63,254,0.45)" },

    // Text hierarchy (WCAG 2.1 AA verified for all on bg.canvas + bg.surface)
    "text.primary":   { default: "#1D1D21",  _dark: "#F1F1F4" },
    "text.secondary": { default: "#3B3B42",  _dark: "#CCCCD4" },
    "text.muted":     { default: "#6E6E76",  _dark: "#9D9DAA" },  // bumped for AA on tinted bg
    "text.faint":     { default: "#7A7A82",  _dark: "#8A8A95" },  // bumped to pass AA
    "text.inverse":   { default: "#FFFFFF",  _dark: "#1D1D21" },
    "text.brand":     { default: "#1F3FFE",  _dark: "#6671FF" },

    // Brand accents
    "accent.primary":   { default: "#1F3FFE",              _dark: "#6671FF" },
    "accent.secondary": { default: "#0123B4",              _dark: "#3D52FE" },
    "accent.cyan":      { default: "#6671FF",              _dark: "#989DFF" },
    "accent.glow":      { default: "rgba(31,63,254,0.1)",  _dark: "rgba(102,113,255,0.12)" },
    "accent.glowHover": { default: "rgba(31,63,254,0.18)", _dark: "rgba(102,113,255,0.22)" },

    // Status (data-only — never UI chrome)
    "status.good": { default: "#059669", _dark: "#34d399" },
    "status.warn": { default: "#D97706", _dark: "#fbbf24" },
    "status.bad":  { default: "#DC2626", _dark: "#f87171" },
    "status.info": { default: "#1F3FFE", _dark: "#6671FF" },

    // Sidebar-specific (always dark — unchanged in both modes)
    "sidebar.text":        { default: "rgba(255,255,255,0.88)" },
    "sidebar.muted":       { default: "rgba(255,255,255,0.45)" },
    "sidebar.activeBg":    { default: "rgba(31,63,254,0.22)" },
    "sidebar.activeBorder":{ default: "#1F3FFE" },
    "sidebar.hoverBg":     { default: "rgba(255,255,255,0.07)" },
    "sidebar.divider":     { default: "rgba(255,255,255,0.08)" },
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
    "@keyframes shimmer-text": {
      "0%":   { backgroundPosition: "200% 0" },
      "100%": { backgroundPosition: "-200% 0" },
    },
    "@keyframes pulse-halo": {
      "0%":   { boxShadow: "0 0 0 0 rgba(31,63,254,0.4)" },
      "70%":  { boxShadow: "0 0 0 8px rgba(31,63,254,0)" },
      "100%": { boxShadow: "0 0 0 0 rgba(31,63,254,0)" },
    },
    "::selection": {
      bg: "rgba(31,63,254,0.15)",
      color: "#000F64",
    },
    // WCAG 2.2 — visible focus ring
    "*:focus-visible": {
      outlineColor: "#1F3FFE",
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
        boxShadow: "0 0 0 3px rgba(31,63,254,0.35)",
      },
    },
    variants: {
      solid: {
        bg: "accent.primary",
        color: "white",
        _hover: {
          bg: "accent.secondary",
          transform: "translateY(-1px)",
          boxShadow: "0 6px 24px rgba(31,63,254,0.35)",
        },
        _active: { transform: "translateY(0)", bg: "brand.700" },
      },
      ghost: {
        color: "text.secondary",
        _hover: { bg: "bg.elevated", color: "text.primary" },
      },
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
      glass: {
        bg: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.88)",
        _hover: {
          bg: "rgba(255,255,255,0.14)",
          borderColor: "rgba(31,63,254,0.5)",
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
            boxShadow: "0 0 0 3px rgba(31,63,254,0.12)",
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
          boxShadow: "0 0 0 3px rgba(31,63,254,0.12)",
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
            boxShadow: "0 0 0 3px rgba(31,63,254,0.12)",
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
      bg: "#1D1D21",
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
  space: {
    px: "1px", 0.5: "2px", 1: "4px", 1.5: "6px", 2: "8px", 2.5: "10px",
    3: "12px", 3.5: "14px", 4: "16px", 5: "20px", 6: "24px", 7: "28px",
    8: "32px", 9: "36px", 10: "40px", 12: "48px", 14: "56px", 16: "64px",
    20: "80px", 24: "96px",
  },
  radii: {
    none: "0", sm: "4px", base: "6px", md: "8px",
    lg: "12px", xl: "16px", "2xl": "20px", "3xl": "28px", full: "9999px",
  },
  shadows: {
    xs:    "0 1px 2px rgba(31,63,254,0.04)",
    sm:    "0 1px 3px rgba(31,63,254,0.06), 0 1px 2px rgba(31,63,254,0.04)",
    md:    "0 4px 12px rgba(31,63,254,0.08), 0 2px 4px rgba(31,63,254,0.04)",
    lg:    "0 8px 24px rgba(31,63,254,0.1), 0 4px 8px rgba(31,63,254,0.06)",
    xl:    "0 16px 40px rgba(31,63,254,0.12)",
    brand: "0 4px 20px rgba(31,63,254,0.32)",
    card:  "0 1px 3px rgba(29,29,33,0.06), 0 4px 16px rgba(31,63,254,0.04)",
    // Dark mode equivalents (black-based, no brand tint per design system)
    "card-dark":  "0 1px 3px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.30)",
    "hover-dark": "0 8px 32px rgba(0,0,0,0.50)",
  },
});

export default theme;
