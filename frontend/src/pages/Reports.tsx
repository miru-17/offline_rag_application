import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";

import { downloadBlob } from "../api/datasets.api";
import { errorMessage } from "../api/documents.api";
import {
  deleteReport,
  downloadReport,
  generateReport,
  getReports,
  setReportSchedule,
  type ReportItem,
} from "../api/integrations.api";
import { toast } from "../components/common/Toast";
import PageHeader from "../components/rag/PageHeader";
import { formatBytes, formatDateTime } from "../utils/format";

const day = (value: string) => formatDateTime(value).split(",")[0];

export default function Reports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [schedule, setSchedule] = useState<"weekly" | "off">("weekly");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getReports();
      setReports(data.reports);
      setSchedule(data.schedule);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Reports could not be loaded."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Reports"
        subtitle="PDF summary of use, answer quality, documents, security and knowledge gaps — for management reviews."
        action={
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Select size="small" value={days} onChange={(e) => setDays(Number(e.target.value))}
                    inputProps={{ "aria-label": "Report period" }}>
              <MenuItem value={7}>Last 7 days</MenuItem>
              <MenuItem value={30}>Last 30 days</MenuItem>
              <MenuItem value={90}>Last 90 days</MenuItem>
            </Select>
            <Button
              variant="contained"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await generateReport(days);
                  toast.success("Report created.");
                  void load();
                } catch (err) {
                  toast.error(errorMessage(err, "The report could not be created."));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create report now
            </Button>
          </Box>
        }
      />
      {error && <Alert severity="error">{error}</Alert>}

      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Weekly report
            </Typography>
            <Typography variant="caption" color="text.secondary">
              A report for the last 7 days is created automatically once a week and kept here.
            </Typography>
          </Box>
          <Switch
            checked={schedule === "weekly"}
            slotProps={{ input: { "aria-label": "Weekly report" } }}
            onChange={async (e) => {
              const next = e.target.checked ? "weekly" : "off";
              try {
                await setReportSchedule(next);
                setSchedule(next);
                toast.success(next === "weekly" ? "Weekly report on." : "Weekly report off.");
              } catch (err) {
                toast.error(errorMessage(err, "The schedule could not be changed."));
              }
            }}
          />
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Size</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No reports yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {day(r.period_start)} – {day(r.period_end)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={r.kind === "weekly" ? "Weekly" : "On request"} />
                  </TableCell>
                  <TableCell>{formatDateTime(r.created_at)}</TableCell>
                  <TableCell>{r.file_size ? formatBytes(r.file_size) : "—"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Download PDF">
                      <IconButton
                        aria-label="Download report"
                        onClick={async () => {
                          try {
                            downloadBlob(await downloadReport(r.id), `ragentis-report-${r.period_end.slice(0, 10)}.pdf`);
                          } catch (err) {
                            toast.error(errorMessage(err, "The report could not be downloaded."));
                          }
                        }}
                      >
                        <FileDownloadOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        aria-label="Delete report"
                        onClick={async () => {
                          try {
                            await deleteReport(r.id);
                            void load();
                          } catch (err) {
                            toast.error(errorMessage(err, "The report could not be deleted."));
                          }
                        }}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  );
}
