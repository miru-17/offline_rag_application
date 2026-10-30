import {
  Box,
  ButtonBase,
  Drawer,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";

import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { useSystemStatus } from "../../hooks/useSystemStatus";
import BrandMark from "../common/BrandMark";
import StatusDot from "../common/StatusDot";
import { navItemsForRole, type NavItem } from "./navigation";

export const SIDEBAR_WIDTH = 252;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const SECTION_LABEL: Record<NavItem["section"], string | null> = {
  workspace: "Workspace",
  admin: "Administration",
  system: null,
};

function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const button = (
    <ButtonBase
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      sx={(theme) => {
        const t = theme.palette.rag;
        return {
          position: "relative",
          width: "100%",
          height: 40,
          px: collapsed ? 0 : 1.25,
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 1.25,
          borderRadius: "10px",
          color: active ? t.text : t.textMuted,
          bgcolor: active ? t.primarySoft : "transparent",
          transition: "background-color 150ms ease, color 150ms ease",
          "& svg": {
            fontSize: 19,
            color: active ? t.primary : "inherit",
            transition: "color 150ms ease, transform 200ms cubic-bezier(0.16,1,0.3,1)",
          },
          "&:hover": {
            color: t.text,
            bgcolor: active ? t.primarySoft : theme.palette.action.hover,
          },
          "&:hover svg": { transform: active ? "none" : "translateX(1px)" },
          "&.Mui-focusVisible": { boxShadow: t.focus },
          "&::before": {
            content: '""',
            position: "absolute",
            left: -12,
            top: 10,
            bottom: 10,
            width: 3,
            borderRadius: "0 3px 3px 0",
            bgcolor: t.primary,
            boxShadow: `0 0 12px ${t.primary}`,
            transform: active ? "scaleY(1)" : "scaleY(0)",
            transition: "transform 220ms cubic-bezier(0.16,1,0.3,1)",
          },
        };
      }}
    >
      {item.icon}
      {!collapsed && (
        <Typography
          component="span"
          sx={{
            fontSize: "0.8438rem",
            fontWeight: active ? 560 : 480,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {item.label}
        </Typography>
      )}
    </ButtonBase>
  );

  return collapsed ? (
    <Tooltip title={item.label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
  onToggleCollapsed,
  showCollapseControl,
}: {
  collapsed: boolean;
  onNavigate: (path: string) => void;
  onToggleCollapsed?: () => void;
  showCollapseControl: boolean;
}) {
  const location = useLocation();
  const { user } = useAuth();
  const { status, loading, error, allReady, ollamaOnline, modelReady } = useSystemStatus();

  const items = navItemsForRole(user?.role);
  const sections: NavItem["section"][] = ["workspace", "admin", "system"];

  const runtimeTone = loading ? "neutral" : error ? "danger" : allReady ? "success" : "warning";
  const runtimeLabel = loading
    ? "Checking runtime…"
    : error
      ? "API unreachable"
      : allReady
        ? "Model ready"
        : !ollamaOnline
          ? "Ollama offline"
          : !modelReady
            ? "Model not pulled"
            : "Degraded";

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Brand */}
      <Box
        sx={{
          height: 64,
          px: collapsed ? 0 : 2,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          flexShrink: 0,
        }}
      >
        <ButtonBase
          onClick={() => onNavigate("/dashboard")}
          aria-label="RAGENTIS home"
          sx={{ gap: 1.25, borderRadius: "10px", p: 0.5, minWidth: 0 }}
        >
          <BrandMark size={32} />
          {!collapsed && (
            <Box sx={{ textAlign: "left", minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 650,
                  fontSize: "0.95rem",
                  letterSpacing: "0.14em",
                  lineHeight: 1.1,
                }}
              >
                RAGENTIS
              </Typography>
              <Typography
                sx={{ fontSize: "0.6875rem", color: "text.secondary", whiteSpace: "nowrap" }}
              >
                Enterprise knowledge AI
              </Typography>
            </Box>
          )}
        </ButtonBase>
      </Box>

      {/* Navigation */}
      <Box
        component="nav"
        aria-label="Main"
        sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", px: 1.5, pt: 1 }}
      >
        {sections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section);
          if (sectionItems.length === 0) return null;
          const label = SECTION_LABEL[section];

          return (
            <Box key={section} sx={{ mb: 2 }}>
              {label && !collapsed && (
                <Typography
                  sx={{
                    px: 1.25,
                    pb: 0.75,
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    color: "text.disabled",
                  }}
                >
                  {label}
                </Typography>
              )}
              {label && collapsed && (
                <Box sx={(theme) => ({ mx: 2, mb: 1, borderTop: `1px solid ${theme.palette.rag.line}` })} />
              )}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                {sectionItems.map((item) => (
                  <NavButton
                    key={item.path}
                    item={item}
                    collapsed={collapsed}
                    active={
                      location.pathname === item.path ||
                      location.pathname.startsWith(`${item.path}/`)
                    }
                    onClick={() => onNavigate(item.path)}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Runtime + collapse */}
      <Box sx={{ p: 1.5, flexShrink: 0 }}>
        <Tooltip
          title={
            collapsed
              ? `${runtimeLabel}${status?.model ? ` · ${status.model}` : ""}`
              : "Local inference runtime, from /system/status"
          }
          placement={collapsed ? "right" : "top"}
        >
          <Box
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: 1.25,
              p: collapsed ? 1.25 : 1.25,
              borderRadius: "12px",
              bgcolor: theme.palette.rag.raised,
              border: `1px solid ${theme.palette.rag.line}`,
            })}
          >
            <StatusDot tone={runtimeTone} pulse={allReady} />
            {!collapsed && (
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 540, lineHeight: 1.3 }}>
                  {runtimeLabel}
                </Typography>
                <Typography
                  className="font-mono"
                  sx={{
                    fontSize: "0.6875rem",
                    color: "text.secondary",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {status?.model ?? "local model"}
                </Typography>
              </Box>
            )}
          </Box>
        </Tooltip>

        {showCollapseControl && (
          <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
            <IconButton
              onClick={onToggleCollapsed}
              size="small"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              sx={{ mt: 1, width: "100%", height: 32 }}
            >
              {collapsed ? (
                <KeyboardDoubleArrowRightRoundedIcon sx={{ fontSize: 18 }} />
              ) : (
                <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

export default function Sidebar({
  mobileOpen,
  onMobileClose,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
    onMobileClose();
  };

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <>
      {/* Mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            borderRight: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <SidebarContent collapsed={false} onNavigate={handleNavigate} showCollapseControl={false} />
      </Drawer>

      {/* Desktop */}
      <Box
        component="aside"
        sx={(theme) => ({
          display: { xs: "none", md: "block" },
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width,
          zIndex: theme.zIndex.appBar + 1,
          bgcolor: theme.palette.rag.surfaceGlass,
          backdropFilter: "blur(18px) saturate(140%)",
          borderRight: `1px solid ${theme.palette.rag.line}`,
          transition: "width 240ms cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
        })}
      >
        <SidebarContent
          collapsed={collapsed}
          onNavigate={handleNavigate}
          onToggleCollapsed={onToggleCollapsed}
          showCollapseControl
        />
      </Box>
    </>
  );
}
