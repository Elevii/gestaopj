"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/contexts/ToastContext";
import { memberInvoiceService } from "@/services/memberInvoiceService";
import { userService } from "@/services/userService";
import { MemberInvoice } from "@/types/memberInvoice";
import { User } from "@/types/user";
import { StatusFatura } from "@/types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFormatDate } from "@/hooks/useFormatDate";
import Link from "next/link";
import AddMembersToInvoiceModal from "@/components/financeiro/AddMembersToInvoiceModal";
import { InvoiceFilters } from "@/components/financeiro/InvoiceFilters";
import { InvoiceStats } from "@/components/financeiro/InvoiceStats";
import { ReopenPeriodModal } from "@/components/financeiro/ReopenPeriodModal";
import { ConfirmationModal } from "@/components/financeiro/ConfirmationModal";

interface InvoiceWithUser extends MemberInvoice {
  user: User | null;
}

export default function MemberInvoicesDetailPage() {
  const params = useParams();
  const { company } = useCompany();
  const { showToast } = useToast();
  const { formatDate } = useFormatDate();
  const [invoices, setInvoices] = useState<InvoiceWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  
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
        if (invoice.status !== filterStatus) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, searchName, filterStatus]);

  const totalizadores = useMemo(() => {
    return invoices.reduce(
      (acc, inv) => {
        acc.total += inv.valor;
        if (inv.status === "pago") {
          acc.pago += inv.valor;
        } else if (inv.status === "pendente" || inv.status === "fatura_gerada") {
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
      (inv) => inv.status !== "pago" && inv.status !== "cancelado"
    );

    if (pendingInvoices.length === 0) {
      showToast("Não há faturas pendentes para pagar", "info");
      return;
    }

    setActionLoading({ bulk: true });
    try {
      const now = new Date().toISOString();
      await Promise.all(
        pendingInvoices.map((inv) =>
          memberInvoiceService.update(inv.id, {
            status: "pago",
            dataPagamento: now,
          })
        )
      );
      showToast(
        `${pendingInvoices.length} fatura(s) marcada(s) como paga(s) com sucesso!`,
        "success"
      );
      await reloadInvoices();
    } catch (error) {
      console.error("Erro ao processar pagamento em massa:", error);
      showToast("Erro ao processar pagamento em massa", "error");
    } finally {
      setActionLoading({});
      setShowBulkPaymentModal(false);
    }
  };

  // Pagamento individual
  const handlePayment = async (invoiceId: string) => {
    setActionLoading({ [invoiceId]: true });
    try {
      await memberInvoiceService.update(invoiceId, {
        status: "pago",
        dataPagamento: new Date().toISOString(),
      });
      showToast("Fatura marcada como paga com sucesso!", "success");
      await reloadInvoices();
    } catch (error) {
      console.error("Erro ao processar pagamento:", error);
      showToast("Erro ao processar pagamento", "error");
    } finally {
      setActionLoading({});
    }
  };

  // Cancelar fatura
  const handleCancel = async (invoiceId: string) => {
    setActionLoading({ [invoiceId]: true });
    try {
      await memberInvoiceService.update(invoiceId, {
        status: "cancelado",
      });
      showToast("Fatura cancelada com sucesso!", "success");
      await reloadInvoices();
    } catch (error) {
      console.error("Erro ao cancelar fatura:", error);
      showToast("Erro ao cancelar fatura", "error");
    } finally {
      setActionLoading({});
    }
  };

  // Verificar se todas as faturas estão pagas
  const allInvoicesPaid = useMemo(() => {
    return invoices.every(
      (inv) => inv.status === "pago"
    );
  }, [invoices]);

  // Reabrir período (mudar todas as faturas de "pago" para "pendente")
  const handleReopenPeriod = async () => {
    if (!allInvoicesPaid) {
      showToast("Só é possível reabrir um período quando todas as faturas estiverem pagas", "warning");
      return;
    }

    try {
      console.log("🔄 Reabrindo período...");

      // Reabrir todas as faturas pagas
      const paidInvoices = invoices.filter((inv) => inv.status === "pago");

      await Promise.all(
        paidInvoices.map((inv) => memberInvoiceService.reopenInvoice(inv.id))
      );

      console.log("✅ Período reaberto com sucesso");
      showToast("Período reaberto! Todas as faturas voltaram para 'Pendente'", "success");
      await reloadInvoices();
    } catch (error) {
      console.error("Erro ao reabrir período:", error);
      alert("Erro ao reabrir período. Verifique o console.");
    }
  };

  // Verificar se o período tem fatura gerada
  const hasFaturaGerada = useMemo(() => {
    return invoices.some((inv) => inv.status === "fatura_gerada");
  }, [invoices]);

  // IDs dos membros que já têm fatura neste período
  const existingMemberIds = useMemo(() => {
    return invoices.map((inv) => inv.userId);
  }, [invoices]);

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
        <div className="flex gap-3">
          {/* Botão Adicionar Membros - só aparece se houver fatura_gerada */}
          {hasFaturaGerada && (
            <button
              onClick={() => setShowAddMembersModal(true)}
              className="inline-flex items-center px-4 py-2 border border-indigo-600 dark:border-indigo-500 text-sm font-medium rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
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
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              Adicionar Membros
            </button>
          )}

          {/* Botão Reabrir Período - só aparece se todas estiverem pagas */}
          {allInvoicesPaid && (
            <button
              onClick={() => setShowReopenModal(true)}
              className="inline-flex items-center px-4 py-2 border border-yellow-600 dark:border-yellow-500 text-sm font-medium rounded-lg text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reabrir Período
            </button>
          )}

          {/* Botão Pagar Todas Pendentes */}
          {invoices.filter(
            (inv) => inv.status !== "pago" && inv.status !== "cancelado"
          ).length > 0 && (
            <button
              onClick={() => setShowBulkPaymentModal(true)}
              disabled={actionLoading.bulk}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading.bulk ? (
                <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
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
              )}
              {actionLoading.bulk ? "Processando..." : "Pagar Todas Pendentes"}
            </button>
          )}
        </div>
      </div>

      {/* Totalizadores */}
      <InvoiceStats
        total={totalizadores.total}
        pago={totalizadores.pago}
        pendente={totalizadores.pendente}
        formatCurrency={formatCurrency}
      />

      {/* Listagem de Faturas */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Faturas ({filteredInvoices.length} {filteredInvoices.length === 1 ? "membro" : "membros"})
            </h2>
          </div>
          
          {/* Filtros */}
          <InvoiceFilters
            searchName={searchName}
            onSearchNameChange={setSearchName}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            onClearFilters={() => {
              setSearchName("");
              setFilterStatus("all");
            }}
          />
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
                  invoice.status !== "pago" && invoice.status !== "cancelado" &&
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
                          invoice.status === "pago"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                        }`}
                      >
                        {invoice.status === "pago"
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
                            invoice.status === "pago"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                              : invoice.status === "cancelado"
                              ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              : isLate
                              ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                              : invoice.status === "fatura_gerada"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                          }`}
                        >
                          {invoice.status === "pago"
                            ? "Pago"
                            : invoice.status === "cancelado"
                            ? "Cancelado"
                            : isLate
                            ? "Atrasado"
                            : invoice.status === "fatura_gerada"
                            ? "Fatura Gerada"
                            : "Pendente"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.status !== "pago" && invoice.status !== "cancelado" && (
                          <>
                            <button
                              onClick={() => handlePayment(invoice.id)}
                              disabled={!!actionLoading[invoice.id]}
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              title="Marcar como pago"
                            >
                              {actionLoading[invoice.id] ? (
                                <>
                                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  <span className="text-xs">...</span>
                                </>
                              ) : (
                                "Pagar"
                              )}
                            </button>
                            <button
                              onClick={() => handleCancel(invoice.id)}
                              disabled={!!actionLoading[invoice.id]}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Cancelar fatura"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {invoice.status === "pago" && (
                          <span className="text-gray-400 text-xs">Pago</span>
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

      {/* Modal Adicionar Membros */}
      <AddMembersToInvoiceModal
        isOpen={showAddMembersModal}
        onClose={() => setShowAddMembersModal(false)}
        periodoInicio={periodoInicio}
        periodoFim={periodoFim}
        existingMemberIds={existingMemberIds}
        onMembersAdded={reloadInvoices}
      />

      {/* Modal Reabrir Período */}
      <ReopenPeriodModal
        isOpen={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        onConfirm={handleReopenPeriod}
        invoices={invoices}
        formatCurrency={formatCurrency}
      />

      {/* Modal Pagamento em Massa */}
      <ConfirmationModal
        isOpen={showBulkPaymentModal}
        onClose={() => setShowBulkPaymentModal(false)}
        onConfirm={handleBulkPayment}
        title="Pagamento em Massa"
        message={`Deseja marcar ${invoices.filter((inv) => inv.status !== "pago" && inv.status !== "cancelado").length} fatura(s) como pagas?\n\nEsta ação irá atualizar o status de todas as faturas pendentes para "Pago" e registrar a data de pagamento.`}
        confirmText="Confirmar Pagamento"
        type="info"
      />
    </div>
  );
}

