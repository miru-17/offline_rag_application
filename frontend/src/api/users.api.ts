import apiClient from "./axios";

export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  tenant_id: string;
  role: "ADMIN" | "USER" | "VIEWER";
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