import {
  FaturaEtapaStatus,
  CreateFaturaEtapaStatusDTO,
  UpdateFaturaEtapaStatusDTO,
  StatusEtapa,
} from "@/types";

const STORAGE_KEY = "atuapj_fatura_etapa_status";

class FaturaEtapaStatusService {
  private getStatusFromStorage(): FaturaEtapaStatus[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as FaturaEtapaStatus[];
    } catch {
      return [];
    }
  }

  private saveStatusToStorage(status: FaturaEtapaStatus[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
  }

  async create(data: CreateFaturaEtapaStatusDTO): Promise<FaturaEtapaStatus> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const statusList = this.getStatusFromStorage();

    // Verificar se já existe status para esta fatura e etapa
    const existing = statusList.find(
      (s) => s.faturaId === data.faturaId && s.etapaId === data.etapaId
    );

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const novoStatus: FaturaEtapaStatus = {
      id: `fes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      faturaId: data.faturaId,
      etapaId: data.etapaId,
      status: data.status,
      anexoUrl: data.anexoUrl,
      anexoNome: data.anexoNome,
      observacoes: data.observacoes,
      createdAt: now,
      updatedAt: now,
    };

    statusList.push(novoStatus);
    this.saveStatusToStorage(statusList);

    return novoStatus;
  }

  async findByFaturaId(faturaId: string): Promise<FaturaEtapaStatus[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const statusList = this.getStatusFromStorage();
    return statusList.filter((s) => s.faturaId === faturaId);
  }

  async findByEtapaId(etapaId: string): Promise<FaturaEtapaStatus[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const statusList = this.getStatusFromStorage();
    return statusList.filter((s) => s.etapaId === etapaId);
  }

  async findById(id: string): Promise<FaturaEtapaStatus | null> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const statusList = this.getStatusFromStorage();
    return statusList.find((s) => s.id === id) || null;
  }

  async findByFaturaAndEtapa(
    faturaId: string,
    etapaId: string
  ): Promise<FaturaEtapaStatus | null> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const statusList = this.getStatusFromStorage();
    return (
      statusList.find(
        (s) => s.faturaId === faturaId && s.etapaId === etapaId
      ) || null
    );
  }

  async update(
    id: string,
    data: UpdateFaturaEtapaStatusDTO
  ): Promise<FaturaEtapaStatus> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const statusList = this.getStatusFromStorage();
    const index = statusList.findIndex((s) => s.id === id);

    if (index === -1) {
      throw new Error("Status de etapa não encontrado");
    }

    statusList[index] = {
      ...statusList[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.saveStatusToStorage(statusList);
    return statusList[index];
  }

  async updateStatus(
    id: string,
    status: StatusEtapa,
    aprovadoPor?: string
  ): Promise<FaturaEtapaStatus> {
    const updateData: UpdateFaturaEtapaStatusDTO = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === "aprovado" || status === "rejeitado") {
      updateData.aprovadoPor = aprovadoPor;
      updateData.aprovadoEm = new Date().toISOString();
    }

    return this.update(id, updateData);
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const statusList = this.getStatusFromStorage();
    const filtered = statusList.filter((s) => s.id !== id);
    this.saveStatusToStorage(filtered);
  }

  async deleteByFaturaId(faturaId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const statusList = this.getStatusFromStorage();
    const filtered = statusList.filter((s) => s.faturaId !== faturaId);
    this.saveStatusToStorage(filtered);
  }

  // Simulação de upload de anexo (em produção, usar serviço de storage)
  async uploadAnexo(
    faturaEtapaStatusId: string,
    file: File
  ): Promise<{ url: string; nome: string }> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Simular upload - em produção, fazer upload real para storage
    const url = `simulated://uploads/${faturaEtapaStatusId}/${file.name}`;
    const nome = file.name;

    // Atualizar status com anexo
    await this.update(faturaEtapaStatusId, {
      anexoUrl: url,
      anexoNome: nome,
    });

    return { url, nome };
  }
}

export const faturaEtapaStatusService = new FaturaEtapaStatusService();

