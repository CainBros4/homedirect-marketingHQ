import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface AuthUser {
  email: string;
  authenticated: boolean;
  // Shape kept compatible with the /marketing page's `user.role === 'admin'`
  // check — authenticated users from /api/auth/me are always admin here.
  role: "admin";
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser({ email: data.email, authenticated: true, role: "admin" });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return <AuthContext.Provider value={{ user, loading, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
