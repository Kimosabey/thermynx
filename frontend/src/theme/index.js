import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
  fonts: {
    heading: "'Inter', sans-serif",
    body: "'Inter', sans-serif",
  },
  colors: {
    brand: {
      50: "#e0f7ff",
      100: "#b3ecff",
      200: "#80dfff",
      300: "#4dd2ff",
      400: "#1ac5ff",
      500: "#00b8f5",
      600: "#0090c2",
      700: "#006b90",
      800: "#00475f",
      900: "#00232f",
    },
    surface: {
      bg: "#f7f9fc",
      card: "#ffffff",
      sidebar: "#0f172a",
      sidebarHover: "#1e293b",
      border: "#e2e8f0",
    },
  },
  styles: {
    global: {
      body: {
        bg: "surface.bg",
        color: "gray.800",
      },
    },
  },
  components: {
    Button: {
      defaultProps: { colorScheme: "brand" },
      variants: {
        solid: {
          bg: "brand.500",
          color: "white",
          _hover: { bg: "brand.600" },
        },
        ghost: {
          color: "gray.600",
          _hover: { bg: "gray.100" },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: "surface.card",
          borderRadius: "xl",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
          border: "1px solid",
          borderColor: "surface.border",
        },
      },
    },
  },
});

export default theme;
