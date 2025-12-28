import { CreateOrcamentoDTO, Orcamento } from "@/types";
import { authService } from "./authService";
import { projetoService } from "./projetoService";

// Simulação de API - em produção será substituído por chamadas HTTP reais
class OrcamentoService {
  private storageKey = "atuapj_orcamentos";

  private getOrcamentosFromStorage(): Orcamento[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      return Array.isArray(parsed) ? (parsed as Orcamento[]) : [];
    } catch {
      return [];
    }
  }

  private saveOrcamentosToStorage(orcamentos: Orcamento[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(orcamentos));
    } catch (error) {
      console.error("Erro ao salvar orçamentos:", error);
    }
  }

  async findAll(companyId?: string): Promise<Orcamento[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const orcamentos = this.getOrcamentosFromStorage();
    
    // Se companyId fornecido, filtrar por empresa
    if (companyId) {
      return orcamentos.filter((o) => o.companyId === companyId);
    }
    
    // Se não fornecido, usar empresa do usuário logado
    const currentCompany = await authService.getCurrentCompany();
    if (currentCompany) {
      return orcamentos.filter((o) => o.companyId === currentCompany.id);
    }
    
    return orcamentos;
  }

  async findById(id: string): Promise<Orcamento | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return this.getOrcamentosFromStorage().find((o) => o.id === id) || null;
  }

  async findByProjetoId(projetoId: string): Promise<Orcamento[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return this.getOrcamentosFromStorage().filter((o) => o.projetoId === projetoId);
  }

  async create(data: CreateOrcamentoDTO): Promise<Orcamento> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Obter companyId do projeto
    const projeto = await projetoService.findById(data.projetoId);
    if (!projeto) {
      throw new Error("Projeto não encontrado");
    }

    const now = new Date().toISOString();
    const orcamentos = this.getOrcamentosFromStorage();
    const novo: Orcamento = {
      id: `orc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: projeto.companyId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    orcamentos.push(novo);
    this.saveOrcamentosToStorage(orcamentos);
    return novo;
  }

  async update(id: string, data: Partial<CreateOrcamentoDTO>): Promise<Orcamento> {
    await new Promise((resolve) => setTimeout(resolve, 250));

    const orcamentos = this.getOrcamentosFromStorage();
    const idx = orcamentos.findIndex((o) => o.id === id);
    if (idx === -1) throw new Error("Orçamento não encontrado");

    orcamentos[idx] = {
      ...orcamentos[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.saveOrcamentosToStorage(orcamentos);
    return orcamentos[idx];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const orcamentos = this.getOrcamentosFromStorage();
    this.saveOrcamentosToStorage(orcamentos.filter((o) => o.id !== id));
  }
}

export const orcamentoService = new OrcamentoService();



