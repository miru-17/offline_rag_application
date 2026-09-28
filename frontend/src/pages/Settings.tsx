import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import { useAuth } from "../auth/AuthContext";
import { useAppearance } from "../context/AppearanceContext";
import { changePassword } from "../api/settings.api";
import {
  getRAGSettings,
  updateRAGSettings,
} from "../api/ragsettings.api";

function Settings() {
  const { user } = useAuth();

  const {
    settings: appearanceSettings,
    setCompact,
    setAnimations,
    setTheme,
  } = useAppearance();

  const userRole = user?.role?.toUpperCase() ?? "USER";
  const isAdmin = userRole === "ADMIN";

  // ============================================================
  // PASSWORD STATE
  // ============================================================

  const [changePasswordOpen, setChangePasswordOpen] =
    useState(false);

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [passwordLoading, setPasswordLoading] =
    useState(false);

  const [passwordError, setPasswordError] =
    useState("");

  const [passwordSuccess, setPasswordSuccess] =
    useState("");

  // ============================================================
  // RAG SETTINGS STATE
  // ============================================================

  const [retrievalDepth, setRetrievalDepth] =
    useState(5);

  const [sourceAttribution, setSourceAttribution] =
    useState(true);

  const [ragLoading, setRagLoading] =
    useState(true);

  const [ragSaving, setRagSaving] =
    useState(false);

  const [ragError, setRagError] =
    useState("");

  const [ragSuccess, setRagSuccess] =
    useState("");

  // ============================================================
  // LOAD RAG SETTINGS
  // ============================================================

  useEffect(() => {
    const loadRAGSettings = async () => {
      try {
        setRagLoading(true);
        setRagError("");

        const settings = await getRAGSettings();

        setRetrievalDepth(
          settings.retrieval_depth,
        );

        setSourceAttribution(
          settings.source_attribution,
        );
      } catch (error: any) {
        const detail =
          error?.response?.data?.detail;

        setRagError(
          detail ||
            "Unable to load RAG settings.",
        );
      } finally {
        setRagLoading(false);
      }
    };

    loadRAGSettings();
  }, []);

  // ============================================================
  // UPDATE RAG SETTINGS
  // ============================================================

  const saveRAGSettings = async (
    nextRetrievalDepth: number,
    nextSourceAttribution: boolean,
  ) => {
    if (!isAdmin) {
      return;
    }

    try {
      setRagSaving(true);
      setRagError("");
      setRagSuccess("");

      const updated =
        await updateRAGSettings({
          retrieval_depth:
            nextRetrievalDepth,
          source_attribution:
            nextSourceAttribution,
        });

      setRetrievalDepth(
        updated.retrieval_depth,
      );

      setSourceAttribution(
        updated.source_attribution,
      );

      setRagSuccess(
        "RAG settings updated successfully.",
      );
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail;

      setRagError(
        detail ||
          "Unable to update RAG settings.",
      );
    } finally {
      setRagSaving(false);
    }
  };

  const handleRetrievalDepthChange = (
    value: number,
  ) => {
    if (!isAdmin || ragSaving) {
      return;
    }

    setRetrievalDepth(value);

    void saveRAGSettings(
      value,
      sourceAttribution,
    );
  };

  const handleSourceAttributionChange = (
    checked: boolean,
  ) => {
    if (!isAdmin || ragSaving) {
      return;
    }

    setSourceAttribution(checked);

    void saveRAGSettings(
      retrievalDepth,
      checked,
    );
  };

  // ============================================================
  // PASSWORD HELPERS
  // ============================================================

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);

    setPasswordError("");
  };

  const handleOpenPasswordDialog = () => {
    resetPasswordForm();
    setChangePasswordOpen(true);
  };

  const handleClosePasswordDialog = () => {
    if (passwordLoading) {
      return;
    }

    setChangePasswordOpen(false);
    resetPasswordForm();
  };

  const handleChangePassword = async () => {
    setPasswordError("");

    if (!currentPassword.trim()) {
      setPasswordError(
        "Please enter your current password.",
      );
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        "New password must be at least 8 characters long.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "New password and confirm password do not match.",
      );
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "New password must be different from your current password.",
      );
      return;
    }

    try {
      setPasswordLoading(true);

      const response = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setPasswordSuccess(
        response.message ||
          "Password changed successfully.",
      );

      setChangePasswordOpen(false);
      resetPasswordForm();
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail;

      setPasswordError(
        detail ||
          "Unable to change password. Please try again.",
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1400,
        mx: "auto",
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 3, md: 4 },
      }}
    >
      {/* ==================== HEADER ==================== */}

      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: "#102A56",
            letterSpacing: "-0.5px",
            mb: 0.75,
          }}
        >
          Settings
        </Typography>

        <Typography
          variant="body1"
          sx={{
            color: "#5F718D",
            fontSize: "1rem",
          }}
        >
          Manage your RAGENTIS workspace, account and
          system preferences.
        </Typography>
      </Box>

      {/* ==================== PASSWORD SUCCESS ==================== */}

      {passwordSuccess && (
        <Alert
          severity="success"
          icon={<CheckCircleRoundedIcon />}
          onClose={() => setPasswordSuccess("")}
          sx={{
            mb: 3,
            borderRadius: 2,
            border:
              "1px solid rgba(46, 125, 50, 0.18)",
          }}
        >
          {passwordSuccess}
        </Alert>
      )}

      {/* ==================== RAG SUCCESS ==================== */}

      {ragSuccess && (
        <Alert
          severity="success"
          icon={<CheckCircleRoundedIcon />}
          onClose={() => setRagSuccess("")}
          sx={{
            mb: 3,
            borderRadius: 2,
            border:
              "1px solid rgba(46, 125, 50, 0.18)",
          }}
        >
          {ragSuccess}
        </Alert>
      )}

      {/* ==================== RAG ERROR ==================== */}

      {ragError && (
        <Alert
          severity="error"
          onClose={() => setRagError("")}
          sx={{
            mb: 3,
            borderRadius: 2,
          }}
        >
          {ragError}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* ==================== ACCOUNT ==================== */}

        <Card
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor:
              "rgba(16, 42, 86, 0.10)",
            borderRadius: 3,
            background:
              "linear-gradient(145deg, #ffffff 0%, #f8fbff 100%)",
          }}
        >
          <CardContent
            sx={{ p: { xs: 2.5, md: 3 } }}
          >
            <Stack
              direction="row"
              spacing={2}
              sx={{
                mb: 3,
                alignItems: "center",
              }}
            >
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    "rgba(25, 118, 210, 0.10)",
                  color: "#1976D2",
                  flexShrink: 0,
                }}
              >
                <PersonOutlineRoundedIcon />
              </Box>

              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 750,
                    color: "#102A56",
                  }}
                >
                  Account
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    color: "#718198",
                  }}
                >
                  Your RAGENTIS account information
                </Typography>
              </Box>
            </Stack>

            <Divider sx={{ mb: 2.5 }} />

            <Stack spacing={2.2}>
              <SettingRow
                label="Username"
                value={
                  user?.username ||
                  "Not available"
                }
              />

              <SettingRow
                label="Email"
                value={
                  user?.email ||
                  "Not available"
                }
              />

              <SettingRow
                label="Role"
                value={
                  <Chip
                    label={userRole}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      borderRadius: 1.5,
                      background:
                        "rgba(25, 118, 210, 0.10)",
                      color: "#1565C0",
                    }}
                  />
                }
              />

              <Divider sx={{ my: 0.5 }} />

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 650,
                      color: "#172B4D",
                      mb: 0.35,
                    }}
                  >
                    Password
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      color: "#718198",
                    }}
                  >
                    Update your account password
                  </Typography>
                </Box>

                <Button
                  variant="outlined"
                  startIcon={
                    <LockResetRoundedIcon />
                  }
                  onClick={
                    handleOpenPasswordDialog
                  }
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 700,
                    borderColor:
                      "rgba(25, 118, 210, 0.35)",
                    color: "#1565C0",
                    px: 2,
                    "&:hover": {
                      borderColor: "#1976D2",
                      background:
                        "rgba(25, 118, 210, 0.05)",
                    },
                  }}
                >
                  Change Password
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* ==================== SECURITY ==================== */}

        <SettingsSection
          icon={<SecurityRoundedIcon />}
          title="Security"
          description="Authentication and account protection"
        >
          <SettingToggle
            title="JWT Authentication"
            description="Secure API access using token-based authentication"
            checked
            disabled
          />

          <SettingToggle
            title="Role-Based Access Control"
            description="Access permissions are enforced according to your role"
            checked
            disabled
          />
        </SettingsSection>

        {/* ==================== AI & RAG ==================== */}

        <SettingsSection
          icon={<SmartToyOutlinedIcon />}
          title="AI & RAG"
          description="Configure how RAGENTIS processes your knowledge"
        >
          <SettingToggle
            title="Local AI Processing"
            description="Keep document retrieval and AI generation within the local environment"
            checked
            disabled
          />

          <SettingToggle
            title="Knowledge-Only Responses"
            description="Generate answers using retrieved information from your uploaded documents"
            checked
            disabled
          />

          <Divider sx={{ my: 1 }} />

          {/* Retrieval Depth */}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: 3,
              py: 1.8,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ flex: 1, minWidth: 240 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  mb: 0.4,
                }}
              >
                <TuneRoundedIcon
                  sx={{
                    fontSize: 19,
                    color: "#1976D2",
                  }}
                />

                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 650,
                    color: "#172B4D",
                  }}
                >
                  Retrieval Depth
                </Typography>
              </Stack>

              <Typography
                variant="body2"
                sx={{
                  color: "#718198",
                  lineHeight: 1.55,
                }}
              >
                Number of relevant document chunks
                retrieved for each query.
              </Typography>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              {ragLoading ? (
                <CircularProgress size={22} />
              ) : (
                <>
                  <Select
                    size="small"
                    value={retrievalDepth}
                    disabled={
                      !isAdmin || ragSaving
                    }
                    onChange={(event) => {
                      handleRetrievalDepthChange(
                        Number(
                          event.target.value,
                        ),
                      );
                    }}
                    sx={{
                      minWidth: 110,
                      borderRadius: 2,
                      background: "#ffffff",
                      fontWeight: 650,
                      color: "#172B4D",
                    }}
                  >
                    <MenuItem value={3}>
                      3 chunks
                    </MenuItem>

                    <MenuItem value={5}>
                      5 chunks
                    </MenuItem>

                    <MenuItem value={7}>
                      7 chunks
                    </MenuItem>

                    <MenuItem value={10}>
                      10 chunks
                    </MenuItem>
                  </Select>

                  {ragSaving && (
                    <CircularProgress
                      size={20}
                    />
                  )}
                </>
              )}
            </Box>
          </Box>

          <Divider />

          {/* Source Attribution */}

          <SettingToggle
            title="Source Attribution"
            description="Show the documents used to generate each response"
            checked={sourceAttribution}
            disabled={
              ragLoading ||
              !isAdmin ||
              ragSaving
            }
            onChange={
              handleSourceAttributionChange
            }
          />

          {!isAdmin && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                mt: 0.5,
                color: "#718198",
              }}
            >
              Only workspace administrators can
              modify RAG configuration.
            </Typography>
          )}

          {isAdmin && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                mt: 0.5,
                color: "#718198",
              }}
            >
              Changes apply to the entire tenant
              workspace.
            </Typography>
          )}
        </SettingsSection>

        {/* ==================== STORAGE ==================== */}

        <SettingsSection
          icon={<StorageRoundedIcon />}
          title="Storage & Processing"
          description="Document processing and local knowledge storage"
        >
          <SettingToggle
            title="Document Processing"
            description="Automatically process uploaded PDF, DOCX and XLSX documents"
            checked
            disabled
          />

          <SettingRow
            label="Supported Formats"
            value={
              <Stack
                component="div"
                direction="row"
                spacing={0.75}
                useFlexGap
                sx={{
                  flexWrap: "wrap",
                }}
              >
                <Chip
                  label="PDF"
                  size="small"
                  sx={{
                    fontWeight: 650,
                    borderRadius: 1.5,
                  }}
                />

                <Chip
                  label="DOCX"
                  size="small"
                  sx={{
                    fontWeight: 650,
                    borderRadius: 1.5,
                  }}
                />

                <Chip
                  label="XLSX"
                  size="small"
                  sx={{
                    fontWeight: 650,
                    borderRadius: 1.5,
                  }}
                />
              </Stack>
            }
          />

          <SettingRow
            label="Maximum File Size"
            value="25 MB"
          />

          <SettingRow
            label="Vector Storage"
            value="ChromaDB"
          />
        </SettingsSection>

        {/* ==================== APPEARANCE ==================== */}

        <SettingsSection
          icon={<PaletteOutlinedIcon />}
          title="Appearance"
          description="Customize your RAGENTIS experience"
        >
          {/* Theme */}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: 3,
              py: 1.8,
              flexWrap: "wrap",
            }}
          >
            <Box
              sx={{
                flex: 1,
                minWidth: 240,
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 650,
                  color: "#172B4D",
                  mb: 0.35,
                }}
              >
                Theme
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: "#718198",
                  lineHeight: 1.55,
                }}
              >
                Choose how the RAGENTIS interface
                should appear.
              </Typography>
            </Box>

            <TextField
              select
              size="small"
              label="Theme"
              value={appearanceSettings.theme}
              onChange={(event) =>
                setTheme(
                  event.target.value as
                    | "light"
                    | "dark"
                    | "system",
                )
              }
              sx={{
                minWidth: 150,
              }}
            >
              <MenuItem value="light">
                Light
              </MenuItem>

              <MenuItem value="dark">
                Dark
              </MenuItem>

              <MenuItem value="system">
                System
              </MenuItem>
            </TextField>
          </Box>

          <Divider />

          {/* Compact Interface */}

          <SettingToggle
            title="Compact Interface"
            description="Use a more condensed layout for workspace content"
            checked={appearanceSettings.compact}
            onChange={setCompact}
          />

          <Divider />

          {/* Animations */}

          <SettingToggle
            title="Animations"
            description="Enable interface animations and visual transitions"
            checked={appearanceSettings.animations}
            onChange={setAnimations}
          />
        </SettingsSection>

        {/* ==================== WORKSPACE ==================== */}

        <SettingsSection
          icon={<BusinessOutlinedIcon />}
          title="Workspace"
          description="Current tenant and deployment information"
        >
          <SettingRow
            label="Tenant ID"
            value={
              user?.tenant_id ||
              "Not available"
            }
          />

          <SettingRow
            label="Deployment"
            value={
              <Chip
                label="Self-Hosted / Offline"
                size="small"
                sx={{
                  fontWeight: 700,
                  borderRadius: 1.5,
                  background:
                    "rgba(46, 125, 50, 0.10)",
                  color: "#2E7D32",
                }}
              />
            }
          />

          <SettingRow
            label="AI Runtime"
            value="Local LLM"
          />
        </SettingsSection>
      </Stack>

      {/* ==================== CHANGE PASSWORD DIALOG ==================== */}

      <Dialog
        open={changePasswordOpen}
        onClose={handleClosePasswordDialog}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              background:
                "linear-gradient(145deg, #ffffff 0%, #f8fbff 100%)",
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 3,
            pb: 1,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 1.8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "rgba(25, 118, 210, 0.10)",
                color: "#1976D2",
              }}
            >
              <LockResetRoundedIcon />
            </Box>

            <Box>
              <Typography
                sx={{
                  fontWeight: 800,
                  color: "#102A56",
                  fontSize: "1.2rem",
                }}
              >
                Change Password
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: "#718198",
                  mt: 0.25,
                }}
              >
                Update your RAGENTIS account password
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent
          sx={{ px: 3, pt: 2 }}
        >
          {passwordError && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                borderRadius: 2,
              }}
            >
              {passwordError}
            </Alert>
          )}

          <Stack
            spacing={2.2}
            sx={{ mt: 1 }}
          >
            <TextField
              fullWidth
              label="Current Password"
              type={
                showCurrentPassword
                  ? "text"
                  : "password"
              }
              value={currentPassword}
              onChange={(event) =>
                setCurrentPassword(
                  event.target.value,
                )
              }
              disabled={passwordLoading}
              autoComplete="current-password"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowCurrentPassword(
                            (previous) =>
                              !previous,
                          )
                        }
                        edge="end"
                        disabled={
                          passwordLoading
                        }
                        aria-label={
                          showCurrentPassword
                            ? "Hide current password"
                            : "Show current password"
                        }
                      >
                        {showCurrentPassword ? (
                          <VisibilityOffRoundedIcon />
                        ) : (
                          <VisibilityRoundedIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              fullWidth
              label="New Password"
              type={
                showNewPassword
                  ? "text"
                  : "password"
              }
              value={newPassword}
              onChange={(event) =>
                setNewPassword(
                  event.target.value,
                )
              }
              disabled={passwordLoading}
              autoComplete="new-password"
              helperText="Minimum 8 characters"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowNewPassword(
                            (previous) =>
                              !previous,
                          )
                        }
                        edge="end"
                        disabled={
                          passwordLoading
                        }
                        aria-label={
                          showNewPassword
                            ? "Hide new password"
                            : "Show new password"
                        }
                      >
                        {showNewPassword ? (
                          <VisibilityOffRoundedIcon />
                        ) : (
                          <VisibilityRoundedIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              fullWidth
              label="Confirm New Password"
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              disabled={passwordLoading}
              autoComplete="new-password"
              error={
                confirmPassword.length > 0 &&
                newPassword !==
                  confirmPassword
              }
              helperText={
                confirmPassword.length > 0 &&
                newPassword !==
                  confirmPassword
                  ? "Passwords do not match"
                  : "Re-enter your new password"
              }
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowConfirmPassword(
                            (previous) =>
                              !previous,
                          )
                        }
                        edge="end"
                        disabled={
                          passwordLoading
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirmation password"
                            : "Show confirmation password"
                        }
                      >
                        {showConfirmPassword ? (
                          <VisibilityOffRoundedIcon />
                        ) : (
                          <VisibilityRoundedIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            pt: 2,
            gap: 1,
          }}
        >
          <Button
            onClick={
              handleClosePasswordDialog
            }
            disabled={passwordLoading}
            sx={{
              textTransform: "none",
              fontWeight: 650,
              color: "#5F718D",
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={
              handleChangePassword
            }
            disabled={passwordLoading}
            startIcon={
              passwordLoading ? (
                <CircularProgress
                  size={18}
                  color="inherit"
                />
              ) : (
                <LockResetRoundedIcon />
              )
            }
            sx={{
              minWidth: 155,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              background: "#1976D2",
              boxShadow:
                "0 6px 18px rgba(25, 118, 210, 0.22)",
              "&:hover": {
                background: "#1565C0",
              },
            }}
          >
            {passwordLoading
              ? "Updating..."
              : "Update Password"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* =========================================================
   SETTING ROW
   ========================================================= */

interface SettingRowProps {
  label: string;
  value: React.ReactNode;
}

function SettingRow({
  label,
  value,
}: SettingRowProps) {
  return (
    <Stack
      direction={{
        xs: "column",
        sm: "row",
      }}
      spacing={1}
      sx={{
        justifyContent:
          "space-between",
        alignItems: {
          xs: "flex-start",
          sm: "center",
        },
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 650,
          color: "#4D607A",
        }}
      >
        {label}
      </Typography>

      <Box
        sx={{
          color: "#172B4D",
          fontWeight: 600,
          textAlign: {
            xs: "left",
            sm: "right",
          },
          wordBreak: "break-word",
        }}
      >
        {value}
      </Box>
    </Stack>
  );
}

/* =========================================================
   SETTING TOGGLE
   ========================================================= */

interface SettingToggleProps {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

function SettingToggle({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: SettingToggleProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent:
          "space-between",
        gap: 2,
        py: 1.5,
      }}
    >
      <Box>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 650,
            color: "#172B4D",
            mb: 0.35,
          }}
        >
          {title}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: "#718198",
            lineHeight: 1.55,
          }}
        >
          {description}
        </Typography>
      </Box>

      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(_, value) =>
          onChange?.(value)
        }
        sx={{
          flexShrink: 0,

          "& .MuiSwitch-switchBase.Mui-checked":
            {
              color: "#1976D2",
            },

          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
            {
              backgroundColor: "#1976D2",
            },
        }}
      />
    </Box>
  );
}

/* =========================================================
   SETTINGS SECTION
   ========================================================= */

interface SettingsSectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsSection({
  icon,
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <Card
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor:
          "rgba(16, 42, 86, 0.10)",
        borderRadius: 3,
        background:
          "linear-gradient(145deg, #ffffff 0%, #f8fbff 100%)",
      }}
    >
      <CardContent
        sx={{
          p: {
            xs: 2.5,
            md: 3,
          },
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{
            mb: 3,
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "rgba(25, 118, 210, 0.10)",
              color: "#1976D2",
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>

          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 750,
                color: "#102A56",
              }}
            >
              {title}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: "#718198",
              }}
            >
              {description}
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 1.5 }} />

        {children}
      </CardContent>
    </Card>
  );
}

export default Settings;

