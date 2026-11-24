import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import api from "./api";
import type { Church, User } from "./types";

interface AuthCtx {
  user: User | null;
  church: Church | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshChurch: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [church, setChurch] = useState<Church | null>(null);
  const [loading, setLoading] = useState(true);

  const loadChurch = async () => {
    try {
      const res = await api.get<Church | null>("/church");
      setChurch(res.data);
    } catch {
      setChurch(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me")
      .then(async (res) => {
        setUser(res.data);
        await loadChurch();
      })
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post("/auth/login/json", { username, password });
    localStorage.setItem("token", res.data.access_token);
    const me = await api.get<User>("/auth/me");
    setUser(me.data);
    await loadChurch();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setChurch(null);
  };

  return (
    <Ctx.Provider value={{ user, church, loading, login, logout, refreshChurch: loadChurch }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
