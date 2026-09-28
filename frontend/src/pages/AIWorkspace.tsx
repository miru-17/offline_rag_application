import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";

import {
  queryDocuments,
  type QuerySource,
} from "../api/query.api";

import {
  getConversations,
  getConversation,
  deleteConversation,
  type Conversation,
} from "../api/conversation.api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: QuerySource[];
}

/* =========================================================
   HELPERS
   ========================================================= */

const createMessageId = (): string => {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
};

const hasQueryText = (value: string): boolean => {
  return value.trim().length > 0;
};

/* =========================================================
   SOURCE HELPERS
   ========================================================= */

const getSourceFilename = (
  source: QuerySource,
): string => {
  const filename: unknown =
    source.filename ??
    source.file_name ??
    source.document_name ??
    source.name;

  if (
    typeof filename === "string" &&
    filename.trim().length > 0
  ) {
    return filename.trim();
  }

  return "Document source";
};

const getSourcePage = (
  source: QuerySource,
): string | null => {
  const possiblePageValues: unknown[] = [
    source.page,
    source.page_number,
    source.pageNumber,
    source.metadata &&
    typeof source.metadata === "object"
      ? (source.metadata as Record<string, unknown>)
          .page
      : undefined,
    source.metadata &&
    typeof source.metadata === "object"
      ? (source.metadata as Record<string, unknown>)
          .page_number
      : undefined,
    source.metadata &&
    typeof source.metadata === "object"
      ? (source.metadata as Record<string, unknown>)
          .pageNumber
      : undefined,
  ];

  for (const pageValue of possiblePageValues) {
    if (typeof pageValue === "number") {
      return `Page ${pageValue}`;
    }

    if (typeof pageValue === "string") {
      const trimmedPage = pageValue.trim();

      if (trimmedPage.length > 0) {
        return `Page ${trimmedPage}`;
      }
    }
  }

  return null;
};

/* =========================================================
   UNIQUE SOURCE
   ========================================================= */

const getUniqueSources = (
  sources: QuerySource[],
): QuerySource[] => {
  const seenDocuments = new Set<string>();

  return sources.filter((source) => {
    const filename = getSourceFilename(source);

    const normalizedFilename =
      filename.toLowerCase().trim();

    if (seenDocuments.has(normalizedFilename)) {
      return false;
    }

    seenDocuments.add(normalizedFilename);

    return true;
  });
};

/* =========================================================
   AI WORKSPACE
   ========================================================= */

export default function AIWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>(
    [],
  );

  const [query, setQuery] = useState<string>("");

  const [isLoading, setIsLoading] =
    useState<boolean>(false);

  const [error, setError] = useState<string>("");

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [conversationId, setConversationId] =
    useState<string | null>(null);

  const [isHistoryLoading, setIsHistoryLoading] =
    useState<boolean>(true);

  const [isLoadingConversation, setIsLoadingConversation] =
    useState<boolean>(false);

  const [historyOpen, setHistoryOpen] =
    useState<boolean>(true);

  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const hasMessages: boolean = messages.length > 0;

  /* =======================================================
     LOAD CONVERSATIONS
     ======================================================= */

  const loadConversations = useCallback(
    async (): Promise<void> => {
      try {
        setIsHistoryLoading(true);

        const data = await getConversations();

        setConversations(data);
      } catch (err: unknown) {
        console.error(
          "Failed to load conversations:",
          err,
        );
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  /* =======================================================
     NEW CHAT
     ======================================================= */

  const handleNewChat = (): void => {
    setMessages([]);
    setQuery("");
    setError("");
    setConversationId(null);

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  /* =======================================================
     LOAD EXISTING CONVERSATION
     ======================================================= */

  const handleLoadConversation = async (
    id: string,
  ): Promise<void> => {
    if (
      isLoading ||
      isLoadingConversation
    ) {
      return;
    }

    try {
      setIsLoadingConversation(true);
      setError("");

      const conversation =
        await getConversation(id);

      const loadedMessages: ChatMessage[] =
        conversation.messages.map((message) => ({
          id: message.id,
          role:
            message.role === "user"
              ? "user"
              : "assistant",
          content: message.content,
          sources: [],
        }));

      setConversationId(conversation.id);
      setMessages(loadedMessages);
      setQuery("");

      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } catch (err: unknown) {
      console.error(
        "Failed to load conversation:",
        err,
      );

      setError(
        "Unable to load this conversation. Please try again.",
      );
    } finally {
      setIsLoadingConversation(false);
    }
  };

  /* =======================================================
     DELETE CONVERSATION
     ======================================================= */

  const handleDeleteConversation = async (
    id: string,
  ): Promise<void> => {
    try {
      await deleteConversation(id);

      setConversations((current) =>
        current.filter(
          (conversation) =>
            conversation.id !== id,
        ),
      );

      if (conversationId === id) {
        handleNewChat();
      }
    } catch (err: unknown) {
      console.error(
        "Failed to delete conversation:",
        err,
      );

      setError(
        "Unable to delete the conversation. Please try again.",
      );
    }
  };

  /* =======================================================
     SEND QUERY
     ======================================================= */

  const handleSubmit = async (
    event?: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event?.preventDefault();

    const trimmedQuery: string = query.trim();

    if (!hasQueryText(query) || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmedQuery,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setQuery("");
    setError("");
    setIsLoading(true);

    try {
      /*
       * For a new chat, conversationId is null.
       * Backend creates the conversation.
       *
       * For an existing chat, the same ID is
       * sent so the conversation continues.
       */

      const response = await queryDocuments(
        trimmedQuery,
        conversationId ?? undefined,
      );

      /*
       * Store the backend-generated conversation ID.
       * This is important after the first message
       * of a new conversation.
       */

      setConversationId(
        response.conversation_id,
      );

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: response.answer,
        sources: response.sources ?? [],
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);

      /*
       * Refresh the sidebar so the latest
       * conversation appears immediately.
       */

      await loadConversations();
    } catch (err: unknown) {
      console.error(
        "RAG query failed:",
        err,
      );

      setError(
        "Unable to process your question. Please check the backend connection and try again.",
      );
    } finally {
      setIsLoading(false);

      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  /* =======================================================
     ENTER KEY
     ======================================================= */

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <Box
      sx={{
        height: "calc(100vh - 64px)",
        minHeight: 620,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      {/* =====================================================
          HEADER
          ===================================================== */}

      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          {/* Mobile history button */}

          <IconButton
            onClick={() =>
              setHistoryOpen(
                (current) => !current,
              )
            }
            sx={{
              display: {
                xs: "inline-flex",
                md: "none",
              },
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <MenuRoundedIcon />
          </IconButton>

          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "primary.main",
              color: "primary.contrastText",
            }}
          >
            <SmartToyOutlinedIcon />
          </Box>

          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              AI Workspace
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
            >
              Query your knowledge with RAGENTIS
            </Typography>
          </Box>
        </Box>

        {/* Desktop New Chat */}

        <Tooltip title="Start a new conversation">
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={handleNewChat}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              display: {
                xs: "none",
                sm: "inline-flex",
              },
            }}
          >
            New Chat
          </Button>
        </Tooltip>

        {/* Mobile New Chat */}

        <Tooltip title="Start a new conversation">
          <IconButton
            onClick={handleNewChat}
            sx={{
              display: {
                xs: "inline-flex",
                sm: "none",
              },
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <AddRoundedIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* =====================================================
          WORKSPACE
          ===================================================== */}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          position: "relative",
        }}
      >
        {/* ===================================================
            CONVERSATION SIDEBAR
            =================================================== */}

        <Box
          sx={{
            width: 280,
            flexShrink: 0,
            borderRight: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            display: {
              xs: historyOpen
                ? "flex"
                : "none",
              md: "flex",
            },
            flexDirection: "column",
            position: {
              xs: "absolute",
              md: "relative",
            },
            zIndex: {
              xs: 10,
              md: "auto",
            },
            height: "100%",
            boxShadow: {
              xs: historyOpen
                ? "8px 0 30px rgba(0,0,0,0.08)"
                : "none",
              md: "none",
            },
          }}
        >
          {/* Sidebar header */}

          <Box
            sx={{
              px: 2,
              py: 1.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <ChatBubbleOutlineRoundedIcon
                sx={{
                  fontSize: 19,
                  color: "primary.main",
                }}
              />

              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                }}
              >
                Conversations
              </Typography>
            </Box>

            <Tooltip title="New Chat">
              <IconButton
                size="small"
                onClick={handleNewChat}
              >
                <AddRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Divider />

          {/* Conversation list */}

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              px: 1,
              py: 1,
            }}
          >
            {isHistoryLoading ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  py: 4,
                }}
              >
                <CircularProgress size={22} />
              </Box>
            ) : conversations.length === 0 ? (
              <Box
                sx={{
                  px: 1.5,
                  py: 5,
                  textAlign: "center",
                }}
              >
                <ChatBubbleOutlineRoundedIcon
                  sx={{
                    fontSize: 30,
                    color: "text.disabled",
                    mb: 1,
                  }}
                />

                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  No conversations yet
                </Typography>

                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{
                    display: "block",
                    mt: 0.5,
                  }}
                >
                  Start asking questions to
                  create your first chat.
                </Typography>
              </Box>
            ) : (
              <List
                disablePadding
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                }}
              >
                {conversations.map(
                  (conversation) => {
                    const isActive =
                      conversation.id ===
                      conversationId;

                    return (
                      <ListItemButton
                        key={conversation.id}
                        selected={isActive}
                        onClick={() => {
                          void handleLoadConversation(
                            conversation.id,
                          );

                          if (
                            window.innerWidth <
                            900
                          ) {
                            setHistoryOpen(
                              false,
                            );
                          }
                        }}
                        sx={{
                          borderRadius: 2,
                          px: 1.25,
                          py: 1,
                          alignItems:
                            "flex-start",

                          "&.Mui-selected": {
                            bgcolor:
                              "action.selected",
                          },

                          "&.Mui-selected:hover": {
                            bgcolor:
                              "action.selected",
                          },
                        }}
                      >
                        <ChatBubbleOutlineRoundedIcon
                          sx={{
                            fontSize: 18,
                            mt: 0.25,
                            mr: 1,
                            color:
                              isActive
                                ? "primary.main"
                                : "text.secondary",
                          }}
                        />

                       <ListItemText
  primary={
    <Typography
      variant="body2"
      noWrap
      sx={{
        display: "block",
        fontWeight: isActive ? 700 : 500,
      }}
    >
      {conversation.title}
    </Typography>
  }
  sx={{
    minWidth: 0,
    mr: 0.5,
  }}
/>

                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={(
                              event,
                            ) => {
                              event.stopPropagation();

                              void handleDeleteConversation(
                                conversation.id,
                              );
                            }}
                            sx={{
                              opacity: 0.55,

                              "&:hover": {
                                opacity: 1,
                                color:
                                  "error.main",
                              },
                            }}
                          >
                            <DeleteOutlineRoundedIcon
                              sx={{
                                fontSize: 17,
                              }}
                            />
                          </IconButton>
                        </Tooltip>
                      </ListItemButton>
                    );
                  },
                )}
              </List>
            )}
          </Box>
        </Box>

        {/* ===================================================
            MOBILE SIDEBAR OVERLAY
            =================================================== */}

        {historyOpen && (
          <Box
            onClick={() =>
              setHistoryOpen(false)
            }
            sx={{
              display: {
                xs: "block",
                md: "none",
              },
              position: "absolute",
              inset: 0,
              bgcolor:
                "rgba(0,0,0,0.18)",
              zIndex: 5,
            }}
          />
        )}

        {/* ===================================================
            CHAT AREA
            =================================================== */}

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!hasMessages ? (
            /* ===============================================
               EMPTY STATE
               =============================================== */

            <Box
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 2,
                overflowY: "auto",
              }}
            >
              <Box
                sx={{
                  width: "100%",
                  maxWidth: 760,
                  textAlign: "center",
                  py: 5,
                }}
              >
                <Box
                  sx={{
                    width: 76,
                    height: 76,
                    mx: "auto",
                    mb: 3,
                    borderRadius: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      "linear-gradient(135deg, rgba(25,118,210,0.14), rgba(103,58,183,0.12))",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow:
                      "0 12px 40px rgba(25,118,210,0.10)",
                  }}
                >
                  <AutoAwesomeOutlinedIcon
                    sx={{
                      fontSize: 36,
                      color: "primary.main",
                    }}
                  />
                </Box>

                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 750,
                    mb: 1,
                    letterSpacing:
                      "-0.02em",
                  }}
                >
                  Ask your knowledge
                </Typography>

                <Typography
                  color="text.secondary"
                  sx={{
                    maxWidth: 560,
                    mx: "auto",
                    lineHeight: 1.7,
                  }}
                >
                  Ask questions about your
                  uploaded documents.
                  RAGENTIS retrieves relevant
                  context and generates an
                  answer grounded in your
                  knowledge base.
                </Typography>

                <Box
                  sx={{
                    mt: 3,
                    display: "flex",
                    flexDirection: {
                      xs: "column",
                      sm: "row",
                    },
                    alignItems: "center",
                    justifyContent:
                      "center",
                    gap: 1,
                  }}
                >
                  {[
                    "Summarize a document",
                    "Find key objectives",
                    "Explain a concept",
                  ].map(
                    (suggestion: string) => (
                      <Button
                        key={suggestion}
                        variant="outlined"
                        onClick={() => {
                          setQuery(
                            suggestion,
                          );

                          inputRef.current?.focus();
                        }}
                        sx={{
                          borderRadius: 3,
                          textTransform:
                            "none",
                          color:
                            "text.secondary",
                          borderColor:
                            "divider",
                        }}
                      >
                        {suggestion}
                      </Button>
                    ),
                  )}
                </Box>
              </Box>
            </Box>
          ) : (
            /* ===============================================
               CONVERSATION
               =============================================== */

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                px: {
                  xs: 1.5,
                  md: 3,
                },
                py: 3,
              }}
            >
              <Box
                sx={{
                  maxWidth: 900,
                  mx: "auto",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection:
                      "column",
                    gap: 3,
                  }}
                >
                  {messages.map(
                    (message) => {
                      const isUser =
                        message.role ===
                        "user";

                      return (
                        <Box
                          key={message.id}
                          sx={{
                            display:
                              "flex",
                            gap: 1.5,
                            alignItems:
                              "flex-start",
                            flexDirection:
                              isUser
                                ? "row-reverse"
                                : "row",
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 34,
                              height: 34,
                              flexShrink: 0,
                              bgcolor:
                                isUser
                                  ? "action.selected"
                                  : "primary.main",
                              color:
                                isUser
                                  ? "text.primary"
                                  : "primary.contrastText",
                            }}
                          >
                            {isUser ? (
                              <PersonOutlineRoundedIcon fontSize="small" />
                            ) : (
                              <SmartToyOutlinedIcon fontSize="small" />
                            )}
                          </Avatar>

                          <Box
                            sx={{
                              maxWidth: {
                                xs: "85%",
                                md: "78%",
                              },
                            }}
                          >
                            {/* ===========================
                                MESSAGE
                                =========================== */}

                            <Paper
                              elevation={0}
                              sx={{
                                px: 2,
                                py: 1.75,
                                borderRadius: 2.5,
                                bgcolor:
                                  isUser
                                    ? "primary.main"
                                    : "background.paper",
                                color:
                                  isUser
                                    ? "primary.contrastText"
                                    : "text.primary",
                                border:
                                  isUser
                                    ? "none"
                                    : "1px solid",
                                borderColor:
                                  "divider",
                                boxShadow:
                                  isUser
                                    ? "0 5px 18px rgba(0,0,0,0.10)"
                                    : "0 4px 18px rgba(0,0,0,0.04)",
                              }}
                            >
                              <Typography
                                variant="body1"
                                sx={{
                                  whiteSpace:
                                    "pre-wrap",
                                  lineHeight: 1.7,
                                }}
                              >
                                {
                                  message.content
                                }
                              </Typography>
                            </Paper>

                            {/* ===========================
                                SOURCES
                                =========================== */}

                            {!isUser &&
                              message.sources &&
                              message.sources
                                .length >
                                0 && (
                                <Box
                                  sx={{
                                    mt: 1.5,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      display:
                                        "block",
                                      mb: 1,
                                      fontWeight: 700,
                                      color:
                                        "text.secondary",
                                      textTransform:
                                        "uppercase",
                                      letterSpacing: 0.7,
                                    }}
                                  >
                                    Source
                                  </Typography>

                                  {getUniqueSources(
                                    message.sources,
                                  ).map(
                                    (
                                      source,
                                      index,
                                    ) => {
                                      const filename =
                                        getSourceFilename(
                                          source,
                                        );

                                      const page =
                                        getSourcePage(
                                          source,
                                        );

                                      return (
                                        <Paper
                                          key={`${filename}-${index}`}
                                          elevation={
                                            0
                                          }
                                          sx={{
                                            px: 1.5,
                                            py: 1.25,
                                            borderRadius:
                                              1.75,
                                            display:
                                              "flex",
                                            alignItems:
                                              "center",
                                            gap: 1.25,
                                            border:
                                              "1px solid",
                                            borderColor:
                                              "divider",
                                            bgcolor:
                                              "background.paper",
                                          }}
                                        >
                                          <DescriptionOutlinedIcon
                                            sx={{
                                              fontSize: 20,
                                              color:
                                                "primary.main",
                                              flexShrink: 0,
                                            }}
                                          />

                                          <Box
                                            sx={{
                                              minWidth: 0,
                                              flex: 1,
                                            }}
                                          >
                                            <Typography
                                              variant="body2"
                                              sx={{
                                                fontWeight: 600,
                                                overflow:
                                                  "hidden",
                                                textOverflow:
                                                  "ellipsis",
                                                whiteSpace:
                                                  "nowrap",
                                              }}
                                            >
                                              {
                                                filename
                                              }
                                            </Typography>

                                            {page && (
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                              >
                                                {
                                                  page
                                                }
                                              </Typography>
                                            )}
                                          </Box>
                                        </Paper>
                                      );
                                    },
                                  )}
                                </Box>
                              )}
                          </Box>
                        </Box>
                      );
                    },
                  )}

                  {/* =======================================
                      LOADING
                      ======================================= */}

                  {isLoading && (
                    <Box
                      sx={{
                        display:
                          "flex",
                        gap: 1.5,
                        alignItems:
                          "flex-start",
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 34,
                          height: 34,
                          bgcolor:
                            "primary.main",
                        }}
                      >
                        <SmartToyOutlinedIcon fontSize="small" />
                      </Avatar>

                      <Paper
                        elevation={0}
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderRadius: 2.5,
                          border:
                            "1px solid",
                          borderColor:
                            "divider",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: 1.25,
                        }}
                      >
                        <CircularProgress
                          size={17}
                        />

                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          Searching your
                          knowledge...
                        </Typography>
                      </Paper>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          )}

          {/* =================================================
              ERROR
              ================================================= */}

          {error.length > 0 && (
            <Box
              sx={{
                px: {
                  xs: 2,
                  md: 3,
                },
                pb: 1,
              }}
            >
              <Box
                sx={{
                  maxWidth: 900,
                  mx: "auto",
                }}
              >
                <Alert
                  severity="error"
                  icon={
                    <ErrorOutlineRoundedIcon />
                  }
                  onClose={() =>
                    setError("")
                  }
                  sx={{
                    borderRadius: 2,
                  }}
                >
                  {error}
                </Alert>
              </Box>
            </Box>
          )}

          {/* =================================================
              COMPOSER
              ================================================= */}

          <Box
            sx={{
              px: {
                xs: 1.5,
                md: 3,
              },
              pt: 1.5,
              pb: {
                xs: 1.5,
                md: 2.5,
              },
              borderTop: "1px solid",
              borderColor: "divider",
              bgcolor:
                "background.paper",
            }}
          >
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{
                maxWidth: 900,
                mx: "auto",
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  display:
                    "flex",
                  alignItems:
                    "flex-end",
                  gap: 1,
                  p: 0.75,
                  pl: 1.75,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor:
                    isLoading
                      ? "primary.main"
                      : "divider",
                  transition:
                    "border-color 0.2s ease",

                  "&:focus-within": {
                    borderColor:
                      "primary.main",
                    boxShadow:
                      "0 0 0 3px rgba(25,118,210,0.08)",
                  },
                }}
              >
                <TextField
                  inputRef={inputRef}
                  fullWidth
                  multiline
                  maxRows={5}
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value,
                    )
                  }
                  onKeyDown={
                    handleKeyDown
                  }
                  placeholder="Ask something about your documents..."
                  variant="standard"
                  disabled={
                    isLoading ||
                    isLoadingConversation
                  }
                  slotProps={{
                    input: {
                      disableUnderline:
                        true,
                    },
                  }}
                  sx={{
                    "& .MuiInputBase-root":
                      {
                        py: 0.8,
                        fontSize: 15,
                      },
                  }}
                />

                <Tooltip
                  title={
                    hasQueryText(
                      query,
                    )
                      ? "Ask RAGENTIS"
                      : "Enter a question"
                  }
                >
                  <span>
                    <IconButton
                      type="submit"
                      disabled={
                        !hasQueryText(
                          query,
                        ) ||
                        isLoading ||
                        isLoadingConversation
                      }
                      sx={{
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        bgcolor:
                          "primary.main",
                        color:
                          "primary.contrastText",

                        "&:hover": {
                          bgcolor:
                            "primary.dark",
                        },

                        "&.Mui-disabled":
                          {
                            bgcolor:
                              "action.disabledBackground",
                          },
                      }}
                    >
                      {isLoading ? (
                        <CircularProgress
                          size={20}
                          color="inherit"
                        />
                      ) : (
                        <SendRoundedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              </Paper>

              {/* Composer footer */}

              <Box
                sx={{
                  mt: 0.8,
                  px: 0.5,
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  RAGENTIS answers using
                  your available
                  knowledge base.
                </Typography>

                {hasMessages && (
                  <Tooltip title="Start new chat">
                    <IconButton
                      size="small"
                      onClick={
                        handleNewChat
                      }
                      disabled={
                        isLoading
                      }
                      sx={{
                        color:
                          "text.secondary",
                      }}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Divider />
    </Box>
  );
}

