import { Atividade, CreateAtividadeDTO, StatusAtividade } from "@/types";
import { calcularDataFimEstimada } from "@/utils/estimativas";

// Simulação de API - em produção será substituído por chamadas HTTP reais
class AtividadeService {
  private storageKey = "atuapj_atividades";

  private calcularCustoTarefa(params: {
    horasAtuacao: number;
    valorHora: number;
  }): number {
    return params.horasAtuacao * params.valorHora;
  }

  private getAtividadesFromStorage(): Atividade[] {
    if (typeof window === "undefined") return [];
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      if (!Array.isArray(parsed)) return [];

      // Migração: lucroEstimado -> custoTarefa (mantém compatibilidade com dados antigos)
      let needsSave = false;
      const migrated = parsed.map((raw) => {
        if (raw && typeof raw === "object") {
          if (raw.custoTarefa === undefined && raw.lucroEstimado !== undefined) {
            needsSave = true;
            return { ...raw, custoTarefa: raw.lucroEstimado };
          }
          if (raw.status === "iniciada") {
            needsSave = true;
            return { ...raw, status: "em_execucao" };
          }
        }
        return raw;
      }) as Atividade[];

      if (needsSave) {
        this.saveAtividadesToStorage(migrated);
      }

      return migrated;
    } catch {
      return [];
    }
  }

  private saveAtividadesToStorage(atividades: Atividade[]): void {
    if (typeof window === "undefined") return;
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(atividades));
    } catch (error) {
      console.error("Erro ao salvar atividades:", error);
    }
  }

  private calcularDataFim(
    dataInicio: string,
    horas: number,
    horasUteisPorDia?: number
  ): string {
    return calcularDataFimEstimada(dataInicio, horas, horasUteisPorDia);
  }

  async findAll(): Promise<Atividade[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.getAtividadesFromStorage();
  }

  async findByProjetoId(projetoId: string): Promise<Atividade[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const atividades = this.getAtividadesFromStorage();
    return atividades.filter((a) => a.projetoId === projetoId);
  }

  async findById(id: string): Promise<Atividade | null> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const atividades = this.getAtividadesFromStorage();
    return atividades.find((a) => a.id === id) || null;
  }

  async create(
    data: CreateAtividadeDTO,
    valorHora: number,
    horasUteisPorDia?: number
  ): Promise<Atividade> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const dataFimEstimada = this.calcularDataFim(
      data.dataInicio,
      data.horasAtuacao,
      horasUteisPorDia
    );
    const custoTarefa =
      data.custoTarefa ??
      this.calcularCustoTarefa({
        horasAtuacao: data.horasAtuacao,
        valorHora,
      });
    
    const atividades = this.getAtividadesFromStorage();
    const novaAtividade: Atividade = {
      id: `ativ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      horasUtilizadas: data.horasUtilizadas || 0,
      status: data.status || "pendente",
      dataFimEstimada,
      custoTarefa,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    atividades.push(novaAtividade);
    this.saveAtividadesToStorage(atividades);
    
    return novaAtividade;
  }

  async update(
    id: string,
    data: Partial<CreateAtividadeDTO> & { status?: StatusAtividade; horasUtilizadas?: number },
    valorHora?: number,
    horasUteisPorDia?: number
  ): Promise<Atividade> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    
    const atividades = this.getAtividadesFromStorage();
    const index = atividades.findIndex((a) => a.id === id);
    
    if (index === -1) {
      throw new Error("Atividade não encontrada");
    }
    
    const atividadeAtual = atividades[index];
    const dataAtualizada = { ...atividadeAtual, ...data };
    
    // Recalcular se necessário
    if (data.dataInicio || data.horasAtuacao) {
      const dataInicio = data.dataInicio || atividadeAtual.dataInicio;
      const horas = data.horasAtuacao || atividadeAtual.horasAtuacao;
      dataAtualizada.dataFimEstimada = this.calcularDataFim(
        dataInicio,
        horas,
        horasUteisPorDia
      );
    }
    
    // Custo da tarefa:
    // - Se veio no payload, respeita (manual).
    // - Caso contrário, recalcula automaticamente quando horas/valorHora mudarem.
    const custoFoiInformado = data.custoTarefa !== undefined;
    if (!custoFoiInformado) {
      const horasAtuacao = data.horasAtuacao ?? atividadeAtual.horasAtuacao;

      if (valorHora !== undefined) {
        dataAtualizada.custoTarefa = this.calcularCustoTarefa({
          horasAtuacao,
          valorHora,
        });
      } else {
        const valorHoraAtual =
          atividadeAtual.horasAtuacao > 0
            ? atividadeAtual.custoTarefa / atividadeAtual.horasAtuacao
            : 0;
        dataAtualizada.custoTarefa = this.calcularCustoTarefa({
          horasAtuacao,
          valorHora: valorHoraAtual,
        });
      }
    }
    
    atividades[index] = {
      ...dataAtualizada,
      updatedAt: new Date().toISOString(),
    };
    
    this.saveAtividadesToStorage(atividades);
    return atividades[index];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    const atividades = this.getAtividadesFromStorage();
    const filtered = atividades.filter((a) => a.id !== id);
    this.saveAtividadesToStorage(filtered);
  }
}

// Exporta instância única (Singleton)
export const atividadeService = new AtividadeService();

