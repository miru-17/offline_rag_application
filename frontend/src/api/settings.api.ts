import apiClient from "./axios";

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export const changePassword = async (
  data: ChangePasswordRequest,
): Promise<ChangePasswordResponse> => {
  const response = await apiClient.patch<ChangePasswordResponse>(
    "/auth/change-password",
    data,
  );

  return response.data;
};