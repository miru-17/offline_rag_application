import apiClient from "./axios";

export type LicenseState = "valid" | "grace" | "expired" | "not_yet_valid" | "invalid" | "missing" | "clock_tampered";

export interface LicenseDetails {
  license_key: string;
  issued_at: string;
  expires_at: string;
  is_active: boolean;
  customer?: string;
  max_users?: number | null;
  features?: string[];
  grace_days?: number;
}

export interface LicenseStatusResponse {
  licensed: boolean;
  state: LicenseState;
  message: string;
  days_left: number | null;
  license?: LicenseDetails | null;
}

export const getLicenseStatus = async (): Promise<LicenseStatusResponse> => {
  const response = await apiClient.get<LicenseStatusResponse>("/license/status");
  return response.data;
};

export const installLicense = async (licenseText: string): Promise<LicenseStatusResponse> => {
  const response = await apiClient.post<LicenseStatusResponse>("/license/install", { license_text: licenseText });
  return response.data;
};
