import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

export default function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between",
               gap: 2, flexWrap: "wrap" }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.75, letterSpacing: "-0.02em" }}>{title}</Typography>
        <Typography variant="body1" color="text.secondary">{subtitle}</Typography>
      </Box>
      {action}
    </Box>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Box sx={{ p: 2.25, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper",
               minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase",
                                                                letterSpacing: 0.6, display: "block" }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, wordBreak: "break-word",
                                     fontVariantNumeric: "tabular-nums",
                                     fontSize: typeof value === "string" && value.length > 14 ? "1.05rem" : undefined }}>
        {value}
      </Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Box>
  );
}

export const formatNumber = (value: unknown, digits = 2): string => {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: Number.isInteger(value) ? 0 : digits });
  }
  return String(value);
};
