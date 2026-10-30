import { useState } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";

import { sendFeedback } from "../../api/query.api";

interface Props {
  messageId?: string;
  initial?: "up" | "down" | null;
  status?: string | null;
}

export default function AnswerFeedback({ messageId, initial = null, status }: Props) {
  const [rating, setRating] = useState<"up" | "down" | null>(initial);
  const [saving, setSaving] = useState(false);

  if (!messageId) {
    return status === "stopped" || status === "error" ? (
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
        {status === "stopped" ? "Stopped" : "The answer could not be completed"}
      </Typography>
    ) : null;
  }

  const rate = async (value: "up" | "down") => {
    if (saving) return;
    setSaving(true);
    try {
      await sendFeedback(messageId, value);
      setRating(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 0.5 }}>
      <Tooltip title="Helpful answer">
        <IconButton size="small" onClick={() => void rate("up")} aria-label="Helpful">
          {rating === "up" ? <ThumbUpAltIcon fontSize="inherit" color="primary" /> : <ThumbUpAltOutlinedIcon fontSize="inherit" />}
        </IconButton>
      </Tooltip>
      <Tooltip title="Not helpful">
        <IconButton size="small" onClick={() => void rate("down")} aria-label="Not helpful">
          {rating === "down" ? <ThumbDownAltIcon fontSize="inherit" color="error" /> : <ThumbDownAltOutlinedIcon fontSize="inherit" />}
        </IconButton>
      </Tooltip>
      {status === "stopped" && <Typography variant="caption" color="text.secondary">Stopped</Typography>}
      {status === "not_found" && <Typography variant="caption" color="text.secondary">Not found in your documents</Typography>}
    </Box>
  );
}
