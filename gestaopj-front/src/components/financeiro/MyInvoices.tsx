"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { memberInvoiceService } from "@/services/memberInvoiceService";
import { MemberInvoice } from "@/types/memberInvoice";
import { StatusFatura } from "@/types";
import { format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFormatDate } from "@/hooks/useFormatDate";

export default function MyInvoices() {
  const { user } = useAuth();
  const { company } = useCompany();
  const { formatDate } = useFormatDate();
  const [invoices, setInvoices] = useState<MemberInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [filters, setFilters] = useState({
    periodoInicio: "",
    periodoFim: "",
    status: "fatura_gerada" as StatusFatura | "all",
  });

  useEffect(() => {
    if (!user || !company) return;
    loadInvoices();
  }, [user, company]);

  const loadInvoices = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userInvoices = await memberInvoiceService.findByUserId(user.id);
      // Filtrar apenas faturas da empresa atual
      const companyInvoices = userInvoices.filter(
        (inv) => inv.companyId === company?.id
      );
      setInvoices(companyInvoices);
    } catch (error) {
      console.error("Erro ao carregar faturas:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const toggleLembrete = async (invoice: MemberInvoice, lembreteId: string) => {
    if (!user) return;

    const currentLembretes = invoice.lembretes || [];
    const newLembretes = currentLembretes.map((l) =>
      l.id === lembreteId ? { ...l, concluido: !l.concluido } : l
    );

    try {
      await memberInvoiceService.update(invoice.id, { lembretes: newLembretes });
      await loadInvoices();
    } catch (error) {
      console.error("Erro ao atualizar lembrete:", error);
    }
  };

  // Filtrar faturas
  const invoicesFiltradas = useMemo(() => {
    return invoices.filter((invoice) => {
      // Filtro por Status (padrão: pendente)
      if (filters.status !== "all" && invoice.status !== filters.status) {
        return false;
      }

      // Filtro por Período (periodoInicio e periodoFim)
      if (filters.periodoInicio || filters.periodoFim) {
        const periodoInicio = invoice.periodoInicio.includes("T")
          ? invoice.periodoInicio.split("T")[0]
          : invoice.periodoInicio;
        const periodoFim = invoice.periodoFim.includes("T")
          ? invoice.periodoFim.split("T")[0]
          : invoice.periodoFim;

        if (filters.periodoInicio && periodoInicio < filters.periodoInicio) return false;
        if (filters.periodoFim && periodoFim > filters.periodoFim) return false;
      }

      return true;
    });
  }, [invoices, filters]);

  // Calcular totalizadores baseado nas faturas filtradas
  const totalizadores = useMemo(() => {
    const hoje = startOfDay(new Date());
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    let recebidoMes = 0;
    let aReceber = 0;
    let atrasado = 0;

    invoicesFiltradas.forEach((invoice) => {
      const dataVenc = parseISO(invoice.dataVencimento);
      const dataPag = invoice.dataPagamento ? parseISO(invoice.dataPagamento) : null;

      // Recebido no Mês (baseado na data de pagamento)
      if (
        invoice.status === "pago" &&
        dataPag &&
        dataPag.getMonth() === mesAtual &&
        dataPag.getFullYear() === anoAtual
      ) {
        recebidoMes += invoice.valor;
      }

      // Em Atraso (não pago e vencido)
      if (invoice.status !== "pago" && invoice.status !== "cancelado" && dataVenc < hoje) {
        atrasado += invoice.valor;
      }

      // A Receber (pendente ou fatura_gerada)
      if (invoice.status === "pendente" || invoice.status === "fatura_gerada") {
        aReceber += invoice.valor;
      }
    });

    return { recebidoMes, aReceber, atrasado };
  }, [invoicesFiltradas]);

  const clearFilters = () => {
    setFilters({
      periodoInicio: "",
      periodoFim: "",
      status: "fatura_gerada",
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-600 dark:text-gray-400">Carregando faturas...</p>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <div className="flex justify-center mb-4">
          <svg
            className="w-16 h-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Nenhuma fatura encontrada
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Suas faturas aparecerão aqui quando forem geradas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
              Período Início
            </label>
            <input
              type="date"
              value={filters.periodoInicio}
              onChange={(e) => setFilters({ ...filters, periodoInicio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
              Período Fim
            </label>
            <input
              type="date"
              value={filters.periodoFim}
              onChange={(e) => setFilters({ ...filters, periodoFim: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as StatusFatura | "all" })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="all">Todos</option>
              <option value="fatura_gerada">Fatura Gerada</option>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
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

      {/* Totalizadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Recebido este Mês
          </h3>
          <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalizadores.recebidoMes)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            A Receber
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalizadores.aReceber)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Em Atraso
          </h3>
          <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(totalizadores.atrasado)}
          </p>
        </div>
      </div>

      {/* Listagem de Faturas */}
      {invoicesFiltradas.length === 0 ? (
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
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Minhas Faturas
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Título
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Período
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vencimento
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Horas
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Valor
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Lembretes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {invoicesFiltradas.map((invoice) => {
                  const isLate =
                    invoice.status !== "pago" && invoice.status !== "cancelado" &&
                    parseISO(invoice.dataVencimento) < new Date();
                  const pendingLembretes = (invoice.lembretes || []).filter(
                    (l) => !l.concluido
                  );

                  return (
                    <tr
                      key={invoice.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {invoice.titulo}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {format(parseISO(invoice.periodoInicio), "dd/MM/yyyy", { locale: ptBR })} a{" "}
                          {format(parseISO(invoice.periodoFim), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(invoice.dataVencimento)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {invoice.tipoCalculo === "horas" ? `${invoice.horasTrabalhadas.toFixed(1)}h` : "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(invoice.valor)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            invoice.status === "pago"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                              : isLate
                              ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                              : invoice.status === "cancelado"
                              ? "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300"
                              : invoice.status === "fatura_gerada"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                          }`}
                        >
                          {invoice.status === "pago"
                            ? "Pago"
                            : isLate
                            ? "Atrasado"
                            : invoice.status === "cancelado"
                            ? "Cancelado"
                            : invoice.status === "fatura_gerada"
                            ? "Fatura Gerada"
                            : "Pendente"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {pendingLembretes.length > 0 ? (
                            <span className="text-yellow-600 dark:text-yellow-400">
                              {pendingLembretes.length} pendente{pendingLembretes.length > 1 ? "s" : ""}
                            </span>
                          ) : invoice.lembretes && invoice.lembretes.length > 0 ? (
                            <span className="text-green-600 dark:text-green-400">Concluído</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
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

