import apiClient from "./axios";

export interface RAGSettings {
  retrieval_depth: number;
  source_attribution: boolean;
}

export interface UpdateRAGSettingsRequest {
  retrieval_depth: number;
  source_attribution: boolean;
}

export const getRAGSettings =
  async (): Promise<RAGSettings> => {
    const response =
      await apiClient.get<RAGSettings>(
        "/rag-settings/",
      );

    return response.data;
  };

export const updateRAGSettings = async (
  data: UpdateRAGSettingsRequest,
): Promise<RAGSettings> => {
  const response =
    await apiClient.patch<RAGSettings>(
      "/rag-settings/",
      data,
    );

  return response.data;
};