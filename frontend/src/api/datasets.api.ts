import apiClient from "./axios";

export type ColumnKind = "number" | "date" | "category" | "text";

export interface DatasetColumn {
  name: string;
  kind: ColumnKind;
  missing: number;
  unique: number;
  min?: number | string | null;
  max?: number | string | null;
  sample?: string[];
}

export interface Dataset {
  id: string;
  name: string;
  file_type: string;
  sheet_name: string | null;
  row_count: number;
  columns: DatasetColumn[];
  visibility: "PRIVATE" | "TENANT";
  origin: "upload" | "extraction";
  file_size: number | null;
  created_at: string;
  owner_id: string;
}

export interface AggregateRow {
  label: string;
  value: number | null;
}

export interface AggregateResult {
  label_column: string | null;
  value_label: string;
  rows: AggregateRow[];
  groups?: number;
  total: number | null;
  matched_rows: number;
  spec: AggregateSpec;
}

export interface ChartResult extends AggregateResult {
  type: "line" | "bar";
  title: string;
}

export interface Kpi {
  label: string;
  value: number | string | null;
  format: "integer" | "number" | "text";
}

export interface DashboardResponse {
  dataset: Dataset;
  kpis: Kpi[];
  charts: ChartResult[];
  primary_metric: string | null;
  primary_date: string | null;
  columns: DatasetColumn[];
  preview: Record<string, unknown>[];
}

export interface AggregateFilter {
  column: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";
  value: string | number | (string | number)[] | null;
}

export interface AggregateSpec {
  metric: "sum" | "avg" | "count" | "min" | "max" | "count_distinct";
  value_column?: string | null;
  group_by?: string | null;
  time_grain?: "day" | "week" | "month" | "quarter" | "year" | null;
  filters?: AggregateFilter[];
  date_column?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  sort?: "value_desc" | "value_asc" | "label" | null;
  limit?: number;
}

export interface AskResponse extends AggregateResult {
  question: string;
  answer: string;
  chart: "line" | "bar";
}

export const getDatasets = async (): Promise<Dataset[]> => (await apiClient.get<Dataset[]>("/datasets/")).data;

export const uploadDataset = async (file: File, shared: boolean, sheetName?: string): Promise<Dataset> => {
  const form = new FormData();
  form.append("file", file);
  form.append("shared", shared ? "true" : "false");
  if (sheetName) form.append("sheet_name", sheetName);
  return (await apiClient.post<Dataset>("/datasets/upload", form, { headers: { "Content-Type": "multipart/form-data" } })).data;
};

export const getDashboard = async (id: string): Promise<DashboardResponse> =>
  (await apiClient.get<DashboardResponse>(`/datasets/${id}/dashboard`)).data;

export const aggregateDataset = async (id: string, spec: AggregateSpec): Promise<AggregateResult> =>
  (await apiClient.post<AggregateResult>(`/datasets/${id}/aggregate`, spec)).data;

export const askDataset = async (id: string, question: string): Promise<AskResponse> =>
  (await apiClient.post<AskResponse>(`/datasets/${id}/ask`, { question }, { timeout: 180000 })).data;

export const exportAggregate = async (id: string, spec: AggregateSpec): Promise<Blob> =>
  (await apiClient.post(`/datasets/${id}/export`, spec, { responseType: "blob" })).data;

export const deleteDataset = async (id: string): Promise<void> => {
  await apiClient.delete(`/datasets/${id}`);
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
