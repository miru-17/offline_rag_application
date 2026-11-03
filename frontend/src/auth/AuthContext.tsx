import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  getCurrentUser,
  loginUser,
  logoutSession,
  verifyMfa,
  type CurrentUser,
  type LoginResponse,
} from "../api/auth.api";
import { clearTokens, refreshSession, storeTokens } from "../api/tokens";

/** Returned by login() when the account has two-step login switched on. */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<MfaChallenge | void>;
  completeMfa: (mfaToken: string, code: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    // End the session on the server (also removes the cookie); ignore network errors.
    void logoutSession().catch(() => undefined);
    clearTokens();
    setUser(null);
  }, []);

  const loadCurrentUser = useCallback(async () => {
    // A page load starts without an access token: ask for one with the session cookie.
    if (!(await refreshSession())) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      // An expired access token is refreshed automatically by the API client.
      setUser(await getCurrentUser());
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  const finish = async (response: LoginResponse) => {
    if (!response.access_token) throw new Error("Sign-in did not return a session.");
    storeTokens({ access_token: response.access_token });
    try {
      setUser(await getCurrentUser());
    } catch {
      throw new Error("Login successful, but your user profile could not be loaded.");
    }
  };

  const login = async (username: string, password: string): Promise<MfaChallenge | void> => {
    setIsLoading(true);
    try {
      const response = await loginUser({ username, password });
      if (response.mfa_required && response.mfa_token) {
        return { mfaRequired: true, mfaToken: response.mfa_token };
      }
      await finish(response);
    } finally {
      setIsLoading(false);
    }
  };

  const completeMfa = async (mfaToken: string, code: string) => {
    setIsLoading(true);
    try {
      await finish(await verifyMfa(mfaToken, code));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = useCallback(async () => {
    setUser(await getCurrentUser());
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        completeMfa,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
