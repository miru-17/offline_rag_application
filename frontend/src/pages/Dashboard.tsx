import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  InputBase,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { getDocuments, type DocumentItem } from "../api/documents.api";
import { getConversations, type Conversation } from "../api/conversation.api";
import { getLicenseStatus, type LicenseStatusResponse } from "../api/license.api";
import { getRAGSettings, type RAGSettings } from "../api/ragsettings.api";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { useCountUp } from "../hooks/useCountUp";
import Panel from "../components/common/Panel";
import EmptyState from "../components/common/EmptyState";
import FileTypeIcon from "../components/common/FileTypeIcon";
import StatusDot, { type StatusTone } from "../components/common/StatusDot";
import {
  formatDate,
  formatRelative,
  getFileKind,
  getGreeting,
  getTimestamp,
} from "../utils/format";

/* =========================================================
   DATA
   ========================================================= */

interface Loadable<T> {
  data: T;
  loading: boolean;
  error: boolean;
}

function useLoad<T>(loader: () => Promise<T>, initial: T) {
  const [state, setState] = useState<Loadable<T>>({ data: initial, loading: true, error: false });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let mounted = true;
    setState((s) => ({ ...s, loading: true }));
    loader()
      .then((data) => mounted && setState({ data, loading: false, error: false }))
      .catch(() => mounted && setState({ data: initial, loading: false, error: true }));
    return () => {
      mounted = false;
    };
    // loader/initial are stable module-level values; reload via nonce.
  }, [nonce]); // eslint-disable-line

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

/* =========================================================
   SMALL PIECES
   ========================================================= */

function Metric({
  label,
  value,
  loading,
  footer,
  accent,
}: {
  label: string;
  value: number;
  loading: boolean;
  footer?: ReactNode;
  accent?: string;
}) {
  const animated = useCountUp(loading ? 0 : value);

  return (
    <Box sx={{ p: 2.5, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>{label}</Typography>
      {loading ? (
        <Skeleton variant="rounded" width={72} height={38} />
      ) : (
        <Typography
          sx={{
            fontSize: "2.125rem",
            fontWeight: 600,
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
            color: accent ?? "text.primary",
          }}
        >
          {animated}
        </Typography>
      )}
      <Box sx={{ minHeight: 20 }}>{loading ? <Skeleton width="70%" height={16} /> : footer}</Box>
    </Box>
  );
}

function MeterBar({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        height: 6,
        borderRadius: 6,
        overflow: "hidden",
        bgcolor: theme.palette.rag.sunken,
        gap: "2px",
      })}
    >
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <Tooltip key={s.label} title={`${s.label}: ${s.value}`}>
              <Box
                sx={{
                  width: `${(s.value / total) * 100}%`,
                  bgcolor: s.color,
                  transition: "width 700ms cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            </Tooltip>
          ))}
    </Box>
  );
}

function StatusRow({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: string;
  tone: StatusTone;
  loading: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1.25,
        "&:not(:last-of-type)": { borderBottom: `1px solid ${theme.palette.rag.line}` },
      })}
    >
      <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", flex: 1 }}>{label}</Typography>
      {loading ? (
        <Skeleton width={90} height={18} />
      ) : (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <StatusDot tone={tone} size={7} />
          <Typography noWrap sx={{ fontSize: "0.8125rem", fontWeight: 520 }}>
            {value}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/* Hero visual: the three stages every answer passes through, with live state. */
function PipelineNode({
  title,
  detail,
  sub,
  tone,
  color,
  loading,
}: {
  title: string;
  detail: string;
  sub?: string;
  tone: StatusTone;
  color: string;
  loading: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        position: "relative",
        flex: 1,
        minWidth: 0,
        p: 1.75,
        borderRadius: "12px",
        bgcolor: theme.palette.rag.surface,
        border: `1px solid ${theme.palette.rag.line}`,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "-1px -1px auto -1px",
          height: 2,
          borderRadius: "12px 12px 0 0",
          background: color,
          opacity: 0.85,
        },
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
        <StatusDot tone={tone} size={6} />
        <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{title}</Typography>
      </Box>
      {loading ? (
        <Skeleton width="80%" height={20} />
      ) : (
        <>
          <Typography noWrap sx={{ fontSize: "0.875rem", fontWeight: 560 }}>
            {detail}
          </Typography>
          {sub && (
            <Typography noWrap sx={{ fontSize: "0.72rem", color: "text.secondary", mt: 0.25 }}>
              {sub}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

function PipelineLink({ color }: { color: string }) {
  return (
    <Box
      aria-hidden
      sx={{
        display: { xs: "none", sm: "block" },
        position: "relative",
        width: 28,
        flexShrink: 0,
        alignSelf: "center",
        height: 2,
        background: `linear-gradient(90deg, transparent, ${color})`,
        overflow: "hidden",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          width: "40%",
          background: `linear-gradient(90deg, transparent, #fff, transparent)`,
          opacity: 0.6,
          animation: "ragScan 2.6s ease-in-out infinite",
        },
      }}
    />
  );
}

/* =========================================================
   DASHBOARD
   ========================================================= */

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role?.toUpperCase();
  const canUpload = role === "ADMIN" || role === "USER";

  const [question, setQuestion] = useState("");

  const docs = useLoad<DocumentItem[]>(getDocuments, []);
  const convos = useLoad<Conversation[]>(getConversations, []);
  const license = useLoad<LicenseStatusResponse | null>(getLicenseStatus, null);
  const rag = useLoad<RAGSettings | null>(getRAGSettings, null);
  const system = useSystemStatus();

  /* ---------- derived, all from API responses ---------- */
  const documents = docs.data;
  const total = documents.length;
  const indexed = documents.filter((d) => d.processed).length;
  const notIndexed = total - indexed;
  const coverage = total ? Math.round((indexed / total) * 100) : 0;
  const animatedCoverage = useCountUp(docs.loading ? 0 : coverage);

  const byKind = {
    pdf: documents.filter((d) => getFileKind(d.filename, d.file_type) === "pdf").length,
    docx: documents.filter((d) => getFileKind(d.filename, d.file_type) === "docx").length,
    xlsx: documents.filter((d) => getFileKind(d.filename, d.file_type) === "xlsx").length,
  };

  const recentDocs = [...documents]
    .sort((a, b) => getTimestamp(b.created_at) - getTimestamp(a.created_at))
    .slice(0, 6);

  const recentConvos = [...convos.data]
    .sort((a, b) => getTimestamp(b.updated_at) - getTimestamp(a.updated_at))
    .slice(0, 5);

  const lic = license.data?.license ?? null;
  const daysLeft = lic
    ? Math.ceil((getTimestamp(lic.expires_at) - Date.now()) / 86_400_000)
    : null;
  const licenseValid = Boolean(license.data?.licensed && lic?.is_active && (daysLeft ?? 0) > 0);

  const s = system.status;

  const refreshAll = () => {
    docs.reload();
    convos.reload();
    license.reload();
    rag.reload();
    void system.refresh();
  };

  const handleAsk = (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    navigate("/ai-workspace", { state: { prefill: text, autoSubmit: true } });
  };

  return (
    <Box className="rag-stagger" sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* ================= HERO ================= */}
      <Box
        style={{ ["--i" as string]: 0 }}
        sx={(theme) => ({
          position: "relative",
          overflow: "hidden",
          borderRadius: "18px",
          border: `1px solid ${theme.palette.rag.line}`,
          p: { xs: 2.5, md: 4 },
          background:
            theme.palette.mode === "dark"
              ? `linear-gradient(135deg, rgba(91,140,255,0.10) 0%, rgba(139,124,255,0.06) 45%, rgba(45,212,230,0.05) 100%), ${theme.palette.rag.surface}`
              : `linear-gradient(135deg, rgba(47,91,234,0.06) 0%, rgba(106,79,224,0.04) 45%, rgba(8,145,178,0.04) 100%), ${theme.palette.rag.surface}`,
          boxShadow: theme.palette.rag.shadow,
        })}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.1fr) minmax(0, 1fr)" },
            gap: { xs: 3, lg: 5 },
            alignItems: "center",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mb: 1 }}>
              {getGreeting()}, {user?.username}
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.75rem", md: "2.25rem" },
                fontWeight: 600,
                letterSpacing: "-0.035em",
                lineHeight: 1.12,
                maxWidth: 560,
              }}
            >
              Context-aware intelligence, built on your knowledge.
            </Typography>

            <Box
              component="form"
              onSubmit={handleAsk}
              sx={(theme) => ({
                mt: 3,
                display: "flex",
                alignItems: "center",
                gap: 1,
                maxWidth: 560,
                pl: 2,
                pr: 0.75,
                height: 52,
                borderRadius: "14px",
                bgcolor: theme.palette.rag.surface,
                border: `1px solid ${theme.palette.rag.lineStrong}`,
                boxShadow: theme.palette.rag.shadow,
                transition: "box-shadow 160ms ease, border-color 160ms ease",
                "&:focus-within": {
                  borderColor: theme.palette.rag.primary,
                  boxShadow: theme.palette.rag.focus,
                },
              })}
            >
              <InputBase
                fullWidth
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  indexed > 0
                    ? `Ask about your ${indexed} indexed document${indexed === 1 ? "" : "s"}…`
                    : "Ask a question about your documents…"
                }
                inputProps={{ "aria-label": "Ask a question" }}
                sx={{ fontSize: "0.9375rem" }}
              />
              <IconButton
                type="submit"
                disabled={!question.trim()}
                aria-label="Ask in AI Workspace"
                sx={(theme) => ({
                  width: 38,
                  height: 38,
                  color: "#fff",
                  bgcolor: theme.palette.rag.primary,
                  "&:hover": { bgcolor: theme.palette.rag.primary, color: "#fff", filter: "brightness(1.1)" },
                  "&.Mui-disabled": { bgcolor: theme.palette.rag.raised, color: theme.palette.rag.textFaint },
                })}
              >
                <ArrowUpwardRoundedIcon sx={{ fontSize: 19 }} />
              </IconButton>
            </Box>

            <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
              {canUpload && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<UploadFileOutlinedIcon />}
                  onClick={() => navigate("/documents", { state: { openUpload: true } })}
                >
                  Upload documents
                </Button>
              )}
              <Button
                variant="text"
                size="small"
                startIcon={<ForumOutlinedIcon />}
                onClick={() => navigate("/ai-workspace")}
              >
                Open AI Workspace
              </Button>
            </Box>
          </Box>

          {/* Pipeline */}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mb: 1.25 }}>
              How your answers are produced
            </Typography>
            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: { xs: 1, sm: 0 } }}>
              <PipelineNode
                title="Your library"
                detail={docs.error ? "Unavailable" : `${indexed} indexed`}
                sub={docs.error ? undefined : `of ${total} document${total === 1 ? "" : "s"}`}
                tone={docs.error ? "danger" : indexed > 0 ? "success" : "warning"}
                color="#5B8CFF"
                loading={docs.loading}
              />
              <PipelineLink color="#2DD4E6" />
              <PipelineNode
                title="Retrieval"
                detail={s ? s.vector_store : system.error ? "Unavailable" : "—"}
                sub={rag.data ? `Top ${rag.data.retrieval_depth} passages` : undefined}
                tone={system.error ? "danger" : system.apiOnline ? "success" : "neutral"}
                color="#2DD4E6"
                loading={system.loading && !s}
              />
              <PipelineLink color="#8B7CFF" />
              <PipelineNode
                title="Generation"
                detail={s ? s.model : system.error ? "Unavailable" : "—"}
                sub={s ? `Ollama · ${system.modelReady ? "ready" : "not available"}` : undefined}
                tone={system.allReady ? "success" : system.loading ? "neutral" : "warning"}
                color="#8B7CFF"
                loading={system.loading && !s}
              />
            </Box>
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: 1.25 }}>
              Questions are matched against your indexed documents, then answered by the local model using only
              those passages.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ================= METRICS ================= */}
      <Box
        style={{ ["--i" as string]: 1 }}
        sx={(theme) => ({
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" },
          bgcolor: theme.palette.rag.surface,
          border: `1px solid ${theme.palette.rag.line}`,
          borderRadius: "14px",
          boxShadow: theme.palette.rag.shadow,
          "& > *": { borderColor: `${theme.palette.rag.line} !important` },
          "& > *:not(:last-of-type)": { borderRight: { lg: "1px solid" } },
          "& > *:nth-of-type(odd)": { borderRight: { xs: "1px solid", lg: undefined } },
          "& > *:nth-of-type(-n+2)": { borderBottom: { xs: "1px solid", lg: "none" } },
        })}
      >
        <Metric
          label="Documents"
          value={total}
          loading={docs.loading}
          footer={
            total > 0 ? (
              <Box>
                <MeterBar
                  segments={[
                    { label: "PDF", value: byKind.pdf, color: "#F06A6A" },
                    { label: "Word", value: byKind.docx, color: "#5B8CFF" },
                    { label: "Excel", value: byKind.xlsx, color: "#2FBF8A" },
                  ]}
                />
                <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", mt: 0.75 }}>
                  {[
                    byKind.pdf && `${byKind.pdf} PDF`,
                    byKind.docx && `${byKind.docx} Word`,
                    byKind.xlsx && `${byKind.xlsx} Excel`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                {docs.error ? "Couldn't load documents" : "Nothing uploaded yet"}
              </Typography>
            )
          }
        />
        <Metric
          label="Indexed for search"
          value={indexed}
          loading={docs.loading}
          footer={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <MeterBar segments={[{ label: "Indexed", value: indexed, color: "#2DD4E6" }, { label: "Not indexed", value: notIndexed, color: "transparent" }]} />
              </Box>
              <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                {animatedCoverage}%
              </Typography>
            </Box>
          }
        />
        <Metric
          label="Not indexed"
          value={notIndexed}
          loading={docs.loading}
          footer={
            <Typography sx={{ fontSize: "0.75rem", color: notIndexed > 0 ? "warning.main" : "text.secondary" }}>
              {notIndexed > 0 ? "Can't be used in answers yet" : total > 0 ? "Everything is searchable" : "No documents yet"}
            </Typography>
          }
        />
        <Metric
          label="Your conversations"
          value={convos.data.length}
          loading={convos.loading}
          footer={
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
              {recentConvos[0] ? `Last active ${formatRelative(recentConvos[0].updated_at)}` : "No conversations yet"}
            </Typography>
          }
        />
      </Box>

      {/* ================= DETAIL GRID ================= */}
      <Box
        style={{ ["--i" as string]: 2 }}
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.7fr) minmax(320px, 1fr)" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, minWidth: 0 }}>
          {/* Recent documents */}
          <Panel
            title="Recently added"
            description="The newest documents in your library"
            padded={false}
            action={
              <Button size="small" endIcon={<ChevronRightRoundedIcon />} onClick={() => navigate("/documents")}>
                All documents
              </Button>
            }
          >
            <Box sx={{ px: 1.25, pb: 1.25, pt: 1 }}>
              {docs.loading ? (
                [0, 1, 2, 3].map((i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.25, py: 1.25 }}>
                    <Skeleton variant="rounded" width={28} height={34} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton width="45%" height={18} />
                      <Skeleton width="25%" height={14} />
                    </Box>
                  </Box>
                ))
              ) : recentDocs.length === 0 ? (
                <EmptyState
                  compact
                  icon={<FolderOpenOutlinedIcon />}
                  title={docs.error ? "Couldn't load documents" : "Your library is empty"}
                  description={
                    docs.error
                      ? "Check that the backend is running, then refresh."
                      : canUpload
                        ? "Upload PDF, Word or Excel files and they'll be indexed for questions."
                        : "An admin hasn't shared any documents with your organisation yet."
                  }
                  action={
                    docs.error ? (
                      <Button variant="outlined" size="small" onClick={docs.reload}>
                        Retry
                      </Button>
                    ) : canUpload ? (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<UploadFileOutlinedIcon />}
                        onClick={() => navigate("/documents", { state: { openUpload: true } })}
                      >
                        Upload documents
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                recentDocs.map((doc) => (
                  <ButtonBase
                    key={doc.id}
                    onClick={() => navigate("/documents", { state: { focusId: doc.id } })}
                    sx={(theme) => ({
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 1.25,
                      py: 1.1,
                      borderRadius: "10px",
                      textAlign: "left",
                      transition: "background-color 150ms ease",
                      "&:hover": { bgcolor: theme.palette.action.hover },
                      "&:hover .row-chevron": { opacity: 1, transform: "translateX(0)" },
                    })}
                  >
                    <FileTypeIcon filename={doc.filename} fileType={doc.file_type} size={34} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: "0.8438rem", fontWeight: 520 }}>
                        {doc.filename}
                      </Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                        Added {formatRelative(doc.created_at)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <StatusDot tone={doc.processed ? "retrieve" : "warning"} size={6} />
                      <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", display: { xs: "none", sm: "block" } }}>
                        {doc.processed ? "Indexed" : "Not indexed"}
                      </Typography>
                    </Box>
                    <ChevronRightRoundedIcon
                      className="row-chevron"
                      sx={{ fontSize: 18, color: "text.secondary", opacity: 0, transform: "translateX(-4px)", transition: "all 180ms ease" }}
                    />
                  </ButtonBase>
                ))
              )}
            </Box>
          </Panel>

          {/* Recent conversations */}
          <Panel
            title="Recent conversations"
            padded={false}
            action={
              <Button size="small" endIcon={<ChevronRightRoundedIcon />} onClick={() => navigate("/ai-workspace")}>
                Workspace
              </Button>
            }
          >
            <Box sx={{ px: 1.25, pb: 1.25, pt: 1 }}>
              {convos.loading ? (
                [0, 1, 2].map((i) => (
                  <Box key={i} sx={{ px: 1.25, py: 1.25 }}>
                    <Skeleton width="55%" height={18} />
                  </Box>
                ))
              ) : recentConvos.length === 0 ? (
                <EmptyState
                  compact
                  icon={<ChatBubbleOutlineRoundedIcon />}
                  title="No conversations yet"
                  description="Ask your first question above. Conversations are saved for you only."
                />
              ) : (
                recentConvos.map((c) => (
                  <ButtonBase
                    key={c.id}
                    onClick={() => navigate("/ai-workspace", { state: { conversationId: c.id } })}
                    sx={(theme) => ({
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 1.25,
                      py: 1.1,
                      borderRadius: "10px",
                      textAlign: "left",
                      "&:hover": { bgcolor: theme.palette.action.hover },
                    })}
                  >
                    <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
                    <Typography noWrap sx={{ flex: 1, fontSize: "0.8438rem" }}>
                      {c.title || "Untitled conversation"}
                    </Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", flexShrink: 0 }}>
                      {formatRelative(c.updated_at)}
                    </Typography>
                  </ButtonBase>
                ))
              )}
            </Box>
          </Panel>
        </Box>

        {/* Right column */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, minWidth: 0 }}>
          <Panel
            title="Platform status"
            description={
              system.checkedAt ? `Checked ${formatRelative(new Date(system.checkedAt).toISOString())}` : "Checking…"
            }
            action={
              <Tooltip title="Refresh all">
                <IconButton size="small" onClick={refreshAll} aria-label="Refresh dashboard">
                  <RefreshRoundedIcon
                    sx={{ fontSize: 18, animation: system.loading ? "ragSpin 900ms linear infinite" : "none" }}
                  />
                </IconButton>
              </Tooltip>
            }
          >
            <StatusRow
              label="API"
              loading={system.loading && !s && !system.error}
              tone={system.apiOnline ? "success" : "danger"}
              value={system.apiOnline ? "Healthy" : "Unreachable"}
            />
            <StatusRow
              label="Ollama runtime"
              loading={system.loading && !s && !system.error}
              tone={system.ollamaOnline ? "success" : "danger"}
              value={system.ollamaOnline ? "Online" : "Offline"}
            />
            <StatusRow
              label="Language model"
              loading={system.loading && !s && !system.error}
              tone={system.modelReady ? "success" : "warning"}
              value={s ? `${s.model} · ${system.modelReady ? "ready" : "not pulled"}` : "Unknown"}
            />
            <StatusRow
              label="Vector store"
              loading={system.loading && !s && !system.error}
              tone={s ? "success" : "neutral"}
              value={s?.vector_store ?? "Unknown"}
            />
            <StatusRow
              label="Deployment"
              loading={system.loading && !s && !system.error}
              tone={s ? "success" : "neutral"}
              value={s ? `${s.deployment}, ${s.mode}` : "Unknown"}
            />
          </Panel>

          <Panel title="License">
            {license.loading ? (
              <Skeleton height={48} />
            ) : license.error || !lic ? (
              <Typography variant="body2" color="text.secondary">
                {license.error ? "Couldn't load license status." : "No license is installed for this organisation."}
              </Typography>
            ) : (
              <Box>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography
                    sx={{
                      fontSize: "1.75rem",
                      fontWeight: 600,
                      letterSpacing: "-0.03em",
                      fontVariantNumeric: "tabular-nums",
                      color: !licenseValid ? "error.main" : (daysLeft ?? 0) <= 14 ? "warning.main" : "text.primary",
                    }}
                  >
                    {licenseValid ? Math.max(daysLeft ?? 0, 0) : 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {licenseValid ? "days remaining" : "license inactive or expired"}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: 0.5 }}>
                  {licenseValid ? "Expires" : "Expired"} {formatDate(lic.expires_at)}
                  {!licenseValid && " — uploads and questions are disabled until it's renewed."}
                </Typography>
              </Box>
            )}
          </Panel>

          <Panel title="Retrieval settings" description="Applied to every question in your organisation">
            {rag.loading ? (
              <Skeleton height={40} />
            ) : rag.data ? (
              <Box sx={{ display: "flex", gap: 3 }}>
                <Box>
                  <Typography sx={{ fontSize: "1.375rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {rag.data.retrieval_depth}
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>passages per answer</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: "1.375rem", fontWeight: 600 }}>
                    {rag.data.source_attribution ? "On" : "Off"}
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>source citations</Typography>
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Couldn't load retrieval settings.
              </Typography>
            )}
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}
