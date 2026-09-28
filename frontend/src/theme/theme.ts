import { createTheme } from "@mui/material/styles";

export type RagentisThemeMode = "light" | "dark";

const createRagentisTheme = (
  mode: RagentisThemeMode,
) =>
  createTheme({
    palette: {
      mode,

      primary: {
        main: mode === "light" ? "#1976d2" : "#90caf9",
      },

      secondary: {
        main: mode === "light" ? "#6c63ff" : "#a9a0ff",
      },

      background: {
        default:
          mode === "light"
            ? "#f5f7fb"
            : "#0b1020",

        paper:
          mode === "light"
            ? "#ffffff"
            : "#111827",
      },

      text: {
        primary:
          mode === "light"
            ? "#172B4D"
            : "#F3F4F6",

        secondary:
          mode === "light"
            ? "#718198"
            : "#A8B3C7",
      },

      divider:
        mode === "light"
          ? "#E5EAF2"
          : "rgba(255,255,255,0.10)",
    },

    typography: {
      fontFamily:
        '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',

      h4: {
        fontWeight: 700,
      },

      h5: {
        fontWeight: 700,
      },

      h6: {
        fontWeight: 600,
      },
    },

    shape: {
      borderRadius: 10,
    },

    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },

        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 9,
          },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow:
              mode === "light"
                ? "0 2px 12px rgba(0, 0, 0, 0.06)"
                : "0 4px 20px rgba(0, 0, 0, 0.25)",

            border:
              mode === "dark"
                ? "1px solid rgba(255,255,255,0.06)"
                : "none",
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },

      MuiTextField: {
        defaultProps: {
          variant: "outlined",
        },
      },
    },
  });

export default createRagentisTheme;