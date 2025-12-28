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
import { CompanyMembership } from "@/types/companyMembership";
import { authService } from "@/services/authService";

interface AuthContextType {
  user: User | null;
  userCompanies: CompanyMembership[];
  company: Company | null;
  subscription: Subscription | null;
  limits: PlanLimits | null;
  loading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userCompanies, setUserCompanies] = useState<CompanyMembership[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAuth = async () => {
    try {
      setLoading(true);
      const currentUser = await authService.getCurrentUser();
      
      if (!currentUser) {
        setUser(null);
        setUserCompanies([]);
        setCompany(null);
        setSubscription(null);
        setLimits(null);
        return;
      }

      setUser(currentUser);
      
      // Buscar empresas do usuário
      const companies = await authService.getUserCompanies(currentUser.id);
      setUserCompanies(companies);

      // Buscar empresa atual
      const currentCompany = await authService.getCurrentCompany();
      const currentSubscription = await authService.getCurrentSubscription();
      const currentLimits = await authService.getCurrentLimits();

      setCompany(currentCompany);
      setSubscription(currentSubscription);
      setLimits(currentLimits);
    } catch (error) {
      console.error("Erro ao carregar autenticação:", error);
      setUser(null);
      setUserCompanies([]);
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
      setUserCompanies(result.companies);
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
    setUserCompanies([]);
    setCompany(null);
    setSubscription(null);
    setLimits(null);
  };

  const refreshAuth = async () => {
    await authService.refreshSession();
    await loadAuth();
  };

  const switchCompany = async (companyId: string) => {
    try {
      const result = await authService.switchCompany(companyId);
      setCompany(result.company);
      setSubscription(result.subscription);
      setLimits(result.limits);
      
      // Recarregar empresas para atualizar role atual
      if (user) {
        const companies = await authService.getUserCompanies(user.id);
        setUserCompanies(companies);
      }
    } catch (error) {
      throw error;
    }
  };

  const needsOnboarding = user !== null && userCompanies.length === 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        userCompanies,
        company,
        subscription,
        limits,
        loading,
        isAuthenticated: !!user,
        needsOnboarding,
        login,
        logout,
        refreshAuth,
        switchCompany,
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

