import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Autocomplete,
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
  IconButton,
  LinearProgress,
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
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";

import { errorMessage, getDocuments, type DocumentItem } from "../api/documents.api";
import {
  createExtraction,
  deleteExtraction,
  exportExtraction,
  getExtraction,
  getExtractions,
  type ExtractionJob,
} from "../api/extraction.api";
import { downloadBlob } from "../api/datasets.api";
import PageHeader from "../components/rag/PageHeader";

const TEMPLATES: Record<string, string[]> = {
  Invoices: ["Invoice Number", "Invoice Date", "Vendor", "Amount", "GST Number"],
  Contracts: ["Party A", "Party B", "Start Date", "End Date", "Contract Value", "Notice Period"],
  Resumes: ["Name", "Email", "Phone", "Skills", "Experience Years"],
  "Purchase orders": ["PO Number", "PO Date", "Supplier", "Total Amount", "Delivery Date"],
};

const STATUS_COLOR: Record<string, "default" | "info" | "success" | "error" | "warning"> = {
  queued: "warning",
  processing: "info",
  completed: "success",
  failed: "error",
};

export default function Extraction() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<DocumentItem[]>([]);
  const [fields, setFields] = useState<string[]>(TEMPLATES.Invoices);
  const [name, setName] = useState("Invoices");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<ExtractionJob | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await getExtractions());
    } catch (err) {
      setError(errorMessage(err, "Unable to load extractions."));
    }
  }, []);

  useEffect(() => {
    getDocuments()
      .then((docs) => setDocuments(docs.filter((d) => d.status === "ready")))
      .catch((err) => setError(errorMessage(err, "Unable to load documents.")));
    void loadJobs();
  }, [loadJobs]);

  const running = jobs.some((j) => j.status === "queued" || j.status === "processing");
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void loadJobs(), 2500);
    return () => window.clearInterval(timer);
  }, [running, loadJobs]);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      await createExtraction(name.trim() || "Extraction", selectedDocs.map((d) => d.id),
        fields.map((f) => ({ name: f.trim() })));
      setSelectedDocs([]);
      await loadJobs();
    } catch (err) {
      setError(errorMessage(err, "Unable to start the extraction."));
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (job: ExtractionJob) => {
    try {
      setDetail(await getExtraction(job.id));
    } catch (err) {
      setError(errorMessage(err, "Unable to open this extraction."));
    }
  };

  const validField = (f: string) => /^[A-Za-z][A-Za-z0-9 _-]{0,39}$/.test(f.trim());

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Structured Extraction"
        subtitle="Pull the same fields out of many documents into one table — invoices, contracts, resumes."
      />

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      <Card sx={{ border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>New extraction</Typography>

            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>Templates:</Typography>
              {Object.keys(TEMPLATES).map((t) => (
                <Chip key={t} label={t} onClick={() => { setFields(TEMPLATES[t]); setName(t); }}
                      variant={name === t ? "filled" : "outlined"} color="primary" />
              ))}
            </Stack>

            <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)}
                       slotProps={{ htmlInput: { maxLength: 120 } }} sx={{ maxWidth: 360 }} />

            <Autocomplete
              multiple
              options={documents}
              value={selectedDocs}
              onChange={(_, value) => setSelectedDocs(value.slice(0, 50))}
              getOptionLabel={(d) => d.filename}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField {...params} label="Documents (up to 50)" placeholder="Choose ready documents" />
              )}
            />

            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={fields}
              onChange={(_, value) => setFields((value as string[]).map((v) => v.trim()).filter(Boolean).slice(0, 15))}
              renderValue={(value, getItemProps) =>
                value.map((option, index) => {
                  const { key, ...itemProps } = getItemProps({ index });
                  return (
                    <Chip key={key} {...itemProps} label={option} color={validField(option) ? "default" : "error"} />
                  );
                })
              }
              renderInput={(params) => (
                <TextField {...params} label="Fields to extract (type and press Enter)"
                           helperText="Letters, numbers, spaces, - and _. Up to 15 fields." />
              )}
            />

            <Box>
              <Button variant="contained" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <PlayArrowRoundedIcon />}
                      disabled={busy || selectedDocs.length === 0 || fields.length === 0 || !fields.every(validField)}
                      onClick={() => void start()}>
                Extract from {selectedDocs.length || ""} document{selectedDocs.length === 1 ? "" : "s"}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Runs in the background on the local AI (about 10–30 seconds per document on a laptop CPU).
                Values the AI cannot find are left empty, never guessed.
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Extractions</Typography>
          {jobs.length === 0 ? (
            <Typography color="text.secondary">No extractions yet.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Fields</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{job.name}</TableCell>
                      <TableCell><Chip size="small" variant="outlined" label={job.status} color={STATUS_COLOR[job.status]} /></TableCell>
                      <TableCell sx={{ minWidth: 160 }}>
                        <LinearProgress variant="determinate" value={(100 * job.processed_count) / Math.max(1, job.document_count)} />
                        <Typography variant="caption" color="text.secondary">{job.processed_count} / {job.document_count}</Typography>
                      </TableCell>
                      <TableCell>{job.fields.map((f) => f.name).join(", ")}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="View results"><IconButton size="small" onClick={() => void openDetail(job)}><VisibilityOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                        {job.dataset_id && (
                          <Tooltip title="Open in Data Dashboard">
                            <IconButton size="small" color="primary" onClick={() => navigate(`/data/${job.dataset_id}`)}><InsightsOutlinedIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Export CSV">
                          <IconButton size="small" onClick={() => void exportExtraction(job.id).then((b) => downloadBlob(b, `${job.name}.csv`))}>
                            <FileDownloadOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {job.status !== "queued" && job.status !== "processing" && (
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => void deleteExtraction(job.id).then(loadJobs)}>
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={detail !== null} onClose={() => setDetail(null)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{detail?.name}</DialogTitle>
        <DialogContent>
          {detail?.error_message && <Alert severity="error" sx={{ mb: 2 }}>{detail.error_message}</Alert>}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Document</TableCell>
                  {detail?.fields.map((f) => <TableCell key={f.name} sx={{ fontWeight: 700 }}>{f.name}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {detail?.results?.map((row) => (
                  <TableRow key={row.document_id}>
                    <TableCell>
                      {row.filename}
                      {row.status === "failed" && <Typography variant="caption" color="error" sx={{ display: "block" }}>{row.error}</Typography>}
                    </TableCell>
                    {detail.fields.map((f) => (
                      <TableCell key={f.name}>
                        {row.values[f.name] ?? <Typography variant="caption" color="text.disabled">not found</Typography>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
