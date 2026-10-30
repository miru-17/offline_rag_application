import { memo, useState } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ManageSearchRoundedIcon from "@mui/icons-material/ManageSearchRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";

import BrandMark from "../common/BrandMark";
import Markdown from "./Markdown";
import { SourceChips } from "./Sources";
import { isNotFoundAnswer, type ChatMessage } from "./types";
import { formatRelative } from "../../utils/format";
import AnswerFeedback from "../rag/AnswerFeedback";

interface MessageItemProps {
  message: ChatMessage;
  modelName?: string;
  citationsEnabled: boolean | null;
  onOpenSources: (message: ChatMessage, index: number) => void;
}

function ActionButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={(theme) => ({
        gap: 0.6,
        px: 0.9,
        height: 28,
        borderRadius: "8px",
        fontSize: "0.75rem",
        color: theme.palette.text.secondary,
        transition: "background-color 150ms ease, color 150ms ease",
        "& svg": { fontSize: 15 },
        "&:hover": { color: theme.palette.text.primary, bgcolor: theme.palette.action.hover },
        "&.Mui-focusVisible": { boxShadow: theme.palette.rag.focus },
      })}
    >
      {icon}
      {label}
    </ButtonBase>
  );
}

/** The left rail: cyan beside retrieval, indigo beside generation. */
export function Rail({ tone, active = false }: { tone: "retrieve" | "generate"; active?: boolean }) {
  return (
    <Box
      aria-hidden
      sx={(theme) => {
        const color = theme.palette.rag[tone];
        return {
          position: "relative",
          width: 2,
          alignSelf: "stretch",
          borderRadius: 2,
          flexShrink: 0,
          bgcolor: color,
          opacity: active ? 1 : 0.6,
          overflow: "hidden",
          boxShadow: active ? `0 0 10px ${color}` : "none",
          "&::after": active
            ? {
                content: '""',
                position: "absolute",
                left: 0,
                right: 0,
                height: "40%",
                background: "linear-gradient(180deg, transparent, #fff, transparent)",
                animation: "ragRailScan 1.6s ease-in-out infinite",
              }
            : {},
          "@keyframes ragRailScan": {
            from: { top: "-40%" },
            to: { top: "100%" },
          },
        };
      }}
    />
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        animation: message.fresh ? "ragRiseIn 320ms cubic-bezier(0.16,1,0.3,1) both" : "none",
      }}
    >
      <Box
        sx={(theme) => ({
          maxWidth: { xs: "92%", md: "75%" },
          px: 2,
          py: 1.25,
          borderRadius: "16px 16px 4px 16px",
          bgcolor: theme.palette.rag.primarySoft,
          border: `1px solid ${theme.palette.rag.primary}38`,
          fontSize: "0.9375rem",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        })}
      >
        {message.content}
      </Box>
      {message.createdAt && (
        <Typography sx={{ fontSize: "0.6875rem", color: "text.disabled", mt: 0.5, mr: 0.5 }}>
          {formatRelative(message.createdAt)}
        </Typography>
      )}
    </Box>
  );
}

function AssistantMessage({ message, modelName, citationsEnabled, onOpenSources }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const sources = message.sources ?? [];
  const notFound = isNotFoundAnswer(message.content);
  const documentCount = new Set(sources.map((s) => s.document_id || s.filename)).size;

  const copy = () => {
    void navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  let retrievalNote: string | null = null;
  if (!notFound && sources.length === 0 && !message.streaming) {
    if (citationsEnabled === false) retrievalNote = "Source citations are turned off for your organisation";
  }

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.75,
        animation: message.fresh ? "ragFadeInUp 420ms cubic-bezier(0.16,1,0.3,1) both" : "none",
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, pt: 0.25 }}>
        <BrandMark size={28} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>RAGENTIS</Typography>
          {modelName && (
            <Typography className="font-mono" sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
              {modelName}
            </Typography>
          )}
          {message.createdAt && (
            <Typography sx={{ fontSize: "0.6875rem", color: "text.disabled" }}>
              {formatRelative(message.createdAt)}
            </Typography>
          )}
        </Box>

        {/* Retrieval */}
        {sources.length > 0 && (
          <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
            <Rail tone="retrieve" />
            <Box sx={{ minWidth: 0, py: 0.25 }}>
              <Typography sx={{ fontSize: "0.75rem", color: "info.main", fontWeight: 540, mb: 0.75 }}>
                Retrieved {sources.length} passage{sources.length === 1 ? "" : "s"} from {documentCount} document
                {documentCount === 1 ? "" : "s"}
              </Typography>
              <SourceChips sources={sources} onOpen={(i) => onOpenSources(message, i)} />
            </Box>
          </Box>
        )}

        {/* Generation */}
        {notFound ? (
          <Box
            sx={(theme) => ({
              display: "flex",
              gap: 1.5,
              alignItems: "flex-start",
              p: 1.75,
              borderRadius: "12px",
              border: `1px dashed ${theme.palette.rag.lineStrong}`,
              bgcolor: theme.palette.rag.raised,
            })}
          >
            <SearchOffRoundedIcon sx={{ color: "text.secondary", fontSize: 20, mt: 0.25 }} />
            <Box>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 560 }}>Not found in your documents</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mt: 0.25 }}>
                RAGENTIS only answers from indexed documents you can access. Try rephrasing, or upload a document that
                covers this topic.
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Rail tone="generate" />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Markdown text={message.content} />
              {message.streaming && (
                <Box component="span" aria-hidden sx={(theme) => ({ display: "inline-block", width: 7, height: 15, ml: 0.25,
                  verticalAlign: "text-bottom", bgcolor: theme.palette.rag.generate, animation: "ragFadeIn 700ms ease infinite alternate" })} />
              )}
            </Box>
          </Box>
        )}

        {/* Actions */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1, ml: -0.5, flexWrap: "wrap" }}>
          <ActionButton
            onClick={copy}
            icon={copied ? <CheckRoundedIcon /> : <ContentCopyOutlinedIcon />}
            label={copied ? "Copied" : "Copy"}
          />
          {sources.length > 0 && (
            <ActionButton
              onClick={() => onOpenSources(message, 0)}
              icon={<ManageSearchRoundedIcon />}
              label="View evidence"
            />
          )}
          {!message.streaming && (message.serverId || message.status === "stopped" || message.status === "error") && (
            <AnswerFeedback messageId={message.serverId} initial={message.feedback ?? null} status={message.status} />
          )}
          {retrievalNote && (
            <Typography sx={{ fontSize: "0.72rem", color: "text.disabled", ml: 0.75 }}>{retrievalNote}</Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function MessageItem(props: MessageItemProps) {
  return props.message.role === "user" ? <UserMessage message={props.message} /> : <AssistantMessage {...props} />;
}

export default memo(MessageItem);
