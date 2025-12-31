import { User, LoginDTO } from "@/types/user";
import { AuthResponse, RegisterDTO } from "@/types/auth";
import { api } from "@/lib/api";
import { userService } from "./userService";
import { companyService } from "./companyService";
import { subscriptionService } from "./subscriptionService";
import { companyMembershipService } from "./companyMembershipService";
import { Company } from "@/types/company";
import { Subscription, PlanLimits } from "@/types/subscription";
import { CompanyMembership } from "@/types/companyMembership";

const SESSION_KEY = "gestaopj_session";
const CURRENT_USER_KEY = "gestaopj_current_user";
const CURRENT_COMPANY_KEY = "gestaopj_current_company";
const ACCESS_TOKEN_KEY = "gestaopj_access_token";

interface Session {
  userId: string;
  companyId?: string; // Opcional - pode não ter empresa selecionada
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
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    api.clearAuthToken();
  }

  // Converter UserResponse para User (compatibilidade)
  private mapUserResponseToUser(userResponse: any): User {
    return {
      id: userResponse.id,
      email: userResponse.email,
      name: userResponse.name,
      active: userResponse.active,
      lastLoginAt: userResponse.lastLoginAt,
      createdAt: userResponse.createdAt,
      updatedAt: userResponse.updatedAt,
    };
  }

  async register(registerDto: RegisterDTO): Promise<{
    user: User;
    companies: CompanyMembership[];
    company: Company | null;
    subscription: Subscription | null;
    limits: PlanLimits | null;
  }> {
    // Chamar API de registro
    const authResponse: AuthResponse = await api.post(
      "/auth/register",
      registerDto
    );

    // Salvar token
    api.setAuthToken(authResponse.accessToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, authResponse.accessToken);

    // Converter resposta para User
    const user = this.mapUserResponseToUser(authResponse.user);

    // 🔄 IMPORTANTE: Sincronizar usuário no localStorage
    await userService.saveOrUpdateUser(user);

    // Buscar empresas do usuário (ainda usando localStorage por enquanto)
    const memberships = await companyMembershipService.findByUserId(user.id);

    // Buscar dados completos das empresas
    const companiesData: CompanyMembership[] = [];
    let defaultCompany: Company | null = null;
    let subscription: Subscription | null = null;
    let limits: PlanLimits | null = null;

    if (memberships.length > 0) {
      const defaultMembership = memberships[0];
      defaultCompany = await companyService.findById(
        defaultMembership.companyId
      );

      if (defaultCompany && defaultCompany.active) {
        subscription = await subscriptionService.findByCompanyId(
          defaultCompany.id
        );
        limits = subscription
          ? await subscriptionService.getCompanyLimits(defaultCompany.id)
          : null;
      }

      companiesData.push(...memberships);
    }

    // Criar sessão (expira em 7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session: Session = {
      userId: user.id,
      companyId: defaultCompany?.id,
      expiresAt: expiresAt.toISOString(),
    };

    this.saveSession(session);

    // Salvar dados atuais no localStorage para acesso rápido
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    if (defaultCompany) {
      localStorage.setItem(CURRENT_COMPANY_KEY, JSON.stringify(defaultCompany));
    }

    return {
      user,
      companies: companiesData,
      company: defaultCompany,
      subscription,
      limits,
    };
  }

  async login(credentials: LoginDTO): Promise<{
    user: User;
    companies: CompanyMembership[];
    company: Company | null;
    subscription: Subscription | null;
    limits: PlanLimits | null;
  }> {
    // Chamar API de login
    const authResponse: AuthResponse = await api.post(
      "/auth/login",
      credentials
    );

    // Salvar token
    api.setAuthToken(authResponse.accessToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, authResponse.accessToken);

    // Converter resposta para User
    const user = this.mapUserResponseToUser(authResponse.user);

    // 🔄 IMPORTANTE: Sincronizar usuário no localStorage
    await userService.saveOrUpdateUser(user);

    // Buscar empresas do usuário (ainda usando localStorage por enquanto)
    const memberships = await companyMembershipService.findByUserId(user.id);

    // Buscar dados completos das empresas
    const companiesData: CompanyMembership[] = [];
    let defaultCompany: Company | null = null;
    let subscription: Subscription | null = null;
    let limits: PlanLimits | null = null;

    if (memberships.length > 0) {
      // Selecionar primeira empresa como padrão (ou a última acessada)
      const defaultMembership = memberships[0];
      defaultCompany = await companyService.findById(
        defaultMembership.companyId
      );

      if (defaultCompany && defaultCompany.active) {
        subscription = await subscriptionService.findByCompanyId(
          defaultCompany.id
        );
        limits = subscription
          ? await subscriptionService.getCompanyLimits(defaultCompany.id)
          : null;
      }

      companiesData.push(...memberships);
    }

    // Criar sessão (expira em 7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session: Session = {
      userId: user.id,
      companyId: defaultCompany?.id,
      expiresAt: expiresAt.toISOString(),
    };

    this.saveSession(session);

    // Salvar dados atuais no localStorage para acesso rápido
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    if (defaultCompany) {
      localStorage.setItem(CURRENT_COMPANY_KEY, JSON.stringify(defaultCompany));
    }

    return {
      user,
      companies: companiesData,
      company: defaultCompany,
      subscription,
      limits,
    };
  }

  async logout(): Promise<void> {
    this.clearSession();
  }

  async getCurrentUser(): Promise<User | null> {
    const session = this.getSession();
    if (!session) return null;

    try {
      // Usar o endpoint /auth/me do backend para validar token e obter usuário
      const user = await api.get<User>("/auth/me");

      // 🔄 Sincronizar usuário no localStorage
      await userService.saveOrUpdateUser(user);

      // Cachear o usuário
      if (typeof window !== "undefined") {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      }

      return user;
    } catch (error) {
      console.error("Erro ao obter usuário atual:", error);
      // Se falhar (token inválido, expirado, etc), fazer logout
      this.clearSession();
      return null;
    }
  }

  async getCurrentCompany(): Promise<Company | null> {
    const session = this.getSession();
    if (!session || !session.companyId) return null;

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

  async getUserCompanies(userId: string): Promise<CompanyMembership[]> {
    return await companyMembershipService.findByUserId(userId);
  }

  async switchCompany(companyId: string): Promise<{
    company: Company;
    subscription: Subscription | null;
    limits: PlanLimits | null;
  }> {
    const session = this.getSession();
    if (!session) {
      // Tentar recarregar sessão do localStorage uma vez antes de falhar
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem(SESSION_KEY)
          : null;
      if (!stored) {
        throw new Error("Usuário não autenticado");
      }
      // Se encontrou no localStorage mas getSession retornou null, pode ser problema de parsing
      throw new Error("Sessão inválida. Faça login novamente.");
    }

    // Verificar se usuário tem membership nesta empresa
    const membership = await companyMembershipService.findByUserAndCompany(
      session.userId,
      companyId
    );

    if (!membership) {
      throw new Error("Usuário não é membro desta empresa");
    }

    const company = await companyService.findById(companyId);
    if (!company || !company.active) {
      throw new Error("Empresa não encontrada ou inativa");
    }

    // Atualizar sessão
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const updatedSession: Session = {
      ...session,
      companyId: company.id,
      expiresAt: expiresAt.toISOString(),
    };

    this.saveSession(updatedSession);

    // Buscar assinatura e limites
    const subscription = await subscriptionService.findByCompanyId(company.id);
    const limits = subscription
      ? await subscriptionService.getCompanyLimits(company.id)
      : null;

    // Salvar no cache
    localStorage.setItem(CURRENT_COMPANY_KEY, JSON.stringify(company));

    return {
      company,
      subscription,
      limits,
    };
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
    const session = this.getSession();
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem(ACCESS_TOKEN_KEY)
        : null;
    return session !== null && token !== null;
  }

  async needsOnboarding(): Promise<boolean> {
    const session = this.getSession();
    if (!session) return false;

    const memberships = await companyMembershipService.findByUserId(
      session.userId
    );
    return memberships.length === 0;
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
