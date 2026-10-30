import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  AdminPanelSettingsOutlined,
  CheckCircleOutlined,
  ContentCopyOutlined,
  EditOutlined,
  RefreshOutlined,
  ScheduleOutlined,
  ShieldOutlined,
  FingerprintOutlined,
  LockOutlined,
  VerifiedUserOutlined,
} from "@mui/icons-material";

import { useAuth } from "../auth/AuthContext";
import {
  getLicenseStatus,
  installLicense,
  type LicenseStatusResponse,
} from "../api/license.api";

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDaysRemaining(expiresAt: string): number {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const difference = expiry - now;
  if (difference <= 0) return 0;
  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}





/* =========================================================
   COMPONENT
========================================================= */

export default function License() {
  const { user } = useAuth();

  const [licenseData, setLicenseData] = useState<LicenseStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [newExpiryDate, setNewExpiryDate] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const userRole = user?.role?.toUpperCase();
  const isAdmin = userRole === "ADMIN";

  const loadLicense = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const response = await getLicenseStatus();
      setLicenseData(response);
    } catch (err) {
      console.error("Failed to load license status:", err);
      setError("Unable to load license information. Please try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadLicense();
    } else {
      setIsLoading(false);
    }
  }, [isAdmin, loadLicense]);

  const license = licenseData?.license;

  const daysRemaining = useMemo(() => {
    if (!license?.expires_at) return 0;
    return getDaysRemaining(license.expires_at);
  }, [license?.expires_at]);

  const isActive = Boolean(licenseData?.licensed);

  const handleCopy = async () => {
    if (!license?.license_key) return;
    try {
      await navigator.clipboard.writeText(license.license_key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy license key:", err);
    }
  };

  const handleOpenEdit = () => {
    setNewExpiryDate("");
    setEditError(null);
    setSuccess(null);
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    if (isSaving) return;
    setEditOpen(false);
    setEditError(null);
  };

  // newExpiryDate holds the pasted / loaded signed licence file.
  const handleSaveExpiry = async () => {
    if (!newExpiryDate.trim()) {
      setEditError("Choose the .license file you received, or paste its contents.");
      return;
    }
    try {
      setIsSaving(true);
      setEditError(null);
      setError(null);
      setSuccess(null);
      setLicenseData(await installLicense(newExpiryDate.trim()));
      setEditOpen(false);
      setSuccess("Licence installed successfully.");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setEditError(typeof detail === "string" ? detail : "Unable to install this licence file.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLicenseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 20000) {
      setEditError("This does not look like a licence file (too large).");
      return;
    }
    setNewExpiryDate(await file.text());
    setEditError(null);
  };

  if (!isAdmin) {
    return (
      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
        <Card sx={{ maxWidth: 480, p: 4, textAlign: "center", borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <AdminPanelSettingsOutlined sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>
            Administrator Access Required
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Only administrators are authorized to inspect or modify on-premise cryptographic license entitlements.
          </Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {/* HEADER */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.025em" }}>
              Cryptographic License Guard
            </Typography>
            <Chip
              label="NODE ENTITLEMENT"
              size="small"
              sx={{ height: 20, fontSize: "0.6875rem", fontWeight: 700, bgcolor: "action.hover" }}
            />
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Offline machine-bound certificate validating sovereign execution and tenant quotas.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshOutlined />}
          onClick={() => void loadLicense(true)}
          disabled={isLoading || isRefreshing}
          sx={{ borderRadius: 2 }}
        >
          {isRefreshing ? "Checking..." : "Verify Certificate"}
        </Button>
      </Box>

      {/* NOTIFICATIONS */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ borderRadius: 2 }}>
          {success}
        </Alert>
      )}

      {licenseData && !licenseData.licensed && (
        <Alert severity={licenseData.state === "missing" ? "info" : "warning"} sx={{ borderRadius: 2 }}>
          {licenseData.message} Install the signed licence file from your vendor to enable uploads and chat.
        </Alert>
      )}
      {licenseData?.state === "grace" && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>{licenseData.message}</Alert>
      )}

      {isLoading ? (
        <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <>
          {/* ========================================================
              HARDWARE-BOUND DIGITAL CERTIFICATE CARD
              ======================================================== */}
          <Card
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: isActive ? "success.main" : "warning.main",
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? "linear-gradient(135deg, rgba(17, 23, 38, 0.95) 0%, rgba(11, 15, 23, 0.98) 100%)"
                  : "#ffffff",
              boxShadow: (theme) =>
                theme.palette.mode === "dark"
                  ? "0 8px 30px rgba(0, 0, 0, 0.5)"
                  : "0 4px 16px rgba(0, 0, 0, 0.05)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Watermark insignia */}
            <Box
              sx={{
                position: "absolute",
                right: -20,
                bottom: -20,
                opacity: 0.03,
                pointerEvents: "none",
              }}
            >
              <ShieldOutlined sx={{ fontSize: 260 }} />
            </Box>

            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 2,
                  mb: 3,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2.5,
                      bgcolor: isActive ? "success.main" : "warning.main",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                    }}
                  >
                    <VerifiedUserOutlined sx={{ fontSize: 28 }} />
                  </Box>

                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        Enterprise Node Certificate
                      </Typography>
                      <Chip
                        label={isActive ? "VALIDATED ENCLAVE" : "ATTENTION REQUIRED"}
                        color={isActive ? "success" : "warning"}
                        size="small"
                        sx={{ fontWeight: 750, height: 22 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Cryptographically signed offline for local deployment
                    </Typography>
                  </Box>
                </Box>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditOutlined />}
                  onClick={handleOpenEdit}
                  sx={{ borderRadius: 2, fontWeight: 650 }}
                >
                  {license ? "Install new licence" : "Install licence"}
                </Button>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Certificate Data Fields */}
              <Grid container spacing={3}>
                {/* DAYS REMAINING */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#f8fafc",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <ScheduleOutlined sx={{ fontSize: 18, color: "text.secondary" }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        DAYS REMAINING
                      </Typography>
                    </Box>

                    <Typography variant="h3" className="font-mono" sx={{ fontWeight: 800, color: daysRemaining < 15 ? "error.main" : "text.primary" }}>
                      {daysRemaining}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Expires on {license?.expires_at ? formatDate(license.expires_at) : "—"}
                    </Typography>
                  </Paper>
                </Grid>

                {/* HARDWARE ISOLATION */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#f8fafc",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <FingerprintOutlined sx={{ fontSize: 18, color: "text.secondary" }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        BINDING VERIFICATION
                      </Typography>
                    </Box>

                    <Typography variant="h5" sx={{ fontWeight: 750, my: 0.5 }}>
                      Machine Bound
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Hardware fingerprint verified on localhost
                    </Typography>
                  </Paper>
                </Grid>

                {/* AIR-GAP ASSURANCE */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#f8fafc",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <LockOutlined sx={{ fontSize: 18, color: "text.secondary" }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        OFFLINE ENFORCEMENT
                      </Typography>
                    </Box>

                    <Typography variant="h5" sx={{ fontWeight: 750, my: 0.5, color: "success.main" }}>
                      Zero Phone-Home
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      No licensing telemetry sent over WAN
                    </Typography>
                  </Paper>
                </Grid>

                {/* LICENSE KEY STRING */}
                <Grid size={{ xs: 12 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark" ? "#070a10" : "#f1f5f9",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                        CRYPTOGRAPHIC LICENSE TOKEN
                      </Typography>

                      <Button
                        size="small"
                        onClick={handleCopy}
                        startIcon={copied ? <CheckCircleOutlined fontSize="small" /> : <ContentCopyOutlined fontSize="small" />}
                        sx={{ fontSize: "0.75rem", py: 0.25 }}
                      >
                        {copied ? "Copied" : "Copy Token"}
                      </Button>
                    </Box>

                    <Typography
                      variant="body2"
                      className="font-mono"
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: (theme) =>
                          theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#ffffff",
                        border: "1px solid",
                        borderColor: "divider",
                        wordBreak: "break-all",
                        fontSize: "0.82rem",
                        color: "primary.light",
                      }}
                    >
                      {license?.license_key || "NO_ACTIVE_LICENSE_KEY"}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </>
      )}

      {/* ========================================================
          EDIT EXPIRY MODAL
          ======================================================== */}
      <Dialog open={editOpen} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Install signed licence
        </DialogTitle>
        <DialogContent dividers>
          {editError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editError}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Licences are signed by the vendor and cannot be edited here. Choose the <b>.license</b> file you
            received, or paste its contents. Expiry, user limit and features come from the signed file.
          </Typography>

          <Button variant="outlined" component="label" disabled={isSaving} sx={{ mb: 2 }}>
            Choose licence file
            <input hidden type="file" accept=".license,.json,.txt" onChange={(e) => void handleLicenseFile(e)} />
          </Button>

          <TextField
            fullWidth
            multiline
            minRows={5}
            label="Licence file contents"
            placeholder='{"format": "ragentis-license-v1", ...}'
            value={newExpiryDate}
            onChange={(e) => setNewExpiryDate(e.target.value)}
            disabled={isSaving}
            slotProps={{ htmlInput: { style: { fontFamily: "monospace", fontSize: 12 } } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseEdit} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveExpiry()}
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <EditOutlined />}
          >
            {isSaving ? "Verifying..." : "Install licence"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}