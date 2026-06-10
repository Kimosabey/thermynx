import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Replaces Chakra's color-mode system. The `.dark` class on <html> is set by a
 * no-flash inline script in index.html BEFORE React hydrates; this provider
 * reads that initial state and owns toggling + persistence thereafter.
 *
 * Drop-in shims `useColorMode()` and `useColorModeValue()` keep the legacy
 * call-site shape so ported pages need minimal edits. `useBrand()` switches the
 * THERMYNX (cyan) / OMNYX (pure blue) signature via the `data-brand` attribute.
 */

type ColorMode = "light" | "dark";
type Brand = "thermynx" | "omnyx";

export const COLOR_MODE_STORAGE_KEY = "thermynx-color-mode";

type ColorModeContextValue = {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
  brand: Brand;
  setBrand: (brand: Brand) => void;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function readInitialMode(): ColorMode {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark";
  }
  return "light";
}

function readInitialBrand(): Brand {
  if (typeof document !== "undefined" && document.documentElement.getAttribute("data-brand") === "omnyx") {
    return "omnyx";
  }
  return "thermynx";
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>(readInitialMode);
  const [brand, setBrandState] = useState<Brand>(readInitialBrand);

  const applyMode = useCallback((mode: ColorMode) => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
    } catch {
      /* private mode / storage disabled — non-fatal */
    }
  }, []);

  const setColorMode = useCallback(
    (mode: ColorMode) => {
      setColorModeState(mode);
      applyMode(mode);
    },
    [applyMode],
  );

  const toggleColorMode = useCallback(() => {
    setColorModeState((prev) => {
      const next: ColorMode = prev === "dark" ? "light" : "dark";
      applyMode(next);
      return next;
    });
  }, [applyMode]);

  const setBrand = useCallback((next: Brand) => {
    setBrandState(next);
    document.documentElement.setAttribute("data-brand", next);
  }, []);

  // Sync React state with whatever the pre-hydration inline script applied.
  useEffect(() => {
    setColorModeState(readInitialMode());
    setBrandState(readInitialBrand());
  }, []);

  return (
    <ColorModeContext.Provider
      value={{ colorMode, setColorMode, toggleColorMode, brand, setBrand }}
    >
      {children}
    </ColorModeContext.Provider>
  );
}

function useColorModeContext(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext);
  if (!ctx) {
    throw new Error("useColorMode must be used within a <ColorModeProvider>");
  }
  return ctx;
}

/** Drop-in replacement for Chakra's `useColorMode()`. */
export function useColorMode() {
  const { colorMode, setColorMode, toggleColorMode } = useColorModeContext();
  return { colorMode, setColorMode, toggleColorMode };
}

/** Drop-in replacement for Chakra's `useColorModeValue(light, dark)`. */
export function useColorModeValue<Light, Dark>(light: Light, dark: Dark): Light | Dark {
  const { colorMode } = useColorModeContext();
  return colorMode === "dark" ? dark : light;
}

/** THERMYNX (cyan) / OMNYX (pure blue) brand signature switch. */
export function useBrand() {
  const { brand, setBrand } = useColorModeContext();
  return { brand, setBrand };
}
