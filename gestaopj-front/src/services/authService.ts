import { User, LoginDTO } from "@/types/user";
import { userService } from "./userService";
import { companyService } from "./companyService";
import { subscriptionService } from "./subscriptionService";
import { Company } from "@/types/company";
import { Subscription, PlanLimits } from "@/types/subscription";

const SESSION_KEY = "gestaopj_session";
const CURRENT_USER_KEY = "gestaopj_current_user";
const CURRENT_COMPANY_KEY = "gestaopj_current_company";

interface Session {
  userId: string;
  companyId: string;
  expiresAt: string;
}

class AuthService {
  private getSession(): Session | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored) as Session;
      const expiresAt = new Date(session.expiresAt);

      // Verificar se sessão expirou
      if (expiresAt < new Date()) {
        this.logout();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  private saveSession(session: Session): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error("Erro ao salvar sessão:", error);
    }
  }

  private clearSession(): void {
    if (typeof window === "undefined") return;

    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(CURRENT_COMPANY_KEY);
  }

  async login(credentials: LoginDTO): Promise<{
    user: User;
    company: Company;
    subscription: Subscription | null;
    limits: PlanLimits | null;
  }> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const user = await userService.findByEmail(credentials.email);

    if (!user) {
      throw new Error("Email ou senha inválidos");
    }

    if (!user.active) {
      throw new Error("Usuário inativo");
    }

    // Verificar senha (simulação - em produção isso deve ser feito no backend)
    const passwordMatch = btoa(credentials.password) === user.passwordHash;
    if (!passwordMatch) {
      throw new Error("Email ou senha inválidos");
    }

    // Atualizar último login
    await userService.update(user.id, {});

    // Buscar empresa
    const company = await companyService.findById(user.companyId);
    if (!company) {
      throw new Error("Empresa não encontrada");
    }

    if (!company.active) {
      throw new Error("Empresa inativa");
    }

    // Buscar assinatura e limites
    const subscription = await subscriptionService.findByCompanyId(
      company.id
    );
    const limits = subscription
      ? await subscriptionService.getCompanyLimits(company.id)
      : null;

    // Criar sessão (expira em 7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session: Session = {
      userId: user.id,
      companyId: company.id,
      expiresAt: expiresAt.toISOString(),
    };

    this.saveSession(session);

    // Salvar dados atuais no localStorage para acesso rápido
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem(CURRENT_COMPANY_KEY, JSON.stringify(company));

    return {
      user,
      company,
      subscription,
      limits,
    };
  }

  async logout(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.clearSession();
  }

  async getCurrentUser(): Promise<User | null> {
    const session = this.getSession();
    if (!session) return null;

    try {
      const stored = localStorage.getItem(CURRENT_USER_KEY);
      if (stored) {
        const user = JSON.parse(stored) as User;
        // Verificar se usuário ainda existe e está ativo
        const freshUser = await userService.findById(user.id);
        if (freshUser && freshUser.active) {
          return freshUser;
        }
      }

      // Buscar do serviço se não estiver em cache
      return await userService.findById(session.userId);
    } catch {
      return null;
    }
  }

  async getCurrentCompany(): Promise<Company | null> {
    const session = this.getSession();
    if (!session) return null;

    try {
      const stored = localStorage.getItem(CURRENT_COMPANY_KEY);
      if (stored) {
        const company = JSON.parse(stored) as Company;
        // Verificar se empresa ainda existe e está ativa
        const freshCompany = await companyService.findById(company.id);
        if (freshCompany && freshCompany.active) {
          return freshCompany;
        }
      }

      // Buscar do serviço se não estiver em cache
      return await companyService.findById(session.companyId);
    } catch {
      return null;
    }
  }

  async getCurrentSubscription(): Promise<Subscription | null> {
    const company = await this.getCurrentCompany();
    if (!company) return null;

    return await subscriptionService.findByCompanyId(company.id);
  }

  async getCurrentLimits(): Promise<PlanLimits | null> {
    const company = await this.getCurrentCompany();
    if (!company) return null;

    return await subscriptionService.getCompanyLimits(company.id);
  }

  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  async refreshSession(): Promise<void> {
    const session = this.getSession();
    if (!session) return;

    const user = await this.getCurrentUser();
    const company = await this.getCurrentCompany();

    if (user && company) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      localStorage.setItem(CURRENT_COMPANY_KEY, JSON.stringify(company));
    } else {
      this.logout();
    }
  }
}

export const authService = new AuthService();

