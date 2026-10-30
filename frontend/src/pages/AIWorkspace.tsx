import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Button, Drawer, IconButton, Tooltip, Typography } from "@mui/material";
import ViewSidebarOutlinedIcon from "@mui/icons-material/ViewSidebarOutlined";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";

import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { queryDocuments, type QuerySource } from "../api/query.api";
import {
  deleteConversation,
  getConversation,
  getConversations,
  type Conversation,
} from "../api/conversation.api";
import { getDocuments, type DocumentItem } from "../api/documents.api";
import { getRAGSettings } from "../api/ragsettings.api";
import { getLicenseStatus } from "../api/license.api";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { toast } from "../components/common/Toast";
import { getApiErrorMessage, getTimestamp } from "../utils/format";

import ConversationList from "../components/workspace/ConversationList";
import MessageItem from "../components/workspace/MessageItem";
import ThinkingTurn from "../components/workspace/ThinkingTurn";
import Composer from "../components/workspace/Composer";
import WorkspaceIntro from "../components/workspace/WorkspaceIntro";
import { EvidenceDrawer } from "../components/workspace/Sources";
import type { ChatMessage } from "../components/workspace/types";

const HISTORY_KEY = "ragentis_workspace_history_open";

interface NavState {
  prefill?: string;
  autoSubmit?: boolean;
  conversationId?: string;
}

interface FailedTurn {
  question: string;
  message: string;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const readHistoryOpen = () => {
  try {
    return localStorage.getItem(HISTORY_KEY) !== "0";
  } catch {
    return true;
  }
};

export default function AIWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const system = useSystemStatus();
  const role = user?.role?.toUpperCase();
  const canUpload = role === "ADMIN" || role === "USER";

  /* ---------------- state ---------------- */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [failed, setFailed] = useState<FailedTurn | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [citationsEnabled, setCitationsEnabled] = useState<boolean | null>(null);
  const [licenseBlocked, setLicenseBlocked] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(readHistoryOpen);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [evidence, setEvidence] = useState<{ sources: QuerySource[]; index: number } | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const handledNavKey = useRef<string | null>(null);

  const modelName = system.status?.model;
  const hasThread = messages.length > 0 || isAsking;

  /* ---------------- loaders ---------------- */
  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setConversationsLoading(true);
    try {
      setConversations(await getConversations());
    } catch (err) {
      if (!silent) toast.error(getApiErrorMessage(err, "Couldn't load conversations."));
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();

    getDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setDocumentsLoading(false));

    getRAGSettings()
      .then((s) => setCitationsEnabled(s.source_attribution))
      .catch(() => setCitationsEnabled(null));

    getLicenseStatus()
      .then((s) => {
        const lic = s.license;
        const valid = Boolean(s.licensed && lic?.is_active && getTimestamp(lic.expires_at) > Date.now());
        setLicenseBlocked(!valid);
      })
      .catch(() => setLicenseBlocked(false)); // let the API decide
  }, [loadConversations]);

  /* ---------------- scrolling ---------------- */
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useLayoutEffect(() => {
    if (atBottom) scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isAsking, failed]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const focusInput = () => window.setTimeout(() => inputRef.current?.focus(), 60);

  /* ---------------- actions ---------------- */
  const ask = useCallback(
    async (question: string, options: { retry?: boolean } = {}) => {
      const text = question.trim();
      if (!text || isAsking) return;

      setFailed(null);
      if (!options.retry) {
        setMessages((current) => [
          ...current,
          { id: newId(), role: "user", content: text, createdAt: new Date().toISOString(), fresh: true },
        ]);
        setQuery("");
      }
      setAtBottom(true);
      setIsAsking(true);

      try {
        const response = await queryDocuments(text, conversationId ?? undefined);
        setConversationId(response.conversation_id);
        setMessages((current) => [
          ...current,
          {
            id: newId(),
            role: "assistant",
            content: response.answer,
            sources: response.sources ?? [],
            createdAt: new Date().toISOString(),
            fresh: true,
          },
        ]);
        void loadConversations(true);
      } catch (err) {
        const message = getApiErrorMessage(
          err,
          "The question couldn't be answered. Check that Ollama is running and try again.",
        );
        setFailed({ question: text, message });
      } finally {
        setIsAsking(false);
        focusInput();
      }
    },
    [conversationId, isAsking, loadConversations],
  );

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setQuery("");
    setFailed(null);
    setConversationId(null);
    setEvidenceOpen(false);
    setMobileHistoryOpen(false);
    focusInput();
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      if (isAsking || loadingConversation) return;
      setMobileHistoryOpen(false);
      if (id === conversationId) return;

      setLoadingConversation(true);
      setFailed(null);
      try {
        const detail = await getConversation(id);
        const ordered = [...detail.messages].sort(
          (a, b) => getTimestamp(a.created_at) - getTimestamp(b.created_at),
        );
        setConversationId(detail.id);
        setMessages(
          ordered.map((m) => ({
            id: m.id,
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
            createdAt: m.created_at,
            sources: [],
            fromHistory: true,
          })),
        );
        setAtBottom(true);
        window.setTimeout(() => scrollToBottom(false), 30);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Couldn't open that conversation."));
      } finally {
        setLoadingConversation(false);
      }
    },
    [conversationId, isAsking, loadingConversation, scrollToBottom],
  );

  const removeConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((current) => current.filter((c) => c.id !== id));
      if (id === conversationId) startNewConversation();
      toast.success("Conversation deleted");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't delete the conversation."));
    }
  };

  const toggleHistory = () => {
    if (window.matchMedia("(max-width: 899.95px)").matches) {
      setMobileHistoryOpen(true);
      return;
    }
    setHistoryOpen((open) => {
      try {
        localStorage.setItem(HISTORY_KEY, open ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !open;
    });
  };

  /* ---------------- navigation state (from dashboard / palette) ---------------- */
  useEffect(() => {
    if (handledNavKey.current === location.key) return;
    handledNavKey.current = location.key;
    const state = (location.state ?? {}) as NavState;
    if (!state.prefill && !state.conversationId) return;
    navigate(location.pathname, { replace: true, state: null });

    if (state.conversationId) {
      void openConversation(state.conversationId);
    } else if (state.prefill) {
      if (state.autoSubmit) void ask(state.prefill);
      else {
        setQuery(state.prefill);
        focusInput();
      }
    }
  }, [location.key, location.state, location.pathname, navigate, ask, openConversation]);

  const firstQuestion = messages.find((m) => m.role === "user")?.content;
  const activeTitle =
    conversations.find((c) => c.id === conversationId)?.title ??
    (firstQuestion ? firstQuestion.slice(0, 60) : "New conversation");

  const historyPanel = (
    <ConversationList
      conversations={conversations}
      loading={conversationsLoading}
      activeId={conversationId}
      disabled={isAsking || loadingConversation}
      onSelect={(id) => void openConversation(id)}
      onDelete={(id) => void removeConversation(id)}
      onNew={startNewConversation}
    />
  );

  /* ---------------- render ---------------- */
  return (
    <Box
      sx={(theme) => ({
        height: "100%",
        display: "flex",
        borderRadius: "16px",
        overflow: "hidden",
        border: `1px solid ${theme.palette.rag.line}`,
        bgcolor: theme.palette.rag.surfaceGlass,
        backdropFilter: "blur(10px)",
        boxShadow: theme.palette.rag.shadow,
      })}
    >
      {/* History — desktop */}
      <Box
        sx={(theme) => ({
          display: { xs: "none", md: "block" },
          width: historyOpen ? 272 : 0,
          flexShrink: 0,
          overflow: "hidden",
          borderRight: historyOpen ? `1px solid ${theme.palette.rag.line}` : "none",
          bgcolor: theme.palette.rag.surface,
          transition: "width 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        })}
      >
        <Box sx={{ width: 272, height: "100%" }}>{historyPanel}</Box>
      </Box>

      {/* History — mobile */}
      <Drawer
        open={mobileHistoryOpen}
        onClose={() => setMobileHistoryOpen(false)}
        sx={{ display: { md: "none" } }}
        slotProps={{ paper: { sx: { width: 290 } } }}
      >
        {historyPanel}
      </Drawer>

      {/* Thread */}
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Thread header */}
        <Box
          sx={(theme) => ({
            height: 52,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.25,
            borderBottom: `1px solid ${theme.palette.rag.line}`,
          })}
        >
          <Tooltip title={historyOpen ? "Hide conversations" : "Show conversations"}>
            <IconButton size="small" onClick={toggleHistory} aria-label="Toggle conversation history">
              <ViewSidebarOutlinedIcon sx={{ fontSize: 19, transform: "scaleX(-1)" }} />
            </IconButton>
          </Tooltip>
          <Typography noWrap sx={{ flex: 1, fontSize: "0.875rem", fontWeight: 560 }}>
            {loadingConversation ? "Opening conversation…" : activeTitle}
          </Typography>
          {hasThread && (
            <Tooltip title="New conversation">
              <IconButton size="small" onClick={startNewConversation} aria-label="New conversation">
                <EditNoteRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Messages */}
        <Box
          ref={scrollRef}
          onScroll={handleScroll}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            opacity: loadingConversation ? 0.45 : 1,
            transition: "opacity 200ms ease",
          }}
        >
          {!hasThread ? (
            <WorkspaceIntro
              documents={documents}
              loading={documentsLoading}
              canUpload={canUpload}
              onAsk={(q) => void ask(q)}
              onUpload={() => navigate("/documents", { state: { openUpload: true } })}
            />
          ) : (
            <Box
              sx={{
                maxWidth: 820,
                mx: "auto",
                px: { xs: 2, md: 3 },
                py: { xs: 3, md: 4 },
                display: "flex",
                flexDirection: "column",
                gap: 3.5,
              }}
            >
              {messages.map((m) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  modelName={modelName}
                  citationsEnabled={citationsEnabled}
                  onOpenSources={(msg, index) => {
                    setEvidence({ sources: msg.sources ?? [], index });
                    setEvidenceOpen(true);
                  }}
                />
              ))}

              {isAsking && <ThinkingTurn modelName={modelName} />}

              {failed && !isAsking && (
                <Box
                  role="alert"
                  sx={(theme) => ({
                    display: "flex",
                    gap: 1.5,
                    alignItems: "flex-start",
                    p: 1.75,
                    borderRadius: "12px",
                    border: `1px solid ${theme.palette.rag.danger}55`,
                    bgcolor: theme.palette.rag.dangerSoft,
                    animation: "ragFadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both",
                  })}
                >
                  <ErrorOutlineRoundedIcon sx={{ color: "error.main", fontSize: 20, mt: 0.25 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 560 }}>No answer was generated</Typography>
                    <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mt: 0.25 }}>
                      {failed.message}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ReplayRoundedIcon />}
                    onClick={() => void ask(failed.question, { retry: true })}
                  >
                    Retry
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Jump to latest */}
        {hasThread && !atBottom && (
          <IconButton
            onClick={() => {
              setAtBottom(true);
              scrollToBottom(true);
            }}
            aria-label="Scroll to latest"
            sx={(theme) => ({
              position: "absolute",
              left: "50%",
              bottom: 128,
              transform: "translateX(-50%)",
              width: 34,
              height: 34,
              borderRadius: "50%",
              bgcolor: theme.palette.rag.surface,
              border: `1px solid ${theme.palette.rag.lineStrong}`,
              boxShadow: theme.palette.rag.shadowLg,
              animation: "ragFadeIn 200ms ease both",
              "&:hover": { bgcolor: theme.palette.rag.raised },
            })}
          >
            <KeyboardArrowDownRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}

        {/* Composer */}
        <Box sx={{ flexShrink: 0, px: { xs: 1.5, md: 3 }, pt: 1.5, pb: { xs: 1.5, md: 2 } }}>
          <Composer
            ref={inputRef}
            value={query}
            onChange={setQuery}
            onSubmit={() => void ask(query)}
            busy={isAsking || loadingConversation}
            disabled={licenseBlocked}
            disabledReason="The license has expired — an admin needs to renew it before questions can be asked."
          />
        </Box>
      </Box>

      <EvidenceDrawer
        open={evidenceOpen}
        sources={evidence?.sources ?? []}
        highlight={evidence?.index ?? null}
        onClose={() => setEvidenceOpen(false)}
      />
    </Box>
  );
}
