import {
  UserCompanySettings,
  CreateUserCompanySettingsDTO,
  UpdateUserCompanySettingsDTO,
} from "@/types/userCompanySettings";

class UserCompanySettingsService {
  private storageKey = "gestaopj_user_company_settings";

  private getSettingsFromStorage(): UserCompanySettings[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      return Array.isArray(parsed)
        ? (parsed as UserCompanySettings[])
        : [];
    } catch {
      return [];
    }
  }

  private saveSettingsToStorage(settings: UserCompanySettings[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(settings));
    } catch (error) {
      console.error("Erro ao salvar configurações de usuário:", error);
    }
  }

  async findByUserAndCompany(
    userId: string,
    companyId: string
  ): Promise<UserCompanySettings | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const settings = this.getSettingsFromStorage();
    return (
      settings.find(
        (s) => s.userId === userId && s.companyId === companyId
      ) || null
    );
  }

  async findByCompanyId(
    companyId: string
  ): Promise<UserCompanySettings[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const settings = this.getSettingsFromStorage();
    return settings.filter((s) => s.companyId === companyId);
  }

  async create(
    data: CreateUserCompanySettingsDTO
  ): Promise<UserCompanySettings> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Verificar se já existe configuração para este usuário nesta empresa
    const existing = await this.findByUserAndCompany(
      data.userId,
      data.companyId
    );
    if (existing) {
      throw new Error(
        "Já existe configuração para este usuário nesta empresa"
      );
    }

    const settings = this.getSettingsFromStorage();
    const now = new Date().toISOString();

    const newSetting: UserCompanySettings = {
      id: `ucs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: data.userId,
      companyId: data.companyId,
      horista: data.horista,
      limiteMensalHoras: data.horista ? data.limiteMensalHoras : undefined,
      contato: data.contato,
      cpf: data.cpf,
      createdAt: now,
      updatedAt: now,
    };

    settings.push(newSetting);
    this.saveSettingsToStorage(settings);

    return newSetting;
  }

  async update(
    id: string,
    data: UpdateUserCompanySettingsDTO
  ): Promise<UserCompanySettings> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const settings = this.getSettingsFromStorage();
    const index = settings.findIndex((s) => s.id === id);

    if (index === -1) {
      throw new Error("Configuração não encontrada");
    }

    // Se mudou para não-horista, remover limite mensal
    if (data.horista === false) {
      data.limiteMensalHoras = undefined;
    }

    settings[index] = {
      ...settings[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.saveSettingsToStorage(settings);
    return settings[index];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const settings = this.getSettingsFromStorage();
    const filtered = settings.filter((s) => s.id !== id);
    this.saveSettingsToStorage(filtered);
  }

  async deleteByUserAndCompany(
    userId: string,
    companyId: string
  ): Promise<void> {
    const setting = await this.findByUserAndCompany(userId, companyId);
    if (setting) {
      await this.delete(setting.id);
    }
  }
}

export const userCompanySettingsService = new UserCompanySettingsService();

