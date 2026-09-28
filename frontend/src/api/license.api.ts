import apiClient from "./axios";

export interface LicenseDetails {
  license_key: string;
  issued_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface LicenseStatusResponse {
  licensed: boolean;
  license: LicenseDetails | null;
}

export interface UpdateLicenseExpiryRequest {
  expires_at: string;
}

export const getLicenseStatus =
  async (): Promise<LicenseStatusResponse> => {
    const response =
      await apiClient.get<LicenseStatusResponse>(
        "/license/status",
      );

    return response.data;
  };

export const updateLicenseExpiry = async (
  expiresAt: string,
): Promise<LicenseDetails> => {
  const response = await apiClient.patch<{
    message: string;
    license: LicenseDetails;
  }>("/license/extend", {
    expires_at: expiresAt,
  });

  return response.data.license;
};