import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { errorMessage } from "../api/documents.api";
import { getKnowledgeGaps, getOverview, type InsightsOverview, type KnowledgeGaps } from "../api/insights.api";
import { getSystemHealth, type SystemHealth } from "../api/system.api";
import PageHeader, { StatTile } from "../components/rag/PageHeader";
import ResultChart from "../components/rag/ResultChart";

const statusColor = (value: string) =>
  ["online", "available", "valid"].includes(value) ? "success" : value === "grace" ? "warning" : "error";

export default function Insights() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<InsightsOverview | null>(null);
  const [gaps, setGaps] = useState<KnowledgeGaps | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    Promise.all([getOverview(days), getKnowledgeGaps(days)])
      .then(([o, g]) => { setOverview(o); setGaps(g); })
      .catch((err) => setError(errorMessage(err, "Unable to load insights.")));
  }, [days]);

  useEffect(() => {
    const load = () => getSystemHealth().then(setHealth).catch(() => setHealth(null));
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const rate = overview?.answers.answer_rate;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Insights"
        subtitle="How the assistant is used, how well it answers, and which documents are missing."
        action={
          <Select size="small" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <MenuItem value={7}>Last 7 days</MenuItem>
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
          </Select>
        }
      />

      {error && <Alert severity="error">{error}</Alert>}

      {health && (
        <Card sx={{ border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>System health</Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip variant="outlined" color={statusColor(health.database)} label={`Database: ${health.database}`} />
              <Chip variant="outlined" color={statusColor(health.ollama)} label={`AI engine: ${health.ollama}`} />
              <Chip variant="outlined" color={statusColor(health.model_status)} label={`${health.model}: ${health.model_status}`} />
              <Chip variant="outlined" color={statusColor(health.license.state)}
                    label={`Licence: ${health.license.state}${health.license.days_left !== null ? ` (${health.license.days_left} days)` : ""}`} />
              <Chip variant="outlined" label={`Processing queue: ${health.ingestion_queue}`} />
              <Chip variant="outlined" label={`Waiting for AI: ${health.llm_waiting}`} />
              {health.disk.uploads?.free_gb !== undefined && (
                <Chip variant="outlined" color={(health.disk.uploads.free_gb ?? 0) < 5 ? "warning" : "default"}
                      label={`Free disk: ${health.disk.uploads.free_gb} GB`} />
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {!overview || !gaps ? (
        !error && <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}><CircularProgress /></Box>
      ) : (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" } }}>
            <StatTile label="Questions" value={overview.questions.toLocaleString()} />
            <StatTile label="Active users" value={overview.active_users} />
            <StatTile label="Answered" value={rate === null || rate === undefined ? "–" : `${Math.round(rate * 100)}%`}
                      hint="Answered from documents" />
            <StatTile label="Not in documents" value={overview.answers.not_found} />
            <StatTile label="Feedback" value={`👍 ${overview.feedback.up} · 👎 ${overview.feedback.down}`} />
          </Box>

          <Card sx={{ border: "1px solid", borderColor: "divider" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Questions per day</Typography>
              <ResultChart type="bar" rows={overview.questions_per_day.map((d) => ({ label: d.date.slice(5), value: d.count }))}
                           valueLabel="Questions" height={220} />
            </CardContent>
          </Card>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" } }}>
            <Card sx={{ border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Knowledge gaps</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {gaps.unanswered_total} question{gaps.unanswered_total === 1 ? "" : "s"} could not be answered from your documents.
                  Upload documents that cover these. Who asked is not shown.
                </Typography>
                {gaps.questions.length === 0 ? (
                  <Typography color="text.secondary">No gaps in this period.</Typography>
                ) : (
                  <List dense>
                    {gaps.questions.map((q) => (
                      <ListItem key={q.question} divider secondaryAction={<Chip size="small" label={`×${q.count}`} />}>
                        <ListItemText primary={q.question} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>

            <Stack spacing={2}>
              <Card sx={{ border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Missing topics</Typography>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                    {gaps.missing_topics.length === 0 && <Typography color="text.secondary">None.</Typography>}
                    {gaps.missing_topics.map((t) => <Chip key={t.topic} label={`${t.topic} (${t.count})`} variant="outlined" />)}
                  </Stack>
                </CardContent>
              </Card>
              <Card sx={{ border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Answers rated unhelpful</Typography>
                  {gaps.disliked_answers.length === 0 ? (
                    <Typography color="text.secondary">None.</Typography>
                  ) : (
                    <List dense>
                      {gaps.disliked_answers.map((q) => (
                        <ListItem key={q.question} divider><ListItemText primary={q.question} secondary={`×${q.count}`} /></ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  );
}
