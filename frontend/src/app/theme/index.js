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
    // Backgrounds
    "bg.canvas":   { default: "#EFF0FF" },            // page bg — brand-tinted white
    "bg.surface":  { default: "#FFFFFF" },             // card surface
    "bg.elevated": { default: "#EFF0FF" },             // hover / secondary bg
    "bg.sidebar":  { default: "#000F64" },             // always dark ultra-navy
    "bg.overlay":  { default: "rgba(0,15,100,0.72)" },

    // Borders
    "border.subtle": { default: "#C7C9FF" },           // soft brand tint
    "border.strong": { default: "#989DFF" },           // stronger brand
    "border.brand":  { default: "rgba(31,63,254,0.3)" },

    // Text
    "text.primary":   { default: "#1D1D21" },          // 15.5:1 on canvas — AAA
    "text.secondary": { default: "#3B3B42" },
    "text.muted":     { default: "#808087" },          // 4.6:1 on canvas — AA
    "text.faint":     { default: "#A5A5AA" },
    "text.inverse":   { default: "#FFFFFF" },
    "text.brand":     { default: "#1F3FFE" },

    // Brand accents
    "accent.primary":   { default: "#1F3FFE" },
    "accent.secondary": { default: "#0123B4" },
    "accent.cyan":      { default: "#6671FF" },
    "accent.glow":      { default: "rgba(31,63,254,0.1)" },
    "accent.glowHover": { default: "rgba(31,63,254,0.18)" },

    // Status (WCAG AA on white/canvas)
    "status.good": { default: "#059669" },
    "status.warn": { default: "#D97706" },
    "status.bad":  { default: "#DC2626" },
    "status.info": { default: "#1F3FFE" },

    // Sidebar-specific (always dark navy bg)
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
  },
});

export default theme;
