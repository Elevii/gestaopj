import {
  MemberInvoice,
  CreateMemberInvoiceDTO,
  UpdateMemberInvoiceDTO,
} from "@/types/memberInvoice";
import { StatusFatura } from "@/types";

class MemberInvoiceService {
  private storageKey = "gestaopj_member_invoices";

  private getInvoicesFromStorage(): MemberInvoice[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      return Array.isArray(parsed) ? (parsed as MemberInvoice[]) : [];
    } catch {
      return [];
    }
  }

  private saveInvoicesToStorage(invoices: MemberInvoice[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(invoices));
    } catch (error) {
      console.error("Erro ao salvar faturas de membros:", error);
    }
  }

  async findByUserId(userId: string): Promise<MemberInvoice[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const invoices = this.getInvoicesFromStorage();
    return invoices.filter((i) => i.userId === userId);
  }

  async findByCompanyId(companyId: string): Promise<MemberInvoice[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const invoices = this.getInvoicesFromStorage();
    return invoices.filter((i) => i.companyId === companyId);
  }

  async findById(id: string): Promise<MemberInvoice | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const invoices = this.getInvoicesFromStorage();
    return invoices.find((i) => i.id === id) || null;
  }

  async create(data: CreateMemberInvoiceDTO): Promise<MemberInvoice> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const invoices = this.getInvoicesFromStorage();
    const now = new Date().toISOString();

    const invoiceId = `mi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Preencher faturaId nos lembretes
    const lembretes = (data.lembretes || []).map((l) => ({
      ...l,
      faturaId: invoiceId,
    }));

    const newInvoice: MemberInvoice = {
      id: invoiceId,
      userId: data.userId,
      companyId: data.companyId,
      titulo: data.titulo,
      valor: data.valor,
      dataVencimento: data.dataVencimento,
      status: "fatura_gerada",
      periodoInicio: data.periodoInicio,
      periodoFim: data.periodoFim,
      horasTrabalhadas: data.horasTrabalhadas,
      tipoCalculo: data.tipoCalculo,
      valorPorHora: data.valorPorHora,
      valorFixo: data.valorFixo,
      lembretes: lembretes,
      observacoes: data.observacoes,
      createdAt: now,
      updatedAt: now,
    };

    invoices.push(newInvoice);
    this.saveInvoicesToStorage(invoices);

    return newInvoice;
  }

  async update(
    id: string,
    data: UpdateMemberInvoiceDTO
  ): Promise<MemberInvoice> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const invoices = this.getInvoicesFromStorage();
    const index = invoices.findIndex((i) => i.id === id);

    if (index === -1) {
      throw new Error("Fatura não encontrada");
    }

    // Calcular status automático se houver pagamento
    let status = invoices[index].status;
    if (data.status) {
      status = data.status;
    } else if (data.dataPagamento && status !== "cancelado") {
      status = "pago";
    }

    invoices[index] = {
      ...invoices[index],
      ...data,
      status,
      updatedAt: new Date().toISOString(),
    };

    this.saveInvoicesToStorage(invoices);
    return invoices[index];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const invoices = this.getInvoicesFromStorage();
    const filtered = invoices.filter((i) => i.id !== id);
    this.saveInvoicesToStorage(filtered);
  }

  async updateStatus(
    id: string,
    status: StatusFatura,
    dataPagamento?: string
  ): Promise<MemberInvoice> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const invoices = this.getInvoicesFromStorage();
    const index = invoices.findIndex((i) => i.id === id);

    if (index === -1) {
      throw new Error("Fatura não encontrada");
    }

    const updatedInvoice: MemberInvoice = {
      ...invoices[index],
      status,
      dataPagamento:
        status === "pago"
          ? dataPagamento || new Date().toISOString()
          : undefined,
      updatedAt: new Date().toISOString(),
    };

    invoices[index] = updatedInvoice;
    this.saveInvoicesToStorage(invoices);

    console.log(`✅ Status da fatura atualizado: ${id} -> ${status}`);
    return updatedInvoice;
  }

  async reopenInvoice(id: string): Promise<MemberInvoice> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log(`🔄 Reabrindo fatura: ${id}`);
    const invoices = this.getInvoicesFromStorage();
    const invoice = invoices.find((i) => i.id === id);

    if (!invoice) {
      throw new Error("Fatura não encontrada");
    }

    if (invoice.status !== "pago") {
      throw new Error("Apenas faturas pagas podem ser reabertas");
    }

    return this.updateStatus(id, "pendente");
  }

  getAll(): MemberInvoice[] {
    return this.getInvoicesFromStorage();
  }
}

export const memberInvoiceService = new MemberInvoiceService();
