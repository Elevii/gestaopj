import { Invite, CreateInviteDTO, UpdateInviteDTO, InviteStatus } from "@/types/invite";

class InviteService {
  private storageKey = "gestaopj_invites";

  private generateToken(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private getInvitesFromStorage(): Invite[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      return Array.isArray(parsed) ? (parsed as Invite[]) : [];
    } catch {
      return [];
    }
  }

  private saveInvitesToStorage(invites: Invite[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(invites));
    } catch (error) {
      console.error("Erro ao salvar convites:", error);
    }
  }

  async create(data: CreateInviteDTO, createdBy: string): Promise<Invite> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Verificar se já existe convite pendente para este email e empresa
    const existing = await this.findByEmail(data.email);
    const pendingForCompany = existing.find(
      (inv) =>
        inv.companyId === data.companyId &&
        inv.status === "pending" &&
        new Date(inv.expiresAt) > new Date()
    );

    if (pendingForCompany) {
      throw new Error("Já existe um convite pendente para este email nesta empresa");
    }

    const invites = this.getInvitesFromStorage();
    const now = new Date();
    const expiresInDays = data.expiresInDays || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const newInvite: Invite = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: data.companyId,
      email: data.email,
      role: data.role,
      status: "pending",
      token: this.generateToken(),
      expiresAt: expiresAt.toISOString(),
      createdBy,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    invites.push(newInvite);
    this.saveInvitesToStorage(invites);

    return newInvite;
  }

  async findByToken(token: string): Promise<Invite | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const invites = this.getInvitesFromStorage();
    return invites.find((inv) => inv.token === token) || null;
  }

  async findByEmail(email: string): Promise<Invite[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const invites = this.getInvitesFromStorage();
    return invites.filter((inv) => inv.email === email);
  }

  async findByCompanyId(companyId: string): Promise<Invite[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const invites = this.getInvitesFromStorage();
    return invites.filter((inv) => inv.companyId === companyId);
  }

  async findPendingByEmail(email: string): Promise<Invite[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const invites = this.getInvitesFromStorage();
    const now = new Date();
    return invites.filter(
      (inv) =>
        inv.email === email &&
        inv.status === "pending" &&
        new Date(inv.expiresAt) > now
    );
  }

  async accept(token: string): Promise<Invite> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const invite = await this.findByToken(token);
    if (!invite) {
      throw new Error("Convite não encontrado");
    }

    if (invite.status !== "pending") {
      throw new Error("Convite já foi processado");
    }

    const expiresAt = new Date(invite.expiresAt);
    if (expiresAt < new Date()) {
      return this.update(invite.id, { status: "expired" });
    }

    return this.update(invite.id, { status: "accepted" });
  }

  async reject(token: string): Promise<Invite> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const invite = await this.findByToken(token);
    if (!invite) {
      throw new Error("Convite não encontrado");
    }

    if (invite.status !== "pending") {
      throw new Error("Convite já foi processado");
    }

    return this.update(invite.id, { status: "rejected" });
  }

  async update(id: string, data: UpdateInviteDTO): Promise<Invite> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const invites = this.getInvitesFromStorage();
    const index = invites.findIndex((inv) => inv.id === id);

    if (index === -1) {
      throw new Error("Convite não encontrado");
    }

    invites[index] = {
      ...invites[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.saveInvitesToStorage(invites);
    return invites[index];
  }

  async expire(id: string): Promise<Invite> {
    return this.update(id, { status: "expired" });
  }

  // Expirar convites automaticamente
  async expireOldInvites(): Promise<void> {
    const invites = this.getInvitesFromStorage();
    const now = new Date();
    let updated = false;

    for (const invite of invites) {
      if (
        invite.status === "pending" &&
        new Date(invite.expiresAt) < now
      ) {
        await this.update(invite.id, { status: "expired" });
        updated = true;
      }
    }

    if (updated) {
      // Recarregar após atualizações
      const updatedInvites = this.getInvitesFromStorage();
      this.saveInvitesToStorage(updatedInvites);
    }
  }
}

export const inviteService = new InviteService();





