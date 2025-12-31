import {
  Fatura,
  CreateFaturaDTO,
  UpdateFaturaDTO,
  Lembrete,
  CreateLembreteDTO,
} from "@/types";
import { addDays, addMonths, addWeeks, addYears, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { authService } from "./authService";
import { projetoService } from "./projetoService";
import { atuacaoService } from "./atuacaoService";
import { userCompanySettingsService } from "./userCompanySettingsService";
import { faturaEtapaService } from "./faturaEtapaService";
import { faturaEtapaStatusService } from "./faturaEtapaStatusService";

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

  async findAll(companyId?: string): Promise<Fatura[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const faturas = this.getFaturasFromStorage();
    
    // Se companyId fornecido, filtrar por empresa
    if (companyId) {
      return faturas.filter((f) => f.companyId === companyId);
    }
    
    // Se não fornecido, usar empresa do usuário logado
    const currentCompany = await authService.getCurrentCompany();
    if (currentCompany) {
      return faturas.filter((f) => f.companyId === currentCompany.id);
    }
    
    return faturas;
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

    // Obter companyId do projeto
    const projeto = await projetoService.findById(data.projetoId);
    if (!projeto) {
      throw new Error("Projeto não encontrado");
    }

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

      // Obter userId do usuário logado se não fornecido
      let userId = data.userId;
      if (!userId) {
        const currentUser = await authService.getCurrentUser();
        userId = currentUser?.id;
      }

      // Validar período obrigatório
      if (!data.periodoInicio || !data.periodoFim) {
        throw new Error("Período de faturamento é obrigatório (periodoInicio e periodoFim)");
      }

      const periodoInicio = parseISO(data.periodoInicio);
      const periodoFim = parseISO(data.periodoFim);

      // Calcular horas trabalhadas do período (se não fornecido)
      let horasTrabalhadas = data.horasTrabalhadas;
      if (horasTrabalhadas === undefined && userId) {
        const atuacoes = await atuacaoService.findAll(projeto.companyId);
        const atuacoesDoPeriodo = atuacoes.filter((a) => {
          if (a.projetoId !== data.projetoId || a.userId !== userId) return false;
          const dataAtuacao = parseISO(a.data);
          return isWithinInterval(dataAtuacao, {
            start: startOfDay(periodoInicio),
            end: endOfDay(periodoFim),
          });
        });
        horasTrabalhadas = atuacoesDoPeriodo.reduce(
          (total, a) => total + (a.horasUtilizadas || 0),
          0
        );
      }

      // Determinar tipo de cálculo e calcular valor
      let tipoCalculo: "horas" | "fixo" = data.tipoCalculo || (projeto.tipoCobranca === "horas" ? "horas" : "fixo");
      let valor = data.valor;
      let valorPorHora = data.valorPorHora;

      if (valor === undefined && userId) {
        // Verificar se usuário é horista
        const settings = await userCompanySettingsService.findByUserAndCompany(
          userId,
          projeto.companyId
        );

        if (settings?.horista || tipoCalculo === "horas") {
          tipoCalculo = "horas";
          valorPorHora = valorPorHora || projeto.valorHora || 0;
          valor = (horasTrabalhadas || 0) * valorPorHora;
        } else {
          tipoCalculo = "fixo";
          valor = projeto.valorFixo || 0;
        }
      } else if (valor === undefined) {
        // Se não há userId, usar valor padrão do projeto
        tipoCalculo = projeto.tipoCobranca || "fixo";
        if (tipoCalculo === "horas") {
          valorPorHora = valorPorHora || projeto.valorHora || 0;
          valor = (horasTrabalhadas || 0) * valorPorHora;
        } else {
          valor = projeto.valorFixo || 0;
        }
      }

      const novaFatura: Fatura = {
        id: faturaId,
        companyId: projeto.companyId,
        projetoId: data.projetoId,
        userId: userId,
        titulo: tituloFatura,
        valor: valor,
        dataVencimento: dataVencimento.toISOString(),
        observacoes: data.observacoes,
        status: "pendente",
        cobrancaEnviada: false,
        notaFiscalEmitida: false,
        comprovanteEnviado: false,
        lembretes: lembretes,
        periodoInicio: data.periodoInicio,
        periodoFim: data.periodoFim,
        horasTrabalhadas: horasTrabalhadas || 0,
        tipoCalculo: tipoCalculo,
        valorPorHora: valorPorHora,
        aprovada: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      novasFaturas.push(novaFatura);

      // Criar status de etapas automaticamente para todas as etapas ativas da empresa
      const etapasAtivas = await faturaEtapaService.findAtivasByCompanyId(projeto.companyId);
      for (const etapa of etapasAtivas) {
        await faturaEtapaStatusService.create({
          faturaId: faturaId,
          etapaId: etapa.id,
          status: "pendente",
        });
      }
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

  async getResumoFinanceiro(companyId?: string): Promise<{
    recebidoMes: number;
    aReceber: number;
    atrasado: number;
  }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    let faturas = this.getFaturasFromStorage();
    
    // Filtrar por empresa se especificado ou usar empresa ativa
    if (companyId) {
      faturas = faturas.filter((f) => f.companyId === companyId);
    } else {
      const currentCompany = await authService.getCurrentCompany();
      if (currentCompany) {
        faturas = faturas.filter((f) => f.companyId === currentCompany.id);
      }
    }
    
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

  // Métodos para filtros avançados
  async findByUserId(userId: string, companyId?: string): Promise<Fatura[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let faturas = this.getFaturasFromStorage();

    faturas = faturas.filter((f) => f.userId === userId);

    if (companyId) {
      faturas = faturas.filter((f) => f.companyId === companyId);
    } else {
      const currentCompany = await authService.getCurrentCompany();
      if (currentCompany) {
        faturas = faturas.filter((f) => f.companyId === currentCompany.id);
      }
    }

    return faturas.sort(
      (a, b) =>
        new Date(a.dataVencimento).getTime() -
        new Date(b.dataVencimento).getTime()
    );
  }

  async findByPeriodo(
    periodoInicio: string,
    periodoFim: string,
    companyId?: string
  ): Promise<Fatura[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let faturas = this.getFaturasFromStorage();

    const inicio = parseISO(periodoInicio);
    const fim = parseISO(periodoFim);

    faturas = faturas.filter((f) => {
      const faturaInicio = parseISO(f.periodoInicio);
      const faturaFim = parseISO(f.periodoFim);
      return (
        isWithinInterval(faturaInicio, { start: inicio, end: fim }) ||
        isWithinInterval(faturaFim, { start: inicio, end: fim }) ||
        (faturaInicio <= inicio && faturaFim >= fim)
      );
    });

    if (companyId) {
      faturas = faturas.filter((f) => f.companyId === companyId);
    } else {
      const currentCompany = await authService.getCurrentCompany();
      if (currentCompany) {
        faturas = faturas.filter((f) => f.companyId === currentCompany.id);
      }
    }

    return faturas.sort(
      (a, b) =>
        new Date(a.dataVencimento).getTime() -
        new Date(b.dataVencimento).getTime()
    );
  }

  async findByStatus(
    status: Fatura["status"],
    companyId?: string
  ): Promise<Fatura[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let faturas = this.getFaturasFromStorage();

    faturas = faturas.filter((f) => f.status === status);

    if (companyId) {
      faturas = faturas.filter((f) => f.companyId === companyId);
    } else {
      const currentCompany = await authService.getCurrentCompany();
      if (currentCompany) {
        faturas = faturas.filter((f) => f.companyId === currentCompany.id);
      }
    }

    return faturas.sort(
      (a, b) =>
        new Date(a.dataVencimento).getTime() -
        new Date(b.dataVencimento).getTime()
    );
  }

  // Geração em lote
  async generateBatch(
    dados: Array<{
      projetoId: string;
      userId: string;
      periodoInicio: string;
      periodoFim: string;
      dataVencimento: string;
      titulo?: string;
    }>
  ): Promise<Fatura[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const faturasGeradas: Fatura[] = [];

    for (const dado of dados) {
      const projeto = await projetoService.findById(dado.projetoId);
      if (!projeto) {
        console.warn(`Projeto ${dado.projetoId} não encontrado, pulando...`);
        continue;
      }

      // Calcular horas trabalhadas
      const periodoInicio = parseISO(dado.periodoInicio);
      const periodoFim = parseISO(dado.periodoFim);
      const atuacoes = await atuacaoService.findAll(projeto.companyId);
      const atuacoesDoPeriodo = atuacoes.filter((a) => {
        if (a.projetoId !== dado.projetoId || a.userId !== dado.userId)
          return false;
        const dataAtuacao = parseISO(a.data);
        return isWithinInterval(dataAtuacao, {
          start: startOfDay(periodoInicio),
          end: endOfDay(periodoFim),
        });
      });
      const horasTrabalhadas = atuacoesDoPeriodo.reduce(
        (total, a) => total + (a.horasUtilizadas || 0),
        0
      );

      // Determinar tipo de cálculo
      const settings = await userCompanySettingsService.findByUserAndCompany(
        dado.userId,
        projeto.companyId
      );
      const tipoCalculo: "horas" | "fixo" =
        settings?.horista || projeto.tipoCobranca === "horas"
          ? "horas"
          : "fixo";

      let valor: number;
      let valorPorHora: number | undefined;

      if (tipoCalculo === "horas") {
        valorPorHora = projeto.valorHora || 0;
        valor = horasTrabalhadas * valorPorHora;
      } else {
        valor = projeto.valorFixo || 0;
      }

      const faturaId = `fat_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}_${dados.indexOf(dado)}`;

      const novaFatura: Fatura = {
        id: faturaId,
        companyId: projeto.companyId,
        projetoId: dado.projetoId,
        userId: dado.userId,
        titulo: dado.titulo || `Fatura - ${projeto.titulo}`,
        valor: valor,
        dataVencimento: dado.dataVencimento,
        observacoes: undefined,
        status: "pendente",
        cobrancaEnviada: false,
        notaFiscalEmitida: false,
        comprovanteEnviado: false,
        lembretes: [
          {
            id: `lemb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            faturaId: faturaId,
            titulo: "Receber pagamento",
            data: dado.dataVencimento,
            concluido: false,
          },
        ],
        periodoInicio: dado.periodoInicio,
        periodoFim: dado.periodoFim,
        horasTrabalhadas: horasTrabalhadas,
        tipoCalculo: tipoCalculo,
        valorPorHora: valorPorHora,
        aprovada: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      faturasGeradas.push(novaFatura);

      // Criar status de etapas automaticamente
      const etapasAtivas = await faturaEtapaService.findAtivasByCompanyId(
        projeto.companyId
      );
      for (const etapa of etapasAtivas) {
        await faturaEtapaStatusService.create({
          faturaId: faturaId,
          etapaId: etapa.id,
          status: "pendente",
        });
      }
    }

    // Salvar todas as faturas
    const faturas = this.getFaturasFromStorage();
    faturas.push(...faturasGeradas);
    this.saveFaturasToStorage(faturas);

    return faturasGeradas;
  }
}

export const faturaService = new FaturaService();
