import apiClient from "./axios";

export type LicenseState =
  | "valid" | "grace" | "expired" | "not_yet_valid" | "invalid" | "missing" | "clock_tampered" | "wrong_installation";

export interface LicenseDetails {
  license_key: string;
  issued_at: string;
  expires_at: string;
  is_active: boolean;
  customer?: string;
  max_users?: number | null;
  features?: string[];
  grace_days?: number;
  bound_to_installation?: boolean;
}

export interface LicenseWarning {
  level: "info" | "warning" | "critical";
  message: string;
}

export interface LicenseStatusResponse {
  licensed: boolean;
  state: LicenseState;
  message: string;
  days_left: number | null;
  license?: LicenseDetails | null;
  /** Expired: data can be opened and exported, new work is paused. */
  read_only?: boolean;
  warning?: LicenseWarning | null;
  installation_id?: string;
}

export interface ActivationRequest {
  installation_id: string;
  organisation: string;
  requested_at: string;
  code: string;
}

export interface LicenseHistoryEntry {
  at: string;
  by: string | null;
  outcome: string;
  license_id: string | null;
  customer: string | null;
  expires_at: string | null;
  max_users: number | null;
  reason: string | null;
}

export const getActivationRequest = async (): Promise<ActivationRequest> =>
  (await apiClient.get<ActivationRequest>("/license/activation-request")).data;

export const getLicenseHistory = async (): Promise<LicenseHistoryEntry[]> =>
  (await apiClient.get<LicenseHistoryEntry[]>("/license/history")).data;

export const getLicenseStatus = async (): Promise<LicenseStatusResponse> => {
  const response = await apiClient.get<LicenseStatusResponse>("/license/status");
  return response.data;
};

export const installLicense = async (licenseText: string): Promise<LicenseStatusResponse> => {
  const response = await apiClient.post<LicenseStatusResponse>("/license/install", { license_text: licenseText });
  return response.data;
};
