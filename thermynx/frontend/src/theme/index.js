import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
  colors: {
    brand: {
      50: "#e0f2f1",
      100: "#b2dfdb",
      200: "#80cbc4",
      300: "#4db6ac",
      400: "#26a69a",
      500: "#009688", // Primary Cyan/Teal
      600: "#00897b",
      700: "#00796b",
      800: "#00695c",
      900: "#004d40",
    },
    bg: {
      main: "#F8FAFC",
      surface: "#FFFFFF",
    },
    text: {
      primary: "#1A202C",
      secondary: "#718096",
    }
  },
  fonts: {
    heading: "'Inter', sans-serif",
    body: "'Inter', sans-serif",
  },
  styles: {
    global: {
      body: {
        bg: "bg.main",
        color: "text.primary",
      },
    },
  },
  components: {
    Card: {
      baseStyle: {
        container: {
          boxShadow: "sm",
          borderRadius: "xl",
          bg: "bg.surface",
        }
      }
    },
    Button: {
      defaultProps: {
        colorScheme: "brand",
      },
      baseStyle: {
        borderRadius: "md",
        fontWeight: "semibold",
      }
    }
  }
});

export default theme;
