import { useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import QRCode from "qrcode";

import { disableMfa, enableMfa, startMfaSetup } from "../../api/auth.api";
import { useAuth } from "../../auth/AuthContext";

const errorText = (err: unknown, fallback: string) => {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
};

/** Two-step login (TOTP) setup inside Settings. */
export default function MfaSettings() {
  const { user, refreshUser } = useAuth();
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"setup" | "disable" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setError("");
    setCode("");
    try {
      const data = await startMfaSetup();
      setSecret(data.secret);
      setQr(await QRCode.toDataURL(data.otpauth_uri, { margin: 1, width: 220 }));
      setMode("setup");
    } catch (err) {
      setError(errorText(err, "Could not start two-step login setup."));
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "setup") await enableMfa(code);
      else await disableMfa(password, code);
      await refreshUser();
      setMode(null);
    } catch (err) {
      setError(errorText(err, "The code is not correct."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ mt: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          Two-step login
          <Chip size="small" label={user?.mfa_enabled ? "On" : "Off"} color={user?.mfa_enabled ? "success" : "default"} />
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Ask for a 6-digit code from an authenticator app (Google or Microsoft Authenticator) at every sign-in.
        </Typography>
        {error && !mode && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </Box>
      {user?.mfa_enabled ? (
        <Button variant="outlined" color="warning" onClick={() => { setError(""); setCode(""); setPassword(""); setMode("disable"); }}>
          Turn off
        </Button>
      ) : (
        <Button variant="contained" onClick={() => void begin()}>Turn on</Button>
      )}

      <Dialog open={mode !== null} onClose={() => !busy && setMode(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{mode === "setup" ? "Set up two-step login" : "Turn off two-step login"}</DialogTitle>
        <DialogContent>
          {mode === "setup" && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                1. Scan this QR code with your authenticator app. 2. Enter the 6-digit code it shows.
              </Typography>
              {qr && <Box component="img" src={qr} alt="QR code for the authenticator app" sx={{ display: "block", mx: "auto", mb: 1, borderRadius: 1, bgcolor: "#fff" }} />}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mb: 2, wordBreak: "break-all" }}>
                Can't scan? Enter this key: <b style={{ fontFamily: "monospace" }}>{secret}</b>
              </Typography>
            </>
          )}
          {mode === "disable" && user?.auth_source !== "ldap" && (
            <TextField fullWidth type="password" label="Your password" value={password} sx={{ mb: 2 }}
                       onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          )}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField fullWidth label="6-digit code" value={code}
                     onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                     slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "one-time-code", "aria-label": "Authentication code" } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMode(null)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={() => void confirm()} disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : mode === "setup" ? "Turn on" : "Turn off"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
