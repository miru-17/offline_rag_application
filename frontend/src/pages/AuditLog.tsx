import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";

import { errorMessage } from "../api/documents.api";
import { exportAudit, getAuditEvents, type AuditEvent, type AuditFilters } from "../api/audit.api";
import { downloadBlob } from "../api/datasets.api";
import PageHeader from "../components/rag/PageHeader";

const ACTION_GROUPS = [
  { value: "", label: "All actions" },
  { value: "auth", label: "Sign-in & passwords" },
  { value: "user", label: "Users" },
  { value: "document", label: "Documents" },
  { value: "license", label: "Licence" },
  { value: "settings", label: "Settings" },
  { value: "group", label: "Team spaces" },
  { value: "dataset", label: "Data dashboard" },
  { value: "extraction", label: "Extraction" },
];

const describe = (details: Record<string, unknown> | null) =>
  details ? Object.entries(details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ") : "";

export default function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [actor, setActor] = useState("");
  const [error, setError] = useState("");

  const filters: AuditFilters = {
    action: action || undefined,
    outcome: outcome || undefined,
    actor: actor.trim() || undefined,
  };

  const load = useCallback(async () => {
    try {
      const data = await getAuditEvents({ ...filters, limit: rowsPerPage, offset: page * rowsPerPage });
      setEvents(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(errorMessage(err, "Unable to load the audit log."));
    }
  }, [action, outcome, actor, page, rowsPerPage]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Audit Log"
        subtitle="Every sign-in, upload, deletion, role, licence and settings change in your organisation."
        action={
          <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}
                  onClick={() => void exportAudit(filters).then((b) => downloadBlob(b, "audit-log.csv"))}>
            Export CSV
          </Button>
        }
      />

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      <Card sx={{ border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
            <Select size="small" value={action} displayEmpty onChange={(e) => { setAction(e.target.value); setPage(0); }}>
              {ACTION_GROUPS.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
            </Select>
            <Select size="small" value={outcome} displayEmpty onChange={(e) => { setOutcome(e.target.value); setPage(0); }}>
              <MenuItem value="">Any outcome</MenuItem>
              <MenuItem value="success">Success</MenuItem>
              <MenuItem value="failure">Failure</MenuItem>
            </Select>
            <TextField size="small" label="User" value={actor} onChange={(e) => { setActor(e.target.value); setPage(0); }} />
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Target</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(e.created_at).toLocaleString()}</TableCell>
                    <TableCell>{e.actor ?? "system"}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{e.action}</Typography>
                        {e.outcome !== "success" && <Chip size="small" color="error" variant="outlined" label={e.outcome} />}
                      </Stack>
                    </TableCell>
                    <TableCell>{e.target ?? ""}</TableCell>
                    <TableCell sx={{ maxWidth: 360 }}><Typography variant="caption">{describe(e.details)}</Typography></TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{e.ip_address ?? ""}</TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow><TableCell colSpan={6}><Typography color="text.secondary">No events.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} rowsPerPage={rowsPerPage}
                           onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[25, 50, 100]}
                           onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }} />
        </CardContent>
      </Card>
    </Stack>
  );
}
