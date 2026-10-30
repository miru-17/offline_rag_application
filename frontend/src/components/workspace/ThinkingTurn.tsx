import { Box, Typography } from "@mui/material";

import BrandMark from "../common/BrandMark";
import { useElapsed } from "../../hooks/useElapsed";

/**
 * Shown while POST /query is in flight. Retrieval and generation happen in a
 * single request, so this shows both stages as in progress with a real elapsed
 * timer rather than invented step-by-step progress.
 */
export default function ThinkingTurn({ modelName }: { modelName?: string }) {
  const seconds = useElapsed(true);

  return (
    <Box sx={{ display: "flex", gap: 1.75, animation: "ragFadeInUp 360ms cubic-bezier(0.16,1,0.3,1) both" }}>
      <Box sx={{ pt: 0.25, position: "relative" }}>
        <BrandMark size={28} />
        <Box
          aria-hidden
          sx={(theme) => ({
            position: "absolute",
            top: -2,
            left: -4,
            width: 36,
            height: 36,
            borderRadius: "12px",
            border: `1.5px solid ${theme.palette.rag.generate}`,
            borderTopColor: "transparent",
            borderRightColor: "transparent",
            animation: "ragSpin 1.1s linear infinite",
          })}
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }} role="status" aria-live="polite">
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>RAGENTIS</Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
            {seconds}s
          </Typography>
        </Box>

        <Box
          sx={(theme) => ({
            position: "relative",
            overflow: "hidden",
            p: 1.75,
            borderRadius: "12px",
            border: `1px solid ${theme.palette.rag.line}`,
            bgcolor: theme.palette.rag.raised,
            maxWidth: 520,
          })}
        >
          <Stage
            tone="retrieve"
            title="Searching your documents"
            detail="Matching your question against indexed passages you can access"
          />
          <Box sx={{ height: 12 }} />
          <Stage
            tone="generate"
            title="Writing the answer"
            detail={`${modelName ?? "The local model"} composes a reply from those passages only`}
          />

          {/* scan line */}
          <Box
            aria-hidden
            sx={(theme) => ({
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 2,
              overflow: "hidden",
              "&::after": {
                content: '""',
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "40%",
                background: `linear-gradient(90deg, transparent, ${theme.palette.rag.retrieve}, ${theme.palette.rag.generate}, transparent)`,
                animation: "ragScan 1.8s ease-in-out infinite",
              },
            })}
          />
        </Box>

        {seconds >= 20 && (
          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", mt: 1, animation: "ragFadeIn 400ms ease both" }}>
            Still working — local models can take longer on CPU-only machines.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function Stage({ tone, title, detail }: { tone: "retrieve" | "generate"; title: string; detail: string }) {
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
      <Box
        sx={(theme) => ({
          mt: "5px",
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          bgcolor: theme.palette.rag[tone],
          color: theme.palette.rag[tone],
          animation: "ragPulseRing 1.6s ease-out infinite",
        })}
      />
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 560 }}>{title}</Typography>
          <Box className="rag-typing" sx={(theme) => ({ color: theme.palette.rag[tone] })}>
            <span />
            <span />
            <span />
          </Box>
        </Box>
        <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{detail}</Typography>
      </Box>
    </Box>
  );
}
