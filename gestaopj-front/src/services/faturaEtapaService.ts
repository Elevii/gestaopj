import { FaturaEtapa, CreateFaturaEtapaDTO, UpdateFaturaEtapaDTO } from "@/types";

const STORAGE_KEY = "atuapj_fatura_etapas";

class FaturaEtapaService {
  private getEtapasFromStorage(): FaturaEtapa[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as FaturaEtapa[];
    } catch {
      return [];
    }
  }

  private saveEtapasToStorage(etapas: FaturaEtapa[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(etapas));
  }

  async create(data: CreateFaturaEtapaDTO): Promise<FaturaEtapa> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const etapas = this.getEtapasFromStorage();

    // Se ordem não fornecida, usar a próxima disponível
    let ordem = data.ordem;
    if (ordem === undefined) {
      const etapasDaEmpresa = etapas.filter((e) => e.companyId === data.companyId);
      ordem = etapasDaEmpresa.length > 0 
        ? Math.max(...etapasDaEmpresa.map((e) => e.ordem)) + 1 
        : 0;
    }

    const now = new Date().toISOString();
    const novaEtapa: FaturaEtapa = {
      id: `fe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: data.companyId,
      nome: data.nome,
      tipo: data.tipo,
      dataLimite: data.dataLimite,
      requerAnexo: data.requerAnexo,
      ordem: ordem,
      ativo: true,
      createdAt: now,
      updatedAt: now,
    };

    etapas.push(novaEtapa);
    this.saveEtapasToStorage(etapas);

    return novaEtapa;
  }

  async findAll(companyId?: string): Promise<FaturaEtapa[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const etapas = this.getEtapasFromStorage();

    if (companyId) {
      return etapas
        .filter((e) => e.companyId === companyId)
        .sort((a, b) => a.ordem - b.ordem);
    }

    return etapas.sort((a, b) => a.ordem - b.ordem);
  }

  async findByCompanyId(companyId: string): Promise<FaturaEtapa[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const etapas = this.getEtapasFromStorage();
    return etapas
      .filter((e) => e.companyId === companyId)
      .sort((a, b) => a.ordem - b.ordem);
  }

  async findById(id: string): Promise<FaturaEtapa | null> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const etapas = this.getEtapasFromStorage();
    return etapas.find((e) => e.id === id) || null;
  }

  async update(id: string, data: UpdateFaturaEtapaDTO): Promise<FaturaEtapa> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const etapas = this.getEtapasFromStorage();
    const index = etapas.findIndex((e) => e.id === id);

    if (index === -1) {
      throw new Error("Etapa não encontrada");
    }

    etapas[index] = {
      ...etapas[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.saveEtapasToStorage(etapas);
    return etapas[index];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const etapas = this.getEtapasFromStorage();
    const filtered = etapas.filter((e) => e.id !== id);
    this.saveEtapasToStorage(filtered);
  }

  async reorder(companyId: string, etapaIds: string[]): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const etapas = this.getEtapasFromStorage();

    // Atualizar ordem das etapas da empresa
    etapaIds.forEach((etapaId, index) => {
      const etapa = etapas.find((e) => e.id === etapaId && e.companyId === companyId);
      if (etapa) {
        etapa.ordem = index;
        etapa.updatedAt = new Date().toISOString();
      }
    });

    this.saveEtapasToStorage(etapas);
  }

  async findAtivasByCompanyId(companyId: string): Promise<FaturaEtapa[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const etapas = this.getEtapasFromStorage();
    return etapas
      .filter((e) => e.companyId === companyId && e.ativo)
      .sort((a, b) => a.ordem - b.ordem);
  }
}

export const faturaEtapaService = new FaturaEtapaService();




