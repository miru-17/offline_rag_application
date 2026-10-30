import type { ReactNode } from "react";
import { Box, Typography, type SxProps, type Theme } from "@mui/material";

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  sx?: SxProps<Theme>;
}

/** The standard content surface: an optional header row and a body. */
export default function Panel({ title, description, action, children, padded = true, sx }: PanelProps) {
  return (
    <Box
      sx={[
        (theme) => ({
          bgcolor: theme.palette.rag.surface,
          border: `1px solid ${theme.palette.rag.line}`,
          borderRadius: "14px",
          boxShadow: theme.palette.rag.shadow,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {(title || action) && (
        <Box
          sx={{
            px: 2.5,
            pt: 2.25,
            pb: padded ? 0 : 2,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {title && (
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {title}
              </Typography>
            )}
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {description}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Box>
      )}
      <Box sx={{ p: padded ? 2.5 : 0, pt: padded ? 2 : 0, flex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}
