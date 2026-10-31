import { Box, Button, ButtonBase, Drawer, IconButton, Tooltip, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

import { useNavigate } from "react-router-dom";

import { useState } from "react";

import { openDocumentFile } from "../../api/documents.api";
import type { QuerySource } from "../../api/query.api";
import { toast } from "../common/Toast";
import FileTypeIcon from "../common/FileTypeIcon";
import { getSourceFilename, getSourcePage, getSourceSnippet } from "./types";

function SourcePreview({ source, index }: { source: QuerySource; index: number }) {
  const page = getSourcePage(source);
  return (
    <Box sx={{ p: 0.5, maxWidth: 280 }}>
      <Typography sx={{ fontSize: "0.72rem", opacity: 0.7, mb: 0.25 }}>Source {index + 1}</Typography>
      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 560, wordBreak: "break-word" }}>
        {getSourceFilename(source)}
      </Typography>
      <Typography sx={{ fontSize: "0.72rem", opacity: 0.75, mt: 0.5 }}>
        {[page && `Page ${page}`, source.chunk_index !== undefined && `Passage ${Number(source.chunk_index) + 1}`]
          .filter(Boolean)
          .join(" · ") || "Location not reported"}
      </Typography>
      <Typography sx={{ fontSize: "0.7rem", opacity: 0.6, mt: 0.5 }}>Click to view all evidence</Typography>
    </Box>
  );
}

export function SourceChips({ sources, onOpen }: { sources: QuerySource[]; onOpen: (index: number) => void }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {sources.map((source, i) => {
        const page = getSourcePage(source);
        return (
          <Tooltip key={i} title={<SourcePreview source={source} index={i} />} placement="top" enterDelay={150}>
            <ButtonBase
              onClick={() => onOpen(i)}
              sx={(theme) => ({
                gap: 0.75,
                pl: 0.5,
                pr: 1,
                height: 28,
                maxWidth: 260,
                borderRadius: "8px",
                border: `1px solid ${theme.palette.rag.retrieve}40`,
                bgcolor: theme.palette.rag.retrieveSoft,
                color: theme.palette.text.primary,
                animation: `ragRiseIn 360ms cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`,
                transition: "border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease",
                "&:hover": {
                  borderColor: theme.palette.rag.retrieve,
                  transform: "translateY(-1px)",
                  boxShadow: `0 6px 16px -8px ${theme.palette.rag.retrieve}`,
                },
                "&.Mui-focusVisible": { boxShadow: theme.palette.rag.focus },
              })}
            >
              <Box
                component="span"
                sx={(theme) => ({
                  minWidth: 18,
                  height: 18,
                  px: 0.5,
                  borderRadius: "5px",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "0.6875rem",
                  fontWeight: 650,
                  color: theme.palette.mode === "dark" ? "#03141a" : "#fff",
                  bgcolor: theme.palette.rag.retrieve,
                })}
              >
                {i + 1}
              </Box>
              <Typography noWrap component="span" sx={{ fontSize: "0.75rem", fontWeight: 500 }}>
                {getSourceFilename(source)}
              </Typography>
              {page && (
                <Typography component="span" sx={{ fontSize: "0.72rem", color: "text.secondary", flexShrink: 0 }}>
                  p.{page}
                </Typography>
              )}
            </ButtonBase>
          </Tooltip>
        );
      })}
    </Box>
  );
}

export function EvidenceDrawer({
  open,
  sources,
  highlight,
  onClose,
}: {
  open: boolean;
  sources: QuerySource[];
  highlight: number | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [opening, setOpening] = useState<number | null>(null);
  const hasSnippets = sources.some((s) => getSourceSnippet(s));
  const documentCount = new Set(sources.map((s) => s.document_id || getSourceFilename(s))).size;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 440 }, borderLeft: "1px solid", borderColor: "divider" } } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box
          sx={(theme) => ({
            px: 2.5,
            py: 2,
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
            borderBottom: `1px solid ${theme.palette.rag.line}`,
          })}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">Evidence</Typography>
            <Typography variant="body2" color="text.secondary">
              {sources.length} passage{sources.length === 1 ? "" : "s"} from {documentCount} document
              {documentCount === 1 ? "" : "s"} were given to the model for this answer.
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close evidence" size="small">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
          {sources.map((source, i) => {
            const page = getSourcePage(source);
            const snippet = getSourceSnippet(source);
            const active = highlight === i;
            const pdfPage = page && /^\d+$/.test(page) ? page : null;

            return (
              <Box
                key={i}
                ref={(el: HTMLDivElement | null) => {
                  if (active && el) el.scrollIntoView({ block: "nearest" });
                }}
                sx={(theme) => ({
                  p: 1.75,
                  borderRadius: "12px",
                  border: `1px solid ${active ? theme.palette.rag.retrieve : theme.palette.rag.line}`,
                  bgcolor: active ? theme.palette.rag.retrieveSoft : theme.palette.rag.raised,
                  animation: `ragRiseIn 360ms cubic-bezier(0.16,1,0.3,1) ${i * 50}ms both`,
                  transition: "border-color 200ms ease, background-color 200ms ease",
                })}
              >
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                  <FileTypeIcon filename={getSourceFilename(source)} size={34} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.72rem", color: "info.main", fontWeight: 560 }}>
                      Source {i + 1}
                    </Typography>
                    <Typography sx={{ fontSize: "0.8438rem", fontWeight: 560, wordBreak: "break-word" }}>
                      {getSourceFilename(source)}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, mt: 0.75, flexWrap: "wrap" }}>
                      <Meta label="Page" value={page ?? "—"} />
                      <Meta
                        label="Passage"
                        value={source.chunk_index !== undefined ? `#${Number(source.chunk_index) + 1}` : "—"}
                      />
                      {source.document_id && <Meta label="Document ID" value={String(source.document_id).slice(0, 8)} mono />}
                    </Box>
                  </Box>
                </Box>

                {snippet && (
                  <Typography
                    sx={(theme) => ({
                      mt: 1.5,
                      p: 1.25,
                      fontSize: "0.8rem",
                      lineHeight: 1.6,
                      borderRadius: "8px",
                      borderLeft: `2px solid ${theme.palette.rag.retrieve}`,
                      bgcolor: theme.palette.rag.surface,
                    })}
                  >
                    {snippet}
                  </Typography>
                )}

                {source.document_id && (
                  <Box sx={{ display: "flex", gap: 0.5, mt: 1, ml: -0.75, flexWrap: "wrap" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={opening === i}
                      endIcon={<OpenInNewRoundedIcon sx={{ fontSize: "14px !important" }} />}
                      onClick={async () => {
                        setOpening(i);
                        try {
                          await openDocumentFile(String(source.document_id), pdfPage);
                        } catch {
                          toast.error("The original file could not be opened.");
                        } finally {
                          setOpening(null);
                        }
                      }}
                    >
                      {pdfPage ? `Open at page ${pdfPage}` : "Open original"}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        onClose();
                        navigate("/documents", { state: { focusId: source.document_id } });
                      }}
                    >
                      Show in Documents
                    </Button>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>

        {!hasSnippets && (
          <Box sx={(theme) => ({ px: 2.5, py: 1.5, borderTop: `1px solid ${theme.palette.rag.line}` })}>
            <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
              Citations show where each passage came from. Open the document to read the passage in context.
            </Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>{label}</Typography>
      <Typography className={mono ? "font-mono" : undefined} sx={{ fontSize: "0.78rem", fontWeight: 520 }}>
        {value}
      </Typography>
    </Box>
  );
}
