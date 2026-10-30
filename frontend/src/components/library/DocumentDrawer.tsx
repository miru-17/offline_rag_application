import { useEffect, useState } from "react";
import { Alert, Box, Button, Drawer, IconButton, Skeleton, Tooltip, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { useNavigate } from "react-router-dom";

import { getDocument, type DocumentDetails, type DocumentItem } from "../../api/documents.api";
import FileTypeIcon from "../common/FileTypeIcon";
import StatusDot from "../common/StatusDot";
import { FILE_KIND_LABEL, formatDateTime, getApiErrorMessage, getFileKind } from "../../utils/format";

interface DocumentDrawerProps {
  document: DocumentItem | null;
  open: boolean;
  canDelete: boolean;
  onClose: () => void;
  onDelete: (doc: DocumentItem) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box
      sx={(theme) => ({
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 2,
        py: 1.4,
        borderBottom: `1px solid ${theme.palette.rag.line}`,
      })}
    >
      <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>{label}</Typography>
      <Box sx={{ fontSize: "0.8125rem", minWidth: 0, wordBreak: "break-word" }}>{children}</Box>
    </Box>
  );
}

export default function DocumentDrawer({ document, open, canDelete, onClose, onDelete }: DocumentDrawerProps) {
  const navigate = useNavigate();
  const [details, setDetails] = useState<DocumentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !document) return;
    let mounted = true;
    setLoading(true);
    setError("");
    setDetails(null);
    getDocument(document.id)
      .then((d) => mounted && setDetails(d))
      .catch((err) => mounted && setError(getApiErrorMessage(err, "Couldn't load document details.")))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [open, document]);

  const doc = details ?? document;
  const kind = getFileKind(doc?.filename, doc?.file_type);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 420 }, borderLeft: "1px solid", borderColor: "divider" } } }}
    >
      {doc && (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
            <IconButton onClick={onClose} aria-label="Close details" size="small">
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ px: 3, pb: 2.5, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
            <FileTypeIcon filename={doc.filename} fileType={doc.file_type} size={52} />
            <Box>
              <Typography variant="h6" sx={{ wordBreak: "break-word" }}>
                {doc.filename}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.75 }}>
                <StatusDot tone={doc.status === "failed" ? "danger" : doc.processed ? "retrieve" : "warning"} size={7} />
                <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                  {doc.status === "queued" || doc.status === "processing"
                    ? "Indexing in the background…"
                    : doc.status === "failed"
                      ? `Failed — ${doc.error_message ?? "not used in answers"}`
                      : doc.processed
                        ? `Indexed — used to answer questions${doc.chunk_count ? ` (${doc.chunk_count} passages)` : ""}`
                        : "Not indexed — not used in answers"}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ px: 3, flex: 1, overflowY: "auto" }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Field label="Format">{FILE_KIND_LABEL[kind]}</Field>
            <Field label="Visibility">
              {loading ? (
                <Skeleton width={160} />
              ) : details?.visibility === "TENANT" ? (
                "Shared with your organisation"
              ) : details?.visibility === "PRIVATE" ? (
                "Private to the uploader"
              ) : details?.visibility === "GROUP" ? (
                `Team space: ${details?.group_name ?? "—"}`
              ) : (
                "—"
              )}
            </Field>
            <Field label="Uploaded">
              {formatDateTime(details?.uploaded_at ?? document?.created_at)}
            </Field>
            <Field label="Document ID">
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography className="font-mono" sx={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                  {doc.id}
                </Typography>
                <Tooltip title={copied ? "Copied" : "Copy ID"}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      void navigator.clipboard.writeText(doc.id);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1600);
                    }}
                    aria-label="Copy document ID"
                  >
                    {copied ? <CheckRoundedIcon sx={{ fontSize: 15, color: "success.main" }} /> : <ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Field>
          </Box>

          <Box
            sx={(theme) => ({
              p: 2,
              display: "flex",
              gap: 1,
              borderTop: `1px solid ${theme.palette.rag.line}`,
            })}
          >
            <Button
              variant="contained"
              startIcon={<ForumOutlinedIcon />}
              disabled={!doc.processed}
              onClick={() =>
                navigate("/ai-workspace", {
                  state: { prefill: `Summarise the key points of “${doc.filename.replace(/\.(pdf|docx|xlsx)$/i, "")}”` },
                })
              }
              sx={{ flex: 1 }}
            >
              Ask about this document
            </Button>
            {canDelete && document && (
              <Tooltip title="Delete document">
                <IconButton
                  onClick={() => onDelete(document)}
                  aria-label="Delete document"
                  sx={(theme) => ({ border: `1px solid ${theme.palette.rag.line}`, "&:hover": { color: "error.main" } })}
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 19 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
