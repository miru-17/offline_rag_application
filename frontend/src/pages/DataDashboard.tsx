import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
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
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";

import { useAuth } from "../auth/AuthContext";
import {
  aggregateDataset,
  askDataset,
  deleteDataset,
  downloadBlob,
  exportAggregate,
  getDashboard,
  getDatasets,
  uploadDataset,
  type AggregateResult,
  type AggregateSpec,
  type DashboardResponse,
  type Dataset,
} from "../api/datasets.api";
import { errorMessage } from "../api/documents.api";
import PageHeader, { StatTile, formatNumber } from "../components/rag/PageHeader";
import ResultChart from "../components/rag/ResultChart";

const METRICS: { value: AggregateSpec["metric"]; label: string }[] = [
  { value: "sum", label: "Total (sum)" },
  { value: "avg", label: "Average" },
  { value: "count", label: "Count of rows" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
  { value: "count_distinct", label: "Distinct values" },
];

const EXAMPLES = ["Show the monthly trend", "Total by region", "Top 5 products by amount"];

export default function DataDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { datasetId } = useParams();
  const canUpload = user?.role === "ADMIN" || user?.role === "USER";

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [shared, setShared] = useState(false);

  const [spec, setSpec] = useState<AggregateSpec>({ metric: "sum", limit: 50 });
  const [custom, setCustom] = useState<AggregateResult | null>(null);
  const [customBusy, setCustomBusy] = useState(false);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ text: string; chart: "line" | "bar"; result: AggregateResult } | null>(null);
  const [asking, setAsking] = useState(false);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      setDatasets(await getDatasets());
    } catch (err) {
      setError(errorMessage(err, "Unable to load tables."));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!datasetId) {
      setDashboard(null);
      return;
    }
    setLoading(true);
    setError("");
    setCustom(null);
    setAnswer(null);
    getDashboard(datasetId)
      .then((data) => {
        setDashboard(data);
        const metric = data.primary_metric;
        setSpec({
          metric: metric ? "sum" : "count",
          value_column: metric,
          group_by: data.primary_date ?? data.columns.find((c) => c.kind === "category")?.name ?? null,
          time_grain: data.primary_date ? "month" : null,
          limit: 50,
        });
      })
      .catch((err) => setError(errorMessage(err, "Unable to build this dashboard.")))
      .finally(() => setLoading(false));
  }, [datasetId]);

  const columns = dashboard?.columns ?? [];
  const numberColumns = columns.filter((c) => c.kind === "number");
  const groupColumns = columns.filter((c) => c.kind === "date" || c.kind === "category");
  const groupIsDate = useMemo(
    () => columns.find((c) => c.name === spec.group_by)?.kind === "date",
    [columns, spec.group_by],
  );

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const created = await uploadDataset(file, shared);
      await loadList();
      navigate(`/data/${created.id}`);
    } catch (err) {
      setError(errorMessage(err, "Unable to read this table."));
    } finally {
      setUploading(false);
    }
  };

  const runCustom = async () => {
    if (!datasetId) return;
    setCustomBusy(true);
    setError("");
    try {
      const cleaned: AggregateSpec = {
        ...spec,
        value_column: spec.metric === "count" ? null : spec.value_column,
        time_grain: groupIsDate ? spec.time_grain ?? "month" : null,
        sort: groupIsDate ? "label" : "value_desc",
      };
      setCustom(await aggregateDataset(datasetId, cleaned));
    } catch (err) {
      setError(errorMessage(err, "This combination cannot be calculated."));
    } finally {
      setCustomBusy(false);
    }
  };

  const ask = async (text?: string) => {
    const q = (text ?? question).trim();
    if (!datasetId || q.length < 3) return;
    setQuestion(q);
    setAsking(true);
    setError("");
    try {
      const response = await askDataset(datasetId, q);
      setAnswer({ text: response.answer, chart: response.chart, result: response });
    } catch (err) {
      setAnswer(null);
      setError(errorMessage(err, "I could not answer that from this table."));
    } finally {
      setAsking(false);
    }
  };

  const exportResult = async (result: AggregateResult) => {
    if (!datasetId) return;
    try {
      downloadBlob(await exportAggregate(datasetId, result.spec), "ragentis-export.csv");
    } catch (err) {
      setError(errorMessage(err, "Export failed."));
    }
  };

  const removeDataset = async (dataset: Dataset) => {
    try {
      await deleteDataset(dataset.id);
      if (dataset.id === datasetId) navigate("/data");
      await loadList();
    } catch (err) {
      setError(errorMessage(err, "Unable to delete this table."));
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Data Dashboard"
        subtitle="Upload a CSV or Excel sheet. Totals are calculated over every row, on this machine."
        action={canUpload && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            {user?.role === "ADMIN" && (
              <FormControlLabel control={<Switch checked={shared} onChange={(e) => setShared(e.target.checked)} />}
                                label="Share with everyone" />
            )}
            <Button variant="contained" component="label" disabled={uploading}
                    startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <CloudUploadOutlinedIcon />}>
              {uploading ? "Reading table…" : "Upload CSV / Excel"}
              <input hidden type="file" accept=".csv,.xlsx" onChange={(e) => void handleUpload(e)} />
            </Button>
          </Stack>
        )}
      />

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "280px 1fr" }, gap: 3, alignItems: "start" }}>
        {/* ---------------- table list ---------------- */}
        <Card sx={{ border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Tables</Typography>
            {listLoading ? (
              <CircularProgress size={22} />
            ) : datasets.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No tables yet. Upload a CSV or Excel file, or create one with Extraction.
              </Typography>
            ) : (
              <List dense disablePadding>
                {datasets.map((d) => (
                  <ListItemButton key={d.id} selected={d.id === datasetId} onClick={() => navigate(`/data/${d.id}`)}
                                  sx={{ borderRadius: 1.5, mb: 0.5 }}>
                    <ListItemText
                      primary={d.name}
                      secondary={`${d.row_count.toLocaleString()} rows · ${d.origin === "extraction" ? "extracted" : d.visibility === "TENANT" ? "shared" : "private"}`}
                      slotProps={{ primary: { noWrap: true, sx: { fontWeight: 600 } } }}
                    />
                    {(d.owner_id === user?.id || user?.role === "ADMIN") && canUpload && (
                      <Tooltip title="Delete table">
                        <IconButton size="small" edge="end"
                                    onClick={(e) => { e.stopPropagation(); void removeDataset(d); }}>
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </ListItemButton>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* ---------------- dashboard ---------------- */}
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          {!datasetId && (
            <Card sx={{ border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ py: 7, textAlign: "center" }}>
                <TableChartOutlinedIcon sx={{ fontSize: 52, color: "text.disabled", mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Choose or upload a table</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 520, mx: "auto" }}>
                  Columns are detected automatically: dates become a timeline, categories become bar charts,
                  and amounts (₹, commas) are added up exactly.
                </Typography>
              </CardContent>
            </Card>
          )}

          {loading && <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}><CircularProgress /></Box>}

          {dashboard && !loading && (
            <>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{dashboard.dataset.name}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
                  {dashboard.columns.map((c) => (
                    <Chip key={c.name} size="small" variant="outlined" label={`${c.name} · ${c.kind}`} />
                  ))}
                </Stack>
              </Box>

              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(auto-fit, minmax(190px, 1fr))" } }}>
                {dashboard.kpis.map((k) => (
                  <StatTile key={k.label} label={k.label} value={k.format === "text" ? String(k.value) : formatNumber(k.value)} />
                ))}
              </Box>

              {/* Ask the data */}
              <Card sx={{ border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={2}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <AutoAwesomeOutlinedIcon color="primary" />
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>Ask the data</Typography>
                    </Box>
                    <Box component="form" onSubmit={(e) => { e.preventDefault(); void ask(); }}
                         sx={{ display: "flex", gap: 1.5, flexDirection: { xs: "column", sm: "row" } }}>
                      <TextField fullWidth size="small" value={question} onChange={(e) => setQuestion(e.target.value)}
                                 placeholder="e.g. monthly sales trend for the South region" disabled={asking}
                                 slotProps={{ htmlInput: { maxLength: 500 } }} />
                      <Button type="submit" variant="contained" disabled={asking || question.trim().length < 3}
                              startIcon={asking ? <CircularProgress size={16} color="inherit" /> : undefined}>
                        {asking ? "Thinking…" : "Ask"}
                      </Button>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                      {EXAMPLES.map((ex) => (
                        <Chip key={ex} label={ex} size="small" onClick={() => void ask(ex)} disabled={asking} />
                      ))}
                    </Stack>
                    {answer && (
                      <Box>
                        <Alert severity="info" sx={{ mb: 2 }}>{answer.text}</Alert>
                        <ResultChart type={answer.chart} rows={answer.result.rows} valueLabel={answer.result.value_label} />
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Calculated from {answer.result.matched_rows.toLocaleString()} rows ·
                            {" "}{answer.result.spec.metric}({answer.result.spec.value_column ?? "rows"})
                            {answer.result.spec.group_by ? ` by ${answer.result.spec.group_by}` : ""}
                          </Typography>
                          <Button size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={() => void exportResult(answer.result)}>
                            Export CSV
                          </Button>
                        </Box>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              {/* Automatic charts */}
              {dashboard.charts.map((chart) => (
                <Card key={chart.title} sx={{ border: "1px solid", borderColor: "divider" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{chart.title}</Typography>
                      <Button size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={() => void exportResult(chart)}>
                        Export
                      </Button>
                    </Box>
                    <ResultChart type={chart.type} rows={chart.rows} valueLabel={chart.value_label} />
                  </CardContent>
                </Card>
              ))}

              {/* Build your own */}
              <Card sx={{ border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Build a chart</Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                      <InputLabel>Calculate</InputLabel>
                      <Select label="Calculate" value={spec.metric}
                              onChange={(e) => setSpec({ ...spec, metric: e.target.value as AggregateSpec["metric"] })}>
                        {METRICS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                    {spec.metric !== "count" && (
                      <FormControl size="small" sx={{ minWidth: 170 }}>
                        <InputLabel>Of column</InputLabel>
                        <Select label="Of column" value={spec.value_column ?? ""}
                                onChange={(e) => setSpec({ ...spec, value_column: e.target.value })}>
                          {(spec.metric === "count_distinct" ? columns : numberColumns).map((c) => (
                            <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                      <InputLabel>Group by</InputLabel>
                      <Select label="Group by" value={spec.group_by ?? ""}
                              onChange={(e) => setSpec({ ...spec, group_by: e.target.value || null })}>
                        <MenuItem value="">(no grouping)</MenuItem>
                        {groupColumns.map((c) => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                    {groupIsDate && (
                      <FormControl size="small" sx={{ minWidth: 130 }}>
                        <InputLabel>Period</InputLabel>
                        <Select label="Period" value={spec.time_grain ?? "month"}
                                onChange={(e) => setSpec({ ...spec, time_grain: e.target.value as AggregateSpec["time_grain"] })}>
                          {["day", "week", "month", "quarter", "year"].map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                        </Select>
                      </FormControl>
                    )}
                    <Button variant="contained" onClick={() => void runCustom()} disabled={customBusy}>
                      {customBusy ? "Calculating…" : "Show"}
                    </Button>
                  </Stack>
                  {custom && (
                    <>
                      <ResultChart type={groupIsDate ? "line" : "bar"} rows={custom.rows} valueLabel={custom.value_label} />
                      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {custom.total !== null ? `Overall: ${formatNumber(custom.total)} · ` : ""}
                          {custom.matched_rows.toLocaleString()} rows
                        </Typography>
                        <Button size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={() => void exportResult(custom)}>
                          Export CSV
                        </Button>
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Preview */}
              <Card sx={{ border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>First {dashboard.preview.length} rows</Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <TableContainer sx={{ maxHeight: 360 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {dashboard.columns.map((c) => <TableCell key={c.name} sx={{ fontWeight: 700 }}>{c.name}</TableCell>)}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dashboard.preview.map((row, i) => (
                          <TableRow key={i} hover>
                            {dashboard.columns.map((c) => (
                              <TableCell key={c.name} sx={{ whiteSpace: "nowrap" }}>
                                {c.kind === "number" ? formatNumber(row[c.name]) : String(row[c.name] ?? "")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
