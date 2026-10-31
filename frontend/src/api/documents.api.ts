import apiClient from "./axios";

export type DocumentStatus = "queued" | "processing" | "ready" | "failed" | "superseded";
export type Visibility = "PRIVATE" | "TENANT" | "GROUP";

export interface DocumentItem {
  id: string;
  filename: string;
  file_type?: string;
  processed: boolean;
  status?: DocumentStatus;
  error_message?: string | null;
  visibility?: Visibility;
  group_id?: string | null;
  group_name?: string | null;
  chunk_count?: number;
  page_count?: number | null;
  file_size?: number | null;
  pii_summary?: { mode: string; counts: Record<string, number>; total: number } | null;
  owner?: string | null;
  created_at?: string;
  processed_at?: string | null;
  /** Pages read with OCR (scanned PDFs / photos). */
  ocr_pages?: number;
  version?: number;
  version_group_id?: string | null;
  legal_hold?: boolean;
  /** "watch:<path>" when the file came from the watched folder. */
  source_path?: string | null;
}

/** Shape returned by GET /documents/{id}. */
export interface DocumentDetails extends DocumentItem {
  uploaded_at?: string;
  tenant_id?: string;
}

export interface DocumentListResponse {
  documents: DocumentItem[];
  total?: number;
}

export const getDocuments = async (): Promise<DocumentItem[]> => {
  const response = await apiClient.get<DocumentItem[]>("/documents/");
  return response.data;
};

export interface UploadOptions {
  visibility?: Visibility;
  groupId?: string;
  allowDuplicate?: boolean;
  /** Upload as a new version of this document (keeps its sharing). */
  replaceDocumentId?: string;
}

export const uploadDocument = async (
  file: File,
  onUploadProgress?: (percent: number) => void,
  options: UploadOptions = {},
): Promise<DocumentItem> => {
  const formData = new FormData();
  formData.append("file", file);
  if (options.visibility) formData.append("visibility", options.visibility);
  if (options.groupId) formData.append("group_id", options.groupId);
  if (options.allowDuplicate) formData.append("allow_duplicate", "true");
  if (options.replaceDocumentId) formData.append("replace_document_id", options.replaceDocumentId);

  const response = await apiClient.post<DocumentItem>("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (onUploadProgress && event.total) onUploadProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return response.data;
};

export const retryDocument = async (documentId: string): Promise<DocumentItem> => {
  const response = await apiClient.post<DocumentItem>(`/documents/${documentId}/retry`);
  return response.data;
};

export const deleteDocument = async (documentId: string): Promise<void> => {
  await apiClient.delete(`/documents/${documentId}`);
};

export const getDocument = async (documentId: string): Promise<DocumentDetails> => {
  const response = await apiClient.get<DocumentDetails>(`/documents/${documentId}`);
  return response.data;
};

export interface SummaryResult {
  document_id: string;
  filename: string;
  summary: string;
  covered: string;
  characters_used: number;
}

export const summarizeDocument = async (documentId: string): Promise<SummaryResult> => {
  const response = await apiClient.post<SummaryResult>(`/documents/${documentId}/summary`, null, { timeout: 300000 });
  return response.data;
};

export interface CompareChange {
  type: "added" | "removed" | "changed";
  before: string | null;
  after: string | null;
}

export interface CompareResult {
  document_a: { id: string; filename: string };
  document_b: { id: string; filename: string };
  similarity: number;
  counts: { added: number; removed: number; changed: number };
  changes: CompareChange[];
  truncated: boolean;
  summary: string | null;
}

export const compareDocuments = async (a: string, b: string, summarize: boolean): Promise<CompareResult> => {
  const response = await apiClient.post<CompareResult>(
    "/documents/compare",
    { document_a: a, document_b: b, summarize },
    { timeout: 300000 },
  );
  return response.data;
};

/**
 * Opens the original file in a new tab, at the cited page for PDFs.
 * The file is fetched with the user's session (no token in the URL).
 */
export const openDocumentFile = async (documentId: string, page?: number | string | null): Promise<void> => {
  // Open the tab first (inside the click) so pop-up blockers allow it.
  const tab = window.open("", "_blank");
  try {
    const response = await apiClient.get<Blob>(`/documents/${documentId}/file`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const target = page ? `${url}#page=${page}` : url;
    if (tab) tab.location.href = target;
    else window.location.assign(target);
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (error) {
    tab?.close();
    throw error;
  }
};

export const getDocumentVersions = async (documentId: string): Promise<DocumentItem[]> => {
  const response = await apiClient.get<DocumentItem[]>(`/documents/${documentId}/versions`);
  return response.data;
};

export const setLegalHold = async (documentId: string, hold: boolean): Promise<DocumentItem> => {
  const response = await apiClient.patch<DocumentItem>(`/documents/${documentId}/legal-hold`, null, { params: { hold } });
  return response.data;
};

export interface DocumentTable {
  index: number;
  name: string;
  columns: string[];
  row_count: number;
  preview: string[][];
}

export const getDocumentTables = async (documentId: string): Promise<DocumentTable[]> => {
  const response = await apiClient.get<{ tables: DocumentTable[] }>(`/documents/${documentId}/tables`);
  return response.data.tables;
};

export const importDocumentTable = async (
  documentId: string,
  tableIndex: number,
): Promise<{ dataset_id: string; name: string; rows: number }> => {
  const response = await apiClient.post(`/documents/${documentId}/tables/${tableIndex}/dataset`);
  return response.data;
};

/** Turns FastAPI error payloads (string, object or validation list) into one sentence. */
export const errorMessage = (error: unknown, fallback = "Something went wrong."): string => {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in (detail as object)) {
    return String((detail as { message: unknown }).message);
  }
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d) => (d as { msg?: string }).msg ?? "").filter(Boolean).join(" ");
  }
  return fallback;
};
