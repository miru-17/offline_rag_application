import { useCallback, useEffect, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

/* =========================================================
   TOAST STORE
   Usage anywhere:  toast.success("Saved")
   ========================================================= */

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let listeners: ToastListener[] = [];
let toastQueue: ToastItem[] = [];

const MAX_VISIBLE = 4;
const EXIT_MS = 180;

const notifyListeners = () => {
  listeners.forEach((listener) => listener([...toastQueue]));
};

export const toast = {
  show(message: string, type: ToastType = "info", duration = 4000) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    toastQueue = [...toastQueue, { id, message, type, duration }].slice(-MAX_VISIBLE);
    notifyListeners();

    // Safety net: the toast animates itself out, this guarantees removal.
    if (duration > 0) {
      setTimeout(() => toast.dismiss(id), duration + EXIT_MS + 400);
    }
  },

  success(message: string, duration?: number) {
    this.show(message, "success", duration);
  },

  error(message: string, duration?: number) {
    this.show(message, "error", duration ?? 6000);
  },

  info(message: string, duration?: number) {
    this.show(message, "info", duration);
  },

  warning(message: string, duration?: number) {
    this.show(message, "warning", duration);
  },

  dismiss(id: string) {
    toastQueue = toastQueue.filter((item) => item.id !== id);
    notifyListeners();
  },
};

/* =========================================================
   SINGLE TOAST
   ========================================================= */

const ICONS: Record<ToastType, typeof InfoRoundedIcon> = {
  success: CheckCircleRoundedIcon,
  error: ErrorRoundedIcon,
  warning: WarningRoundedIcon,
  info: InfoRoundedIcon,
};

function SingleToast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const Icon = ICONS[item.type];
  const duration = item.duration ?? 4000;

  const dismiss = useCallback(() => {
    setExiting(true);
    window.setTimeout(() => onDismiss(item.id), EXIT_MS);
  }, [item.id, onDismiss]);

  useEffect(() => {
    if (duration <= 0 || paused) return;
    const id = window.setTimeout(dismiss, duration);
    return () => window.clearTimeout(id);
  }, [duration, paused, dismiss]);

  return (
    <Box
      role={item.type === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      sx={(theme) => {
        const t = theme.palette.rag;
        const accent = {
          success: t.success,
          error: t.danger,
          warning: t.warning,
          info: t.primary,
        }[item.type];

        return {
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-start",
          gap: 1.25,
          width: { xs: "calc(100vw - 32px)", sm: 360 },
          pl: 1.75,
          pr: 1,
          py: 1.4,
          borderRadius: "12px",
          bgcolor: t.surfaceGlass,
          backdropFilter: "blur(16px) saturate(140%)",
          border: `1px solid ${t.line}`,
          boxShadow: t.shadowLg,
          animation: exiting
            ? `ragToastOut ${EXIT_MS}ms ease-in both`
            : "ragToastIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both",
          "& .toast-icon": { color: accent, fontSize: 18, mt: "1px" },
          "&::after":
            duration > 0
              ? {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  height: 2,
                  width: "100%",
                  bgcolor: accent,
                  opacity: 0.55,
                  transformOrigin: "left",
                  animation: `ragToastTimer ${duration}ms linear forwards`,
                  animationPlayState: paused ? "paused" : "running",
                }
              : {},
          "@keyframes ragToastTimer": {
            from: { transform: "scaleX(1)" },
            to: { transform: "scaleX(0)" },
          },
        };
      }}
    >
      <Icon className="toast-icon" />
      <Typography
        variant="body2"
        sx={{ flex: 1, fontWeight: 500, color: "text.primary", lineHeight: 1.45, pt: "1px" }}
      >
        {item.message}
      </Typography>
      <IconButton
        size="small"
        onClick={dismiss}
        aria-label="Dismiss notification"
        sx={{ width: 24, height: 24, mt: -0.25 }}
      >
        <CloseRoundedIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Box>
  );
}

/* =========================================================
   CONTAINER — mount once (AppLayout)
   ========================================================= */

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: ToastListener = (items) => setToasts(items);
    listeners.push(listener);
    setToasts([...toastQueue]);
    return () => {
      listeners = listeners.filter((existing) => existing !== listener);
    };
  }, []);

  const handleDismiss = useCallback((id: string) => toast.dismiss(id), []);

  if (toasts.length === 0) return null;

  return (
    <Box
      aria-live="polite"
      sx={{
        position: "fixed",
        bottom: { xs: 16, sm: 24 },
        right: { xs: 16, sm: 24 },
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        alignItems: "flex-end",
      }}
    >
      {toasts.map((item) => (
        <SingleToast key={item.id} item={item} onDismiss={handleDismiss} />
      ))}
    </Box>
  );
}
