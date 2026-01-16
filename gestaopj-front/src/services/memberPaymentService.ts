import {
  MemberPayment,
  CreateMemberPaymentDTO,
  UpdateMemberPaymentDTO,
} from "@/types/memberPayment";

class MemberPaymentService {
  private storageKey = "gestaopj_member_payments";

  private getPaymentsFromStorage(): MemberPayment[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      return Array.isArray(parsed) ? (parsed as MemberPayment[]) : [];
    } catch {
      return [];
    }
  }

  private savePaymentsToStorage(payments: MemberPayment[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(payments));
    } catch (error) {
      console.error("Erro ao salvar pagamentos de membros:", error);
    }
  }

  async findByUserAndCompanyAndMonth(
    userId: string,
    companyId: string,
    mes: string
  ): Promise<MemberPayment | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const payments = this.getPaymentsFromStorage();
    return (
      payments.find(
        (p) => p.userId === userId && p.companyId === companyId && p.mes === mes
      ) || null
    );
  }

  async findByCompanyAndMonth(
    companyId: string,
    mes: string
  ): Promise<MemberPayment[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const payments = this.getPaymentsFromStorage();
    return payments.filter((p) => p.companyId === companyId && p.mes === mes);
  }

  async create(data: CreateMemberPaymentDTO): Promise<MemberPayment> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Verificar se já existe pagamento para este usuário/empresa/mês
    const existing = await this.findByUserAndCompanyAndMonth(
      data.userId,
      data.companyId,
      data.mes
    );
    if (existing) {
      throw new Error(
        "Já existe um pagamento registrado para este membro neste mês"
      );
    }

    const payments = this.getPaymentsFromStorage();
    const now = new Date().toISOString();

    const newPayment: MemberPayment = {
      id: `mp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: data.userId,
      companyId: data.companyId,
      valor: data.valor,
      mes: data.mes,
      createdAt: now,
      updatedAt: now,
    };

    payments.push(newPayment);
    this.savePaymentsToStorage(payments);

    return newPayment;
  }

  async update(
    id: string,
    data: UpdateMemberPaymentDTO
  ): Promise<MemberPayment> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const payments = this.getPaymentsFromStorage();
    const index = payments.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error("Pagamento não encontrado");
    }

    payments[index] = {
      ...payments[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.savePaymentsToStorage(payments);
    return payments[index];
  }

  async createOrUpdate(
    userId: string,
    companyId: string,
    mes: string,
    valor: number
  ): Promise<MemberPayment> {
    const existing = await this.findByUserAndCompanyAndMonth(
      userId,
      companyId,
      mes
    );

    if (existing) {
      return await this.update(existing.id, { valor });
    } else {
      return await this.create({ userId, companyId, mes, valor });
    }
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const payments = this.getPaymentsFromStorage();
    const filtered = payments.filter((p) => p.id !== id);
    this.savePaymentsToStorage(filtered);
  }
}

export const memberPaymentService = new MemberPaymentService();



