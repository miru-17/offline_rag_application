import { useState } from "react";
import { Box, Chip, Collapse, Paper, Tooltip, Typography } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";

import type { QuerySource } from "../../api/query.api";

/** Shows where an answer came from: file, page / sheet, match and the exact passage. */
export default function EvidencePanel({ sources }: { sources: QuerySource[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (!sources || sources.length === 0) return null;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography
        variant="caption"
        sx={{ display: "block", mb: 1, fontWeight: 700, color: "text.secondary",
              textTransform: "uppercase", letterSpacing: 0.7 }}
      >
        Evidence ({sources.length})
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {sources.map((source, index) => {
          const filename = String(source.filename ?? source.file_name ?? "Document");
          const location = source.page ? `Page ${source.page}` : source.sheet ? `Sheet ${source.sheet}` : null;
          const isOpen = open === index;
          return (
            <Paper
              key={`${source.document_id ?? filename}-${source.chunk_index ?? index}`}
              elevation={0}
              onClick={() => setOpen(isOpen ? null : index)}
              sx={{ px: 1.5, py: 1, borderRadius: 1.75, border: "1px solid",
                    borderColor: isOpen ? "primary.main" : "divider",
                    bgcolor: "background.paper", cursor: source.excerpt ? "pointer" : "default" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Chip label={source.ref ?? index + 1} size="small" color="primary" variant="outlined"
                      sx={{ height: 22, minWidth: 28, fontWeight: 700 }} />
                <DescriptionOutlinedIcon sx={{ fontSize: 19, color: "primary.main", flexShrink: 0 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2"
                    sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {filename}
                  </Typography>
                  {location && <Typography variant="caption" color="text.secondary">{location}</Typography>}
                </Box>
                {typeof source.score === "number" && (
                  <Tooltip title="How closely this passage matches your question">
                    <Chip label={`${Math.round(source.score * 100)}% match`} size="small" variant="outlined" />
                  </Tooltip>
                )}
                {source.excerpt && (
                  <ExpandMoreRoundedIcon fontSize="small"
                    sx={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s",
                          color: "text.secondary" }} />
                )}
              </Box>
              {source.excerpt && (
                <Collapse in={isOpen}>
                  <Typography variant="body2" color="text.secondary"
                    sx={{ mt: 1, pl: 1.25, borderLeft: "3px solid", borderColor: "primary.light",
                          whiteSpace: "pre-wrap", fontStyle: "italic" }}>
                    {source.excerpt}
                  </Typography>
                </Collapse>
              )}
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
