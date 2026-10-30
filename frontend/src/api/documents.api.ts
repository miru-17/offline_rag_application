import apiClient from "./axios";

export interface DocumentItem {
  id: string;
  filename: string;
  file_type?: string;
  processed: boolean;
  created_at?: string;
}

export interface DocumentListResponse {
  documents: DocumentItem[];
  total?: number;
}

export const getDocuments = async (): Promise<DocumentItem[]> => {
  const response = await apiClient.get<
    DocumentItem[] | DocumentListResponse
  >("/documents/");

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return response.data.documents;
};

export const uploadDocument = async (
  file: File,
  onUploadProgress?: (percent: number) => void,
): Promise<DocumentItem> => {
  const formData = new FormData();

  formData.append("file", file);

  const response = await apiClient.post<DocumentItem>(
    "/documents/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (event) => {
        if (onUploadProgress && event.total) {
          onUploadProgress(
            Math.round((event.loaded / event.total) * 100),
          );
        }
      },
    },
  );

  return response.data;
};

export const deleteDocument = async (
  documentId: string,
): Promise<void> => {
  await apiClient.delete(
    `/documents/${documentId}`,
  );
};

/** Shape returned by GET /documents/{id}. */
export interface DocumentDetails {
  id: string;
  tenant_id: string;
  filename: string;
  file_type: string;
  visibility?: "TENANT" | "PRIVATE" | string;
  processed: boolean;
  uploaded_at?: string;
}

export const getDocument = async (
  documentId: string,
): Promise<DocumentDetails> => {
  const response =
    await apiClient.get<DocumentDetails>(
      `/documents/${documentId}`,
    );

  return response.data;
};