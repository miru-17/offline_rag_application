import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Skeleton,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { useNavigate } from "react-router-dom";

import {
  getDocument,
  getDocumentTables,
  getDocumentVersions,
  importDocumentTable,
  openDocumentFile,
  setLegalHold,
  uploadDocument,
  type DocumentDetails,
  type DocumentItem,
  type DocumentTable,
} from "../../api/documents.api";
import { toast } from "../common/Toast";
import FileTypeIcon from "../common/FileTypeIcon";
import StatusDot from "../common/StatusDot";
import { FILE_KIND_LABEL, formatDateTime, getApiErrorMessage, getFileKind } from "../../utils/format";

interface DocumentDrawerProps {
  document: DocumentItem | null;
  open: boolean;
  canDelete: boolean;
  /** Administrators can place a legal hold. */
  isAdmin?: boolean;
  onClose: () => void;
  onDelete: (doc: DocumentItem) => void;
  /** Called after a new version is uploaded or the legal hold changes. */
  onChanged?: () => void;
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

export default function DocumentDrawer({
  document,
  open,
  canDelete,
  isAdmin = false,
  onClose,
  onDelete,
  onChanged,
}: DocumentDrawerProps) {
  const navigate = useNavigate();
  const [details, setDetails] = useState<DocumentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [versions, setVersions] = useState<DocumentItem[]>([]);
  const [tables, setTables] = useState<DocumentTable[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const versionInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !document) return;
    let mounted = true;
    setLoading(true);
    setError("");
    setDetails(null);
    setVersions([]);
    setTables(null);
    getDocument(document.id)
      .then((d) => {
        if (!mounted) return;
        setDetails(d);
        if (d.version_group_id && (d.version ?? 1) > 1) {
          getDocumentVersions(d.id).then((v) => mounted && setVersions(v)).catch(() => undefined);
        }
      })
      .catch((err) => mounted && setError(getApiErrorMessage(err, "Couldn't load document details.")))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [open, document, reload]);

  const doc = details ?? document;
  const kind = getFileKind(doc?.filename, doc?.file_type);
  const ready = doc?.status === "ready" || (doc?.status === undefined && doc?.processed);
  const hasTables = kind === "docx" || kind === "xlsx";

  const run = async (key: string, task: () => Promise<void>, failure: string) => {
    setBusy(key);
    try {
      await task();
    } catch (err) {
      toast.error(getApiErrorMessage(err, failure));
    } finally {
      setBusy(null);
    }
  };

  const uploadVersion = (file: File) =>
    run(
      "version",
      async () => {
        if (!doc) return;
        const created = await uploadDocument(file, undefined, { replaceDocumentId: doc.id });
        toast.success(`Version ${created.version ?? ""} uploaded. It replaces the old one once indexed.`);
        onChanged?.();
        onClose();
      },
      "The new version could not be uploaded.",
    );

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
            {details?.source_path?.startsWith("watch:") && (
              <Field label="Source">Watched folder · {details.source_path.slice(6)}</Field>
            )}
            {Boolean(details?.ocr_pages) && (
              <Field label="Text reading">
                <Chip size="small" label={`OCR on ${details?.ocr_pages} page${details?.ocr_pages === 1 ? "" : "s"}`} />
              </Field>
            )}
            <Field label="Version">
              {loading ? <Skeleton width={60} /> : `Version ${details?.version ?? 1}`}
              {versions.length > 1 && (
                <Box sx={{ mt: 0.75, display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {versions.map((v) => (
                    <Box key={v.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontSize: "0.75rem", minWidth: 28, fontWeight: 600 }}>v{v.version}</Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", flex: 1 }} noWrap>
                        {v.filename} · {formatDateTime(v.created_at)}
                        {v.status === "superseded" ? " · replaced" : ""}
                      </Typography>
                      <Tooltip title="Open this version">
                        <IconButton
                          size="small"
                          aria-label={`Open version ${v.version}`}
                          onClick={() => run(`open-${v.id}`, () => openDocumentFile(v.id), "The file could not be opened.")}
                        >
                          <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Box>
              )}
            </Field>
            {isAdmin && details && (
              <Field label="Legal hold">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Switch
                    size="small"
                    checked={Boolean(details.legal_hold)}
                    disabled={busy === "hold"}
                    slotProps={{ input: { "aria-label": "Legal hold" } }}
                    onChange={(e) => {
                      const hold = e.target.checked;
                      void run(
                        "hold",
                        async () => {
                          await setLegalHold(details.id, hold);
                          toast.success(hold ? "Legal hold placed. The document cannot be deleted." : "Legal hold removed.");
                          setReload((n) => n + 1);
                          onChanged?.();
                        },
                        "The legal hold could not be changed.",
                      );
                    }}
                  />
                  <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                    {details.legal_hold ? "Protected from deletion and clean-up" : "Off"}
                  </Typography>
                </Box>
              </Field>
            )}

            {hasTables && ready && (
              <Box sx={{ py: 1.5 }}>
                {tables === null ? (
                  <Button
                    size="small"
                    startIcon={busy === "tables" ? <CircularProgress size={14} /> : <TableChartOutlinedIcon />}
                    disabled={busy === "tables"}
                    onClick={() =>
                      run("tables", async () => setTables(await getDocumentTables(doc!.id)), "Tables could not be read.")
                    }
                  >
                    Find tables for the Data Dashboard
                  </Button>
                ) : tables.length === 0 ? (
                  <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>No tables found in this document.</Typography>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Tables in this document</Typography>
                    {tables.map((t) => (
                      <Box
                        key={t.index}
                        sx={(theme) => ({
                          p: 1,
                          borderRadius: "8px",
                          border: `1px solid ${theme.palette.rag.line}`,
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        })}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: "0.8rem", fontWeight: 560 }}>{t.name}</Typography>
                          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }} noWrap>
                            {t.row_count} rows · {t.columns.join(", ")}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={busy === `table-${t.index}`}
                          onClick={() =>
                            run(
                              `table-${t.index}`,
                              async () => {
                                const result = await importDocumentTable(doc!.id, t.index);
                                onClose();
                                navigate(`/data/${result.dataset_id}`);
                              },
                              "The table could not be imported.",
                            )
                          }
                        >
                          Open in dashboard
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}
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
            <input
              ref={versionInput}
              type="file"
              hidden
              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadVersion(file);
              }}
            />
            <Tooltip title="Open the original file">
              <span>
                <IconButton
                  aria-label="Open original file"
                  disabled={busy === "open"}
                  onClick={() => run("open", () => openDocumentFile(doc.id), "The file could not be opened.")}
                  sx={(theme) => ({ border: `1px solid ${theme.palette.rag.line}` })}
                >
                  <OpenInNewRoundedIcon sx={{ fontSize: 19 }} />
                </IconButton>
              </span>
            </Tooltip>
            {canDelete && (doc.status === "ready" || doc.status === "failed") && (
              <Tooltip title="Upload a new version (keeps the same sharing; the old version stays in history)">
                <span>
                  <IconButton
                    aria-label="Upload new version"
                    disabled={busy === "version"}
                    onClick={() => versionInput.current?.click()}
                    sx={(theme) => ({ border: `1px solid ${theme.palette.rag.line}` })}
                  >
                    {busy === "version" ? <CircularProgress size={18} /> : <UploadFileRoundedIcon sx={{ fontSize: 19 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Button
              variant="contained"
              startIcon={<ForumOutlinedIcon />}
              disabled={!doc.processed}
              onClick={() =>
                navigate("/ai-workspace", {
                  state: { prefill: `Summarise the key points of “${doc.filename.replace(/\.(pdf|docx|xlsx|png|jpe?g)$/i, "")}”` },
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
