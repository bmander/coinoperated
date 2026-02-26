import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { PatronMe } from "../api/types";
import * as authApi from "../api/auth";

interface AuthContextValue {
  patron: PatronMe | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [patron, setPatron] = useState<PatronMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.fetchMe().then(setPatron).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string) => {
    await authApi.login(email);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setPatron(null);
  }, []);

  return (
    <AuthContext.Provider value={{ patron, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
