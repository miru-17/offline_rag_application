import { useState } from "react";
import { Box, Toolbar } from "@mui/material";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useAppearance } from "../../context/AppearanceContext";

const DRAWER_WIDTH = 260;

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const { settings } = useAppearance();

  const compact = settings.compact;

  const handleMenuClick = () => {
    setMobileOpen((current) => !current);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
      }}
    >
      <Topbar
        drawerWidth={DRAWER_WIDTH}
        onMenuClick={handleMenuClick}
      />

      <Sidebar
        open={mobileOpen}
        onClose={handleDrawerClose}
        drawerWidth={DRAWER_WIDTH}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,

          width: {
            xs: "100%",
            md: `calc(100% - ${DRAWER_WIDTH}px)`,
          },

          minHeight: "100vh",

          bgcolor: "background.default",

          transition: settings.animations
            ? "padding 180ms ease, margin 180ms ease"
            : "none",
        }}
      >
        <Toolbar
          sx={{
            minHeight: compact ? 64 : 72,
          }}
        />

        <Box
          sx={{
            p: {
              xs: compact ? 1.5 : 2,
              sm: compact ? 2 : 3,
              lg: compact ? 2.5 : 4,
            },

            transition: settings.animations
              ? "padding 180ms ease"
              : "none",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}