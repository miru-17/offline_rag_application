import apiClient from "./axios";

export interface SystemStatus {
  api: string;
  ollama: string;
  model: string;
  model_status: string;
  vector_store: string;
  deployment: string;
  mode: string;
}

export const getSystemStatus =
  async (): Promise<SystemStatus> => {
    const response =
      await apiClient.get<SystemStatus>(
        "/system/status",
      );

    return response.data;
  };

