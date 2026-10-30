import apiClient from "./axios";

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  message: string;
  access_token?: string;
}

export const changePassword = async (
  data: ChangePasswordRequest,
): Promise<ChangePasswordResponse> => {
  const response = await apiClient.patch<ChangePasswordResponse>(
    "/auth/change-password",
    data,
  );

  // Old sessions are revoked on the server; keep this one signed in.
  if (response.data.access_token) {
    localStorage.setItem("access_token", response.data.access_token);
  }

  return response.data;
};