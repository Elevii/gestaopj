export type SubscriptionStatus = "active" | "canceled" | "expired" | "trial";

export interface PlanLimits {
  maxProjects: number | null; // null = ilimitado
  maxMembers: number | null; // null = ilimitado
  maxStorage?: number; // em MB
  features: string[];
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number; // em centavos (BRL)
  limits: PlanLimits;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate?: string; // null para planos sem expiração
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionDTO {
  companyId: string;
  planId: string;
  status?: SubscriptionStatus;
  startDate?: string;
  endDate?: string;
}

export interface UpdateSubscriptionDTO {
  planId?: string;
  status?: SubscriptionStatus;
  endDate?: string;
}

