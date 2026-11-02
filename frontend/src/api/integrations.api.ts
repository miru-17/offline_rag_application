import apiClient from "./axios";

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
