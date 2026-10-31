import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";

import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import {
  deleteDocument,
  getDocuments,
  retryDocument,
  summarizeDocument,
  type DocumentItem,
  type SummaryResult,
  type Visibility,
} from "../api/documents.api";
import { getGroups, type TeamSpace } from "../api/groups.api";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import FileTypeIcon from "../components/common/FileTypeIcon";
import StatusDot from "../components/common/StatusDot";
import { toast } from "../components/common/Toast";
import UploadZone from "../components/library/UploadZone";
import DocumentDrawer from "../components/library/DocumentDrawer";
import {
  FILE_KIND_LABEL,
  formatDate,
  formatRelative,
  getApiErrorMessage,
  getFileKind,
  getTimestamp,
  type FileKind,
} from "../utils/format";

type StatusFilter = "all" | "indexed" | "not-indexed";

/** Processing state from the background indexer. */
const docState = (d: DocumentItem) => d.status ?? (d.processed ? "ready" : "failed");
const isReady = (d: DocumentItem) => docState(d) === "ready";
const STATE_LABEL: Record<string, string> = {
  ready: "Indexed",
  queued: "Queued",
  processing: "Indexing…",
  failed: "Failed",
};
const STATE_TONE: Record<string, "retrieve" | "warning" | "danger"> = {
  ready: "retrieve",
  queued: "warning",
  processing: "warning",
  failed: "danger",
};
const VISIBILITY_LABEL: Record<string, string> = {
  PRIVATE: "Private",
  TENANT: "Organisation",
  GROUP: "Team space",
};
type SortKey = "newest" | "oldest" | "name";

interface NavState {
  openUpload?: boolean;
  focusId?: string;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <Box
      role="radiogroup"
      aria-label={label}
      sx={(theme) => ({
        display: "inline-flex",
        p: "3px",
        gap: "2px",
        borderRadius: "10px",
        bgcolor: theme.palette.rag.sunken,
        border: `1px solid ${theme.palette.rag.line}`,
      })}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <ButtonBase
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            sx={(theme) => ({
              px: 1.25,
              height: 28,
              gap: 0.75,
              borderRadius: "7px",
              fontSize: "0.78rem",
              fontWeight: active ? 560 : 460,
              color: active ? theme.palette.text.primary : theme.palette.text.secondary,
              bgcolor: active ? theme.palette.rag.surface : "transparent",
              boxShadow: active ? theme.palette.rag.shadow : "none",
              transition: "all 160ms ease",
              "&:hover": { color: theme.palette.text.primary },
              "&.Mui-focusVisible": { boxShadow: theme.palette.rag.focus },
            })}
          >
            {opt.label}
            {opt.count !== undefined && (
              <Box component="span" sx={{ fontSize: "0.7rem", color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                {opt.count}
              </Box>
            )}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export default function Documents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role?.toUpperCase();
  const isAdmin = role === "ADMIN";
  const isViewer = role === "VIEWER";
  const canUpload = role === "ADMIN" || role === "USER";

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<FileKind | "all">("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [drawerDoc, setDrawerDoc] = useState<DocumentItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [visibility, setVisibility] = useState<Visibility>(isAdmin ? "TENANT" : "PRIVATE");
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState<TeamSpace[]>([]);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summaryFor, setSummaryFor] = useState<string | null>(null);

  /* ---------------- load ---------------- */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError("");
    try {
      const data = await getDocuments();
      setDocuments(data);
      return data;
    } catch (err) {
      setLoadError(getApiErrorMessage(err, "Couldn't load documents."));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const state = (location.state ?? {}) as NavState;
    if (state.openUpload && canUpload) setUploadOpen(true);

    void load().then((data) => {
      if (state.focusId && data) {
        const doc = data.find((d) => d.id === state.focusId);
        if (doc) {
          setHighlightId(doc.id);
          setDrawerDoc(doc);
          setDrawerOpen(true);
          window.setTimeout(() => setHighlightId(null), 2400);
        }
      }
    });

    if (state.openUpload || state.focusId) navigate(location.pathname, { replace: true, state: null });
    // Run once on mount; navigation state is consumed immediately.
  }, []); // eslint-disable-line

  useEffect(() => {
    getGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  // Refresh quietly while documents are still being indexed in the background.
  const hasPending = documents.some((d) => docState(d) === "queued" || docState(d) === "processing");
  useEffect(() => {
    if (!hasPending) return;
    const timer = window.setInterval(() => void load(true), 3000);
    return () => window.clearInterval(timer);
  }, [hasPending, load]);

  const retry = async (doc: DocumentItem) => {
    try {
      await retryDocument(doc.id);
      toast.success(`“${doc.filename}” queued again`);
      void load(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't retry this document."));
    }
  };

  const summarise = async (doc: DocumentItem) => {
    setSummary(null);
    setSummaryFor(doc.filename);
    try {
      setSummary(await summarizeDocument(doc.id));
    } catch (err) {
      setSummaryFor(null);
      toast.error(getApiErrorMessage(err, "Couldn't summarise this document."));
    }
  };

  const sharingLabel =
    visibility === "TENANT"
      ? `Files you upload are shared with everyone in ${user?.tenant_name ?? "your organisation"}.`
      : visibility === "GROUP"
        ? `Files you upload are shared with the ${groups.find((g) => g.id === groupId)?.name ?? "selected"} team space only.`
        : "Files you upload are private to you.";

  /* ---------------- derived ---------------- */
  const counts = useMemo(
    () => ({
      all: documents.length,
      indexed: documents.filter(isReady).length,
      notIndexed: documents.filter((d) => !isReady(d)).length,
    }),
    [documents],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = documents.filter((d) => {
      if (needle && !d.filename.toLowerCase().includes(needle)) return false;
      if (status === "indexed" && !isReady(d)) return false;
      if (status === "not-indexed" && isReady(d)) return false;
      if (kind !== "all" && getFileKind(d.filename, d.file_type) !== kind) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "name") return a.filename.localeCompare(b.filename);
      const diff = getTimestamp(b.created_at) - getTimestamp(a.created_at);
      return sort === "newest" ? diff : -diff;
    });
  }, [documents, search, status, kind, sort]);

  const filtersActive = search.trim() !== "" || status !== "all" || kind !== "all";
  const libraryEmpty = !loading && !loadError && documents.length === 0;

  /* ---------------- actions ---------------- */
  const openDetails = (doc: DocumentItem) => {
    setDrawerDoc(doc);
    setDrawerOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteDocument(toDelete.id);
      setDocuments((current) => current.filter((d) => d.id !== toDelete.id));
      toast.success(`Deleted “${toDelete.filename}”`);
      if (drawerDoc?.id === toDelete.id) setDrawerOpen(false);
      setToDelete(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't delete the document."));
    } finally {
      setDeleting(false);
    }
  };

  const askAbout = (doc: DocumentItem) =>
    navigate("/ai-workspace", {
      state: { prefill: `Summarise the key points of “${doc.filename.replace(/\.(pdf|docx|xlsx|png|jpe?g)$/i, "")}”` },
    });

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setKind("all");
  };

  /* ---------------- render ---------------- */
  return (
    <Box>
      <PageHeader
        title="Documents"
        description={
          isAdmin
            ? "Every document in your organisation. Indexed documents are searchable in the AI Workspace."
            : "Documents shared with your organisation, plus your own private uploads."
        }
        actions={
          <>
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  onClick={() => void load()}
                  disabled={loading}
                  aria-label="Refresh documents"
                  sx={(theme) => ({ border: `1px solid ${theme.palette.rag.line}` })}
                >
                  <RefreshRoundedIcon sx={{ fontSize: 19, animation: loading ? "ragSpin 900ms linear infinite" : "none" }} />
                </IconButton>
              </span>
            </Tooltip>
            {canUpload && !libraryEmpty && (
              <Button
                variant={uploadOpen ? "outlined" : "contained"}
                startIcon={uploadOpen ? <CloseRoundedIcon /> : <UploadFileOutlinedIcon />}
                onClick={() => setUploadOpen((o) => !o)}
              >
                {uploadOpen ? "Close upload" : "Upload documents"}
              </Button>
            )}
          </>
        }
      />

      {isViewer && (
        <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />} sx={{ mb: 2.5 }}>
          You have view-only access. You can browse documents and ask questions about them, but not upload or delete.
        </Alert>
      )}

      {canUpload && (
        <Collapse in={uploadOpen || libraryEmpty} unmountOnExit>
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{ display: "flex", gap: 1.5, mb: 1.5, flexWrap: "wrap", alignItems: "center" }}>
              <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>Who can use these files:</Typography>
              <Select size="small" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}
                      sx={{ minWidth: 190, fontSize: "0.8125rem" }} inputProps={{ "aria-label": "Who can use these files" }}>
                <MenuItem value="PRIVATE">Only me (private)</MenuItem>
                {isAdmin && <MenuItem value="TENANT">Whole organisation</MenuItem>}
                <MenuItem value="GROUP" disabled={groups.length === 0}>A team space</MenuItem>
              </Select>
              {visibility === "GROUP" && (
                <Select size="small" value={groupId} displayEmpty onChange={(e) => setGroupId(e.target.value)}
                        sx={{ minWidth: 190, fontSize: "0.8125rem" }} inputProps={{ "aria-label": "Team space" }}>
                  <MenuItem value="" disabled>Choose a team space</MenuItem>
                  {groups.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                </Select>
              )}
            </Box>
            {visibility === "GROUP" && !groupId ? (
              <Alert severity="info">Choose a team space first.</Alert>
            ) : (
              <UploadZone
                isAdmin={isAdmin}
                tenantName={user?.tenant_name}
                large={libraryEmpty}
                onUploaded={() => void load(true)}
                uploadOptions={{ visibility, groupId: visibility === "GROUP" ? groupId : undefined }}
                sharingLabel={sharingLabel}
              />
            )}
          </Box>
        </Collapse>
      )}

      <Box
        sx={(theme) => ({
          bgcolor: theme.palette.rag.surface,
          border: `1px solid ${theme.palette.rag.line}`,
          borderRadius: "14px",
          boxShadow: theme.palette.rag.shadow,
          overflow: "hidden",
        })}
      >
        {/* Toolbar */}
        <Box
          sx={(theme) => ({
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1.25,
            p: 1.5,
            borderBottom: `1px solid ${theme.palette.rag.line}`,
          })}
        >
          <Box
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              height: 36,
              px: 1.25,
              flex: { xs: "1 1 100%", md: "0 1 280px" },
              borderRadius: "10px",
              bgcolor: theme.palette.rag.sunken,
              border: `1px solid ${theme.palette.rag.line}`,
              transition: "border-color 150ms ease, box-shadow 150ms ease",
              "&:focus-within": { borderColor: theme.palette.rag.primary, boxShadow: theme.palette.rag.focus },
            })}
          >
            <SearchRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
            <InputBase
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file name"
              inputProps={{ "aria-label": "Search documents" }}
              sx={{ flex: 1, fontSize: "0.8125rem" }}
            />
            {search && (
              <IconButton size="small" onClick={() => setSearch("")} aria-label="Clear search" sx={{ width: 22, height: 22 }}>
                <CloseRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>

          <Segmented
            label="Index status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "indexed", label: "Indexed", count: counts.indexed },
              { value: "not-indexed", label: "Not indexed", count: counts.notIndexed },
            ]}
          />

          <Box sx={{ flex: 1 }} />

          <Select
            size="small"
            value={kind}
            onChange={(e) => setKind(e.target.value as FileKind | "all")}
            inputProps={{ "aria-label": "File type" }}
            sx={{ minWidth: 130, fontSize: "0.8125rem", "& .MuiSelect-select": { py: "7px" } }}
          >
            <MenuItem value="all">All types</MenuItem>
            <MenuItem value="pdf">PDF</MenuItem>
            <MenuItem value="docx">Word</MenuItem>
            <MenuItem value="xlsx">Excel</MenuItem>
            <MenuItem value="image">Images</MenuItem>
          </Select>
          <Select
            size="small"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            inputProps={{ "aria-label": "Sort" }}
            sx={{ minWidth: 130, fontSize: "0.8125rem", "& .MuiSelect-select": { py: "7px" } }}
          >
            <MenuItem value="newest">Newest first</MenuItem>
            <MenuItem value="oldest">Oldest first</MenuItem>
            <MenuItem value="name">Name A–Z</MenuItem>
          </Select>
        </Box>

        {/* Column header (desktop) */}
        <Box
          sx={(theme) => ({
            display: { xs: "none", md: "grid" },
            gridTemplateColumns: "minmax(0, 1fr) 110px 150px 140px 120px",
            gap: 2,
            px: 2.5,
            py: 1,
            fontSize: "0.75rem",
            color: "text.secondary",
            borderBottom: `1px solid ${theme.palette.rag.line}`,
          })}
        >
          <span>Name</span>
          <span>Type</span>
          <span>Status</span>
          <span>Uploaded</span>
          <span style={{ textAlign: "right" }}>Actions</span>
        </Box>

        {/* Body */}
        {loading ? (
          <Box>
            {[0, 1, 2, 3, 4].map((i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2, px: 2.5, py: 1.6 }}>
                <Skeleton variant="rounded" width={28} height={34} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width={`${40 + ((i * 13) % 30)}%`} height={18} />
                </Box>
                <Skeleton width={80} height={18} sx={{ display: { xs: "none", md: "block" } }} />
                <Skeleton width={90} height={18} sx={{ display: { xs: "none", md: "block" } }} />
              </Box>
            ))}
          </Box>
        ) : loadError ? (
          <EmptyState
            icon={<FolderOpenOutlinedIcon />}
            title="Couldn't load documents"
            description={loadError}
            action={
              <Button variant="outlined" onClick={() => void load()} startIcon={<RefreshRoundedIcon />}>
                Try again
              </Button>
            }
          />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FolderOpenOutlinedIcon />}
            title="No documents yet"
            description={
              canUpload
                ? "Use the upload area above. Each file is parsed, split into passages and indexed so it can answer questions."
                : "When an admin shares documents with your organisation, they'll appear here."
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={<SearchOffRoundedIcon />}
            title="No documents match these filters"
            action={
              filtersActive ? (
                <Button size="small" variant="outlined" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Box className="rag-stagger">
            {visible.map((doc, i) => {
              const docKind = getFileKind(doc.filename, doc.file_type);
              const highlighted = highlightId === doc.id;
              return (
                <Box
                  key={doc.id}
                  style={{ ["--i" as string]: Math.min(i, 12) }}
                  onClick={() => openDetails(doc)}
                  sx={(theme) => ({
                    display: "grid",
                    gridTemplateColumns: { xs: "minmax(0,1fr) auto", md: "minmax(0, 1fr) 110px 150px 140px 120px" },
                    alignItems: "center",
                    gap: 2,
                    px: 2.5,
                    py: 1.25,
                    cursor: "pointer",
                    borderBottom: `1px solid ${theme.palette.rag.line}`,
                    bgcolor: highlighted ? theme.palette.rag.primarySoft : "transparent",
                    transition: "background-color 400ms ease",
                    "&:last-of-type": { borderBottom: "none" },
                    "&:hover": { bgcolor: highlighted ? theme.palette.rag.primarySoft : theme.palette.action.hover },
                    "&:hover .row-actions": { opacity: 1 },
                  })}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                    <FileTypeIcon filename={doc.filename} fileType={doc.file_type} size={34} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: "0.8438rem", fontWeight: 520 }} title={doc.filename}>
                        {doc.filename}
                      </Typography>
                      <Typography noWrap sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.75, fontSize: "0.72rem", color: "text.secondary" }}>
                        {VISIBILITY_LABEL[doc.visibility ?? "PRIVATE"]}
                        {doc.group_name ? ` · ${doc.group_name}` : ""}
                        {doc.page_count ? ` · ${doc.page_count} pages` : ""}
                        {(doc.version ?? 1) > 1 ? ` · v${doc.version}` : ""}
                        {doc.ocr_pages ? " · OCR" : ""}
                        {doc.legal_hold ? " · Legal hold" : ""}
                        {doc.source_path?.startsWith("watch:") ? " · Watched folder" : ""}
                        {isAdmin && doc.owner ? ` · ${doc.owner}` : ""}
                        {doc.pii_summary && doc.pii_summary.total > 0 && (
                          <Tooltip title={`Personal data ${doc.pii_summary.mode === "redact" ? "redacted" : "found"}: ` +
                            Object.entries(doc.pii_summary.counts).map(([k, v]) => `${k} ${v}`).join(", ")}>
                            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.3,
                                                         color: doc.pii_summary.mode === "redact" ? "success.main" : "warning.main" }}>
                              <ShieldOutlinedIcon sx={{ fontSize: 13 }} />
                              {doc.pii_summary.mode === "redact" ? "PII redacted" : "Contains PII"}
                            </Box>
                          </Tooltip>
                        )}
                      </Typography>
                      <Typography sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 0.75, fontSize: "0.72rem", color: "text.secondary" }}>
                        <StatusDot tone={STATE_TONE[docState(doc)]} size={6} />
                        {STATE_LABEL[docState(doc)]} · {formatRelative(doc.created_at)}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography sx={{ display: { xs: "none", md: "block" }, fontSize: "0.8125rem", color: "text.secondary" }}>
                    {FILE_KIND_LABEL[docKind]}
                  </Typography>

                  <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.9 }}>
                    <StatusDot tone={STATE_TONE[docState(doc)]} size={7} />
                    <Tooltip title={docState(doc) === "failed" ? doc.error_message ?? "" : ""}>
                      <Typography sx={{ fontSize: "0.8125rem", color: docState(doc) === "failed" ? "error.main" : undefined }}>
                        {STATE_LABEL[docState(doc)]}
                      </Typography>
                    </Tooltip>
                  </Box>

                  <Tooltip title={formatDate(doc.created_at)} placement="top-start">
                    <Typography sx={{ display: { xs: "none", md: "block" }, fontSize: "0.8125rem", color: "text.secondary" }}>
                      {formatRelative(doc.created_at)}
                    </Typography>
                  </Tooltip>

                  <Box
                    className="row-actions"
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 0.25,
                      opacity: { xs: 1, md: 0.55 },
                      transition: "opacity 150ms ease",
                    }}
                  >
                    <Tooltip title={isReady(doc) ? "Ask about this document" : "Not indexed yet"}>
                      <span>
                        <IconButton size="small" disabled={!isReady(doc)} onClick={() => askAbout(doc)} aria-label={`Ask about ${doc.filename}`}>
                          <ForumOutlinedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    {isReady(doc) && (
                      <Tooltip title="Summarise">
                        <IconButton size="small" onClick={() => void summarise(doc)} aria-label={`Summarise ${doc.filename}`}>
                          <SummarizeOutlinedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {docState(doc) === "failed" && canUpload && (
                      <Tooltip title={`Retry indexing${doc.error_message ? ` — ${doc.error_message}` : ""}`}>
                        <IconButton size="small" onClick={() => void retry(doc)} aria-label={`Retry ${doc.filename}`}
                                    sx={{ color: "warning.main" }}>
                          <ReplayRoundedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Details">
                      <IconButton size="small" onClick={() => openDetails(doc)} aria-label={`Details for ${doc.filename}`}>
                        <VisibilityOutlinedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    {canUpload && (
                      <Tooltip title={isAdmin ? "Delete" : "Delete (your own uploads only)"}>
                        <IconButton
                          size="small"
                          onClick={() => setToDelete(doc)}
                          aria-label={`Delete ${doc.filename}`}
                          sx={{ "&:hover": { color: "error.main" } }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {!loading && !loadError && visible.length > 0 && (
          <Box
            sx={(theme) => ({
              px: 2.5,
              py: 1.25,
              fontSize: "0.75rem",
              color: "text.secondary",
              borderTop: `1px solid ${theme.palette.rag.line}`,
            })}
          >
            Showing {visible.length} of {documents.length} document{documents.length === 1 ? "" : "s"}
          </Box>
        )}
      </Box>

      <Dialog open={summaryFor !== null} onClose={() => setSummaryFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: "1.0625rem" }}>Summary · {summaryFor}</DialogTitle>
        <DialogContent>
          {summary === null ? (
            <Box sx={{ py: 4, display: "flex", alignItems: "center", gap: 2, justifyContent: "center" }}>
              <CircularProgress size={20} />
              <Typography color="text.secondary">The local AI is reading the document…</Typography>
            </Box>
          ) : (
            <>
              <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: "0.9rem" }}>{summary.summary}</Typography>
              <Typography sx={{ display: "block", mt: 2, fontSize: "0.75rem", color: "text.secondary" }}>
                Based on {summary.covered} ({summary.characters_used.toLocaleString()} characters).
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryFor(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <DocumentDrawer
        document={drawerDoc}
        open={drawerOpen}
        canDelete={canUpload}
        isAdmin={isAdmin}
        onClose={() => setDrawerOpen(false)}
        onDelete={(doc) => setToDelete(doc)}
        onChanged={() => void load(true)}
      />

      <Dialog open={Boolean(toDelete)} onClose={() => !deleting && setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: "1.0625rem", pb: 1 }}>Delete this document?</DialogTitle>
        <DialogContent>
          {toDelete && (
            <Box
              sx={(theme) => ({
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.25,
                mb: 1.5,
                borderRadius: "10px",
                bgcolor: theme.palette.rag.raised,
                border: `1px solid ${theme.palette.rag.line}`,
              })}
            >
              <FileTypeIcon filename={toDelete.filename} fileType={toDelete.file_type} size={30} />
              <Typography noWrap sx={{ fontSize: "0.8125rem", fontWeight: 540 }}>
                {toDelete.filename}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" color="text.secondary">
            The file and its indexed passages will be removed. It will no longer be used to answer questions. This can't
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="text" onClick={() => setToDelete(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void confirmDelete()}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlineRoundedIcon />}
          >
            {deleting ? "Deleting…" : "Delete document"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
