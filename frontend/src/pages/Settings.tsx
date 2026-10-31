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
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import { useAuth } from "../auth/AuthContext";
import { useAppearance } from "../context/AppearanceContext";
import { changePassword } from "../api/settings.api";
import MfaSettings from "../components/rag/MfaSettings";
import {
  getRAGSettings,
  updateRAGSettings,
} from "../api/ragsettings.api";

export default function Settings() {
  const { user } = useAuth();

  const {
    settings: appearanceSettings,
    setCompact,
    setAnimations,
    setTheme,
  } = useAppearance();

  const userRole = user?.role?.toUpperCase() ?? "USER";
  const isAdmin = userRole === "ADMIN";

  // Password state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // RAG Settings
  const [retrievalDepth, setRetrievalDepth] = useState(5);
  const [sourceAttribution, setSourceAttribution] = useState(true);
  const [piiMode, setPiiMode] = useState<"off" | "flag" | "redact">("flag");
  const [ragLoading, setRagLoading] = useState(true);
  const [ragSaving, setRagSaving] = useState(false);
  const [ragError, setRagError] = useState("");
  const [ragSuccess, setRagSuccess] = useState("");

  useEffect(() => {
    const loadRAG = async () => {
      try {
        setRagLoading(true);
        setRagError("");
        const settings = await getRAGSettings();
        setRetrievalDepth(settings.retrieval_depth);
        setSourceAttribution(settings.source_attribution);
        setPiiMode(settings.pii_mode ?? "flag");
      } catch (error: any) {
        const detail = error?.response?.data?.detail;
        setRagError(detail || "Unable to load RAG hyperparameters.");
      } finally {
        setRagLoading(false);
      }
    };

    void loadRAG();
  }, []);

  const saveRAG = async (depth: number, attribution: boolean, pii: "off" | "flag" | "redact" = piiMode) => {
    if (!isAdmin) return;
    try {
      setRagSaving(true);
      setRagError("");
      setRagSuccess("");

      const updated = await updateRAGSettings({
        retrieval_depth: depth,
        source_attribution: attribution,
        pii_mode: pii,
      });
      setPiiMode(updated.pii_mode ?? pii);

      setRetrievalDepth(updated.retrieval_depth);
      setSourceAttribution(updated.source_attribution);
      setRagSuccess("RAG hyperparameters updated successfully.");
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setRagError(detail || "Failed to update RAG hyperparameters.");
    } finally {
      setRagSaving(false);
    }
  };

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError("");
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    if (!currentPassword.trim()) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password.");
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setPasswordSuccess(res.message || "Password changed successfully.");
      setChangePasswordOpen(false);
      resetPasswordForm();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setPasswordError(detail || "Unable to change password. Please verify current credentials.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Stack spacing={3}>
      {/* HEADER */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.025em" }}>
            Platform Settings & Configuration
          </Typography>
          <Chip
            label="WORKSPACE CONTROLS"
            size="small"
            sx={{ height: 20, fontSize: "0.6875rem", fontWeight: 700, bgcolor: "action.hover" }}
          />
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          Tune neural retrieval hyperparameters, account security, and workspace appearance tokens.
        </Typography>
      </Box>

      {/* FEEDBACK ALERTS */}
      {ragSuccess && (
        <Alert severity="success" onClose={() => setRagSuccess("")} sx={{ borderRadius: 2 }}>
          {ragSuccess}
        </Alert>
      )}
      {ragError && (
        <Alert severity="error" onClose={() => setRagError("")} sx={{ borderRadius: 2 }}>
          {ragError}
        </Alert>
      )}
      {passwordSuccess && (
        <Alert severity="success" onClose={() => setPasswordSuccess("")} sx={{ borderRadius: 2 }}>
          {passwordSuccess}
        </Alert>
      )}

      {/* ========================================================
          RAG RETRIEVAL HYPERPARAMETERS (ADMIN)
          ======================================================== */}
      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(6, 182, 212, 0.12)"
                      : "rgba(6, 182, 212, 0.1)",
                  color: "info.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TuneRoundedIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 750 }}>
                  Neural RAG Hyperparameters
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure semantic vector search depth and source attribution strictness
                </Typography>
              </Box>
            </Box>

            <Chip
              label={isAdmin ? "ADMIN CONTROL" : "READ ONLY"}
              size="small"
              color={isAdmin ? "primary" : "default"}
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          </Box>

          <Divider sx={{ mb: 3 }} />

          {ragLoading ? (
            <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Stack spacing={3}>
              {/* Retrieval Depth Slider */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Top-K Retrieval Chunk Depth: <Box component="span" className="font-mono" sx={{ color: "primary.main" }}>{retrievalDepth} chunks</Box>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Number of relevant semantic document chunks injected into the local LLM prompt context window.
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ px: 2, pt: 1 }}>
                  <Slider
                    value={retrievalDepth}
                    min={1}
                    max={15}
                    step={1}
                    marks={[
                      { value: 1, label: "1" },
                      { value: 5, label: "5 (Optimal)" },
                      { value: 10, label: "10" },
                      { value: 15, label: "15" },
                    ]}
                    valueLabelDisplay="auto"
                    disabled={!isAdmin || ragSaving}
                    onChange={(_, val) => setRetrievalDepth(val as number)}
                    onChangeCommitted={(_, val) => void saveRAG(val as number, sourceAttribution)}
                  />
                </Box>
              </Box>

              <Divider />

              {/* Source Attribution Switch */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Enforce Grounded Source Attribution
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Require every synthesized response to append verifiable source citations and chunk coordinates.
                  </Typography>
                </Box>

                <Switch
                  checked={sourceAttribution}
                  disabled={!isAdmin || ragSaving}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSourceAttribution(checked);
                    void saveRAG(retrievalDepth, checked);
                  }}
                  color="primary"
                />
              </Box>

              <Divider />

              {/* Personal data protection */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Personal data (PII) protection
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Detects Aadhaar, PAN, phone, email, IFSC and card numbers in new uploads. Redact hides them from the
                    AI completely. Applies to documents uploaded after the change.
                  </Typography>
                </Box>
                <Select
                  size="small"
                  value={piiMode}
                  disabled={!isAdmin || ragSaving}
                  onChange={(e) => {
                    const next = e.target.value as "off" | "flag" | "redact";
                    setPiiMode(next);
                    void saveRAG(retrievalDepth, sourceAttribution, next);
                  }}
                  sx={{ minWidth: 190 }}
                >
                  <MenuItem value="off">Off</MenuItem>
                  <MenuItem value="flag">Detect and flag</MenuItem>
                  <MenuItem value="redact">Detect and redact</MenuItem>
                </Select>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          APPEARANCE & THEME TOKENS
          ======================================================== */}
      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(99, 102, 241, 0.12)"
                    : "rgba(99, 102, 241, 0.1)",
                color: "secondary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PaletteOutlinedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 750 }}>
                Appearance & Viewport
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Personalize visual theme and motion fluidity
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            {/* Theme Selector */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Theme Mode
              </Typography>
              <Select
                fullWidth
                size="small"
                value={appearanceSettings.theme}
                onChange={(e) => setTheme(e.target.value as "light" | "dark")}
              >
                <MenuItem value="dark">Enterprise Dark (Default)</MenuItem>
                <MenuItem value="light">Crisp Light Slate</MenuItem>
              </Select>
            </Grid>

            {/* Compact mode toggle */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%" }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Compact Layout
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Increases information density
                  </Typography>
                </Box>
                <Switch
                  checked={appearanceSettings.compact}
                  onChange={(e) => setCompact(e.target.checked)}
                />
              </Box>
            </Grid>

            {/* Animations toggle */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%" }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Smooth Micro-Transitions
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Telemetry pulses & state motion
                  </Typography>
                </Box>
                <Switch
                  checked={appearanceSettings.animations}
                  onChange={(e) => setAnimations(e.target.checked)}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ========================================================
          SECURITY & CREDENTIALS
          ======================================================== */}
      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(16, 185, 129, 0.1)",
                  color: "success.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SecurityRoundedIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 750 }}>
                  Account & Authentication
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage login credentials and tenant access tokens
                </Typography>
              </Box>
            </Box>

            {user?.auth_source !== "ldap" && (
            <Button
              variant="outlined"
              startIcon={<LockResetRoundedIcon />}
              onClick={() => {
                resetPasswordForm();
                setChangePasswordOpen(true);
              }}
              sx={{ borderRadius: 2, fontWeight: 650 }}
            >
              Update Password
            </Button>
            )}
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                LOGGED IN USERNAME
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.25 }}>
                {user?.username}
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                ASSIGNED TENANT PARTITION
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.25 }}>
                {user?.tenant_name || "Primary Enclave"}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ mt: 2.5 }} />
          <MfaSettings />
        </CardContent>
      </Card>

      {/* ========================================================
          CHANGE PASSWORD MODAL
          ======================================================== */}
      <Dialog
        open={changePasswordOpen}
        onClose={() => !passwordLoading && setChangePasswordOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Change Password
        </DialogTitle>
        <DialogContent dividers>
          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}

          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Current Password"
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={passwordLoading}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowCurrentPassword((prev) => !prev)}>
                        {showCurrentPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              fullWidth
              size="small"
              label="New Password"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordLoading}
              helperText="Minimum 8 characters"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowNewPassword((prev) => !prev)}>
                        {showNewPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              fullWidth
              size="small"
              label="Confirm New Password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordLoading}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowConfirmPassword((prev) => !prev)}>
                        {showConfirmPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setChangePasswordOpen(false)} disabled={passwordLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleChangePassword()}
            disabled={passwordLoading}
            startIcon={passwordLoading ? <CircularProgress size={16} color="inherit" /> : <LockResetRoundedIcon />}
          >
            {passwordLoading ? "Saving..." : "Change Password"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
