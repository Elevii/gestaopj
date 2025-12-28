"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "@/types/user";
import { Company } from "@/types/company";
import { Subscription, PlanLimits } from "@/types/subscription";
import { authService } from "@/services/authService";

interface AuthContextType {
  user: User | null;
  company: Company | null;
  subscription: Subscription | null;
  limits: PlanLimits | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAuth = async () => {
    try {
      setLoading(true);
      const currentUser = await authService.getCurrentUser();
      const currentCompany = await authService.getCurrentCompany();
      const currentSubscription = await authService.getCurrentSubscription();
      const currentLimits = await authService.getCurrentLimits();

      setUser(currentUser);
      setCompany(currentCompany);
      setSubscription(currentSubscription);
      setLimits(currentLimits);
    } catch (error) {
      console.error("Erro ao carregar autenticação:", error);
      setUser(null);
      setCompany(null);
      setSubscription(null);
      setLimits(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await authService.login({ email, password });
      setUser(result.user);
      setCompany(result.company);
      setSubscription(result.subscription);
      setLimits(result.limits);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setCompany(null);
    setSubscription(null);
    setLimits(null);
  };

  const refreshAuth = async () => {
    await authService.refreshSession();
    await loadAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        subscription,
        limits,
        loading,
        isAuthenticated: !!user && !!company,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}

