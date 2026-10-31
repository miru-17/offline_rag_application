import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { API_BASE_URL, getAccessToken, redirectToLogin, refreshSession } from "./tokens";

export { API_BASE_URL };

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const NO_REFRESH = ["/auth/login", "/auth/refresh", "/auth/mfa/verify", "/auth/register"];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const url = original?.url ?? "";

    if (error.response?.status === 401 && original && !original._retried && !NO_REFRESH.some((p) => url.includes(p))) {
      original._retried = true;
      if (await refreshSession()) {
        original.headers.Authorization = `Bearer ${getAccessToken()}`;
        return apiClient(original);
      }
      redirectToLogin();
    }

    return Promise.reject(error);
  },
);

export default apiClient;
