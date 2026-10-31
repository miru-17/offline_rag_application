/**
 * Token storage + automatic session refresh.
 *
 * The access token lives 30 minutes. When a request gets 401 we exchange the
 * refresh token once (shared by all parallel requests) and retry, so users
 * are not logged out in the middle of their work.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const ACCESS = "access_token";
const REFRESH = "refresh_token";

export const getAccessToken = () => localStorage.getItem(ACCESS);
export const getRefreshToken = () => localStorage.getItem(REFRESH);

export interface TokenPair {
  access_token: string;
  refresh_token?: string;
}

export const storeTokens = (tokens: TokenPair) => {
  localStorage.setItem(ACCESS, tokens.access_token);
  if (tokens.refresh_token) localStorage.setItem(REFRESH, tokens.refresh_token);
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
};

let refreshing: Promise<boolean> | null = null;

/** Returns true when a new access token was obtained. */
export const refreshSession = (): Promise<boolean> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) return false;
        storeTokens(await response.json());
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
};

export const redirectToLogin = () => {
  clearTokens();
  const path = window.location.pathname;
  if (path !== "/login" && path !== "/signup") window.location.href = "/login";
};
