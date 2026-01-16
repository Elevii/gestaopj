import {
  MemberProjectHoursLimit,
  CreateMemberProjectHoursLimitDTO,
  UpdateMemberProjectHoursLimitDTO,
} from "@/types/memberProjectHours";

class MemberProjectHoursService {
  private storageKey = "gestaopj_member_project_hours";

  private getLimitsFromStorage(): MemberProjectHoursLimit[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      return Array.isArray(parsed)
        ? (parsed as MemberProjectHoursLimit[])
        : [];
    } catch {
      return [];
    }
  }

  private saveLimitsToStorage(limits: MemberProjectHoursLimit[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(limits));
    } catch (error) {
      console.error("Erro ao salvar limites de horas:", error);
    }
  }

  async findByProjectId(projetoId: string): Promise<MemberProjectHoursLimit[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const limits = this.getLimitsFromStorage();
    return limits.filter((l) => l.projetoId === projetoId);
  }

  async findByUserId(userId: string): Promise<MemberProjectHoursLimit[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const limits = this.getLimitsFromStorage();
    return limits.filter((l) => l.userId === userId);
  }

  async findByUserAndProject(
    userId: string,
    projetoId: string
  ): Promise<MemberProjectHoursLimit | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const limits = this.getLimitsFromStorage();
    return (
      limits.find((l) => l.userId === userId && l.projetoId === projetoId) ||
      null
    );
  }

  async findByCompanyId(companyId: string): Promise<MemberProjectHoursLimit[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const limits = this.getLimitsFromStorage();
    return limits.filter((l) => l.companyId === companyId);
  }

  async create(
    data: CreateMemberProjectHoursLimitDTO
  ): Promise<MemberProjectHoursLimit> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Verificar se já existe limite para este usuário neste projeto
    const existing = await this.findByUserAndProject(
      data.userId,
      data.projetoId
    );
    if (existing) {
      throw new Error(
        "Já existe um teto de horas definido para este membro neste projeto"
      );
    }

    const limits = this.getLimitsFromStorage();
    const now = new Date().toISOString();

    const newLimit: MemberProjectHoursLimit = {
      id: `mph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: data.companyId,
      userId: data.userId,
      projetoId: data.projetoId,
      maxHours: data.maxHours,
      createdAt: now,
      updatedAt: now,
    };

    limits.push(newLimit);
    this.saveLimitsToStorage(limits);

    return newLimit;
  }

  async update(
    id: string,
    data: UpdateMemberProjectHoursLimitDTO
  ): Promise<MemberProjectHoursLimit> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const limits = this.getLimitsFromStorage();
    const index = limits.findIndex((l) => l.id === id);

    if (index === -1) {
      throw new Error("Limite não encontrado");
    }

    limits[index] = {
      ...limits[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.saveLimitsToStorage(limits);
    return limits[index];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const limits = this.getLimitsFromStorage();
    const filtered = limits.filter((l) => l.id !== id);
    this.saveLimitsToStorage(filtered);
  }

  async deleteByUserAndProject(
    userId: string,
    projetoId: string
  ): Promise<void> {
    const limit = await this.findByUserAndProject(userId, projetoId);
    if (limit) {
      await this.delete(limit.id);
    }
  }
}

export const memberProjectHoursService = new MemberProjectHoursService();




