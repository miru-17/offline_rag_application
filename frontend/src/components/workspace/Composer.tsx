import { forwardRef, type KeyboardEvent } from "react";
import { Box, IconButton, InputBase, Tooltip, Typography } from "@mui/material";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

const MAX_LENGTH = 2000;

const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, onChange, onSubmit, busy, disabled = false, disabledReason },
  ref,
) {
  const canSend = value.trim().length > 0 && !busy && !disabled;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 820, mx: "auto" }}>
      <Box
        sx={(theme) => ({
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          pl: 2,
          pr: 0.75,
          py: 0.75,
          borderRadius: "16px",
          bgcolor: theme.palette.rag.surface,
          border: `1px solid ${theme.palette.rag.lineStrong}`,
          boxShadow: theme.palette.rag.shadow,
          transition: "border-color 160ms ease, box-shadow 160ms ease",
          "&:focus-within": {
            borderColor: theme.palette.rag.primary,
            boxShadow: `${theme.palette.rag.focus}, ${theme.palette.rag.shadow}`,
          },
        })}
      >
        <InputBase
          inputRef={ref}
          multiline
          maxRows={7}
          fullWidth
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? disabledReason : "Ask a question about your documents…"}
          inputProps={{ "aria-label": "Your question" }}
          sx={{ py: 0.9, fontSize: "0.9375rem", lineHeight: 1.55 }}
        />
        <Tooltip title={canSend ? "Send (Enter)" : ""}>
          <span>
            <IconButton
              onClick={onSubmit}
              disabled={!canSend}
              aria-label="Send question"
              sx={(theme) => ({
                width: 38,
                height: 38,
                mb: 0.1,
                borderRadius: "11px",
                color: "#fff",
                bgcolor: theme.palette.rag.primary,
                boxShadow: `0 6px 16px -8px ${theme.palette.rag.primary}`,
                "&:hover": { bgcolor: theme.palette.rag.primary, color: "#fff", filter: "brightness(1.1)" },
                "&.Mui-disabled": { bgcolor: theme.palette.rag.raised, color: theme.palette.rag.textFaint, boxShadow: "none" },
              })}
            >
              <ArrowUpwardRoundedIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mt: 0.9, px: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0 }}>
          <LockOutlinedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
          <Typography noWrap sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
            Answers come only from documents you can access, processed on this server.
          </Typography>
        </Box>
        <Typography sx={{ fontSize: "0.72rem", color: "text.disabled", flexShrink: 0, display: { xs: "none", sm: "block" } }}>
          {value.length > MAX_LENGTH * 0.8 ? `${value.length}/${MAX_LENGTH}` : "Shift + Enter for a new line"}
        </Typography>
      </Box>
    </Box>
  );
});

export default Composer;
