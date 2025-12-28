/**
 * Regras atuais (até existir configuração):
 * - Considera 8 horas úteis por dia
 * - Considera apenas dias úteis (segunda a sexta)
 */
export const DEFAULT_HORAS_UTEIS_POR_DIA = 8;

export function parseISODateToLocal(dateISO: string): Date | null {
  // Espera YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, monthIndex, day);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatTodayISODateLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function calcularDataFimEstimada(
  dataInicioISO: string,
  horasTotais: number,
  horasUteisPorDia: number = DEFAULT_HORAS_UTEIS_POR_DIA
): string {
  if (!dataInicioISO) return "";

  const dataInicioObj = parseISODateToLocal(dataInicioISO);
  if (!dataInicioObj) return "";

  const horas = Number(horasTotais);
  if (!Number.isFinite(horas) || horas <= 0) return "";

  const horasPorDiaInput = Number(horasUteisPorDia);
  const horasPorDia =
    Number.isFinite(horasPorDiaInput) && horasPorDiaInput >= 1 && horasPorDiaInput <= 24
      ? horasPorDiaInput
      : DEFAULT_HORAS_UTEIS_POR_DIA;

  const diasNecessarios = Math.ceil(horas / horasPorDia);

  const dataFim = new Date(dataInicioObj);

  // Regra: considera o "início" como a data de partida e soma dias úteis a partir do dia seguinte.
  // Ex.: início 24/12 + 16h (2 dias) => 26/12
  let diasUteisSomados = 0;
  while (diasUteisSomados < diasNecessarios) {
    dataFim.setDate(dataFim.getDate() + 1);
    const diaDaSemana = dataFim.getDay();
    if (diaDaSemana !== 0 && diaDaSemana !== 6) {
      diasUteisSomados++;
    }
  }

  return formatDateToISODateLocal(dataFim);
}

export type CronogramaItem = {
  atividadeId: string;
  horasEstimadas: number;
  inicio: string; // ISO date
  fim: string; // ISO date
};

export function gerarCronogramaSequencial(params: {
  dataInicioProjetoISO: string;
  itens: Array<{
    atividadeId: string;
    horasEstimadas: number;
    inicioOverride?: string;
    fimOverride?: string;
  }>;
  horasUteisPorDia: number;
}): CronogramaItem[] {
  let cursorISO = params.dataInicioProjetoISO;

  return params.itens.map((item) => {
    const inicio = item.inicioOverride ?? cursorISO;
    const fim =
      item.fimOverride ?? calcularDataFimEstimada(inicio, item.horasEstimadas, params.horasUteisPorDia);

    // Próximo item começa no dia seguinte ao fim calculado (sequencial)
    const fimDate = parseISODateToLocal(fim);
    const nextStart =
      fimDate ? formatDateToISODateLocal(addDays(fimDate, 1)) : fim;
    cursorISO = nextStart;

    return {
      atividadeId: item.atividadeId,
      horasEstimadas: item.horasEstimadas,
      inicio,
      fim,
    };
  });
}

function formatDateToISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Formata uma data ISO (YYYY-MM-DD) ou timestamp ISO para o formato configurado
 * Considera o fuso horário e formato de data das configurações
 * 
 * @param dateISO - Data no formato ISO (YYYY-MM-DD) ou timestamp ISO
 * @param options - Opções opcionais para formato e fuso horário
 */
export function formatDateBR(
  dateISO: string | null | undefined,
  options?: {
    formatoData?: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
    fusoHorario?: string;
  }
): string {
  if (!dateISO) return "-";

  const formato = options?.formatoData ?? "dd/MM/yyyy";
  const fuso = options?.fusoHorario ?? "America/Sao_Paulo";

  // Se for apenas data (YYYY-MM-DD), usa parseISODateToLocal
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    const data = parseISODateToLocal(dateISO);
    if (!data) return "-";
    
    // Formata baseado no formato configurado
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    
    if (formato === "dd/MM/yyyy") {
      return `${dia}/${mes}/${ano}`;
    } else if (formato === "MM/dd/yyyy") {
      return `${mes}/${dia}/${ano}`;
    } else {
      return `${ano}-${mes}-${dia}`;
    }
  }

  // Se for timestamp ISO completo, usa new Date mas formata considerando o fuso local
  const data = new Date(dateISO);
  if (Number.isNaN(data.getTime())) return "-";

  // Formata usando Intl.DateTimeFormat com o fuso horário configurado
  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);

  // Ajusta o formato se necessário
  if (formato === "dd/MM/yyyy") {
    return dataFormatada; // Já está no formato correto
  } else if (formato === "MM/dd/yyyy") {
    const [dia, mes, ano] = dataFormatada.split("/");
    return `${mes}/${dia}/${ano}`;
  } else {
    const [dia, mes, ano] = dataFormatada.split("/");
    return `${ano}-${mes}-${dia}`;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}


