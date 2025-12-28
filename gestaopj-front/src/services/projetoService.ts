import { Projeto, CreateProjetoDTO } from "@/types";
import { DEFAULT_HORAS_UTEIS_POR_DIA } from "@/utils/estimativas";
import { authService } from "./authService";

// Simulação de API - em produção será substituído por chamadas HTTP reais
class ProjetoService {
  private storageKey = "atuapj_projetos";

  private getProjetosFromStorage(): Projeto[] {
    if (typeof window === "undefined") return [];
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      if (!Array.isArray(parsed)) return [];

      // Migração: adiciona horasUteisPorDia (default 8), status (default "ativo") e companyId para projetos antigos
      let needsSave = false;
      const migrated = parsed.map((raw) => {
        if (raw && typeof raw === "object") {
          const updates: any = {};
          if (raw.horasUteisPorDia === undefined) {
            needsSave = true;
            updates.horasUteisPorDia = DEFAULT_HORAS_UTEIS_POR_DIA;
          }
          if (raw.status === undefined) {
            needsSave = true;
            updates.status = "ativo";
          }
          // companyId será adicionado apenas se não existir (para compatibilidade)
          // Em novos projetos, será obrigatório
          return { ...raw, ...updates };
        }
        return raw;
      }) as Projeto[];

      if (needsSave) {
        this.saveProjetosToStorage(migrated);
      }

      return migrated;
    } catch {
      return [];
    }
  }

  private saveProjetosToStorage(projetos: Projeto[]): void {
    if (typeof window === "undefined") return;
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(projetos));
    } catch (error) {
      console.error("Erro ao salvar projetos:", error);
    }
  }

  async findAll(companyId?: string): Promise<Projeto[]> {
    // Simula delay de rede
    await new Promise((resolve) => setTimeout(resolve, 300));
    const projetos = this.getProjetosFromStorage();
    
    // Se companyId fornecido, filtrar por empresa
    if (companyId) {
      return projetos.filter((p) => p.companyId === companyId);
    }
    
    // Se não fornecido, usar empresa do usuário logado
    const currentCompany = await authService.getCurrentCompany();
    if (currentCompany) {
      return projetos.filter((p) => p.companyId === currentCompany.id);
    }
    
    return projetos;
  }

  async findById(id: string): Promise<Projeto | null> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const projetos = this.getProjetosFromStorage();
    return projetos.find((p) => p.id === id) || null;
  }

  async create(data: CreateProjetoDTO): Promise<Projeto> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Garantir que companyId está presente
    let companyId = data.companyId;
    if (!companyId) {
      const currentCompany = await authService.getCurrentCompany();
      if (!currentCompany) {
        throw new Error("Empresa não encontrada. Faça login novamente.");
      }
      companyId = currentCompany.id;
    }
    
    const projetos = this.getProjetosFromStorage();
    const novoProjeto: Projeto = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      companyId,
      status: data.status ?? "ativo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    projetos.push(novoProjeto);
    this.saveProjetosToStorage(projetos);
    
    return novoProjeto;
  }

  async update(id: string, data: Partial<CreateProjetoDTO>): Promise<Projeto> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    
    const projetos = this.getProjetosFromStorage();
    const index = projetos.findIndex((p) => p.id === id);
    
    if (index === -1) {
      throw new Error("Projeto não encontrado");
    }
    
    projetos[index] = {
      ...projetos[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    
    this.saveProjetosToStorage(projetos);
    return projetos[index];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    const projetos = this.getProjetosFromStorage();
    const filtered = projetos.filter((p) => p.id !== id);
    this.saveProjetosToStorage(filtered);
  }
}

// Exporta instância única (Singleton)
export const projetoService = new ProjetoService();

