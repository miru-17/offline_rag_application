import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";

// Fonts are bundled locally so the UI renders correctly fully offline.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./index.css";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import {
  AppearanceProvider,
  useAppearance,
} from "./context/AppearanceContext";
import createRagentisTheme from "./theme/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setPrefersDark(event.matches);

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return prefersDark;
}

function AppProviders() {
  const { settings } = useAppearance();
  const systemPrefersDark = useSystemPrefersDark();

  const isDark =
    settings.theme === "dark" ||
    (settings.theme === "system" && systemPrefersDark);

  const theme = useMemo(
    () => createRagentisTheme(isDark ? "dark" : "light"),
    [isDark],
  );

  // Honour the "animations" preference from Settings across the whole app.
  useEffect(() => {
    document.body.classList.toggle(
      "ragentis-no-animations",
      !settings.animations,
    );
  }, [settings.animations]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppearanceProvider>
        <AppProviders />
      </AppearanceProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
