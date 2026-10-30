import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export default function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <Box
      sx={{
        py: compact ? 4 : 7,
        px: 3,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        animation: "ragFadeIn 300ms ease-out both",
      }}
    >
      <Box
        sx={(theme) => ({
          width: compact ? 44 : 56,
          height: compact ? 44 : 56,
          borderRadius: "14px",
          display: "grid",
          placeItems: "center",
          mb: 2,
          color: theme.palette.rag.textMuted,
          bgcolor: theme.palette.rag.raised,
          border: `1px solid ${theme.palette.rag.line}`,
          "& svg": { fontSize: compact ? 22 : 26 },
        })}
      >
        {icon}
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, maxWidth: 420 }}
        >
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Box>
  );
}
