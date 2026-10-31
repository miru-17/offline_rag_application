import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";

import { errorMessage } from "../api/documents.api";
import {
  createApiKey,
  getApiKeys,
  getApiScopes,
  revokeApiKey,
  type ApiKeyItem,
  type CreatedApiKey,
} from "../api/integrations.api";
import { getUsers, type ManagedUser } from "../api/users.api";
import { toast } from "../components/common/Toast";
import PageHeader from "../components/rag/PageHeader";
import { formatDateTime } from "../utils/format";

const EXAMPLE = (key: string) => `curl -X POST https://<server>/api/query/ \\
  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "What is the leave policy?"}'`;

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [scopes, setScopes] = useState<{ scope: string; description: string }[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<string[]>(["query"]);
  const [days, setDays] = useState("365");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [toRevoke, setToRevoke] = useState<ApiKeyItem | null>(null);

  const load = useCallback(async () => {
    try {
      const [k, s, u] = await Promise.all([getApiKeys(), getApiScopes(), getUsers()]);
      setKeys(k);
      setScopes(s);
      setUsers(u.filter((x) => x.is_active !== false));
      setError("");
    } catch (err) {
      setError(errorMessage(err, "API keys could not be loaded."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setSaving(true);
    try {
      const result = await createApiKey({
        name: name.trim(),
        scopes: chosen,
        expires_in_days: days ? Number(days) : null,
        user_id: userId || undefined,
      });
      setOpen(false);
      setCreated(result);
      setName("");
      void load();
    } catch (err) {
      toast.error(errorMessage(err, "The key could not be created."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="API keys"
        subtitle="Let other company systems (ERP, intranet, scripts) ask questions and add documents through the REST API."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setOpen(true)}>
            New API key
          </Button>
        }
      />
      {error && <Alert severity="error">{error}</Alert>}

      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Acts as</TableCell>
                <TableCell>Allowed</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No API keys yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{k.name}</TableCell>
                  <TableCell className="font-mono" sx={{ fontSize: "0.75rem" }}>{k.prefix}</TableCell>
                  <TableCell>{k.user ?? "—"}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {k.scopes.map((s) => (
                        <Chip key={s} size="small" label={s} variant="outlined" />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>{k.last_used_at ? formatDateTime(k.last_used_at) : "Never"}</TableCell>
                  <TableCell>{k.expires_at ? formatDateTime(k.expires_at) : "Never"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={k.state}
                      color={k.state === "active" ? "success" : "default"}
                      variant={k.state === "active" ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {k.state === "active" && (
                      <Button size="small" color="error" onClick={() => setToRevoke(k)}>
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            How to use a key
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Send it in the <code>X-API-Key</code> header. A key can only do what its scopes allow and what its
            account’s role allows. Endpoints: <code>POST /query/</code>, <code>POST /query/stream</code>,{" "}
            <code>GET /documents/</code>, <code>POST /documents/upload</code>, <code>GET /documents/&#123;id&#125;/file</code>.
          </Typography>
          <Box component="pre" className="font-mono"
               sx={{ m: 0, p: 1.5, borderRadius: 2, bgcolor: "action.hover", fontSize: "0.75rem", overflowX: "auto" }}>
            {EXAMPLE("rgk_xxxxxxxx_…")}
          </Box>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>New API key</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" placeholder="e.g. SAP connector" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <TextField
              select
              label="Acts as account"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              helperText="Use a separate account with the smallest role that is enough."
            >
              <MenuItem value="">Me</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.username} ({u.role})
                </MenuItem>
              ))}
            </TextField>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Allowed
              </Typography>
              {scopes.map((s) => (
                <FormControlLabel
                  key={s.scope}
                  sx={{ display: "flex" }}
                  control={
                    <Checkbox
                      checked={chosen.includes(s.scope)}
                      onChange={(e) =>
                        setChosen((c) => (e.target.checked ? [...c, s.scope] : c.filter((x) => x !== s.scope)))
                      }
                    />
                  }
                  label={
                    <span>
                      <b>{s.scope}</b> — {s.description}
                    </span>
                  }
                />
              ))}
            </Box>
            <TextField
              select
              label="Expires after"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              <MenuItem value="30">30 days</MenuItem>
              <MenuItem value="90">90 days</MenuItem>
              <MenuItem value="365">1 year</MenuItem>
              <MenuItem value="">Never</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submit} disabled={saving || name.trim().length < 2 || chosen.length === 0}>
            Create key
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(created)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Copy the key now</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This is the only time the full key is shown. Store it in the other system’s secret settings.
          </Alert>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box component="code" className="font-mono" data-testid="new-api-key"
                 sx={{ flex: 1, p: 1.25, borderRadius: 1.5, bgcolor: "action.hover", wordBreak: "break-all", fontSize: "0.8rem" }}>
              {created?.key}
            </Box>
            <Tooltip title="Copy">
              <IconButton
                aria-label="Copy key"
                onClick={() => {
                  if (created) void navigator.clipboard.writeText(created.key);
                  toast.success("Key copied.");
                }}
              >
                <ContentCopyOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCreated(null)}>
            I have stored it
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(toRevoke)} onClose={() => setToRevoke(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Revoke “{toRevoke?.name}”?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Systems using this key stop working immediately. This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToRevoke(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!toRevoke) return;
              try {
                await revokeApiKey(toRevoke.id);
                toast.success("Key revoked.");
                void load();
              } catch (err) {
                toast.error(errorMessage(err, "The key could not be revoked."));
              } finally {
                setToRevoke(null);
              }
            }}
          >
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
