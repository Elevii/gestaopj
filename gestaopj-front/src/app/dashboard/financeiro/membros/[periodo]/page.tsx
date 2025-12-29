"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCompany } from "@/contexts/CompanyContext";
import { memberInvoiceService } from "@/services/memberInvoiceService";
import { userService } from "@/services/userService";
import { MemberInvoice } from "@/types/memberInvoice";
import { User } from "@/types/user";
import { StatusFatura } from "@/types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFormatDate } from "@/hooks/useFormatDate";
import Link from "next/link";

interface InvoiceWithUser extends MemberInvoice {
  user: User | null;
}

export default function MemberInvoicesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { company } = useCompany();
  const { formatDate } = useFormatDate();
  const [invoices, setInvoices] = useState<InvoiceWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [searchName, setSearchName] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFatura | "all">("all");

  const periodoKey = params.periodo as string;
  const [periodoInicio, periodoFim] = periodoKey
    ? decodeURIComponent(periodoKey).split("_")
    : ["", ""];

  useEffect(() => {
    if (!company || !periodoInicio || !periodoFim) return;

    const loadInvoices = async () => {
      try {
        setLoading(true);
        const allInvoices = await memberInvoiceService.findByCompanyId(company.id);
        
        // Filtrar faturas do período
        const periodInvoices = allInvoices.filter(
          (inv) =>
            inv.periodoInicio === periodoInicio && inv.periodoFim === periodoFim
        );

        // Carregar informações dos usuários
        const invoicesWithUsers: InvoiceWithUser[] = await Promise.all(
          periodInvoices.map(async (invoice) => {
            const user = await userService.findById(invoice.userId);
            return {
              ...invoice,
              user: user || null,
            };
          })
        );

        // Ordenar por nome do usuário
        invoicesWithUsers.sort((a, b) => {
          const nameA = a.user?.name || "";
          const nameB = b.user?.name || "";
          return nameA.localeCompare(nameB);
        });

        setInvoices(invoicesWithUsers);
      } catch (error) {
        console.error("Erro ao carregar faturas:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, [company, periodoInicio, periodoFim]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Filtrar faturas
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      // Filtro por nome
      if (searchName) {
        const searchLower = searchName.toLowerCase();
        const userName = invoice.user?.name?.toLowerCase() || "";
        const userEmail = invoice.user?.email?.toLowerCase() || "";
        if (!userName.includes(searchLower) && !userEmail.includes(searchLower)) {
          return false;
        }
      }

      // Filtro por status
      if (filterStatus !== "all") {
        if (filterStatus === "pago") {
          // Incluir tanto "pago" quanto "pagamentos_realizados"
          if (invoice.status !== "pago" && invoice.status !== "pagamentos_realizados") {
            return false;
          }
        } else if (filterStatus === "pagamentos_realizados") {
          // Incluir apenas "pagamentos_realizados"
          if (invoice.status !== "pagamentos_realizados") {
            return false;
          }
        } else {
          if (invoice.status !== filterStatus) {
            return false;
          }
        }
      }

      return true;
    });
  }, [invoices, searchName, filterStatus]);

  const totalizadores = useMemo(() => {
    return invoices.reduce(
      (acc, inv) => {
        acc.total += inv.valor;
        if (inv.status === "pago" || inv.status === "pagamentos_realizados") {
          acc.pago += inv.valor;
        } else if (inv.status === "pendente" || inv.status === "fatura_gerada" || inv.status === "atrasado") {
          acc.pendente += inv.valor;
        }
        return acc;
      },
      { total: 0, pago: 0, pendente: 0 }
    );
  }, [invoices]);

  // Função para recarregar faturas
  const reloadInvoices = async () => {
    if (!company || !periodoInicio || !periodoFim) return;

    try {
      setLoading(true);
      const allInvoices = await memberInvoiceService.findByCompanyId(company.id);
      
      const periodInvoices = allInvoices.filter(
        (inv) =>
          inv.periodoInicio === periodoInicio && inv.periodoFim === periodoFim
      );

      const invoicesWithUsers: InvoiceWithUser[] = await Promise.all(
        periodInvoices.map(async (invoice) => {
          const user = await userService.findById(invoice.userId);
          return {
            ...invoice,
            user: user || null,
          };
        })
      );

      invoicesWithUsers.sort((a, b) => {
        const nameA = a.user?.name || "";
        const nameB = b.user?.name || "";
        return nameA.localeCompare(nameB);
      });

      setInvoices(invoicesWithUsers);
    } catch (error) {
      console.error("Erro ao recarregar faturas:", error);
    } finally {
      setLoading(false);
    }
  };

  // Pagamento em massa
  const handleBulkPayment = async () => {
    const pendingInvoices = invoices.filter(
      (inv) => inv.status !== "pago" && inv.status !== "pagamentos_realizados" && inv.status !== "cancelado"
    );

    if (pendingInvoices.length === 0) {
      alert("Não há faturas pendentes para pagar.");
      return;
    }

    if (
      !confirm(
        `Deseja marcar como pagas ${pendingInvoices.length} faturas pendentes?`
      )
    ) {
      return;
    }

    try {
      const now = new Date().toISOString();
      await Promise.all(
        pendingInvoices.map((inv) =>
          memberInvoiceService.update(inv.id, {
            status: "pagamentos_realizados",
            dataPagamento: now,
          })
        )
      );
      await reloadInvoices();
    } catch (error) {
      console.error("Erro ao processar pagamento em massa:", error);
      alert("Erro ao processar pagamento em massa.");
    }
  };

  // Pagamento individual
  const handlePayment = async (invoiceId: string) => {
    if (!confirm("Deseja marcar esta fatura como paga?")) {
      return;
    }

    try {
      await memberInvoiceService.update(invoiceId, {
        status: "pagamentos_realizados",
        dataPagamento: new Date().toISOString(),
      });
      await reloadInvoices();
    } catch (error) {
      console.error("Erro ao processar pagamento:", error);
      alert("Erro ao processar pagamento.");
    }
  };

  // Cancelar fatura
  const handleCancel = async (invoiceId: string) => {
    if (!confirm("Deseja cancelar esta fatura?")) {
      return;
    }

    try {
      await memberInvoiceService.update(invoiceId, {
        status: "cancelado",
      });
      await reloadInvoices();
    } catch (error) {
      console.error("Erro ao cancelar fatura:", error);
      alert("Erro ao cancelar fatura.");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">Carregando detalhes...</p>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Nenhuma fatura encontrada para este período
          </h3>
          <Link
            href="/dashboard/gestao-financeira"
            className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Voltar para Gestão Financeira
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/gestao-financeira"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2 inline-flex items-center"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Voltar para Financeiro
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Detalhamento de Faturas de Membros
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Período: {format(parseISO(periodoInicio), "dd/MM/yyyy", { locale: ptBR })} a{" "}
            {format(parseISO(periodoFim), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
        <div>
          {invoices.filter(
            (inv) => inv.status !== "pago" && inv.status !== "pagamentos_realizados" && inv.status !== "cancelado"
          ).length > 0 && (
            <button
              onClick={handleBulkPayment}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Pagar Todas Pendentes
            </button>
          )}
        </div>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalizadores.total)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Pago
          </h3>
          <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalizadores.pago)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Pendente
          </h3>
          <p className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {formatCurrency(totalizadores.pendente)}
          </p>
        </div>
      </div>

      {/* Listagem de Faturas */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Faturas ({filteredInvoices.length} {filteredInvoices.length === 1 ? "membro" : "membros"})
            </h2>
          </div>
          
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                Pesquisar por Nome
              </label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Digite o nome ou email..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                Filtrar por Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StatusFatura | "all")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="all">Todos</option>
                <option value="fatura_gerada">Fatura Gerada</option>
                <option value="pagamentos_realizados">Pagamentos Realizados</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchName("");
                  setFilterStatus("all");
                }}
                className="w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Usuário
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Tipo
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Horas
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
                  Valor Manual
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
                  Pago
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
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredInvoices.map((invoice) => {
                const isLate =
                  invoice.status !== "pago" && invoice.status !== "pagamentos_realizados" &&
                  parseISO(invoice.dataVencimento) < new Date();

                return (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {invoice.user?.name || "Usuário não encontrado"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {invoice.user?.email || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                          {invoice.tipoCalculo === "horas" ? "Horista" : "Fixo"}
                        </span>
                        {invoice.tipoCalculo === "horas" && invoice.valorPorHora && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatCurrency(invoice.valorPorHora)}/h
                          </span>
                        )}
                        {invoice.tipoCalculo === "fixo" && invoice.valorFixo && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Fixo: {formatCurrency(invoice.valorFixo)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {invoice.tipoCalculo === "horas" ? (
                        <span>{invoice.horasTrabalhadas.toFixed(1)}h</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(invoice.valor)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          invoice.valorManual
                            ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {invoice.valorManual ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(invoice.dataVencimento)}
                      {isLate && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Vencido
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          invoice.status === "pago" || invoice.status === "pagamentos_realizados"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                        }`}
                      >
                        {invoice.status === "pago" || invoice.status === "pagamentos_realizados"
                          ? "Sim"
                          : "Não"}
                      </span>
                      {invoice.dataPagamento && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatDate(invoice.dataPagamento)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            invoice.status === "pago" || invoice.status === "pagamentos_realizados"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                              : invoice.status === "cancelado"
                              ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              : isLate || invoice.status === "atrasado"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                              : invoice.status === "fatura_gerada"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                          }`}
                        >
                          {invoice.status === "pago" || invoice.status === "pagamentos_realizados"
                            ? "Pagamentos Realizados"
                            : invoice.status === "cancelado"
                            ? "Cancelado"
                            : isLate || invoice.status === "atrasado"
                            ? "Atrasado"
                            : invoice.status === "fatura_gerada"
                            ? "Fatura Gerada"
                            : "Pendente"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.status !== "pago" && invoice.status !== "pagamentos_realizados" && invoice.status !== "cancelado" && (
                          <>
                            <button
                              onClick={() => handlePayment(invoice.id)}
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 font-medium"
                              title="Marcar como pago"
                            >
                              Pagar
                            </button>
                            <button
                              onClick={() => handleCancel(invoice.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium"
                              title="Cancelar fatura"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {(invoice.status === "pago" || invoice.status === "pagamentos_realizados") && (
                          <span className="text-gray-400 text-xs">Pagamentos Realizados</span>
                        )}
                        {invoice.status === "cancelado" && (
                          <span className="text-gray-400 text-xs">Cancelado</span>
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
    </div>
  );
}

