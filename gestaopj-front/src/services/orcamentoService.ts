import { CreateOrcamentoDTO, Orcamento } from "@/types";
import { authService } from "./authService";
import { projetoService } from "./projetoService";
import { atividadeService } from "./atividadeService";
import { formatTodayISODateLocal } from "@/utils/estimativas";

// Simulação de API - em produção será substituído por chamadas HTTP reais
class OrcamentoService {
  private storageKey = "atuapj_orcamentos";

  private getOrcamentosFromStorage(): Orcamento[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      if (!Array.isArray(parsed)) return [];

      // Migração: converter orçamentos antigos que usam atividadeId para o novo formato
      let needsSave = false;
      const migrated = parsed.map((raw) => {
        if (!raw || typeof raw !== "object") return raw;

        const updates: any = {};

        // Adicionar status padrão se não existir
        if (raw.status === undefined) {
          needsSave = true;
          updates.status = "aberto";
        }

        // Migrar itens: se usar atividadeId (formato antigo), precisa migrar
        if (raw.itens && Array.isArray(raw.itens)) {
          const itensMigrados = raw.itens.map((item: any) => {
            // Se já tem titulo e horasEstimadas, está no formato novo
            if (item.titulo && item.horasEstimadas !== undefined) {
              return item;
            }

            // Formato antigo: tem atividadeId, precisa buscar atividade
            if (item.atividadeId) {
              needsSave = true;
              // Retornar item com campos vazios - será preenchido depois se necessário
              // Por enquanto, retornamos um item básico
              return {
                titulo: `Atividade migrada ${item.atividadeId}`,
                horasEstimadas: 0,
                ordem: item.ordem,
                entregavelId: item.entregavelId,
                inicioOverride: item.inicioOverride,
                fimOverride: item.fimOverride,
              };
            }

            return item;
          });

          if (needsSave) {
            updates.itens = itensMigrados;
          }
        }

        return { ...raw, ...updates };
      }) as Orcamento[];

      if (needsSave) {
        this.saveOrcamentosToStorage(migrated);
      }

      return migrated;
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
      status: data.status || "aberto",
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

  async approveOrcamento(id: string, userId: string): Promise<Orcamento> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const orcamentos = this.getOrcamentosFromStorage();
    const idx = orcamentos.findIndex((o) => o.id === id);
    if (idx === -1) throw new Error("Orçamento não encontrado");

    const orcamento = orcamentos[idx];

    // Validar que está aberto
    if (orcamento.status !== "aberto") {
      throw new Error("Apenas orçamentos abertos podem ser aprovados");
    }

    // Validar que tem atividades
    if (orcamento.itens.length === 0) {
      throw new Error("Orçamento deve ter pelo menos uma atividade para ser aprovado");
    }

    // Obter projeto
    const projeto = await projetoService.findById(orcamento.projetoId);
    if (!projeto) {
      throw new Error("Projeto não encontrado");
    }

    // Criar atividades no projeto
    const dataInicio = formatTodayISODateLocal();
    for (const item of orcamento.itens) {
      await atividadeService.create(
        {
          projetoId: orcamento.projetoId,
          titulo: item.titulo,
          dataInicio,
          horasAtuacao: item.horasEstimadas,
          status: "pendente",
          horasUtilizadas: 0,
        },
        projeto.valorHora ?? 0,
        projeto.horasUteisPorDia
      );
    }

    // Atualizar orçamento
    const now = new Date().toISOString();
    orcamentos[idx] = {
      ...orcamento,
      status: "aprovado",
      aprovadoPor: userId,
      aprovadoEm: now,
      updatedAt: now,
    };

    this.saveOrcamentosToStorage(orcamentos);
    return orcamentos[idx];
  }
}

export const orcamentoService = new OrcamentoService();



