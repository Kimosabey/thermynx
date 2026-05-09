import { extendTheme } from "@chakra-ui/react";

const colors = {
  brand: {
    50:  "#e0f9ff",
    100: "#b3f0ff",
    200: "#80e6ff",
    300: "#4ddcff",
    400: "#1ad2ff",
    500: "#00c4f4",
    600: "#009dc3",
    700: "#007692",
    800: "#005061",
    900: "#002a30",
  },
  canvas: {
    900: "#060d1f",
    800: "#0d1526",
    700: "#111f38",
    600: "#162540",
    500: "#1e2d4a",
    400: "#2a3d5c",
    300: "#3a5070",
  },
};

const semanticTokens = {
  colors: {
    "bg.canvas":    { default: "#f8fafc",  _dark: "#060d1f" },
    "bg.surface":   { default: "#ffffff",  _dark: "#0d1526" },
    "bg.elevated":  { default: "#f1f5f9",  _dark: "#111f38" },
    "border.subtle":{ default: "#e2e8f0",  _dark: "#1e2d4a" },
    "border.strong":{ default: "#cbd5e1",  _dark: "#2a3d5c" },
    "text.primary": { default: "#0f172a",  _dark: "#e2e8f0" },
    "text.muted":   { default: "#64748b",  _dark: "#64748b" },
    "text.faint":   { default: "#94a3b8",  _dark: "#334155" },
    "accent.cyan":  { default: "#0284c7",  _dark: "#00c4f4" },
    "accent.glow":  { default: "rgba(2,132,199,0.1)", _dark: "rgba(0,196,244,0.1)" },
  },
};

const config = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

const fonts = {
  heading: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  body:    `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  mono:    `'JetBrains Mono', 'Fira Code', monospace`,
};

const styles = {
  global: (props) => ({
    "@import": `url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap')`,
    "html, body": {
      bg: props.colorMode === "dark" ? "#060d1f" : "#f8fafc",
      color: props.colorMode === "dark" ? "#e2e8f0" : "#0f172a",
      fontFeatureSettings: `"tnum" 1`,
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    },
    "::-webkit-scrollbar": { width: "4px", height: "4px" },
    "::-webkit-scrollbar-track": { bg: "transparent" },
    "::-webkit-scrollbar-thumb": {
      bg: props.colorMode === "dark" ? "#1e2d4a" : "#cbd5e1",
      borderRadius: "full",
    },
  }),
};

const components = {
  Button: {
    baseStyle: {
      fontWeight: 500,
      borderRadius: "10px",
      transition: "all 0.15s ease",
      _focus: { boxShadow: "none" },
    },
    variants: {
      solid: (props) => ({
        bg: "brand.500",
        color: "#060d1f",
        fontWeight: 600,
        _hover: {
          bg: "brand.400",
          transform: "translateY(-1px)",
          boxShadow: "0 4px 20px rgba(0,196,244,0.3)",
        },
        _active: { transform: "translateY(0)", bg: "brand.600" },
      }),
      ghost: (props) => ({
        color: props.colorMode === "dark" ? "whiteAlpha.700" : "gray.600",
        _hover: {
          bg: props.colorMode === "dark" ? "whiteAlpha.100" : "blackAlpha.50",
          color: props.colorMode === "dark" ? "white" : "gray.900",
        },
      }),
      glass: (props) => ({
        bg: props.colorMode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        backdropFilter: "blur(12px)",
        border: "1px solid",
        borderColor: props.colorMode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
        color: props.colorMode === "dark" ? "whiteAlpha.800" : "gray.700",
        _hover: {
          bg: props.colorMode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)",
          transform: "translateY(-1px)",
          borderColor: props.colorMode === "dark" ? "rgba(0,196,244,0.3)" : "rgba(2,132,199,0.3)",
        },
      }),
    },
    defaultProps: { variant: "solid", colorScheme: "brand" },
  },
  Badge: {
    baseStyle: {
      borderRadius: "6px",
      fontWeight: 600,
      letterSpacing: "0.02em",
      textTransform: "none",
    },
  },
};

const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  fonts,
  styles,
  components,
});

export default theme;
