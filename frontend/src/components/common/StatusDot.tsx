import { Box } from "@mui/material";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "retrieve";

interface StatusDotProps {
  tone: StatusTone;
  pulse?: boolean;
  size?: number;
}

export default function StatusDot({ tone, pulse = false, size = 8 }: StatusDotProps) {
  return (
    <Box
      component="span"
      sx={(theme) => {
        const t = theme.palette.rag;
        const color = {
          success: t.success,
          warning: t.warning,
          danger: t.danger,
          neutral: t.textFaint,
          retrieve: t.retrieve,
        }[tone];

        return {
          display: "inline-block",
          flexShrink: 0,
          width: size,
          height: size,
          borderRadius: "50%",
          bgcolor: color,
          color,
          boxShadow: `0 0 0 3px ${color}22`,
          animation: pulse ? "ragPulseRing 2s ease-out infinite" : "none",
        };
      }}
    />
  );
}
