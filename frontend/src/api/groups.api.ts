import apiClient from "./axios";

export interface TeamSpace {
  id: string;
  name: string;
  description: string | null;
  members: { id: string; username: string }[];
  document_count: number;
  created_at: string;
}

export const getGroups = async () => (await apiClient.get<TeamSpace[]>("/groups/")).data;
export const createGroup = async (name: string, description?: string) =>
  (await apiClient.post<TeamSpace>("/groups/", { name, description })).data;
export const addGroupMember = async (groupId: string, userId: string) =>
  (await apiClient.post<TeamSpace>(`/groups/${groupId}/members`, { user_id: userId })).data;
export const removeGroupMember = async (groupId: string, userId: string) =>
  (await apiClient.delete<TeamSpace>(`/groups/${groupId}/members/${userId}`)).data;
export const deleteGroup = async (groupId: string) => {
  await apiClient.delete(`/groups/${groupId}`);
};
