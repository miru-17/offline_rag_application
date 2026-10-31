import { useState } from "react";
import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";

import { changePassword } from "../api/settings.api";
import { useAuth } from "./AuthContext";

/** Shown after an admin password reset: the user must pick a new password first. */
export default function PasswordChangeGate() {
  const { user, refreshUser, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (next !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await changePassword({ current_password: current, new_password: next });
      await refreshUser();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? String((detail[0] as { msg?: string })?.msg ?? "Password not accepted.")
            : "Password not accepted.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Paper sx={{ p: 4, width: "100%", maxWidth: 420, borderRadius: 3 }} elevation={3}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <LockResetRoundedIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Choose a new password</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Hi {user?.username}, an administrator reset your password. Enter the temporary password, then choose
          your own (at least 8 characters, with a letter and a number).
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField fullWidth type="password" label="Temporary password" value={current}
                   onChange={(e) => setCurrent(e.target.value)} sx={{ mb: 2 }} autoComplete="current-password" />
        <TextField fullWidth type="password" label="New password" value={next}
                   onChange={(e) => setNext(e.target.value)} sx={{ mb: 2 }} autoComplete="new-password" />
        <TextField fullWidth type="password" label="Confirm new password" value={confirm}
                   onChange={(e) => setConfirm(e.target.value)} sx={{ mb: 3 }} autoComplete="new-password"
                   onKeyDown={(e) => e.key === "Enter" && void submit()} />
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Button onClick={logout} disabled={busy}>Sign out</Button>
          <Button variant="contained" onClick={() => void submit()}
                  disabled={busy || !current || next.length < 8 || !confirm}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
