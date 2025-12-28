import { parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Projeto, Atuacao, Fatura, Atividade } from "@/types";

/**
 * Verifica se uma data ISO está dentro do mês atual
 */
export function isInCurrentMonth(dateISO: string): boolean {
  const date = parseISO(dateISO);
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  return isWithinInterval(date, { start, end });
}

/**
 * Verifica se uma data ISO está dentro do mês anterior
 */
export function isInPreviousMonth(dateISO: string): boolean {
  const date = parseISO(dateISO);
  const now = new Date();
  const previousMonth = subMonths(now, 1);
  const start = startOfMonth(previousMonth);
  const end = endOfMonth(previousMonth);
  return isWithinInterval(date, { start, end });
}

/**
 * Calcula a variação percentual entre dois valores
 * Retorna null quando não faz sentido calcular a variação
 */
export function calculatePercentageChange(current: number, previous: number): number | null {
  // Se ambos são zero, não há variação
  if (previous === 0 && current === 0) {
    return null;
  }
  
  // Se mês anterior era zero e agora tem valor, não calcula variação
  // (evita mostrar "100%" que é enganoso - melhor não mostrar nada)
  if (previous === 0 && current > 0) {
    return null;
  }
  
  // Se mês atual é zero e anterior tinha valor, é -100%
  if (current === 0 && previous > 0) {
    return -100;
  }
  
  const change = ((current - previous) / previous) * 100;
  
  // Limitar variação máxima para evitar valores absurdos (ex: 5000%)
  // Limita entre -100% e 999%
  return Math.round(Math.min(Math.max(change, -100), 999));
}

/**
 * Formata horas para exibição (ex: 142h)
 */
export function formatHours(hours: number): string {
  return `${Math.round(hours)}h`;
}

/**
 * Formata valor monetário para exibição (ex: R$ 28.400)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formata valor monetário por hora (ex: R$ 200/h)
 */
export function formatCurrencyPerHour(value: number): string {
  return `${formatCurrency(value)}/h`;
}

/**
 * Calcula total de horas trabalhadas em um período
 */
export function calculateTotalHours(atuacoes: Atuacao[], filterFn: (dateISO: string) => boolean): number {
  return atuacoes
    .filter((atuacao) => filterFn(atuacao.data))
    .reduce((total, atuacao) => total + (atuacao.horasUtilizadas || 0), 0);
}

/**
 * Calcula receita total de faturas pagas em um período
 */
export function calculateRevenue(
  faturas: Fatura[],
  filterFn: (dateISO: string) => boolean
): number {
  return faturas
    .filter((fatura) => {
      if (fatura.status !== "pago" || !fatura.dataPagamento) {
        return false;
      }
      return filterFn(fatura.dataPagamento);
    })
    .reduce((total, fatura) => total + fatura.valor, 0);
}

/**
 * Conta projetos criados em um período
 */
export function countProjectsCreated(projetos: Projeto[], filterFn: (dateISO: string) => boolean): number {
  return projetos.filter((projeto) => filterFn(projeto.createdAt)).length;
}

/**
 * Formata timestamp relativo (ex: "2 horas atrás", "Ontem")
 */
export function formatRelativeTime(dateISO: string): string {
  const date = parseISO(dateISO);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) {
    return "Agora";
  }
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? "minuto" : "minutos"} atrás`;
  }
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? "hora" : "horas"} atrás`;
  }
  if (diffInDays === 1) {
    return "Ontem";
  }
  if (diffInDays < 7) {
    return `${diffInDays} dias atrás`;
  }
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} ${weeks === 1 ? "semana" : "semanas"} atrás`;
  }
  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `${months} ${months === 1 ? "mês" : "meses"} atrás`;
  }
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

/**
 * Calcula média por hora (receita / horas)
 */
export function calculateAveragePerHour(revenue: number, hours: number): number {
  if (hours === 0) return 0;
  return revenue / hours;
}

