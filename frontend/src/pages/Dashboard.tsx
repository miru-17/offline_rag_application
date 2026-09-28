import { useEffect, useState, type ReactNode } from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import PendingOutlinedIcon from "@mui/icons-material/PendingOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

import {
  getDocuments,
  type DocumentItem,
} from "../api/documents.api";

import {
  getSystemStatus,
  type SystemStatus,
} from "../api/system.api";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
}

type ChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "error"
  | "info"
  | "success"
  | "warning";

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: StatCardProps) {
  return (
    <Card
      sx={{
        height: "100%",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 600 }}
            >
              {title}
            </Typography>

            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: "action.hover",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "primary.main",
              }}
            >
              {icon}
            </Box>
          </Box>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            {value}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
          >
            {subtitle}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ============================================================
  // ROLE PERMISSIONS
  // ============================================================

  const userRole = user?.role?.toUpperCase();

  const canManageDocuments =
    userRole === "ADMIN" ||
    userRole === "USER";

  // ============================================================
  // STATE
  // ============================================================

  const [systemStatus, setSystemStatus] =
    useState<SystemStatus | null>(null);

  const [isSystemLoading, setIsSystemLoading] =
    useState(true);

  const [documents, setDocuments] =
    useState<DocumentItem[]>([]);

  const [isDocumentsLoading, setIsDocumentsLoading] =
    useState(true);

  // ============================================================
  // LOAD SYSTEM STATUS
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const loadSystemStatus = async () => {
      try {
        const data = await getSystemStatus();

        if (mounted) {
          setSystemStatus(data);
        }
      } catch (error) {
        console.error(
          "Failed to load system status:",
          error,
        );

        if (mounted) {
          setSystemStatus(null);
        }
      } finally {
        if (mounted) {
          setIsSystemLoading(false);
        }
      }
    };

    void loadSystemStatus();

    return () => {
      mounted = false;
    };
  }, []);

  // ============================================================
  // LOAD DOCUMENTS
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const loadDocuments = async () => {
      try {
        const data = await getDocuments();

        if (mounted) {
          setDocuments(data);
        }
      } catch (error) {
        console.error(
          "Failed to load dashboard documents:",
          error,
        );

        if (mounted) {
          setDocuments([]);
        }
      } finally {
        if (mounted) {
          setIsDocumentsLoading(false);
        }
      }
    };

    void loadDocuments();

    return () => {
      mounted = false;
    };
  }, []);

  // ============================================================
  // DOCUMENT STATISTICS
  // ============================================================

  const totalDocuments = documents.length;

  const processedDocuments = documents.filter(
    (document) => document.processed,
  ).length;

  const processingDocuments = documents.filter(
    (document) => !document.processed,
  ).length;

  const knowledgeCoverage =
    totalDocuments > 0
      ? Math.round(
          (processedDocuments / totalDocuments) * 100,
        )
      : 0;

  // ============================================================
  // RECENT DOCUMENTS
  // ============================================================

  const recentDocuments = [...documents]
    .sort((a, b) => {
      const dateA = a.created_at
        ? new Date(a.created_at).getTime()
        : 0;

      const dateB = b.created_at
        ? new Date(b.created_at).getTime()
        : 0;

      return dateB - dateA;
    })
    .slice(0, 5);

  // ============================================================
  // SYSTEM STATUS HELPERS
  // ============================================================

  const apiIsOnline =
    systemStatus?.api === "healthy";

  const ollamaIsOnline =
    systemStatus?.ollama === "online";

  const modelIsAvailable =
    systemStatus?.model_status === "available";

  const getApiStatusColor = (): ChipColor => {
    if (isSystemLoading) {
      return "default";
    }

    return apiIsOnline
      ? "success"
      : "error";
  };

  const getApiStatusLabel = (): string => {
    if (isSystemLoading) {
      return "Checking...";
    }

    return apiIsOnline
      ? "Operational"
      : "Unavailable";
  };

  const getOllamaStatusColor = (): ChipColor => {
    if (isSystemLoading) {
      return "default";
    }

    return ollamaIsOnline
      ? "success"
      : "error";
  };

  const getOllamaStatusLabel = (): string => {
    if (isSystemLoading) {
      return "Checking...";
    }

    return ollamaIsOnline
      ? "Online"
      : "Offline";
  };

  const getModelStatusColor = (): ChipColor => {
    if (isSystemLoading) {
      return "default";
    }

    return modelIsAvailable
      ? "success"
      : "warning";
  };

  const getModelStatusLabel = (): string => {
    if (isSystemLoading) {
      return "Checking...";
    }

    return modelIsAvailable
      ? "Available"
      : "Unavailable";
  };

  // ============================================================
  // DOCUMENT STATUS
  // ============================================================

  const getDocumentStatusColor = (
    processed: boolean,
  ): ChipColor => {
    return processed
      ? "success"
      : "warning";
  };

  const getDocumentStatusLabel = (
    processed: boolean,
  ): string => {
    return processed
      ? "Ready"
      : "Processing";
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Stack spacing={3}>
      {/* =========================================================
          HEADER
      ========================================================= */}

      <Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            mb: 0.75,
            letterSpacing: "-0.02em",
          }}
        >
          Welcome back, {user?.username}
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
        >
          Manage your documents and interact with your
          organization&apos;s knowledge through the AI workspace.
        </Typography>
      </Box>

      {/* =========================================================
          SYSTEM STATUS
      ========================================================= */}

      <Card
        sx={{
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Box>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700 }}
                >
                  System status
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.35 }}
                >
                  Current local AI runtime
                </Typography>
              </Box>

              <Chip
                label={
                  isSystemLoading
                    ? "Checking..."
                    : apiIsOnline &&
                        ollamaIsOnline &&
                        modelIsAvailable
                      ? "Operational"
                      : "Attention required"
                }
                color={
                  isSystemLoading
                    ? "default"
                    : apiIsOnline &&
                        ollamaIsOnline &&
                        modelIsAvailable
                      ? "success"
                      : "warning"
                }
                variant="outlined"
              />
            </Box>

            <Divider />

            <Grid container spacing={2}>
              {/* API */}

              <Grid
                size={{
                  xs: 12,
                  sm: 6,
                  md: 3,
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    API service
                  </Typography>

                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 650,
                      mt: 0.4,
                    }}
                  >
                    {getApiStatusLabel()}
                  </Typography>
                </Box>
              </Grid>

              {/* OLLAMA */}

              <Grid
                size={{
                  xs: 12,
                  sm: 6,
                  md: 3,
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    AI runtime
                  </Typography>

                  <Box
                    sx={{
                      mt: 0.4,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Chip
                      label={getOllamaStatusLabel()}
                      size="small"
                      color={getOllamaStatusColor()}
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Grid>

              {/* MODEL */}

              <Grid
                size={{
                  xs: 12,
                  sm: 6,
                  md: 3,
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Local model
                  </Typography>

                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 650,
                      mt: 0.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {systemStatus?.model ?? "—"}
                  </Typography>

                  <Box
                    sx={{
                      mt: 0.6,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Chip
                      label={getModelStatusLabel()}
                      size="small"
                      color={getModelStatusColor()}
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Grid>

              {/* VECTOR STORE */}

              <Grid
                size={{
                  xs: 12,
                  sm: 6,
                  md: 3,
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Vector store
                  </Typography>

                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 650,
                      mt: 0.4,
                    }}
                  >
                    {systemStatus?.vector_store ?? "—"}
                  </Typography>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    {systemStatus?.mode === "offline"
                      ? "Offline mode"
                      : "—"}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {/* =========================================================
          DOCUMENT STATISTICS
      ========================================================= */}

      <Grid container spacing={2.5}>
        {/* TOTAL DOCUMENTS */}

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Total Documents"
            value={
              isDocumentsLoading
                ? "—"
                : totalDocuments
            }
            subtitle="Documents available in your tenant"
            icon={
              <DescriptionOutlinedIcon />
            }
          />
        </Grid>

        {/* PROCESSED */}

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Processed"
            value={
              isDocumentsLoading
                ? "—"
                : processedDocuments
            }
            subtitle="Documents ready for retrieval"
            icon={
              <CheckCircleOutlineOutlinedIcon />
            }
          />
        </Grid>

        {/* PROCESSING */}

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Processing"
            value={
              isDocumentsLoading
                ? "—"
                : processingDocuments
            }
            subtitle="Documents currently being indexed"
            icon={
              <PendingOutlinedIcon />
            }
          />
        </Grid>

        {/* KNOWLEDGE COVERAGE */}

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Knowledge Coverage"
            value={
              isDocumentsLoading
                ? "—"
                : `${knowledgeCoverage}%`
            }
            subtitle="Documents ready for AI retrieval"
            icon={
              <StorageOutlinedIcon />
            }
          />
        </Grid>
      </Grid>

      {/* =========================================================
          MAIN WORKSPACE
      ========================================================= */}

      <Grid container spacing={2.5}>
        {/* -------------------------------------------------------
            QUICK ACTIONS
        ------------------------------------------------------- */}

        <Grid size={{ xs: 12, md: 7 }}>
          <Card
            sx={{
              height: "100%",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={3}>
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700 }}
                  >
                    Quick actions
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    Start working with your enterprise
                    knowledge base.
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  {/* UPLOAD DOCUMENTS */}

                  {canManageDocuments && (
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6,
                      }}
                    >
                      <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        startIcon={
                          <CloudUploadOutlinedIcon />
                        }
                        onClick={() =>
                          navigate("/documents")
                        }
                        sx={{
                          justifyContent:
                            "flex-start",
                          px: 2,
                          py: 1.5,
                        }}
                      >
                        Upload documents
                      </Button>
                    </Grid>
                  )}

                  {/* AI WORKSPACE */}

                  <Grid
                    size={{
                      xs: 12,
                      sm: canManageDocuments
                        ? 6
                        : 12,
                    }}
                  >
                    <Button
                      fullWidth
                      variant="outlined"
                      size="large"
                      startIcon={
                        <SmartToyOutlinedIcon />
                      }
                      onClick={() =>
                        navigate("/ai-workspace")
                      }
                      sx={{
                        justifyContent:
                          "flex-start",
                        px: 2,
                        py: 1.5,
                      }}
                    >
                      Open AI workspace
                    </Button>
                  </Grid>
                </Grid>

                <Divider />

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <StorageOutlinedIcon
                    fontSize="small"
                    color="action"
                  />

                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Your documents are isolated within the{" "}
                    <Box
                      component="span"
                      sx={{ fontWeight: 600 }}
                    >
                      {user?.tenant_name}
                    </Box>{" "}
                    tenant.
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* -------------------------------------------------------
            PLATFORM OVERVIEW
        ------------------------------------------------------- */}

        <Grid size={{ xs: 12, md: 5 }}>
          <Card
            sx={{
              height: "100%",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700 }}
                  >
                    Platform overview
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    Current workspace configuration
                  </Typography>
                </Box>

                <Stack spacing={1.5}>
                  {/* TENANT */}

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Tenant
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        textAlign: "right",
                      }}
                    >
                      {user?.tenant_name ?? "—"}
                    </Typography>
                  </Box>

                  <Divider />

                  {/* ROLE */}

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Access level
                    </Typography>

                    <Chip
                      label={user?.role ?? "—"}
                      size="small"
                      variant="outlined"
                    />
                  </Box>

                  <Divider />

                  {/* API */}

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      API service
                    </Typography>

                    <Chip
                      label={getApiStatusLabel()}
                      size="small"
                      color={getApiStatusColor()}
                      variant="outlined"
                    />
                  </Box>

                  <Divider />

                  {/* AI RUNTIME */}

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      AI runtime
                    </Typography>

                    <Chip
                      label={getOllamaStatusLabel()}
                      size="small"
                      color={getOllamaStatusColor()}
                      variant="outlined"
                    />
                  </Box>

                  <Divider />

                  {/* AI ARCHITECTURE */}

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      AI architecture
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        textAlign: "right",
                      }}
                    >
                      {systemStatus?.mode ===
                      "offline"
                        ? "Local / Offline"
                        : "—"}
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  variant="text"
                  endIcon={
                    <ArrowForwardOutlinedIcon />
                  }
                  onClick={() =>
                    navigate("/settings")
                  }
                  sx={{
                    alignSelf: "flex-start",
                    px: 0,
                  }}
                >
                  View workspace settings
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* =========================================================
          RECENT DOCUMENTS
      ========================================================= */}

      <Card
        sx={{
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            {/* HEADER */}

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Box>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700 }}
                >
                  Recent documents
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Recently uploaded and processed
                  knowledge sources.
                </Typography>
              </Box>

              <Button
                variant="outlined"
                endIcon={
                  <ArrowForwardOutlinedIcon />
                }
                onClick={() =>
                  navigate("/documents")
                }
              >
                View all
              </Button>
            </Box>

            <Divider />

            {/* LOADING */}

            {isDocumentsLoading ? (
              <Box
                sx={{
                  py: 5,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <CircularProgress size={28} />
              </Box>
            ) : recentDocuments.length === 0 ? (
              /* EMPTY STATE */

              <Box
                sx={{
                  py: 5,
                  textAlign: "center",
                }}
              >
                <DescriptionOutlinedIcon
                  sx={{
                    fontSize: 42,
                    color: "text.disabled",
                    mb: 1,
                  }}
                />

                <Typography
                  variant="body1"
                  sx={{ fontWeight: 600 }}
                >
                  No recent documents to display
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 0.5,
                    maxWidth: 520,
                    mx: "auto",
                  }}
                >
                  {canManageDocuments
                    ? "Upload a PDF, DOCX, or XLSX file to start building your knowledge base."
                    : "No documents have been added to your tenant yet."}
                </Typography>

                {/* UPLOAD FIRST DOCUMENT */}

                {canManageDocuments && (
                  <Button
                    variant="contained"
                    startIcon={
                      <CloudUploadOutlinedIcon />
                    }
                    onClick={() =>
                      navigate("/documents")
                    }
                    sx={{ mt: 2 }}
                  >
                    Upload your first document
                  </Button>
                )}
              </Box>
            ) : (
              /* DOCUMENT LIST */

              <Stack spacing={0}>
                {recentDocuments.map(
                  (document, index) => (
                    <Box key={document.id}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent:
                            "space-between",
                          gap: 2,
                          py: 1.75,
                        }}
                      >
                        {/* DOCUMENT INFO */}

                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            minWidth: 0,
                          }}
                        >
                          <DescriptionOutlinedIcon
                            color="primary"
                            sx={{ mr: 1.5 }}
                          />

                          <Box
                            sx={{
                              minWidth: 0,
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
                                maxWidth: {
                                  xs: 180,
                                  sm: 350,
                                },
                              }}
                            >
                              {document.filename}
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {document.created_at
                                ? new Date(
                                    document.created_at,
                                  ).toLocaleDateString()
                                : "Date unavailable"}
                            </Typography>
                          </Box>
                        </Box>

                        {/* DOCUMENT STATUS */}

                        <Chip
                          label={getDocumentStatusLabel(
                            document.processed,
                          )}
                          size="small"
                          color={getDocumentStatusColor(
                            document.processed,
                          )}
                          variant="outlined"
                        />
                      </Box>

                      {index <
                        recentDocuments.length - 1 && (
                        <Divider />
                      )}
                    </Box>
                  ),
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* =========================================================
          SYSTEM CHECK LOADING
      ========================================================= */}

      {isSystemLoading && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <CircularProgress size={22} />
        </Box>
      )}
    </Stack>
  );
}

