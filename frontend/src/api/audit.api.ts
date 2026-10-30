import apiClient from "./axios";

export interface AuditEvent {
  id: string;
  created_at: string;
  actor: string | null;
  action: string;
  outcome: string;
  target_type: string | null;
  target_id: string | null;
  target: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
}

export interface AuditFilters {
  action?: string;
  outcome?: string;
  actor?: string;
  limit?: number;
  offset?: number;
}

export const getAuditEvents = async (filters: AuditFilters) =>
  (await apiClient.get<{ total: number; items: AuditEvent[] }>("/audit/", { params: filters })).data;

export const exportAudit = async (filters: AuditFilters): Promise<Blob> =>
  (await apiClient.get("/audit/export", { params: filters, responseType: "blob" })).data;
