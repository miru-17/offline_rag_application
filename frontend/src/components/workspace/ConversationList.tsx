import { useState } from "react";
import { Box, ButtonBase, IconButton, InputBase, Skeleton, Tooltip, Typography } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";

import type { Conversation } from "../../api/conversation.api";
import { getTimestamp } from "../../utils/format";

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  activeId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const groupLabel = (value: string): string => {
  const ts = getTimestamp(value);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  if (ts >= startOfToday.getTime()) return "Today";
  if (ts >= startOfToday.getTime() - day) return "Yesterday";
  if (ts >= startOfToday.getTime() - 7 * day) return "Previous 7 days";
  return "Older";
};

export default function ConversationList({
  conversations,
  loading,
  activeId,
  disabled,
  onSelect,
  onDelete,
  onNew,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = [...conversations]
    .sort((a, b) => getTimestamp(b.updated_at) - getTimestamp(a.updated_at))
    .filter((c) => !search.trim() || (c.title || "").toLowerCase().includes(search.trim().toLowerCase()));

  let lastGroup = "";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        <ButtonBase
          onClick={onNew}
          sx={(theme) => ({
            justifyContent: "flex-start",
            gap: 1,
            height: 38,
            px: 1.25,
            borderRadius: "10px",
            fontSize: "0.8125rem",
            fontWeight: 540,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.rag.lineStrong}`,
            bgcolor: theme.palette.rag.surface,
            transition: "border-color 150ms ease, background-color 150ms ease",
            "&:hover": { borderColor: theme.palette.rag.primary, bgcolor: theme.palette.rag.primarySoft },
            "&.Mui-focusVisible": { boxShadow: theme.palette.rag.focus },
          })}
        >
          <AddRoundedIcon sx={{ fontSize: 18, color: "primary.main" }} />
          New conversation
        </ButtonBase>

        <Box
          sx={(theme) => ({
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            height: 34,
            px: 1,
            borderRadius: "9px",
            bgcolor: theme.palette.rag.sunken,
            border: `1px solid ${theme.palette.rag.line}`,
            "&:focus-within": { borderColor: theme.palette.rag.primary },
          })}
        >
          <SearchRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          <InputBase
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            inputProps={{ "aria-label": "Search conversations" }}
            sx={{ fontSize: "0.8125rem", flex: 1 }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 1, pb: 1.5 }}>
        {loading ? (
          [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={34} sx={{ mx: 1 }} />)
        ) : filtered.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
            <ChatBubbleOutlineRoundedIcon sx={{ color: "text.disabled", fontSize: 22, mb: 1 }} />
            <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
              {search ? "No conversations match" : "Your conversations will appear here"}
            </Typography>
          </Box>
        ) : (
          filtered.map((c) => {
            const group = groupLabel(c.updated_at);
            const showGroup = group !== lastGroup;
            lastGroup = group;
            const active = c.id === activeId;
            const confirming = confirmId === c.id;

            return (
              <Box key={c.id}>
                {showGroup && (
                  <Typography sx={{ px: 1.25, pt: 1.5, pb: 0.5, fontSize: "0.6875rem", color: "text.disabled", fontWeight: 500 }}>
                    {group}
                  </Typography>
                )}
                <Box
                  onMouseLeave={() => confirming && setConfirmId(null)}
                  sx={(theme) => ({
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "9px",
                    bgcolor: active ? theme.palette.rag.primarySoft : "transparent",
                    transition: "background-color 150ms ease",
                    "&:hover": { bgcolor: active ? theme.palette.rag.primarySoft : theme.palette.action.hover },
                    "&:hover .conv-delete, & .conv-delete:focus-visible": { opacity: 1 },
                  })}
                >
                  <ButtonBase
                    disabled={disabled}
                    onClick={() => onSelect(c.id)}
                    aria-current={active ? "true" : undefined}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      justifyContent: "flex-start",
                      px: 1.25,
                      py: 0.9,
                      borderRadius: "9px",
                      textAlign: "left",
                    }}
                  >
                    <Typography
                      noWrap
                      sx={{
                        fontSize: "0.8125rem",
                        fontWeight: active ? 560 : 440,
                        color: active ? "text.primary" : "text.secondary",
                      }}
                    >
                      {c.title || "Untitled conversation"}
                    </Typography>
                  </ButtonBase>

                  {confirming ? (
                    <ButtonBase
                      onClick={() => {
                        setConfirmId(null);
                        onDelete(c.id);
                      }}
                      sx={(theme) => ({
                        mr: 0.5,
                        px: 1,
                        height: 24,
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 560,
                        color: "#fff",
                        bgcolor: theme.palette.rag.danger,
                        animation: "ragFadeIn 150ms ease both",
                      })}
                    >
                      Delete
                    </ButtonBase>
                  ) : (
                    <Tooltip title="Delete conversation">
                      <IconButton
                        className="conv-delete"
                        size="small"
                        onClick={() => setConfirmId(c.id)}
                        aria-label={`Delete ${c.title}`}
                        sx={{ mr: 0.25, width: 26, height: 26, opacity: { xs: 1, md: 0 }, "&:hover": { color: "error.main" } }}
                      >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
