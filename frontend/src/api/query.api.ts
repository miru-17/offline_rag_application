import apiClient from "./axios";

export interface QuerySource {
  filename?: string;
  file_name?: string;
  document_name?: string;
  name?: string;
  page?: number | string | null;
  page_number?: number | string | null;
  pageNumber?: number | string | null;
  content?: string;
  metadata?: Record<string, unknown>;
  chunk_index?: number;
  document_id?: string;
  [key: string]: unknown;
}

export interface QueryResponse {
  conversation_id: string;
  query: string;
  answer: string;
  sources: QuerySource[];
  user_id: string;
  tenant_id: string;
}

export const queryDocuments = async (
  query: string,
  conversationId?: string,
): Promise<QueryResponse> => {
  const response = await apiClient.post<QueryResponse>(
    "/query/",
    null,
    {
      params: {
        query,
        ...(conversationId
          ? { conversation_id: conversationId }
          : {}),
      },
    },
  );

  return response.data;
};