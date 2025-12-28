import { Configuracoes, UpdateConfiguracoesDTO } from "@/types";

// Simulação de API - em produção será substituído por chamadas HTTP reais
class ConfiguracoesService {
  private storageKey = "atuapj_configuracoes";

  private getDefaultConfiguracoes(): Configuracoes {
    const now = new Date().toISOString();
    return {
      tema: "escuro",
      nomeEmpresa: "",
      horasUteisPadrao: 8,
      fusoHorario: "America/Sao_Paulo",
      formatoData: "dd/MM/yyyy",
      createdAt: now,
      updatedAt: now,
    };
  }

  private getConfiguracoesFromStorage(): Configuracoes {
    if (typeof window === "undefined") {
      return this.getDefaultConfiguracoes();
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        const defaultConfig = this.getDefaultConfiguracoes();
        this.saveConfiguracoesToStorage(defaultConfig);
        return defaultConfig;
      }

      const parsed = JSON.parse(stored) as Partial<Configuracoes>;
      
      // Garantir que todos os campos obrigatórios existam
      const config: Configuracoes = {
        tema: "escuro", // Tema sempre escuro fixo
        nomeEmpresa: parsed.nomeEmpresa ?? "",
        horasUteisPadrao: parsed.horasUteisPadrao ?? 8,
        fusoHorario: parsed.fusoHorario ?? "America/Sao_Paulo",
        formatoData: parsed.formatoData ?? "dd/MM/yyyy",
        createdAt: parsed.createdAt ?? new Date().toISOString(),
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      };

      // Se algum campo estava faltando, salvar a versão completa
      if (
        parsed.tema === undefined ||
        parsed.nomeEmpresa === undefined ||
        parsed.horasUteisPadrao === undefined ||
        parsed.fusoHorario === undefined ||
        parsed.formatoData === undefined
      ) {
        this.saveConfiguracoesToStorage(config);
      }

      return config;
    } catch {
      return this.getDefaultConfiguracoes();
    }
  }

  private saveConfiguracoesToStorage(config: Configuracoes): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(config));
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
    }
  }

  async findAll(): Promise<Configuracoes> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.getConfiguracoesFromStorage();
  }

  async update(data: UpdateConfiguracoesDTO): Promise<Configuracoes> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const current = this.getConfiguracoesFromStorage();
    const updated: Configuracoes = {
      ...current,
      ...data,
      tema: "escuro", // Tema sempre escuro fixo, ignorar qualquer tentativa de alteração
      updatedAt: new Date().toISOString(),
    };

    this.saveConfiguracoesToStorage(updated);
    return updated;
  }
}

// Exporta instância única (Singleton)
export const configuracoesService = new ConfiguracoesService();



