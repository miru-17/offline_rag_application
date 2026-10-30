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



export interface SystemHealth {
  database: string;
  ollama: string;
  model: string;
  model_status: string;
  ingestion_queue: number;
  llm_waiting: number;
  documents: Record<string, number>;
  datasets: number;
  users: number;
  license: { state: string; days_left: number | null; message: string };
  disk: Record<string, { free_gb?: number; total_gb?: number; used_percent?: number }>;
}

export const getSystemHealth = async (): Promise<SystemHealth> => {
  const response = await apiClient.get<SystemHealth>("/system/health");
  return response.data;
};
