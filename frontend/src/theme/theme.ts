import { alpha, createTheme } from "@mui/material/styles";

import {
  EASE_OUT,
  FONT_MONO,
  FONT_SANS,
  getTokens,
  type RagTokens,
} from "./tokens";

export type RagentisThemeMode = "light" | "dark";

declare module "@mui/material/styles" {
  interface Palette {
    rag: RagTokens;
  }
  interface PaletteOptions {
    rag?: RagTokens;
  }
}

const createRagentisTheme = (mode: RagentisThemeMode) => {
  const t = getTokens(mode);
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      rag: t,
      primary: {
        main: t.primary,
        contrastText: "#ffffff",
      },
      secondary: {
        main: t.generate,
        contrastText: "#ffffff",
      },
      info: {
        main: t.retrieve,
        contrastText: isDark ? "#04121a" : "#ffffff",
      },
      success: { main: t.success, contrastText: "#ffffff" },
      warning: { main: t.warning, contrastText: "#1a1200" },
      error: { main: t.danger, contrastText: "#ffffff" },
      background: {
        default: t.bg,
        paper: t.surface,
      },
      text: {
        primary: t.text,
        secondary: t.textMuted,
        disabled: t.textFaint,
      },
      divider: t.line,
      action: {
        hover: isDark ? "rgba(140,165,210,0.06)" : "rgba(14,22,40,0.035)",
        selected: t.primarySoft,
        focus: t.primarySoft,
      },
    },

    shape: { borderRadius: 10 },

    typography: {
      fontFamily: FONT_SANS,
      h1: { fontWeight: 650, letterSpacing: "-0.035em" },
      h2: { fontWeight: 650, letterSpacing: "-0.03em" },
      h3: { fontWeight: 650, letterSpacing: "-0.03em" },
      h4: { fontWeight: 620, fontSize: "1.75rem", letterSpacing: "-0.025em", lineHeight: 1.2 },
      h5: { fontWeight: 620, fontSize: "1.3rem", letterSpacing: "-0.02em", lineHeight: 1.25 },
      h6: { fontWeight: 600, fontSize: "1.0625rem", letterSpacing: "-0.012em", lineHeight: 1.3 },
      subtitle1: { fontWeight: 560, fontSize: "0.9375rem", letterSpacing: "-0.006em" },
      subtitle2: { fontWeight: 560, fontSize: "0.8125rem", letterSpacing: "-0.003em" },
      body1: { fontSize: "0.9375rem", lineHeight: 1.6 },
      body2: { fontSize: "0.8125rem", lineHeight: 1.55 },
      caption: { fontSize: "0.75rem", lineHeight: 1.45 },
      overline: {
        fontSize: "0.75rem",
        fontWeight: 560,
        letterSpacing: "0",
        textTransform: "none",
        lineHeight: 1.4,
      },
      button: {
        textTransform: "none",
        fontWeight: 560,
        letterSpacing: "-0.003em",
      },
    },

    transitions: {
      easing: {
        easeOut: EASE_OUT,
      },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ":root": {
            colorScheme: mode,
          },
          body: {
            backgroundColor: t.bg,
            backgroundImage: t.bgGlow,
            backgroundAttachment: "fixed",
            color: t.text,
            fontFeatureSettings: '"ss01", "cv11"',
          },
          "code, pre, kbd, .font-mono": {
            fontFamily: FONT_MONO,
          },
          "::selection": {
            background: alpha(t.primary, 0.3),
          },
          ':where(a, button, [role="button"], [role="radio"], [role="option"], [role="tab"]):focus-visible': {
            outline: "none",
            boxShadow: t.focus,
            borderRadius: 6,
          },
        },
      },

      // MUI v9 no longer maps the `color` prop on Typography to theme colours,
      // so keep `color="text.secondary"` (used across pages) working via variants.
      MuiTypography: {
        variants: [
          { props: { color: "text.secondary" }, style: { color: t.textMuted } },
          { props: { color: "text.disabled" }, style: { color: t.textFaint } },
          { props: { color: "text.primary" }, style: { color: t.text } },
        ],
      },

      MuiButtonBase: {
        defaultProps: { disableRipple: true },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 9,
            padding: "7px 14px",
            fontSize: "0.8125rem",
            transition: `background-color 150ms ${EASE_OUT}, border-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, box-shadow 150ms ${EASE_OUT}, transform 90ms ease`,
            "&:active": { transform: "scale(0.98)" },
            "&.Mui-focusVisible": { boxShadow: t.focus },
          },
          sizeLarge: { padding: "10px 18px", fontSize: "0.875rem" },
          sizeSmall: { padding: "5px 10px", fontSize: "0.78rem", borderRadius: 8 },
          contained: ({ ownerState }) => {
            const key = (ownerState.color ?? "primary") as "primary" | "secondary" | "error" | "success" | "warning" | "info";
            const base =
              key === "error" ? t.danger
              : key === "success" ? t.success
              : key === "warning" ? t.warning
              : key === "info" ? t.retrieve
              : key === "secondary" ? t.generate
              : t.primary;
            return {
              backgroundColor: base,
              backgroundImage: `linear-gradient(180deg, ${alpha("#ffffff", 0.14)} 0%, ${alpha("#ffffff", 0)} 100%)`,
              boxShadow: `0 1px 0 ${alpha("#ffffff", 0.18)} inset, 0 6px 16px -8px ${alpha(base, 0.7)}`,
              "&:hover": {
                backgroundColor: alpha(base, 0.88),
                boxShadow: `0 1px 0 ${alpha("#ffffff", 0.18)} inset, 0 8px 22px -8px ${alpha(base, 0.85)}`,
              },
              "&.Mui-disabled": {
                backgroundImage: "none",
                boxShadow: "none",
                backgroundColor: t.raised,
                color: t.textFaint,
              },
            };
          },
          outlined: {
            borderColor: t.lineStrong,
            color: t.text,
            backgroundColor: isDark ? "rgba(140,165,210,0.03)" : t.surface,
            "&:hover": {
              borderColor: alpha(t.primary, 0.5),
              backgroundColor: t.primarySoft,
            },
          },
          text: {
            color: t.textMuted,
            "&:hover": { color: t.text, backgroundColor: isDark ? "rgba(140,165,210,0.07)" : "rgba(14,22,40,0.04)" },
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            color: t.textMuted,
            transition: `background-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, transform 90ms ease`,
            "&:hover": {
              color: t.text,
              backgroundColor: isDark ? "rgba(140,165,210,0.08)" : "rgba(14,22,40,0.05)",
            },
            "&:active": { transform: "scale(0.94)" },
            "&.Mui-focusVisible": { boxShadow: t.focus },
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadow,
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 7,
            fontWeight: 540,
            fontSize: "0.72rem",
            height: 24,
          },
          sizeSmall: { height: 22 },
          outlined: { borderColor: t.lineStrong },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${t.line}`,
            padding: "12px 16px",
            fontSize: "0.8125rem",
          },
          head: {
            fontWeight: 540,
            fontSize: "0.75rem",
            color: t.textMuted,
            backgroundColor: "transparent",
            paddingTop: 10,
            paddingBottom: 10,
          },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            backgroundColor: isDark ? "rgba(140,165,210,0.04)" : t.surface,
            transition: `box-shadow 150ms ${EASE_OUT}`,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: t.line },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: t.lineStrong },
            "&.Mui-focused": { boxShadow: t.focus },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: t.primary,
              borderWidth: 1,
            },
          },
          input: { fontSize: "0.875rem" },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: `1px solid ${t.line}`,
            backgroundColor: t.surface,
            boxShadow: t.shadowLg,
          },
        },
      },

      MuiBackdrop: {
        styleOverrides: {
          root: {
            "&:not(.MuiBackdrop-invisible)": {
              backgroundColor: isDark ? "rgba(3,6,12,0.66)" : "rgba(14,22,40,0.32)",
              backdropFilter: "blur(4px)",
            },
          },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: t.surface,
            borderColor: t.line,
          },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            marginTop: 6,
            borderRadius: 12,
            border: `1px solid ${t.line}`,
            backgroundColor: t.surface,
            boxShadow: t.shadowLg,
          },
          list: { padding: 6 },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontSize: "0.8125rem",
            minHeight: 36,
          },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: false, enterDelay: 300 },
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? "#1A2438" : "#0E1628",
            color: "#F1F4FA",
            fontSize: "0.72rem",
            fontWeight: 500,
            borderRadius: 7,
            padding: "6px 9px",
            border: `1px solid ${isDark ? "rgba(140,165,210,0.16)" : "transparent"}`,
            boxShadow: "0 8px 20px -6px rgba(0,0,0,0.4)",
          },
        },
      },

      MuiSkeleton: {
        defaultProps: { animation: "wave" },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "rgba(140,165,210,0.08)" : "rgba(14,22,40,0.06)",
          },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: {
            height: 4,
            borderRadius: 4,
            backgroundColor: isDark ? "rgba(140,165,210,0.12)" : "rgba(14,22,40,0.08)",
          },
          bar: { borderRadius: 4 },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            fontSize: "0.8125rem",
            alignItems: "center",
          },
        },
        variants: [
        ...(["error", "success", "info", "warning"] as const).map((severity) => {
          const color = { error: t.danger, success: t.success, info: t.primary, warning: t.warning }[severity];
          const soft = { error: t.dangerSoft, success: t.successSoft, info: t.primarySoft, warning: t.warningSoft }[severity];
          return {
            props: { severity, variant: "standard" as const },
            style: {
              backgroundColor: soft,
              color: t.text,
              border: `1px solid ${alpha(color, 0.3)}`,
              "& .MuiAlert-icon": { color },
            },
          };
        }),
        ],
      },

      MuiDivider: {
        styleOverrides: { root: { borderColor: t.line } },
      },

      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            "&.Mui-checked + .MuiSwitch-track": { opacity: 1 },
          },
          track: { backgroundColor: t.lineStrong, opacity: 1 },
        },
      },
    },
  });
};

export default createRagentisTheme;
