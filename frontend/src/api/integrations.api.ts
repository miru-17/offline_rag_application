import apiClient from "./axios";

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  user: string | null;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  state: "active" | "expired" | "revoked";
}

export interface CreatedApiKey extends ApiKeyItem {
  key: string;
}

export const getApiKeys = async (): Promise<ApiKeyItem[]> => (await apiClient.get<ApiKeyItem[]>("/api-keys/")).data;

export const getApiScopes = async (): Promise<{ scope: string; description: string }[]> =>
  (await apiClient.get("/api-keys/scopes")).data;

export const createApiKey = async (body: {
  name: string;
  scopes: string[];
  expires_in_days: number | null;
  user_id?: string;
}): Promise<CreatedApiKey> => (await apiClient.post<CreatedApiKey>("/api-keys/", body)).data;

export const revokeApiKey = async (id: string): Promise<ApiKeyItem> => (await apiClient.delete<ApiKeyItem>(`/api-keys/${id}`)).data;

export interface ReportItem {
  id: string;
  kind: "weekly" | "manual";
  period_start: string;
  period_end: string;
  created_at: string;
  file_size: number | null;
}

export const getReports = async (): Promise<{ schedule: "weekly" | "off"; reports: ReportItem[] }> =>
  (await apiClient.get("/reports/")).data;

export const generateReport = async (days: number): Promise<ReportItem> =>
  (await apiClient.post<ReportItem>("/reports/generate", null, { params: { days }, timeout: 120000 })).data;

export const setReportSchedule = async (schedule: "weekly" | "off") =>
  (await apiClient.patch("/reports/schedule", { schedule })).data;

export const downloadReport = async (id: string): Promise<Blob> =>
  (await apiClient.get<Blob>(`/reports/${id}/file`, { responseType: "blob" })).data;

export const deleteReport = async (id: string) => (await apiClient.delete(`/reports/${id}`)).data;
