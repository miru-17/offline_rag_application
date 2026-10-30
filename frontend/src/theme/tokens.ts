/* =========================================================
   RAGENTIS DESIGN TOKENS

   The palette carries meaning through the RAG workflow:
     blue   (primary) -> you: your actions and your questions
     cyan   (retrieve) -> evidence pulled from your documents
     indigo (generate) -> text written by the local model
   Keep that mapping consistent so the pipeline stays readable.
   ========================================================= */

export type RagMode = "light" | "dark";

export interface RagTokens {
  bg: string;
  bgGlow: string;
  surface: string;
  surfaceGlass: string;
  raised: string;
  sunken: string;
  line: string;
  lineStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primarySoft: string;
  retrieve: string;
  retrieveSoft: string;
  generate: string;
  generateSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  shadow: string;
  shadowLg: string;
  focus: string;
}

const dark: RagTokens = {
  bg: "#070B14",
  bgGlow:
    "radial-gradient(1200px 600px at 12% -10%, rgba(91,140,255,0.10), transparent 60%)," +
    "radial-gradient(900px 500px at 100% 0%, rgba(45,212,230,0.06), transparent 60%)",
  surface: "#0C1322",
  surfaceGlass: "rgba(12, 19, 34, 0.72)",
  raised: "#111A2D",
  sunken: "#09101D",
  line: "rgba(140, 165, 210, 0.12)",
  lineStrong: "rgba(140, 165, 210, 0.22)",
  text: "#E7ECF6",
  textMuted: "#8D9AB3",
  textFaint: "#5B6782",
  primary: "#5B8CFF",
  primarySoft: "rgba(91, 140, 255, 0.14)",
  retrieve: "#2DD4E6",
  retrieveSoft: "rgba(45, 212, 230, 0.12)",
  generate: "#8B7CFF",
  generateSoft: "rgba(139, 124, 255, 0.14)",
  success: "#34D399",
  successSoft: "rgba(52, 211, 153, 0.12)",
  warning: "#FBBF24",
  warningSoft: "rgba(251, 191, 36, 0.12)",
  danger: "#F87171",
  dangerSoft: "rgba(248, 113, 113, 0.12)",
  shadow: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
  shadowLg: "0 24px 64px -16px rgba(0,0,0,0.7), 0 0 0 1px rgba(140,165,210,0.10)",
  focus: "0 0 0 3px rgba(91, 140, 255, 0.35)",
};

const light: RagTokens = {
  bg: "#F4F6FB",
  bgGlow:
    "radial-gradient(1200px 600px at 12% -10%, rgba(47,91,234,0.07), transparent 60%)," +
    "radial-gradient(900px 500px at 100% 0%, rgba(8,145,178,0.05), transparent 60%)",
  surface: "#FFFFFF",
  surfaceGlass: "rgba(255, 255, 255, 0.78)",
  raised: "#F7F9FD",
  sunken: "#EEF2F8",
  line: "#E3E8F1",
  lineStrong: "#CDD5E3",
  text: "#0E1628",
  textMuted: "#56627A",
  textFaint: "#8A95AB",
  primary: "#2F5BEA",
  primarySoft: "rgba(47, 91, 234, 0.08)",
  retrieve: "#0891B2",
  retrieveSoft: "rgba(8, 145, 178, 0.08)",
  generate: "#6A4FE0",
  generateSoft: "rgba(106, 79, 224, 0.08)",
  success: "#059669",
  successSoft: "rgba(5, 150, 105, 0.08)",
  warning: "#B45309",
  warningSoft: "rgba(217, 119, 6, 0.10)",
  danger: "#DC2626",
  dangerSoft: "rgba(220, 38, 38, 0.07)",
  shadow: "0 1px 2px rgba(14,22,40,0.04), 0 6px 20px -10px rgba(14,22,40,0.10)",
  shadowLg: "0 24px 64px -20px rgba(14,22,40,0.25), 0 0 0 1px rgba(14,22,40,0.06)",
  focus: "0 0 0 3px rgba(47, 91, 234, 0.25)",
};

export const getTokens = (mode: RagMode): RagTokens =>
  mode === "dark" ? dark : light;

export const FONT_SANS =
  '"Geist Variable", "Segoe UI", system-ui, -apple-system, sans-serif';

export const FONT_MONO =
  '"Geist Mono Variable", ui-monospace, "Cascadia Code", Consolas, monospace';

export const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
