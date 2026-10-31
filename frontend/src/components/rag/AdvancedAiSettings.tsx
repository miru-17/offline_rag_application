import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import {
  getRAGSettings,
  getSettingsOptions,
  reindexDocuments,
  runRetentionNow,
  updateRAGSettings,
  type RAGSettings,
  type SettingsOptions,
} from "../../api/ragsettings.api";
import { getApiErrorMessage } from "../../utils/format";
import { toast } from "../common/Toast";

type RetentionKey = "conversation_retention_days" | "audit_retention_days" | "document_retention_days";

const RETENTION_ROWS: { key: RetentionKey; label: string; help: string }[] = [
  { key: "conversation_retention_days", label: "Chats", help: "Delete conversations not used for this many days." },
  { key: "audit_retention_days", label: "Audit log", help: "Delete audit entries older than this (minimum 30 days)." },
  {
    key: "document_retention_days",
    label: "Documents",
    help: "Delete documents uploaded longer ago than this (minimum 30 days). Legal hold always wins.",
  },
];

function Row({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
      <Box sx={{ maxWidth: 520 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {help}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

/** Search, answer language, AI model and data retention (administrators edit, others see). */
export default function AdvancedAiSettings({ isAdmin }: { isAdmin: boolean }) {
  const [settings, setSettings] = useState<RAGSettings | null>(null);
  const [options, setOptions] = useState<SettingsOptions | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [retention, setRetention] = useState<Record<RetentionKey, string>>({
    conversation_retention_days: "",
    audit_retention_days: "",
    document_retention_days: "",
  });
  const [confirmRun, setConfirmRun] = useState(false);
  const [busy, setBusy] = useState<"run" | "reindex" | null>(null);

  const applySettings = (s: RAGSettings) => {
    setSettings(s);
    setRetention({
      conversation_retention_days: s.conversation_retention_days ? String(s.conversation_retention_days) : "",
      audit_retention_days: s.audit_retention_days ? String(s.audit_retention_days) : "",
      document_retention_days: s.document_retention_days ? String(s.document_retention_days) : "",
    });
  };

  useEffect(() => {
    Promise.all([getRAGSettings(), getSettingsOptions()])
      .then(([s, o]) => {
        applySettings(s);
        setOptions(o);
      })
      .catch((err) => setError(getApiErrorMessage(err, "Settings could not be loaded.")));
  }, []);

  const save = async (change: Partial<RAGSettings>, message = "Settings saved.") => {
    setSaving(true);
    try {
      applySettings(await updateRAGSettings(change));
      toast.success(message);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Settings could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  const saveRetention = () => {
    const change: Partial<RAGSettings> = {};
    for (const row of RETENTION_ROWS) {
      const raw = retention[row.key].trim();
      change[row.key] = raw === "" ? null : Number(raw);
    }
    void save(change, "Retention saved. Clean-up runs once a day.");
  };

  const retentionChanged =
    settings !== null &&
    RETENTION_ROWS.some((row) => (retention[row.key].trim() || null) !== (settings[row.key] ? String(settings[row.key]) : null));

  return (
    <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              bgcolor: "action.hover",
              color: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TuneRoundedIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 750 }}>
              Search, language, AI model & retention
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isAdmin ? "Applies to everyone in your organisation" : "Set by your administrator"}
            </Typography>
          </Box>
        </Box>
        <Divider sx={{ mb: 3 }} />

        {error && <Alert severity="error">{error}</Alert>}
        {!error && (!settings || !options) && <CircularProgress size={22} />}

        {settings && options && (
          <Stack spacing={3}>
            <Row
              title="Exact-match (hybrid) search"
              help="Also finds invoice numbers, IDs and quoted phrases word for word, not only by meaning."
            >
              <Switch
                checked={Boolean(settings.hybrid_search)}
                disabled={!isAdmin || saving || !options.hybrid_search_available}
                slotProps={{ input: { "aria-label": "Hybrid search" } }}
                onChange={(e) => void save({ hybrid_search: e.target.checked })}
              />
            </Row>

            <Row
              title="Answer language"
              help={`Documents can be in any language the search model supports (now: ${options.embedding_model}).`}
            >
              <Select
                size="small"
                value={settings.answer_language ?? "auto"}
                disabled={!isAdmin || saving}
                onChange={(e) => void save({ answer_language: String(e.target.value) })}
                sx={{ minWidth: 220 }}
                inputProps={{ "aria-label": "Answer language" }}
              >
                {options.languages.map((l) => (
                  <MenuItem key={l.code} value={l.code}>
                    {l.name}
                  </MenuItem>
                ))}
              </Select>
            </Row>

            <Row
              title="AI model"
              help="Models offered on this server. Larger models answer better but are slower on a laptop CPU."
            >
              <Select
                size="small"
                value={settings.llm_model ?? ""}
                disabled={!isAdmin || saving}
                onChange={(e) => void save({ llm_model: String(e.target.value) }, "Model changed.")}
                sx={{ minWidth: 220 }}
                inputProps={{ "aria-label": "AI model" }}
              >
                {options.models.map((m) => (
                  <MenuItem key={m.name} value={m.name} disabled={m.installed === false}>
                    {m.name}
                    {m.default ? " (default)" : ""}
                    {m.installed === false ? " — not downloaded" : ""}
                  </MenuItem>
                ))}
              </Select>
            </Row>

            {isAdmin && (
              <Row
                title="Re-read all documents"
                help="Needed once after the search model is changed (for example to the multilingual model)."
              >
                <Button
                  variant="outlined"
                  size="small"
                  disabled={busy === "reindex"}
                  onClick={async () => {
                    setBusy("reindex");
                    try {
                      const r = await reindexDocuments();
                      toast.success(`${r.queued} documents are being re-read in the background.`);
                    } catch (err) {
                      toast.error(getApiErrorMessage(err, "Re-indexing could not start."));
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Re-index documents
                </Button>
              </Row>
            )}

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Data retention
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Leave empty to keep forever. Documents under legal hold are never deleted.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, mt: 1.5 }}>
                {RETENTION_ROWS.map((row) => (
                  <TextField
                    key={row.key}
                    size="small"
                    type="number"
                    label={`${row.label} (days)`}
                    placeholder="Keep forever"
                    helperText={row.help}
                    value={retention[row.key]}
                    disabled={!isAdmin || saving}
                    onChange={(e) => setRetention((r) => ({ ...r, [row.key]: e.target.value.replace(/[^0-9]/g, "") }))}
                    slotProps={{ htmlInput: { min: options.retention_minimum_days[row.key] ?? 1 } }}
                  />
                ))}
              </Box>
              {isAdmin && (
                <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                  <Button variant="contained" size="small" disabled={!retentionChanged || saving} onClick={saveRetention}>
                    Save retention
                  </Button>
                  <Button
                    size="small"
                    disabled={busy === "run" || retentionChanged}
                    onClick={() => setConfirmRun(true)}
                  >
                    Run clean-up now
                  </Button>
                </Box>
              )}
            </Box>
          </Stack>
        )}
      </CardContent>

      <Dialog open={confirmRun} onClose={() => setConfirmRun(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Run clean-up now?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Everything older than the saved retention periods is deleted permanently. Documents under legal hold
            are kept.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRun(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy === "run"}
            onClick={async () => {
              setBusy("run");
              try {
                const r = await runRetentionNow();
                toast.success(
                  `Removed ${r.conversations} chats, ${r.documents} documents, ${r.audit_events} audit entries` +
                    (r.kept_on_hold ? ` (kept ${r.kept_on_hold} on legal hold)` : "") +
                    ".",
                );
              } catch (err) {
                toast.error(getApiErrorMessage(err, "Clean-up failed."));
              } finally {
                setBusy(null);
                setConfirmRun(false);
              }
            }}
          >
            Delete old data
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
