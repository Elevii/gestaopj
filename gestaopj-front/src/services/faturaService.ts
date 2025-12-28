import {
  Fatura,
  CreateFaturaDTO,
  UpdateFaturaDTO,
  Lembrete,
  CreateLembreteDTO,
} from "@/types";
import { addDays, addMonths, addWeeks, addYears, parseISO } from "date-fns";

class FaturaService {
  private storageKey = "atuapj_faturas";

  private getFaturasFromStorage(): Fatura[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? (JSON.parse(stored) as Fatura[]) : [];
    } catch {
      return [];
    }
  }

  private saveFaturasToStorage(faturas: Fatura[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(faturas));
    } catch (error) {
      console.error("Erro ao salvar faturas:", error);
    }
  }

  async findAll(): Promise<Fatura[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return this.getFaturasFromStorage();
  }

  async findByProjetoId(projetoId: string): Promise<Fatura[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const faturas = this.getFaturasFromStorage();
    return faturas
      .filter((f) => f.projetoId === projetoId)
      .sort(
        (a, b) =>
          new Date(a.dataVencimento).getTime() -
          new Date(b.dataVencimento).getTime()
      );
  }

  async create(data: CreateFaturaDTO): Promise<Fatura[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const faturas = this.getFaturasFromStorage();
    const novasFaturas: Fatura[] = [];
    const baseDate = parseISO(data.dataVencimento);

    const repeticoes = data.recorrencia?.repeticoes || 1;
    const frequencia = data.recorrencia?.frequencia;

    for (let i = 0; i < repeticoes; i++) {
      let dataVencimento = baseDate;

      if (i > 0 && frequencia) {
        switch (frequencia) {
          case "semanal":
            dataVencimento = addWeeks(baseDate, i);
            break;
          case "quinzenal":
            dataVencimento = addWeeks(baseDate, i * 2);
            break;
          case "mensal":
            dataVencimento = addMonths(baseDate, i);
            break;
          case "anual":
            dataVencimento = addYears(baseDate, i);
            break;
        }
      }

      // Adiciona lembrete padrão "Receber pagamento" no dia do vencimento
      const lembretesIniciais: CreateLembreteDTO[] = [
        ...(data.lembretesIniciais || []),
        { titulo: "Receber pagamento", diasAntesVencimento: 0 },
      ];

      // Gera lembretes para esta fatura
      const lembretes: Lembrete[] = lembretesIniciais.map(
        (dto) => {
          let dataLembrete = dataVencimento; // default

          if (dto.dataFixa) {
            dataLembrete = parseISO(dto.dataFixa);
            
            // Se for recorrente, ajustamos a data do lembrete também
            if (i > 0 && frequencia) {
               switch (frequencia) {
                case "semanal":
                  dataLembrete = addWeeks(dataLembrete, i);
                  break;
                case "quinzenal":
                  dataLembrete = addWeeks(dataLembrete, i * 2);
                  break;
                case "mensal":
                  dataLembrete = addMonths(dataLembrete, i);
                  break;
                case "anual":
                  dataLembrete = addYears(dataLembrete, i);
                  break;
              }
            }

          } else if (dto.diasAntesVencimento !== undefined) {
            dataLembrete = addDays(dataVencimento, -dto.diasAntesVencimento);
          }

          return {
            id: `lemb_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}_${i}_${Math.random().toString(36).substr(2, 5)}`,
            faturaId: "", // será preenchido após criar ID da fatura
            titulo: dto.titulo,
            data: dataLembrete.toISOString(),
            concluido: false,
          };
        }
      );

      const faturaId = `fat_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}_${i}`;

      // Atualiza ID da fatura nos lembretes
      lembretes.forEach((l) => (l.faturaId = faturaId));
      
      let tituloFatura = data.titulo;
      if (repeticoes > 1) {
        tituloFatura = `${data.titulo} (${i + 1}/${repeticoes})`;
      }

      const novaFatura: Fatura = {
        id: faturaId,
        projetoId: data.projetoId,
        titulo: tituloFatura,
        valor: data.valor,
        dataVencimento: dataVencimento.toISOString(),
        observacoes: data.observacoes,
        status: "pendente",
        cobrancaEnviada: false,
        notaFiscalEmitida: false,
        comprovanteEnviado: false,
        lembretes: lembretes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      novasFaturas.push(novaFatura);
    }

    faturas.push(...novasFaturas);
    this.saveFaturasToStorage(faturas);

    return novasFaturas;
  }

  async update(id: string, data: UpdateFaturaDTO): Promise<Fatura> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const faturas = this.getFaturasFromStorage();
    const index = faturas.findIndex((f) => f.id === id);

    if (index === -1) {
      throw new Error("Fatura não encontrada");
    }

    // Calcula status automático se houver pagamento
    let novoStatus = data.status || faturas[index].status;
    if (data.dataPagamento) {
      novoStatus = "pago";
    }

    faturas[index] = {
      ...faturas[index],
      ...data,
      status: novoStatus,
      updatedAt: new Date().toISOString(),
    };

    this.saveFaturasToStorage(faturas);
    return faturas[index];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const faturas = this.getFaturasFromStorage();
    const filtered = faturas.filter((f) => f.id !== id);
    this.saveFaturasToStorage(filtered);
  }

  async getResumoFinanceiro(): Promise<{
    recebidoMes: number;
    aReceber: number;
    atrasado: number;
  }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const faturas = this.getFaturasFromStorage();
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    let recebidoMes = 0;
    let aReceber = 0;
    let atrasado = 0;

    faturas.forEach((f) => {
      const dataVenc = new Date(f.dataVencimento);
      const dataPag = f.dataPagamento ? new Date(f.dataPagamento) : null;

      // Recebido no Mês
      if (
        f.status === "pago" &&
        dataPag &&
        dataPag.getMonth() === mesAtual &&
        dataPag.getFullYear() === anoAtual
      ) {
        recebidoMes += f.valor;
      }

      // Atrasado (não pago e vencido)
      if (f.status !== "pago" && f.status !== "cancelado" && dataVenc < hoje) {
        atrasado += f.valor;
      }

      // A Receber (pendente ou atrasado)
      if (f.status === "pendente" || f.status === "atrasado") {
        aReceber += f.valor;
      }
    });

    return { recebidoMes, aReceber, atrasado };
  }
}

export const faturaService = new FaturaService();
