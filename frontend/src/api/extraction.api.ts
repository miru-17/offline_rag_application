import apiClient from "./axios";

export interface ExtractionField {
  name: string;
  description?: string | null;
}

export interface ExtractionResultRow {
  document_id: string;
  filename: string;
  status: "ok" | "failed";
  error?: string;
  values: Record<string, string | number | null>;
}

export interface ExtractionJob {
  id: string;
  name: string;
  status: "queued" | "processing" | "completed" | "failed";
  fields: ExtractionField[];
  document_count: number;
  processed_count: number;
  error_message: string | null;
  dataset_id: string | null;
  created_at: string;
  completed_at: string | null;
  results?: ExtractionResultRow[];
}

export const createExtraction = async (name: string, documentIds: string[], fields: ExtractionField[]) =>
  (await apiClient.post<ExtractionJob>("/extraction/jobs", { name, document_ids: documentIds, fields })).data;

export const getExtractions = async () => (await apiClient.get<ExtractionJob[]>("/extraction/jobs")).data;

export const getExtraction = async (id: string) => (await apiClient.get<ExtractionJob>(`/extraction/jobs/${id}`)).data;

export const exportExtraction = async (id: string): Promise<Blob> =>
  (await apiClient.get(`/extraction/jobs/${id}/export`, { responseType: "blob" })).data;

export const deleteExtraction = async (id: string) => {
  await apiClient.delete(`/extraction/jobs/${id}`);
};
