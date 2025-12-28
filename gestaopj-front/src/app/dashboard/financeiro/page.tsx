"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useFaturamento } from "@/contexts/FaturamentoContext";
import { useProjetos } from "@/contexts/ProjetoContext";
import EmptyState from "@/components/dashboard/EmptyState";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFormatDate } from "@/hooks/useFormatDate";

export default function FinanceiroPage() {
  const { faturas, loading, updateFatura, deleteFaturas } = useFaturamento();
  const { projetos } = useProjetos();
  const { formatDate } = useFormatDate();
  const [selectedFaturas, setSelectedFaturas] = useState<Set<string>>(new Set());

  // Filtros
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    projetoId: "",
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getProjectName = (id: string) => {
    const proj = projetos.find((p) => p.id === id);
    return proj ? proj.titulo : "Projeto não encontrado";
  };

  // Lógica de filtragem das faturas
  const faturasFiltradas = useMemo(() => {
    return faturas.filter((fatura) => {
      // Filtro por Projeto
      if (filters.projetoId && fatura.projetoId !== filters.projetoId) return false;

      // Filtro por Data
      if (filters.startDate || filters.endDate) {
        const dataVenc = parseISO(fatura.dataVencimento);
        const start = filters.startDate ? startOfDay(parseISO(filters.startDate)) : null;
        const end = filters.endDate ? endOfDay(parseISO(filters.endDate)) : null;

        if (start && dataVenc < start) return false;
        if (end && dataVenc > end) return false;
      }

      return true;
    });
  }, [faturas, filters, projetos]);

  // Resumo dinâmico baseado nos filtros
  const resumoFiltrado = useMemo(() => {
    const hoje = startOfDay(new Date());
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    let recebidoMes = 0;
    let aReceber = 0;
    let atrasado = 0;

    faturasFiltradas.forEach((f) => {
      const dataVenc = parseISO(f.dataVencimento);
      const dataPag = f.dataPagamento ? parseISO(f.dataPagamento) : null;

      // Recebido no Mês (baseado na data de pagamento)
      if (
        f.status === "pago" &&
        dataPag &&
        dataPag.getMonth() === mesAtual &&
        dataPag.getFullYear() === anoAtual
      ) {
        recebidoMes += f.valor;
      }

      // Em Atraso (não pago e vencido)
      if (f.status !== "pago" && f.status !== "cancelado" && dataVenc < hoje) {
        atrasado += f.valor;
      }

      // A Receber (pendente ou atrasado)
      if (f.status === "pendente" || f.status === "atrasado") {
        aReceber += f.valor;
      }
    });

    return { recebidoMes, aReceber, atrasado };
  }, [faturasFiltradas]);

  // Ordenação
  const sortedFaturas = useMemo(() => {
    return [...faturasFiltradas].sort(
      (a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()
    );
  }, [faturasFiltradas]);

  const isNearDueDate = (dateString: string) => {
    const today = new Date();
    const due = new Date(dateString);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 5;
  };

  const isLate = (fatura: any) => {
    if (fatura.status === "pago" || fatura.status === "cancelado") return false;
    const today = startOfDay(new Date());
    const due = parseISO(fatura.dataVencimento);
    return due < today;
  };

  const toggleSelectAll = () => {
    if (selectedFaturas.size === sortedFaturas.length) {
      setSelectedFaturas(new Set());
    } else {
      setSelectedFaturas(new Set(sortedFaturas.map((f) => f.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedFaturas);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFaturas(newSelected);
  };

  const handleBulkDelete = async () => {
    if (
      confirm(
        `Tem certeza que deseja excluir as ${selectedFaturas.size} faturas selecionadas?`
      )
    ) {
      await deleteFaturas(Array.from(selectedFaturas));
      setSelectedFaturas(new Set());
    }
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      projetoId: "",
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Financeiro
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Controle de contas a receber
          </p>
        </div>
        <div className="flex space-x-3">
          {selectedFaturas.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors dark:bg-gray-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-gray-700"
            >
              Excluir Selecionadas ({selectedFaturas.size})
            </button>
          )}
          <Link
            href="/dashboard/financeiro/novo"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Nova Fatura
          </Link>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
              Início (Venc.)
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
              Fim (Venc.)
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
              Projeto
            </label>
            <select
              value={filters.projetoId}
              onChange={(e) => setFilters({ ...filters, projetoId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">Todos</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={clearFilters}
              className="w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Resumo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Recebido este Mês
          </h3>
          <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(resumoFiltrado.recebidoMes)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            A Receber
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(resumoFiltrado.aReceber)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Em Atraso
          </h3>
          <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(resumoFiltrado.atrasado)}
          </p>
        </div>
      </div>

      {/* Listagem */}
      {sortedFaturas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhum resultado encontrado</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Tente ajustar os filtros para encontrar o que procura.</p>
          <button
            onClick={clearFilters}
            className="mt-4 text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Limpar todos os filtros
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th scope="col" className="px-6 py-3 w-4">
                    <input
                      type="checkbox"
                      checked={
                        selectedFaturas.size === sortedFaturas.length &&
                        sortedFaturas.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Vencimento
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Fatura / Projeto
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Valor
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Checklist
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedFaturas.map((fatura) => {
                  const late = isLate(fatura);
                  const nearDue = isNearDueDate(fatura.dataVencimento);
                  const showCobrancaAlert =
                    fatura.status === "pendente" &&
                    nearDue &&
                    !fatura.cobrancaEnviada;

                  // Closest PENDING reminder
                  const nextReminder = (fatura.lembretes || [])
                    .filter((l: any) => !l.concluido)
                    .sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime())[0];

                  const isReminderLate = nextReminder && parseISO(nextReminder.data) < startOfDay(new Date());

                  return (
                    <tr
                      key={fatura.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        // Evita navegar se clicou em um botão ou checkbox
                        if (
                          (e.target as HTMLElement).closest("button") ||
                          (e.target as HTMLElement).closest("input[type='checkbox']")
                        )
                          return;
                        window.location.href = `/dashboard/financeiro/${fatura.id}`;
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedFaturas.has(fatura.id)}
                          onChange={() => toggleSelect(fatura.id)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            fatura.status === "pago"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                              : late || fatura.status === "atrasado"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                              : fatura.status === "cancelado"
                              ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                          }`}
                        >
                          {fatura.status === "pago"
                            ? "Pago"
                            : late || fatura.status === "atrasado"
                            ? "Atrasado"
                            : fatura.status === "cancelado"
                            ? "Cancelado"
                            : "Pendente"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(fatura.dataVencimento)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400">
                            {fatura.titulo}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {getProjectName(fatura.projetoId)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(fatura.valor)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col gap-1 max-w-[150px]">
                          {/* Next pending reminder - Primary focus */}
                          {nextReminder ? (
                            <>
                              <span
                                title={`Próximo: ${nextReminder.titulo}`}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 truncate"
                              >
                                ⏳ {nextReminder.titulo}
                              </span>
                              <span
                                className={`text-[10px] mt-0.5 flex items-center ${
                                  isReminderLate
                                    ? "text-red-600 dark:text-red-400 font-bold"
                                    : "text-gray-500"
                                }`}
                              >
                                {isReminderLate && (
                                  <svg
                                    className="w-3 h-3 mr-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                  </svg>
                                )}
                                {format(parseISO(nextReminder.data), "dd/MM/yyyy")}
                              </span>
                            </>
                          ) : fatura.status === "pago" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800">
                              ✅ Tudo pronto
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[10px]">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {/* Botão de Cobrança - só se pendente e cobrancaEnviada=false e perto do vencimento */}
                          {showCobrancaAlert && (
                            <button
                              onClick={() =>
                                updateFatura(fatura.id, {
                                  cobrancaEnviada: true,
                                })
                              }
                              title="Marcar cobrança como enviada"
                              className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400"
                            >
                              📧 Cobrança
                            </button>
                          )}

                          {/* SEMPRE mostra Registrar Pagamento se não estiver pago ou cancelado */}
                          {fatura.status !== "pago" &&
                            fatura.status !== "cancelado" && (
                              <button
                                onClick={() =>
                                  updateFatura(fatura.id, {
                                    dataPagamento: new Date().toISOString(),
                                    status: "pago",
                                  })
                                }
                                className="text-green-600 hover:text-green-900 dark:text-green-400 font-bold"
                              >
                                Registrar Pagamento
                              </button>
                            )}

                          <Link
                            href={`/dashboard/financeiro/${fatura.id}`}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
