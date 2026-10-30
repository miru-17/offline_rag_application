import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Box, Dialog, InputBase, Typography } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ContrastRoundedIcon from "@mui/icons-material/ContrastRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import KeyboardReturnRoundedIcon from "@mui/icons-material/KeyboardReturnRounded";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { useAppearance } from "../../context/AppearanceContext";
import { navItemsForRole } from "./navigation";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { settings, setTheme } = useAppearance();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const role = user?.role?.toUpperCase();
  const canUpload = role === "ADMIN" || role === "USER";

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string, state?: unknown) => () => {
      navigate(path, state ? { state } : undefined);
      onClose();
    };

    const list: Command[] = [];
    const trimmed = query.trim();

    if (trimmed) {
      list.push({
        id: "ask",
        group: "Ask",
        label: `Ask: “${trimmed}”`,
        hint: "Opens the AI Workspace with this question",
        icon: <AutoAwesomeOutlinedIcon />,
        run: go("/ai-workspace", { prefill: trimmed }),
      });
    }

    navItemsForRole(user?.role).forEach((item) => {
      list.push({
        id: `nav-${item.path}`,
        group: "Go to",
        label: item.label,
        hint: item.description,
        icon: item.icon,
        run: go(item.path),
      });
    });

    if (canUpload) {
      list.push({
        id: "upload",
        group: "Actions",
        label: "Upload documents",
        hint: "PDF, Word or Excel",
        icon: <UploadFileOutlinedIcon />,
        keywords: "add ingest file pdf docx xlsx",
        run: go("/documents", { openUpload: true }),
      });
    }

    list.push({
      id: "theme",
      group: "Actions",
      label: settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      icon: <ContrastRoundedIcon />,
      keywords: "appearance mode dark light",
      run: () => {
        setTheme(settings.theme === "dark" ? "light" : "dark");
        onClose();
      },
    });

    list.push({
      id: "logout",
      group: "Account",
      label: "Sign out",
      icon: <LogoutRoundedIcon />,
      keywords: "logout exit",
      run: () => {
        onClose();
        logout();
      },
    });

    if (!trimmed) return list;

    const needle = trimmed.toLowerCase();
    return list.filter(
      (cmd) =>
        cmd.id === "ask" ||
        `${cmd.label} ${cmd.hint ?? ""} ${cmd.keywords ?? ""}`.toLowerCase().includes(needle),
    );
  }, [query, user?.role, canUpload, settings.theme, navigate, onClose, setTheme, logout]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, commands.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commands[activeIndex]?.run();
    }
  };

  let lastGroup = "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            alignSelf: "flex-start",
            mt: { xs: 2, sm: "12vh" },
            mx: 2,
            overflow: "hidden",
          },
        },
      }}
    >
      <Box onKeyDown={handleKeyDown}>
        <Box
          sx={(theme) => ({
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            px: 2,
            height: 56,
            borderBottom: `1px solid ${theme.palette.rag.line}`,
          })}
        >
          <SearchRoundedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
          <InputBase
            autoFocus
            fullWidth
            placeholder="Type a command, page, or a question to ask…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputProps={{ "aria-label": "Command search" }}
            sx={{ fontSize: "0.9375rem" }}
          />
          <Box
            component="kbd"
            sx={(theme) => ({
              fontSize: "0.6875rem",
              px: 0.75,
              py: 0.25,
              borderRadius: "5px",
              color: "text.secondary",
              border: `1px solid ${theme.palette.rag.line}`,
            })}
          >
            Esc
          </Box>
        </Box>

        <Box ref={listRef} role="listbox" sx={{ maxHeight: 380, overflowY: "auto", p: 1 }}>
          {commands.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
              No matching commands
            </Typography>
          )}

          {commands.map((cmd, index) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            const active = index === activeIndex;

            return (
              <Box key={cmd.id}>
                {showGroup && (
                  <Typography
                    sx={{ px: 1.25, pt: index === 0 ? 0.5 : 1.25, pb: 0.5, fontSize: "0.72rem", color: "text.disabled" }}
                  >
                    {cmd.group}
                  </Typography>
                )}
                <Box
                  role="option"
                  aria-selected={active}
                  data-index={index}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={cmd.run}
                  sx={(theme) => ({
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1.25,
                    py: 1,
                    borderRadius: "9px",
                    cursor: "pointer",
                    bgcolor: active ? theme.palette.rag.primarySoft : "transparent",
                    "& > svg, & .cmd-icon svg": {
                      fontSize: 18,
                      color: active ? theme.palette.rag.primary : theme.palette.rag.textMuted,
                    },
                  })}
                >
                  <Box className="cmd-icon" sx={{ display: "flex" }}>
                    {cmd.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: "0.8438rem", fontWeight: 500 }}>
                      {cmd.label}
                    </Typography>
                    {cmd.hint && (
                      <Typography noWrap sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                        {cmd.hint}
                      </Typography>
                    )}
                  </Box>
                  {active && <KeyboardReturnRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Dialog>
  );
}
