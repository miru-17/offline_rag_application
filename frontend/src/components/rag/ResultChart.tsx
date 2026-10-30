import { useTheme } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AggregateRow } from "../../api/datasets.api";
import { formatNumber } from "./PageHeader";

interface Props {
  type: "line" | "bar";
  rows: AggregateRow[];
  valueLabel: string;
  height?: number;
}

const compact = (value: number) =>
  Math.abs(value) >= 1e7 ? `${(value / 1e7).toFixed(1)} Cr`
    : Math.abs(value) >= 1e5 ? `${(value / 1e5).toFixed(1)} L`
      : Math.abs(value) >= 1e3 ? `${(value / 1e3).toFixed(1)}k` : String(Math.round(value * 100) / 100);

export default function ResultChart({ type, rows, valueLabel, height = 280 }: Props) {
  const theme = useTheme();
  const color = theme.palette.primary.main;
  const grid = theme.palette.divider;
  const text = theme.palette.text.secondary;

  if (rows.length === 0) {
    return (
      <Box sx={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography color="text.secondary">No data for this selection.</Typography>
      </Box>
    );
  }

  const data = rows.map((r) => ({ label: r.label, value: r.value ?? 0 }));
  const tooltip = (
    <Tooltip
      cursor={type === "bar" ? { fill: theme.palette.action.hover } : { stroke: grid }}
      formatter={(value) => [formatNumber(value as number), valueLabel]}
      contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${grid}`, borderRadius: 8 }}
      labelStyle={{ color: theme.palette.text.primary, fontWeight: 600 }}
    />
  );

  return (
    <Box sx={{ width: "100%", height }}>
      <ResponsiveContainer>
        {type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: text, fontSize: 12 }} tickLine={false} axisLine={{ stroke: grid }}
                   minTickGap={16} />
            <YAxis tick={{ fill: text, fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={compact}
                   width={56} />
            {tooltip}
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={data.length <= 40}
                  activeDot={{ r: 5 }} />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: text, fontSize: 12 }} tickLine={false} axisLine={{ stroke: grid }}
                   interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? "end" : "middle"}
                   height={data.length > 6 ? 60 : 30} />
            <YAxis tick={{ fill: text, fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={compact}
                   width={56} />
            {tooltip}
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </Box>
  );
}
