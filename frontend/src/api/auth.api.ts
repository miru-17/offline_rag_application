import apiClient from "./axios";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  must_change_password?: boolean;
  mfa_required?: boolean;
  mfa_token?: string;
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
  auth_source?: "local" | "ldap";
  mfa_enabled?: boolean;
  must_change_password?: boolean;
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

export interface SetupStatus {
  needs_setup: boolean;
  self_registration: boolean;
  directory_login?: boolean;
}

export const getSetupStatus = async (): Promise<SetupStatus> => {
  const response = await apiClient.get<SetupStatus>("/auth/setup-status");
  return response.data;
};


export const verifyMfa = async (mfaToken: string, code: string): Promise<LoginResponse> =>
  (await apiClient.post<LoginResponse>("/auth/mfa/verify", { mfa_token: mfaToken, code })).data;

export const logoutSession = async (refreshToken: string): Promise<void> => {
  await apiClient.post("/auth/logout", { refresh_token: refreshToken });
};

export const startMfaSetup = async (): Promise<{ secret: string; otpauth_uri: string }> =>
  (await apiClient.post("/auth/mfa/setup")).data;

export const enableMfa = async (code: string): Promise<void> => {
  await apiClient.post("/auth/mfa/enable", { code });
};

export const disableMfa = async (password: string, code: string): Promise<void> => {
  await apiClient.post("/auth/mfa/disable", { password, code });
};
