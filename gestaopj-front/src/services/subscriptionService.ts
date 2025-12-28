import {
  Plan,
  Subscription,
  CreateSubscriptionDTO,
  UpdateSubscriptionDTO,
  SubscriptionStatus,
  PlanLimits,
} from "@/types/subscription";

class SubscriptionService {
  private plansStorageKey = "gestaopj_plans";
  private subscriptionsStorageKey = "gestaopj_subscriptions";

  // Inicializar planos padrão se não existirem
  private initializeDefaultPlans(): Plan[] {
    const plans: Plan[] = [
      {
        id: "plan_free",
        name: "Free",
        slug: "free",
        description: "Plano gratuito com recursos básicos",
        price: 0,
        limits: {
          maxProjects: 3,
          maxMembers: 2,
          features: ["projetos_basicos", "relatorios_basicos"],
        },
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "plan_starter",
        name: "Starter",
        slug: "starter",
        description: "Plano inicial para pequenas equipes",
        price: 9900, // R$ 99,00 em centavos
        limits: {
          maxProjects: 10,
          maxMembers: 5,
          features: [
            "projetos_ilimitados",
            "relatorios_completos",
            "exportacao_dados",
            "suporte_email",
          ],
        },
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "plan_professional",
        name: "Professional",
        slug: "professional",
        description: "Plano completo para empresas",
        price: 29900, // R$ 299,00 em centavos
        limits: {
          maxProjects: null, // ilimitado
          maxMembers: null, // ilimitado
          features: [
            "projetos_ilimitados",
            "membros_ilimitados",
            "relatorios_avancados",
            "exportacao_dados",
            "integracao_api",
            "suporte_prioritario",
          ],
        },
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    return plans;
  }

  private getPlansFromStorage(): Plan[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.plansStorageKey);
      if (!stored) {
        // Inicializar planos padrão
        const defaultPlans = this.initializeDefaultPlans();
        this.savePlansToStorage(defaultPlans);
        return defaultPlans;
      }
      const parsed = JSON.parse(stored) as any[];
      return Array.isArray(parsed) ? (parsed as Plan[]) : [];
    } catch {
      return this.initializeDefaultPlans();
    }
  }

  private savePlansToStorage(plans: Plan[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.plansStorageKey, JSON.stringify(plans));
    } catch (error) {
      console.error("Erro ao salvar planos:", error);
    }
  }

  private getSubscriptionsFromStorage(): Subscription[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.subscriptionsStorageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      return Array.isArray(parsed) ? (parsed as Subscription[]) : [];
    } catch {
      return [];
    }
  }

  private saveSubscriptionsToStorage(subscriptions: Subscription[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(
        this.subscriptionsStorageKey,
        JSON.stringify(subscriptions)
      );
    } catch (error) {
      console.error("Erro ao salvar assinaturas:", error);
    }
  }

  // Planos
  async getAllPlans(): Promise<Plan[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.getPlansFromStorage();
  }

  async getPlanById(id: string): Promise<Plan | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const plans = this.getPlansFromStorage();
    return plans.find((p) => p.id === id) || null;
  }

  async getPlanBySlug(slug: string): Promise<Plan | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const plans = this.getPlansFromStorage();
    return plans.find((p) => p.slug === slug) || null;
  }

  // Assinaturas
  async findAll(): Promise<Subscription[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.getSubscriptionsFromStorage();
  }

  async findByCompanyId(companyId: string): Promise<Subscription | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const subscriptions = this.getSubscriptionsFromStorage();
    return (
      subscriptions.find(
        (s) => s.companyId === companyId && s.status === "active"
      ) || null
    );
  }

  async findById(id: string): Promise<Subscription | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const subscriptions = this.getSubscriptionsFromStorage();
    return subscriptions.find((s) => s.id === id) || null;
  }

  async create(data: CreateSubscriptionDTO): Promise<Subscription> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Verificar se empresa já tem assinatura ativa
    const existing = await this.findByCompanyId(data.companyId);
    if (existing) {
      throw new Error("Empresa já possui uma assinatura ativa");
    }

    const subscriptions = this.getSubscriptionsFromStorage();
    const now = new Date().toISOString();

    const novaSubscription: Subscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: data.companyId,
      planId: data.planId,
      status: data.status || "active",
      startDate: data.startDate || now,
      endDate: data.endDate,
      createdAt: now,
      updatedAt: now,
    };

    subscriptions.push(novaSubscription);
    this.saveSubscriptionsToStorage(subscriptions);

    return novaSubscription;
  }

  async update(
    id: string,
    data: UpdateSubscriptionDTO
  ): Promise<Subscription> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const subscriptions = this.getSubscriptionsFromStorage();
    const index = subscriptions.findIndex((s) => s.id === id);

    if (index === -1) {
      throw new Error("Assinatura não encontrada");
    }

    subscriptions[index] = {
      ...subscriptions[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.saveSubscriptionsToStorage(subscriptions);
    return subscriptions[index];
  }

  async cancel(id: string): Promise<Subscription> {
    return this.update(id, { status: "canceled" });
  }

  async upgrade(
    subscriptionId: string,
    newPlanId: string
  ): Promise<Subscription> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const plan = await this.getPlanById(newPlanId);
    if (!plan) {
      throw new Error("Plano não encontrado");
    }

    return this.update(subscriptionId, { planId: newPlanId });
  }

  async getCompanyLimits(companyId: string): Promise<PlanLimits | null> {
    const subscription = await this.findByCompanyId(companyId);
    if (!subscription) {
      return null;
    }

    const plan = await this.getPlanById(subscription.planId);
    return plan?.limits || null;
  }

  async checkLimit(
    companyId: string,
    limitType: "maxProjects" | "maxMembers",
    currentCount: number
  ): Promise<{ allowed: boolean; limit: number | null }> {
    const limits = await this.getCompanyLimits(companyId);
    if (!limits) {
      return { allowed: false, limit: null };
    }

    const limit = limits[limitType];
    if (limit === null) {
      // Ilimitado
      return { allowed: true, limit: null };
    }

    return {
      allowed: currentCount < limit,
      limit,
    };
  }
}

export const subscriptionService = new SubscriptionService();

