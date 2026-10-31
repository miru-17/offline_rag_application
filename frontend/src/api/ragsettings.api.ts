import apiClient from "./axios";

export type PiiMode = "off" | "flag" | "redact";

export interface RAGSettings {
  retrieval_depth: number;
  source_attribution: boolean;
  pii_mode?: PiiMode;
  hybrid_search?: boolean;
  answer_language?: string;
  llm_model?: string;
  conversation_retention_days?: number | null;
  audit_retention_days?: number | null;
  document_retention_days?: number | null;
}

/** Only the fields that are sent are changed. */
export type UpdateRAGSettingsRequest = Partial<RAGSettings>;

export interface SettingsOptions {
  models: { name: string; default: boolean; installed: boolean | null }[];
  languages: { code: string; name: string }[];
  hybrid_search_available: boolean;
  embedding_model: string;
  retention_minimum_days: Record<string, number>;
}

export interface RetentionResult {
  conversations: number;
  audit_events: number;
  documents: number;
  kept_on_hold: number;
}

export const getRAGSettings = async (): Promise<RAGSettings> => {
  const response = await apiClient.get<RAGSettings>("/rag-settings/");
  return response.data;
};

export const updateRAGSettings = async (data: UpdateRAGSettingsRequest): Promise<RAGSettings> => {
  const response = await apiClient.patch<RAGSettings>("/rag-settings/", data);
  return response.data;
};

export const getSettingsOptions = async (): Promise<SettingsOptions> => {
  const response = await apiClient.get<SettingsOptions>("/rag-settings/options");
  return response.data;
};

export const runRetentionNow = async (): Promise<RetentionResult> => {
  const response = await apiClient.post<RetentionResult>("/rag-settings/retention/run");
  return response.data;
};

export const reindexDocuments = async (): Promise<{ queued: number; embedding_model: string }> => {
  const response = await apiClient.post("/rag-settings/reindex");
  return response.data;
};
