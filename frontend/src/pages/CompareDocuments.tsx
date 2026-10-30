import { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import DifferenceOutlinedIcon from "@mui/icons-material/DifferenceOutlined";

import { compareDocuments, errorMessage, getDocuments, type CompareResult, type DocumentItem } from "../api/documents.api";
import PageHeader, { StatTile } from "../components/rag/PageHeader";

const CHANGE_STYLE = {
  added: { label: "Added", color: "success" as const },
  removed: { label: "Removed", color: "error" as const },
  changed: { label: "Changed", color: "warning" as const },
};

export default function CompareDocuments() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docA, setDocA] = useState<DocumentItem | null>(null);
  const [docB, setDocB] = useState<DocumentItem | null>(null);
  const [summarize, setSummarize] = useState(true);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getDocuments()
      .then((docs) => setDocuments(docs.filter((d) => d.status === "ready")))
      .catch((err) => setError(errorMessage(err, "Unable to load documents.")));
  }, []);

  const run = async () => {
    if (!docA || !docB) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await compareDocuments(docA.id, docB.id, summarize));
    } catch (err) {
      setError(errorMessage(err, "Unable to compare these documents."));
    } finally {
      setBusy(false);
    }
  };

  const picker = (label: string, value: DocumentItem | null, onChange: (d: DocumentItem | null) => void) => (
    <Autocomplete
      sx={{ flex: 1, minWidth: 240 }}
      options={documents}
      value={value}
      onChange={(_, v) => onChange(v)}
      getOptionLabel={(d) => d.filename}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );

  return (
    <Stack spacing={3}>
      <PageHeader title="Compare Documents"
                  subtitle="See exactly what changed between two versions of a contract, policy or agreement." />

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      <Card sx={{ border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
            {picker("Old version", docA, setDocA)}
            {picker("New version", docB, setDocB)}
            <FormControlLabel control={<Switch checked={summarize} onChange={(e) => setSummarize(e.target.checked)} />}
                              label="AI summary of changes" />
            <Button variant="contained" onClick={() => void run()} disabled={busy || !docA || !docB || docA.id === docB.id}
                    startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DifferenceOutlinedIcon />}>
              {busy ? "Comparing…" : "Compare"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {result && (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
            <StatTile label="Same text" value={`${Math.round(result.similarity * 100)}%`} />
            <StatTile label="Changed" value={result.counts.changed} />
            <StatTile label="Added" value={result.counts.added} />
            <StatTile label="Removed" value={result.counts.removed} />
          </Box>

          {result.summary && (
            <Card sx={{ border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>What changed (AI summary)</Typography>
                <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{result.summary}</Typography>
                <Typography variant="caption" color="text.secondary">Check the exact changes below before relying on the summary.</Typography>
              </CardContent>
            </Card>
          )}

          <Card sx={{ border: "1px solid", borderColor: "divider" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Exact changes: {result.document_a.filename} → {result.document_b.filename}
              </Typography>
              {result.changes.length === 0 && <Typography color="text.secondary">No differences found.</Typography>}
              <Stack spacing={1.5}>
                {result.changes.map((change, i) => (
                  <Box key={i} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
                    <Chip size="small" variant="outlined" color={CHANGE_STYLE[change.type].color}
                          label={CHANGE_STYLE[change.type].label} sx={{ mb: 1 }} />
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                      <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: change.before ? "rgba(220,38,38,0.07)" : "transparent" }}>
                        <Typography variant="caption" color="text.secondary">Before</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", textDecoration: change.type === "removed" ? "line-through" : "none" }}>
                          {change.before ?? "—"}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: change.after ? "rgba(22,163,74,0.08)" : "transparent" }}>
                        <Typography variant="caption" color="text.secondary">After</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{change.after ?? "—"}</Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Stack>
              {result.truncated && (
                <Alert severity="info" sx={{ mt: 2 }}>Only the first 200 changes are shown.</Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}
