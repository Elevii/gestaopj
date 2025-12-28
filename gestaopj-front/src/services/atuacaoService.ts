import { Atuacao, CreateAtuacaoDTO } from "@/types";

// Simulação de API - em produção será substituído por chamadas HTTP reais
class AtuacaoService {
  private storageKey = "atuapj_atuacoes";

  private getAtuacoesFromStorage(): Atuacao[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      if (!Array.isArray(parsed)) return [];

      // Migração: status antigo "iniciada" -> "em_execucao" e defaults para campos novos
      let needsSave = false;
      const migrated = parsed.map((raw) => {
        if (raw && typeof raw === "object") {
          let next = raw;
          if (raw.statusAtividadeNoRegistro === "iniciada") {
            needsSave = true;
            next = { ...next, statusAtividadeNoRegistro: "em_execucao" };
          }
          if (next.horasEstimadasNoRegistro === undefined) {
            needsSave = true;
            next = { ...next, horasEstimadasNoRegistro: 0 };
          }
          if (next.statusAtividadeNoRegistro === undefined) {
            needsSave = true;
            next = { ...next, statusAtividadeNoRegistro: "em_execucao" };
          }
          if (next.horarioInicio === undefined) {
            // campo novo opcional
            needsSave = true;
            next = { ...next, horarioInicio: undefined };
          }
          return next;
        }
        return raw;
      }) as Atuacao[];

      if (needsSave) {
        this.saveAtuacoesToStorage(migrated);
      }

      return migrated;
    } catch {
      return [];
    }
  }

  private saveAtuacoesToStorage(atuacoes: Atuacao[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(atuacoes));
    } catch (error) {
      console.error("Erro ao salvar atuações:", error);
    }
  }

  async findAll(): Promise<Atuacao[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.getAtuacoesFromStorage();
  }

  async findByProjetoId(projetoId: string): Promise<Atuacao[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.getAtuacoesFromStorage().filter((a) => a.projetoId === projetoId);
  }

  async create(data: CreateAtuacaoDTO): Promise<Atuacao> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const atuacoes = this.getAtuacoesFromStorage();
    const now = new Date().toISOString();

    const novaAtuacao: Atuacao = {
      id: `atu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    atuacoes.push(novaAtuacao);
    this.saveAtuacoesToStorage(atuacoes);
    return novaAtuacao;
  }

  async update(id: string, data: Partial<CreateAtuacaoDTO>): Promise<Atuacao> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    
    const atuacoes = this.getAtuacoesFromStorage();
    const index = atuacoes.findIndex((a) => a.id === id);
    
    if (index === -1) {
      throw new Error("Atuação não encontrada");
    }
    
    const atuacaoAtualizada: Atuacao = {
      ...atuacoes[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    
    atuacoes[index] = atuacaoAtualizada;
    this.saveAtuacoesToStorage(atuacoes);
    return atuacaoAtualizada;
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const atuacoes = this.getAtuacoesFromStorage();
    this.saveAtuacoesToStorage(atuacoes.filter((a) => a.id !== id));
  }
}

export const atuacaoService = new AtuacaoService();


