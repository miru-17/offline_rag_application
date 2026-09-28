import apiClient from "./axios";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: "ADMIN" | "USER" | "VIEWER";
    tenant_id: string;
    tenant_name: string;
  };
}

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  role: "ADMIN" | "USER" | "VIEWER";
  tenant_id: string;
  tenant_name: string;
}

export const loginUser = async (
  credentials: LoginRequest,
): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>(
    "/auth/login",
    credentials,
  );

  return response.data;
};

export const registerUser = async (
  userData: RegisterRequest,
): Promise<RegisterResponse> => {
  const response = await apiClient.post<RegisterResponse>(
    "/auth/register",
    userData,
  );

  return response.data;
};

export const getCurrentUser = async (): Promise<CurrentUser> => {
  const response = await apiClient.get<CurrentUser>("/auth/me");

  return response.data;
};