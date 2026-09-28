import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  CssBaseline,
  ThemeProvider,
} from "@mui/material";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { AppearanceProvider } from "./context/AppearanceContext";
import {
  useAppearance,
} from "./context/AppearanceContext";
import createRagentisTheme from "./theme/theme";

function AppProviders() {
  const { settings } = useAppearance();

  const systemPrefersDark =
    window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

  const isDark =
    settings.theme === "dark" ||
    (settings.theme === "system" &&
      systemPrefersDark);

  const theme = createRagentisTheme(
    isDark ? "dark" : "light",
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppearanceProvider>
        <AppProviders />
      </AppearanceProvider>
    </BrowserRouter>
  </React.StrictMode>,
);