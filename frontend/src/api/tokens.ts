/**
 * Session handling.
 *
 * - The access token (30 min) is kept in memory only: nothing that a script
 *   could steal is stored in localStorage.
 * - The refresh token is an HttpOnly cookie set by the server; JavaScript can
 *   never read it. A page reload or a 401 asks the server for a new access
 *   token using that cookie (one request shared by all parallel calls).
 * - The API is always reached on the same address under /api (Caddy in
 *   production, the Vite proxy in development), so the cookie stays first-party.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || "/api";

let accessToken: string | null = null;

// Older versions kept tokens in localStorage: remove them.
try {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
} catch {
  /* storage blocked: nothing to clean */
}

export const getAccessToken = () => accessToken;

export interface TokenPair {
  access_token: string;
}

export const storeTokens = (tokens: TokenPair) => {
  accessToken = tokens.access_token;
};

export const clearTokens = () => {
  accessToken = null;
};

let refreshing: Promise<boolean> | null = null;

/** Gets a new access token from the session cookie. True when signed in. */
export const refreshSession = (): Promise<boolean> => {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(async (response) => {
        if (!response.ok) {
          clearTokens();
          return false;
        }
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
