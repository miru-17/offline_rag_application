import { useState } from "react";
import {
  Avatar,
  Box,
  ButtonBase,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";

import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { useAppearance } from "../../context/AppearanceContext";
import { findNavItem } from "./navigation";

interface TopbarProps {
  leftOffset: number;
  onMenuClick: () => void;
  onOpenCommand: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  USER: "Member",
  VIEWER: "Viewer",
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export default function Topbar({ leftOffset, onMenuClick, onOpenCommand }: TopbarProps) {
  const { user, logout } = useAuth();
  const { settings, setTheme } = useAppearance();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const current = findNavItem(location.pathname);
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : "··";
  const roleLabel = user?.role ? ROLE_LABEL[user.role] ?? user.role : "";
  const isDark = settings.theme === "dark";

  return (
    <Box
      component="header"
      sx={(theme) => ({
        position: "fixed",
        top: 0,
        right: 0,
        left: { xs: 0, md: leftOffset },
        height: 64,
        zIndex: theme.zIndex.appBar,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: { xs: 2, md: 3 },
        bgcolor: theme.palette.rag.surfaceGlass,
        backdropFilter: "blur(18px) saturate(140%)",
        borderBottom: `1px solid ${theme.palette.rag.line}`,
        transition: "left 240ms cubic-bezier(0.16, 1, 0.3, 1)",
      })}
    >
      <IconButton
        onClick={onMenuClick}
        aria-label="Open navigation"
        sx={{ display: { md: "none" }, ml: -0.5 }}
      >
        <MenuRoundedIcon />
      </IconButton>

      {/* Location */}
      <Box sx={{ minWidth: 0, flexShrink: 1 }}>
        <Typography
          noWrap
          sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.2, display: { xs: "none", sm: "block" } }}
        >
          {user?.tenant_name ?? "RAGENTIS"}
        </Typography>
        <Typography noWrap sx={{ fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.3 }}>
          {current?.label ?? "RAGENTIS"}
        </Typography>
      </Box>

      <Box sx={{ flex: 1 }} />

      {/* Command search */}
      <ButtonBase
        onClick={onOpenCommand}
        aria-label="Search and commands"
        sx={(theme) => ({
          display: { xs: "none", sm: "flex" },
          alignItems: "center",
          gap: 1,
          width: { sm: 220, lg: 300 },
          height: 36,
          px: 1.25,
          borderRadius: "10px",
          color: "text.secondary",
          bgcolor: theme.palette.rag.raised,
          border: `1px solid ${theme.palette.rag.line}`,
          transition: "border-color 150ms ease, background-color 150ms ease",
          "&:hover": { borderColor: theme.palette.rag.lineStrong },
          "&.Mui-focusVisible": { boxShadow: theme.palette.rag.focus },
        })}
      >
        <SearchRoundedIcon sx={{ fontSize: 18 }} />
        <Typography sx={{ fontSize: "0.8125rem", flex: 1, textAlign: "left" }}>
          Search or ask…
        </Typography>
        <Box
          component="kbd"
          sx={(theme) => ({
            fontSize: "0.6875rem",
            px: 0.75,
            borderRadius: "5px",
            border: `1px solid ${theme.palette.rag.line}`,
            bgcolor: theme.palette.rag.surface,
            lineHeight: "18px",
          })}
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </Box>
      </ButtonBase>

      <IconButton
        onClick={onOpenCommand}
        aria-label="Search and commands"
        sx={{ display: { xs: "inline-flex", sm: "none" } }}
      >
        <SearchRoundedIcon />
      </IconButton>

      <Tooltip title={isDark ? "Light theme" : "Dark theme"}>
        <IconButton
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Toggle theme"
          sx={{ "& svg": { transition: "transform 400ms cubic-bezier(0.16,1,0.3,1)" }, "&:hover svg": { transform: "rotate(-25deg)" } }}
        >
          {isDark ? <LightModeOutlinedIcon sx={{ fontSize: 19 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 19 }} />}
        </IconButton>
      </Tooltip>

      {/* Profile */}
      {user && (
        <>
          <ButtonBase
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            aria-label="Account menu"
            aria-haspopup="menu"
            sx={(theme) => ({
              gap: 1,
              pl: 0.5,
              pr: { xs: 0.5, md: 1 },
              py: 0.5,
              borderRadius: "11px",
              transition: "background-color 150ms ease",
              "&:hover": { bgcolor: theme.palette.action.hover },
              "&.Mui-focusVisible": { boxShadow: theme.palette.rag.focus },
            })}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#fff",
                background: "linear-gradient(140deg, #3F6BFF, #6A5CFF)",
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ display: { xs: "none", md: "block" }, textAlign: "left" }}>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 560, lineHeight: 1.2 }}>
                {user.username}
              </Typography>
              <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary", lineHeight: 1.2 }}>
                {roleLabel}
              </Typography>
            </Box>
            <KeyboardArrowDownRoundedIcon
              sx={{ fontSize: 16, color: "text.secondary", display: { xs: "none", md: "block" } }}
            />
          </ButtonBase>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { width: 260 } } }}
          >
            <Box sx={{ px: 1.25, pt: 1, pb: 1.25 }}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>{user.username}</Typography>
              <Typography noWrap sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                {user.email}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
                <Box
                  component="span"
                  sx={(theme) => ({
                    fontSize: "0.6875rem",
                    fontWeight: 560,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: "6px",
                    color: theme.palette.rag.primary,
                    bgcolor: theme.palette.rag.primarySoft,
                  })}
                >
                  {roleLabel}
                </Box>
                <Box
                  component="span"
                  sx={(theme) => ({
                    fontSize: "0.6875rem",
                    px: 0.75,
                    py: 0.25,
                    borderRadius: "6px",
                    color: "text.secondary",
                    bgcolor: theme.palette.rag.raised,
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  })}
                >
                  {user.tenant_name}
                </Box>
              </Box>
            </Box>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                navigate("/settings");
              }}
            >
              <ListItemIcon>
                <TuneOutlinedIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                logout();
              }}
              sx={{ color: "error.main" }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <LogoutRoundedIcon fontSize="small" />
              </ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );
}
