import apiClient from "./axios";

export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  tenant_id: string;
  role: "ADMIN" | "USER" | "VIEWER";
  is_active?: boolean;
  groups?: string[];
  last_login_at?: string | null;
  mfa_enabled?: boolean;
  auth_source?: "local" | "ldap";
  must_change_password?: boolean;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER" | "VIEWER";
}

export interface UpdateUserRoleRequest {
  role: "ADMIN" | "USER" | "VIEWER";
}

export const getUsers = async (): Promise<ManagedUser[]> => {
  const response = await apiClient.get<ManagedUser[]>(
    "/users/",
  );

  return response.data;
};

export const createUser = async (
  data: CreateUserRequest,
): Promise<ManagedUser> => {
  const response = await apiClient.post<ManagedUser>(
    "/users/",
    data,
  );

  return response.data;
};

export const updateUserRole = async (
  userId: string,
  data: UpdateUserRoleRequest,
): Promise<ManagedUser> => {
  const response = await apiClient.patch<ManagedUser>(
    `/users/${userId}/role`,
    data,
  );

  return response.data;
};

export const deleteUser = async (
  userId: string,
): Promise<void> => {
  await apiClient.delete(`/users/${userId}`);
};

export const updateUserStatus = async (userId: string, isActive: boolean): Promise<ManagedUser> => {
  const response = await apiClient.patch<ManagedUser>(`/users/${userId}/status`, { is_active: isActive });
  return response.data;
};


export const resetUserPassword = async (userId: string): Promise<{ username: string; temporary_password: string }> =>
  (await apiClient.post(`/users/${userId}/reset-password`)).data;

export const resetUserMfa = async (userId: string): Promise<ManagedUser> =>
  (await apiClient.post<ManagedUser>(`/users/${userId}/mfa/reset`)).data;
