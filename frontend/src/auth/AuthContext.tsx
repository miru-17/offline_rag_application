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
  type CurrentUser,
} from "../api/auth.api";

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setUser(null);
  }, []);

  // Load currently authenticated user
  const loadCurrentUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");

    // No token = not logged in
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser();

      console.log("CURRENT USER:", currentUser);

      setUser(currentUser);
    } catch (error) {
      console.error("GET /auth/me failed:", error);

      /*
       * If the token is invalid/expired, remove it.
       * This prevents an invalid token from being reused.
       */
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  // Check authentication when application starts
  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  // Login
  const login = async (username: string, password: string) => {
    setIsLoading(true);

    try {
      console.log("LOGIN STARTED");

      // Step 1: Login API
      const response = await loginUser({
        username,
        password,
      });

      console.log("LOGIN API SUCCESS");

      // Step 2: Save JWT
      localStorage.setItem("access_token", response.access_token);

      console.log("ACCESS TOKEN SAVED");

      // Step 3: Get logged-in user
      try {
        const currentUser = await getCurrentUser();

        console.log("AUTH ME SUCCESS:", currentUser);

        // Step 4: Store user in React state
        setUser(currentUser);
      } catch (error) {
        console.error("AUTH ME FAILED:", error);

        /*
         * Login itself succeeded.
         * /auth/me is the endpoint currently failing.
         */
        throw new Error(
          "Login successful, but your user profile could not be loaded.",
        );
      }
    } catch (error) {
      console.error("LOGIN FLOW ERROR:", error);

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}