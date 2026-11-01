import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";

import {
  getActivationRequest,
  getLicenseHistory,
  type ActivationRequest,
  type LicenseHistoryEntry,
  type LicenseStatusResponse,
} from "../../api/license.api";
import { formatDateTime } from "../../utils/format";
import { toast } from "../common/Toast";

const cardSx = { borderRadius: 3, border: "1px solid", borderColor: "divider" } as const;

/** Installation binding: the code the customer sends to the vendor. */
export function LicenseActivation({ status }: { status: LicenseStatusResponse | null }) {
  const [request, setRequest] = useState<ActivationRequest | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getActivationRequest()
      .then(setRequest)
      .catch(() => setError("The activation request could not be created."));
  }, []);

  const bound = Boolean(status?.license?.bound_to_installation);

  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 750 }}>
              This installation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A licence can be tied to this installation so it cannot be copied to another server.
            </Typography>
          </Box>
          {status?.license && (
            <Chip
              color={bound ? "success" : "default"}
              variant={bound ? "filled" : "outlined"}
              label={bound ? "Licence bound to this installation" : "Licence not bound (works on any installation)"}
            />
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {request && (
          <Stack spacing={1.5} sx={{ mt: 2.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">INSTALLATION ID</Typography>
              <Typography className="font-mono" data-testid="installation-id" sx={{ fontWeight: 700 }}>
                {request.installation_id}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                ACTIVATION REQUEST – send this code to your vendor to receive a licence for this installation
              </Typography>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mt: 0.5 }}>
                <Box
                  component="code"
                  className="font-mono"
                  data-testid="activation-code"
                  sx={{ flex: 1, p: 1.25, borderRadius: 1.5, bgcolor: "action.hover", wordBreak: "break-all",
                        fontSize: "0.75rem" }}
                >
                  {request.code}
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyOutlinedIcon />}
                  onClick={() => {
                    void navigator.clipboard.writeText(request.code);
                    toast.success("Activation request copied.");
                  }}
                >
                  Copy
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                The code contains only the installation ID, your organisation name and the date – no documents or
                personal data. A restored backup keeps the same installation ID.
              </Typography>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

/** Every licence install attempt, newest first. */
export function LicenseHistory({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<LicenseHistoryEntry[]>([]);

  useEffect(() => {
    getLicenseHistory().then(setRows).catch(() => setRows([]));
  }, [refreshKey]);

  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Typography variant="h6" sx={{ fontWeight: 750, mb: 1.5 }}>
          Licence history
        </Typography>
        <TableContainer>
          <Table size="small" data-testid="licence-history">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>By</TableCell>
                <TableCell>Licence</TableCell>
                <TableCell>Valid until</TableCell>
                <TableCell>Result</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">No licence installed yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{formatDateTime(r.at)}</TableCell>
                  <TableCell>{r.by ?? "—"}</TableCell>
                  <TableCell className="font-mono" sx={{ fontSize: "0.75rem" }}>
                    {r.license_id ?? "—"}
                    {r.customer ? ` · ${r.customer}` : ""}
                  </TableCell>
                  <TableCell>{r.expires_at ? formatDateTime(r.expires_at).split(",")[0] : "—"}</TableCell>
                  <TableCell>
                    {r.outcome === "success" ? (
                      <Chip size="small" color="success" label="Installed" />
                    ) : (
                      <Chip size="small" color="error" variant="outlined" label={r.reason ?? "Rejected"} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
