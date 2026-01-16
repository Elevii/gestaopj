import {
  CompanyMembership,
  CreateCompanyMembershipDTO,
  UpdateCompanyMembershipDTO,
} from "@/types/companyMembership";

class CompanyMembershipService {
  private storageKey = "gestaopj_company_memberships";

  private getMembershipsFromStorage(): CompanyMembership[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      return Array.isArray(parsed) ? (parsed as CompanyMembership[]) : [];
    } catch {
      return [];
    }
  }

  private saveMembershipsToStorage(
    memberships: CompanyMembership[]
  ): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(memberships));
    } catch (error) {
      console.error("Erro ao salvar memberships:", error);
    }
  }

  async findByUserId(userId: string): Promise<CompanyMembership[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const memberships = this.getMembershipsFromStorage();
    return memberships.filter(
      (m) => m.userId === userId && m.active
    );
  }

  async findByCompanyId(companyId: string): Promise<CompanyMembership[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const memberships = this.getMembershipsFromStorage();
    return memberships.filter(
      (m) => m.companyId === companyId && m.active
    );
  }

  async findByUserAndCompany(
    userId: string,
    companyId: string
  ): Promise<CompanyMembership | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const memberships = this.getMembershipsFromStorage();
    return (
      memberships.find(
        (m) => m.userId === userId && m.companyId === companyId && m.active
      ) || null
    );
  }

  async create(
    data: CreateCompanyMembershipDTO
  ): Promise<CompanyMembership> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Verificar se já existe membership ativa
    const existing = await this.findByUserAndCompany(
      data.userId,
      data.companyId
    );
    if (existing) {
      throw new Error("Usuário já é membro desta empresa");
    }

    // Se role é owner, verificar se já existe owner na empresa
    if (data.role === "owner") {
      const companyMemberships = await this.findByCompanyId(data.companyId);
      const hasOwner = companyMemberships.some((m) => m.role === "owner");
      if (hasOwner) {
        throw new Error("Empresa já possui um Owner. Apenas um Owner por empresa.");
      }
    }

    const memberships = this.getMembershipsFromStorage();
    const now = new Date().toISOString();

    const newMembership: CompanyMembership = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: data.userId,
      companyId: data.companyId,
      role: data.role,
      active: data.active !== undefined ? data.active : true,
      createdAt: now,
      updatedAt: now,
    };

    memberships.push(newMembership);
    this.saveMembershipsToStorage(memberships);

    return newMembership;
  }

  async update(
    id: string,
    data: UpdateCompanyMembershipDTO
  ): Promise<CompanyMembership> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const memberships = this.getMembershipsFromStorage();
    const index = memberships.findIndex((m) => m.id === id);

    if (index === -1) {
      throw new Error("Membership não encontrada");
    }

    // Se mudando para owner, verificar se já existe owner na empresa
    if (data.role === "owner" && memberships[index].role !== "owner") {
      const companyMemberships = memberships.filter(
        (m) =>
          m.companyId === memberships[index].companyId &&
          m.id !== id &&
          m.active
      );
      const hasOwner = companyMemberships.some((m) => m.role === "owner");
      if (hasOwner) {
        throw new Error(
          "Empresa já possui um Owner. Transfira a propriedade primeiro."
        );
      }
    }

    memberships[index] = {
      ...memberships[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.saveMembershipsToStorage(memberships);
    return memberships[index];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const memberships = this.getMembershipsFromStorage();
    const membership = memberships.find((m) => m.id === id);

    if (!membership) {
      throw new Error("Membership não encontrada");
    }

    // Não permitir deletar Owner sem transferência
    if (membership.role === "owner") {
      throw new Error(
        "Não é possível remover o Owner. Transfira a propriedade primeiro."
      );
    }

    const filtered = memberships.filter((m) => m.id !== id);
    this.saveMembershipsToStorage(filtered);
  }

  async deactivate(id: string): Promise<CompanyMembership> {
    const memberships = this.getMembershipsFromStorage();
    const membership = memberships.find((m) => m.id === id);

    if (!membership) {
      throw new Error("Membership não encontrada");
    }

    // Não permitir desativar Owner
    if (membership.role === "owner") {
      throw new Error("Não é possível desativar o Owner.");
    }

    return this.update(id, { active: false });
  }

  async changeRole(
    id: string,
    newRole: string
  ): Promise<CompanyMembership> {
    return this.update(id, { role: newRole as any });
  }

  async transferOwnership(
    companyId: string,
    currentOwnerMembershipId: string,
    newOwnerMembershipId: string
  ): Promise<{
    oldOwner: CompanyMembership;
    newOwner: CompanyMembership;
  }> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const memberships = this.getMembershipsFromStorage();
    const currentOwner = memberships.find(
      (m) => m.id === currentOwnerMembershipId
    );
    const newOwner = memberships.find(
      (m) => m.id === newOwnerMembershipId
    );

    if (!currentOwner || currentOwner.role !== "owner") {
      throw new Error("Membership atual não é Owner");
    }

    if (!newOwner) {
      throw new Error("Nova membership Owner não encontrada");
    }

    if (currentOwner.companyId !== newOwner.companyId) {
      throw new Error("Memberships devem pertencer à mesma empresa");
    }

    // Transferir propriedade
    const oldOwnerIndex = memberships.findIndex(
      (m) => m.id === currentOwnerMembershipId
    );
    const newOwnerIndex = memberships.findIndex(
      (m) => m.id === newOwnerMembershipId
    );

    memberships[oldOwnerIndex] = {
      ...memberships[oldOwnerIndex],
      role: "admin", // Ex-owner vira admin
      updatedAt: new Date().toISOString(),
    };

    memberships[newOwnerIndex] = {
      ...memberships[newOwnerIndex],
      role: "owner",
      updatedAt: new Date().toISOString(),
    };

    this.saveMembershipsToStorage(memberships);

    return {
      oldOwner: memberships[oldOwnerIndex],
      newOwner: memberships[newOwnerIndex],
    };
  }
}

export const companyMembershipService = new CompanyMembershipService();





