import { useCallback, useEffect, useState } from "react";
import { Box } from "@mui/material";
import { Outlet, useLocation } from "react-router-dom";

import Sidebar, { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from "./Sidebar";
import Topbar from "./Topbar";
import LicenseBanner from "./LicenseBanner";
import CommandPalette from "./CommandPalette";
import { useAppearance } from "../../context/AppearanceContext";
import { ToastContainer } from "../common/Toast";

const COLLAPSE_KEY = "ragentis_sidebar_collapsed";

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

/** Pages that manage their own full-height layout. */
const FULL_HEIGHT_ROUTES = ["/ai-workspace"];

export default function AppLayout() {
  const location = useLocation();
  const { settings } = useAppearance();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [commandOpen, setCommandOpen] = useState(false);

  const compact = settings.compact;
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const fullHeight = FULL_HEIGHT_ROUTES.includes(location.pathname);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable: keep in memory only */
      }
      return next;
    });
  }, []);

  // Ctrl/⌘ + K opens the command palette; Ctrl/⌘ + B toggles the sidebar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      } else if (key === "b") {
        event.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  return (
    <Box sx={{ minHeight: "100vh", position: "relative" }}>
      {/* Ambient background: one slow-moving glow, purely decorative */}
      <Box
        aria-hidden
        sx={(theme) => ({
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            width: "60vw",
            height: "60vw",
            top: "-25vw",
            right: "-15vw",
            borderRadius: "50%",
            background: `radial-gradient(closest-side, ${theme.palette.rag.generateSoft}, transparent)`,
            filter: "blur(20px)",
            animation: "ragDrift 38s ease-in-out infinite",
          },
        })}
      />

      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      <Topbar
        leftOffset={sidebarWidth}
        onMenuClick={() => setMobileOpen(true)}
        onOpenCommand={() => setCommandOpen(true)}
      />

      <Box
        component="main"
        sx={{
          position: "relative",
          zIndex: 1,
          ml: { xs: 0, md: `${sidebarWidth}px` },
          pt: "64px",
          minHeight: "100vh",
          transition: "margin-left 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <Box
          key={location.pathname}
          className="rag-page-enter"
          sx={
            fullHeight
              ? { height: "calc(100vh - 64px)", p: { xs: 1, md: 1.5 } }
              : {
                  maxWidth: 1440,
                  mx: "auto",
                  px: { xs: 2, sm: 3, lg: compact ? 3 : 4 },
                  py: { xs: 2.5, md: compact ? 2.5 : 4 },
                }
          }
        >
          {!fullHeight && <LicenseBanner />}
          <Outlet />
        </Box>
      </Box>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <ToastContainer />
    </Box>
  );
}
