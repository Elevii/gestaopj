"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Company } from "@/types/company";
import { Subscription, PlanLimits } from "@/types/subscription";
import { companyService } from "@/services/companyService";
import { subscriptionService } from "@/services/subscriptionService";
import { authService } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";

interface CompanyContextType {
  company: Company | null;
  subscription: Subscription | null;
  limits: PlanLimits | null;
  loading: boolean;
  refreshCompany: () => Promise<void>;
  updateCompany: (id: string, data: Partial<Company>) => Promise<Company>;
  checkLimit: (
    limitType: "maxProjects" | "maxMembers",
    currentCount: number
  ) => Promise<{ allowed: boolean; limit: number | null }>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(
  undefined
);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const { company: authCompany } = useAuth();

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      const currentCompany = await authService.getCurrentCompany();
      const currentSubscription = await authService.getCurrentSubscription();
      const currentLimits = await authService.getCurrentLimits();

      setCompany(currentCompany);
      setSubscription(currentSubscription);
      setLimits(currentLimits);
    } catch (error) {
      console.error("Erro ao carregar dados da empresa:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanyData();
  }, [authCompany?.id]);

  const refreshCompany = async () => {
    await loadCompanyData();
  };

  const updateCompany = async (
    id: string,
    data: Partial<Company>
  ): Promise<Company> => {
    const updated = await companyService.update(id, data);
    setCompany(updated);
    return updated;
  };

  const checkLimit = async (
    limitType: "maxProjects" | "maxMembers",
    currentCount: number
  ): Promise<{ allowed: boolean; limit: number | null }> => {
    if (!company) {
      return { allowed: false, limit: null };
    }

    return await subscriptionService.checkLimit(
      company.id,
      limitType,
      currentCount
    );
  };

  return (
    <CompanyContext.Provider
      value={{
        company,
        subscription,
        limits,
        loading,
        refreshCompany,
        updateCompany,
        checkLimit,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany deve ser usado dentro de CompanyProvider");
  }
  return context;
}

