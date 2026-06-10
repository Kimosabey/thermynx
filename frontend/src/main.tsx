import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { ColorModeProvider } from "@/app/theme/ColorModeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import App from "@/app/App";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ColorModeProvider>
      <BrowserRouter>
        <TooltipProvider delayDuration={200}>
          <App />
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </BrowserRouter>
    </ColorModeProvider>
  </StrictMode>,
);
