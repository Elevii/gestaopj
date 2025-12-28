"use client";

import { useMemo } from "react";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useAtividades } from "@/contexts/AtividadeContext";
import { useAtuacoes } from "@/contexts/AtuacaoContext";
import { useFaturamento } from "@/contexts/FaturamentoContext";
import {
  isInCurrentMonth,
  isInPreviousMonth,
  calculatePercentageChange,
  formatHours,
  formatCurrency,
  formatCurrencyPerHour,
  calculateTotalHours,
  calculateRevenue,
  countProjectsCreated,
  calculateAveragePerHour,
} from "@/utils/dashboardMetrics";

export interface DashboardMetrics {
  projetosAtivos: {
    value: number;
    change?: {
      value: number;
      type: "increase" | "decrease";
      period: string;
    };
  };
  horasTotais: {
    value: string;
    change?: {
      value: number;
      type: "increase" | "decrease";
      period: string;
    };
  };
  receitaTotal: {
    value: string;
    change?: {
      value: number;
      type: "increase" | "decrease";
      period: string;
    };
  };
  receitaHora: {
    value: string;
    change?: {
      value: number;
      type: "increase" | "decrease";
      period: string;
    };
  };
  projetosNovos: {
    value: number;
    change?: {
      value: number;
      type: "increase" | "decrease";
      period: string;
    };
  };
}

export function useDashboardMetrics(): {
  metrics: DashboardMetrics;
  loading: boolean;
} {
  const { projetos, loading: projetosLoading } = useProjetos();
  const { atividades, loading: atividadesLoading } = useAtividades();
  const { atuacoes, loading: atuacoesLoading } = useAtuacoes();
  const { faturas, loading: faturasLoading } = useFaturamento();

  const loading = projetosLoading || atividadesLoading || atuacoesLoading || faturasLoading;

  const metrics = useMemo(() => {
    // Projetos Ativos - não mostra variação pois é um total acumulado
    // (não faz sentido comparar total de projetos com projetos criados no mês anterior)
    const projetosAtivosAtual = projetos.length;

    // Horas Trabalhadas
    const horasAtual = calculateTotalHours(atuacoes, isInCurrentMonth);
    const horasAnterior = calculateTotalHours(atuacoes, isInPreviousMonth);
    const horasChange = calculatePercentageChange(horasAtual, horasAnterior);

    // Receita Total
    const receitaAtual = calculateRevenue(faturas, isInCurrentMonth);
    const receitaAnterior = calculateRevenue(faturas, isInPreviousMonth);
    const receitaChange = calculatePercentageChange(receitaAtual, receitaAnterior);

    // Média por Hora
    const mediaHoraAtual = calculateAveragePerHour(receitaAtual, horasAtual);
    const mediaHoraAnterior = calculateAveragePerHour(receitaAnterior, horasAnterior);
    const mediaHoraChange = calculatePercentageChange(mediaHoraAtual, mediaHoraAnterior);

    // Projetos Novos
    const projetosNovosAtual = countProjectsCreated(projetos, isInCurrentMonth);
    const projetosNovosAnterior = countProjectsCreated(projetos, isInPreviousMonth);
    const projetosNovosChange = calculatePercentageChange(projetosNovosAtual, projetosNovosAnterior);

    return {
      projetosAtivos: {
        value: projetosAtivosAtual,
        // Não mostra variação para projetos ativos (é um total acumulado)
        change: undefined,
      },
      horasTotais: {
        value: formatHours(horasAtual),
        change:
          horasChange !== null && horasAnterior > 0 && horasAtual > 0
            ? {
                value: Math.abs(horasChange),
                type: (horasChange >= 0 ? "increase" : "decrease") as "increase" | "decrease",
                period: "mês passado",
              }
            : undefined,
      },
      receitaTotal: {
        value: formatCurrency(receitaAtual),
        change:
          receitaChange !== null && receitaAnterior > 0 && receitaAtual > 0
            ? {
                value: Math.abs(receitaChange),
                type: (receitaChange >= 0 ? "increase" : "decrease") as "increase" | "decrease",
                period: "mês passado",
              }
            : undefined,
      },
      receitaHora: {
        value: formatCurrencyPerHour(mediaHoraAtual),
        change:
          mediaHoraChange !== null && mediaHoraAnterior > 0 && mediaHoraAtual > 0
            ? {
                value: Math.abs(mediaHoraChange),
                type: (mediaHoraChange >= 0 ? "increase" : "decrease") as "increase" | "decrease",
                period: "mês passado",
              }
            : undefined,
      },
      projetosNovos: {
        value: projetosNovosAtual,
        change:
          projetosNovosChange !== null && projetosNovosAnterior > 0 && projetosNovosAtual > 0
            ? {
                value: Math.abs(projetosNovosChange),
                type: (projetosNovosChange >= 0 ? "increase" : "decrease") as "increase" | "decrease",
                period: "mês passado",
              }
            : undefined,
      },
    };
  }, [projetos, atuacoes, faturas]);

  return { metrics, loading };
}

