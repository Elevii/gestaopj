"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import MemberPaymentClosure from "@/components/financeiro/MemberPaymentClosure";
import AddMembersToInvoiceModal from "@/components/financeiro/AddMembersToInvoiceModal";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  setDate,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { memberInvoiceService } from "@/services/memberInvoiceService";
import { userService } from "@/services/userService";
import { MemberInvoice } from "@/types/memberInvoice";
import { User } from "@/types/user";

interface BillingPeriod {
  inicio: string; // ISO date
  fim: string; // ISO date
  label: string; // Label formatado para exibição
  value: string; // Valor único para identificação
}

// Função auxiliar para gerar períodos de faturamento
function generateBillingPeriods(
  diaInicio: number | undefined,
  diaFim: number | undefined,
  startMonthOffset: number = -1, // -1 = 1 mês antes
  endMonthOffset: number = 12 // 12 meses à frente
): BillingPeriod[] {
  const periods: BillingPeriod[] = [];
  const now = new Date();

  // Se não tiver configuração, usar padrão: primeiro e último dia do mês
  const defaultDiaInicio = diaInicio || 1;
  const defaultDiaFim = diaFim || 31;

  for (let i = startMonthOffset; i <= endMonthOffset; i++) {
    const baseMonth = startOfMonth(addMonths(now, i));

    let inicio: Date;
    let fim: Date;

    // Se o dia de início é maior que o dia de fim, o período vai do dia início até o dia fim do mês seguinte
    // Exemplo: dia 26 até dia 25 do mês seguinte
    if (defaultDiaInicio > defaultDiaFim) {
      // Início: dia de início no mês atual
      const inicioMonth = baseMonth;
      inicio = setDate(
        inicioMonth,
        Math.min(defaultDiaInicio, endOfMonth(inicioMonth).getDate())
      );

      // Fim: dia de fim no mês seguinte
      const fimMonth = addMonths(baseMonth, 1);
      fim = setDate(
        fimMonth,
        Math.min(defaultDiaFim, endOfMonth(fimMonth).getDate())
      );
    } else {
      // Período dentro do mesmo mês
      inicio = setDate(
        baseMonth,
        Math.min(defaultDiaInicio, endOfMonth(baseMonth).getDate())
      );
      fim = setDate(
        baseMonth,
        Math.min(defaultDiaFim, endOfMonth(baseMonth).getDate())
      );
    }

    periods.push({
      inicio: format(inicio, "yyyy-MM-dd"),
      fim: format(fim, "yyyy-MM-dd"),
      label: `${format(inicio, "dd/MM/yyyy", { locale: ptBR })} a ${format(fim, "dd/MM/yyyy", { locale: ptBR })}`,
      value: `${format(inicio, "yyyy-MM-dd")}_${format(fim, "yyyy-MM-dd")}`,
    });
  }

  return periods;
}

// Função auxiliar para encontrar o período padrão (primeiro não pago)
async function findDefaultPeriod(
  availablePeriods: BillingPeriod[],
  allInvoices: any[],
  companyId: string
): Promise<string | null> {
  if (availablePeriods.length === 0) return null;

  // Ordenar períodos por data (mais antigo primeiro)
  const sortedPeriods = [...availablePeriods].sort(
    (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
  );

  // Encontrar o primeiro período que não está com status "pagamentos_realizados"
  for (const period of sortedPeriods) {
    const periodInvoices = allInvoices.filter(
      (inv) =>
        inv.companyId === companyId &&
        inv.periodoInicio === period.inicio &&
        inv.periodoFim === period.fim &&
        inv.status !== "cancelado"
    );

    if (periodInvoices.length === 0) {
      // Sem faturas, pode ser selecionado
      return period.value;
    }

    // Verificar se todas as faturas estão pagas
    const todasPagas = periodInvoices.every(
      (inv) => inv.status === "pago" || inv.status === "pagamentos_realizados"
    );

    if (!todasPagas) {
      // Período não está totalmente pago, selecionar
      return period.value;
    }
  }

  // Se todos os períodos estão pagos, selecionar o primeiro da lista ordenada
  return sortedPeriods[0]?.value || null;
}

export default function GestaoFinanceiraPage() {
  const { userCompanies } = useAuth();
  const { company } = useCompany();
  const router = useRouter();
  const [memberInvoices, setMemberInvoices] = useState<MemberInvoice[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [loadingMemberInvoices, setLoadingMemberInvoices] = useState(false);
  const [activeTab, setActiveTab] = useState<"fechamento" | "faturas-geradas">(
    "fechamento"
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [sharedSelectedPeriod, setSharedSelectedPeriod] = useState<string>(""); // Período compartilhado entre abas
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [addMembersPeriod, setAddMembersPeriod] = useState<{ inicio: string; fim: string; memberIds: string[] }>({ inicio: "", fim: "", memberIds: [] });

  // Verificar se é owner ou admin
  const isOwnerOrAdmin = useMemo(() => {
    if (!company) return false;
    const membership = userCompanies.find((m) => m.companyId === company.id);
    return membership?.role === "owner" || membership?.role === "admin";
  }, [company, userCompanies]);

  // Redirecionar se não for admin/owner
  useEffect(() => {
    if (company && !isOwnerOrAdmin) {
      router.push("/dashboard/meu-financeiro");
    }
  }, [company, isOwnerOrAdmin, router]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Carregar faturas de membros
  const loadMemberInvoices = async () => {
    if (!company || !isOwnerOrAdmin) return;

    try {
      setLoadingMemberInvoices(true);
      const invoices = await memberInvoiceService.findByCompanyId(company.id);
      setMemberInvoices(invoices);

      // Carregar informações dos usuários
      const userIds = [...new Set(invoices.map((inv) => inv.userId))];
      const usersMap = new Map<string, User>();
      for (const userId of userIds) {
        const user = await userService.findById(userId);
        if (user) {
          usersMap.set(userId, user);
        }
      }
      setUsers(usersMap);
    } catch (error) {
      console.error("Erro ao carregar faturas de membros:", error);
    } finally {
      setLoadingMemberInvoices(false);
    }
  };

  useEffect(() => {
    loadMemberInvoices();
  }, [company, isOwnerOrAdmin]);

  // Gerar períodos de faturamento disponíveis
  const availablePeriods = useMemo(() => {
    if (!company) return [];
    return generateBillingPeriods(
      company.diaInicioFaturamento,
      company.diaFimFaturamento,
      -1, // 1 mês antes
      12 // até 12 meses à frente
    );
  }, [company]);

  // Definir período selecionado padrão: primeiro período (ordenado por data) que não esteja com status "pagamentos_realizados"
  useEffect(() => {
    if (
      availablePeriods.length > 0 &&
      !sharedSelectedPeriod &&
      company &&
      !loadingMemberInvoices
    ) {
      // Ordenar períodos por data (mais antigo primeiro)
      const sortedPeriods = [...availablePeriods].sort(
        (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
      );

      // Agrupar faturas por período para verificar status
      const invoicesByPeriodMap = new Map<string, MemberInvoice[]>();
      memberInvoices.forEach((invoice) => {
        const key = `${invoice.periodoInicio}_${invoice.periodoFim}`;
        if (!invoicesByPeriodMap.has(key)) {
          invoicesByPeriodMap.set(key, []);
        }
        invoicesByPeriodMap.get(key)!.push(invoice);
      });

      // Encontrar o primeiro período que não está com status "pagamentos_realizados"
      for (const period of sortedPeriods) {
        const key = `${period.inicio}_${period.fim}`;
        const periodInvoices = invoicesByPeriodMap.get(key) || [];

        if (periodInvoices.length === 0) {
          // Sem faturas, pode ser selecionado
          setSharedSelectedPeriod(period.value);
          setSelectedPeriod(period.value);
          return;
        }

        // Verificar se todas as faturas estão pagas (não canceladas)
        const nonCanceledInvoices = periodInvoices.filter(
          (inv) => inv.status !== "cancelado"
        );
        if (nonCanceledInvoices.length === 0) {
          // Todas canceladas, pode ser selecionado
          setSharedSelectedPeriod(period.value);
          setSelectedPeriod(period.value);
          return;
        }

        const todasPagas = nonCanceledInvoices.every(
          (inv) =>
            inv.status === "pago" || inv.status === "pagamentos_realizados"
        );

        if (!todasPagas) {
          // Período não está totalmente pago, selecionar
          setSharedSelectedPeriod(period.value);
          setSelectedPeriod(period.value);
          return;
        }
      }

      // Se todos os períodos estão pagos, selecionar o primeiro da lista ordenada
      if (sortedPeriods.length > 0) {
        setSharedSelectedPeriod(sortedPeriods[0].value);
        setSelectedPeriod(sortedPeriods[0].value);
      }
    }
  }, [
    availablePeriods,
    sharedSelectedPeriod,
    company,
    memberInvoices,
    loadingMemberInvoices,
  ]);

  // Sincronizar selectedPeriod com sharedSelectedPeriod quando mudar na aba "Faturas Geradas"
  // Apenas quando sharedSelectedPeriod mudar vindo do Fechamento ou quando a aba muda
  useEffect(() => {
    if (activeTab === "faturas-geradas" && sharedSelectedPeriod && sharedSelectedPeriod !== selectedPeriod) {
      setSelectedPeriod(sharedSelectedPeriod);
    }
  }, [sharedSelectedPeriod, activeTab]); // selectedPeriod não está nas dependências para evitar loop

  // Agrupar faturas por período
  const invoicesByPeriod = useMemo(() => {
    const grouped = new Map<string, MemberInvoice[]>();

    memberInvoices.forEach((invoice) => {
      const key = `${invoice.periodoInicio}_${invoice.periodoFim}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(invoice);
    });

    // Converter para array e ordenar por período (mais recente primeiro)
    return Array.from(grouped.entries())
      .map(([key, invoices]) => {
        const totalValor = invoices.reduce((sum, inv) => sum + inv.valor, 0);
        const totalPago = invoices
          .filter(
            (inv) =>
              inv.status === "pago" || inv.status === "pagamentos_realizados"
          )
          .reduce((sum, inv) => sum + inv.valor, 0);
        const totalPendente = invoices
          .filter(
            (inv) =>
              inv.status === "pendente" ||
              inv.status === "fatura_gerada" ||
              inv.status === "atrasado"
          )
          .reduce((sum, inv) => sum + inv.valor, 0);

        // Calcular status do período baseado nas faturas
        // Se todas as faturas estão pagas e não há pendentes, período está pago
        // Se todas as faturas estão canceladas, período está cancelado
        // Se há faturas geradas mas não pagas, período está com faturas geradas
        // Caso contrário, pendente
        let periodoStatus:
          | "fatura_gerada"
          | "pagamentos_realizados"
          | "pendente"
          | "parcialmente_pago"
          | "cancelado";
        const todasPagas =
          invoices.length > 0 &&
          invoices.every(
            (inv) =>
              inv.status === "pago" || inv.status === "pagamentos_realizados"
          );
        const todasCanceladas =
          invoices.length > 0 &&
          invoices.every((inv) => inv.status === "cancelado");
        const temGeradas = invoices.some(
          (inv) => inv.status === "fatura_gerada"
        );
        const temPendentes = invoices.some(
          (inv) => inv.status === "pendente" || inv.status === "atrasado"
        );
        const temPagas = invoices.some(
          (inv) =>
            inv.status === "pago" || inv.status === "pagamentos_realizados"
        );

        if (todasCanceladas) {
          periodoStatus = "cancelado";
        } else if (todasPagas) {
          periodoStatus = "pagamentos_realizados";
        } else if (temGeradas && !temPendentes && !temPagas) {
          periodoStatus = "fatura_gerada";
        } else if (temPagas && (temPendentes || temGeradas)) {
          periodoStatus = "parcialmente_pago";
        } else {
          periodoStatus = "pendente";
        }

        return {
          periodoInicio: invoices[0].periodoInicio,
          periodoFim: invoices[0].periodoFim,
          invoices,
          totalValor,
          totalPago,
          totalPendente,
          status: periodoStatus,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.periodoInicio).getTime() -
          new Date(a.periodoInicio).getTime()
      );
  }, [memberInvoices]);

  // Filtrar faturas pelo período selecionado
  const filteredInvoicesByPeriod = useMemo(() => {
    if (!selectedPeriod) return invoicesByPeriod;
    return invoicesByPeriod.filter(
      (group) => `${group.periodoInicio}_${group.periodoFim}` === selectedPeriod
    );
  }, [invoicesByPeriod, selectedPeriod]);

  // Se não for admin/owner, não renderizar nada (redirecionamento em andamento)
  if (!isOwnerOrAdmin) {
    return (
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">Redirecionando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Gestão Financeira
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Controle de contas a receber e fechamento de membros
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("fechamento")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "fechamento"
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Fechamento
            </button>
            <button
              onClick={() => setActiveTab("faturas-geradas")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "faturas-geradas"
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Faturas Geradas
            </button>
          </nav>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      {activeTab === "fechamento" ? (
        <div className="mb-8">
          <MemberPaymentClosure 
            sharedSelectedPeriod={sharedSelectedPeriod}
            onPeriodChange={(period) => setSharedSelectedPeriod(period)}
          />
        </div>
      ) : (
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Faturas de Membros
                </h2>
                {availablePeriods.length > 0 && (
                  <select
                    value={selectedPeriod || sharedSelectedPeriod}
                    onChange={(e) => {
                      setSelectedPeriod(e.target.value);
                      setSharedSelectedPeriod(e.target.value);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  >
                    {availablePeriods.map((period) => (
                      <option key={period.value} value={period.value}>
                        {period.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {loadingMemberInvoices ? (
              <div className="p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  Carregando faturas...
                </p>
              </div>
            ) : filteredInvoicesByPeriod.length === 0 ? (
              <div className="p-12 text-center">
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
                  Nenhuma fatura de membro encontrada
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  As faturas aparecerão aqui quando forem geradas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Período de Faturamento
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
                        Membros
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Total
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
                        Pendente
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredInvoicesByPeriod.map((group, index) => (
                      <tr
                        key={`${group.periodoInicio}_${group.periodoFim}`}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {format(
                              parseISO(group.periodoInicio),
                              "dd/MM/yyyy",
                              { locale: ptBR }
                            )}{" "}
                            a{" "}
                            {format(parseISO(group.periodoFim), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              group.status === "pagamentos_realizados"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                                : group.status === "fatura_gerada"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                                  : group.status === "parcialmente_pago"
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                                    : group.status === "cancelado"
                                      ? "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300"
                                      : "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300"
                            }`}
                          >
                            {group.status === "pagamentos_realizados"
                              ? "Pagamentos Realizados"
                              : group.status === "fatura_gerada"
                                ? "Fatura Gerada"
                                : group.status === "parcialmente_pago"
                                  ? "Parcialmente Pago"
                                  : group.status === "cancelado"
                                    ? "Cancelado"
                                    : "Pendente"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {group.invoices.length}{" "}
                            {group.invoices.length === 1 ? "membro" : "membros"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(group.totalValor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                          {formatCurrency(group.totalPago)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 dark:text-yellow-400">
                          {formatCurrency(group.totalPendente)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-3">
                            {/* Botão Adicionar Membros - só aparece se status for fatura_gerada */}
                            {group.status === "fatura_gerada" && (
                              <button
                                onClick={() => {
                                  setAddMembersPeriod({
                                    inicio: group.periodoInicio,
                                    fim: group.periodoFim,
                                    memberIds: group.invoices.map((inv) => inv.userId),
                                  });
                                  setShowAddMembersModal(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
                                title="Adicionar membros à fatura"
                              >
                                <svg
                                  className="w-4 h-4"
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
                            <Link
                              href={`/dashboard/financeiro/membros/${encodeURIComponent(group.periodoInicio)}_${encodeURIComponent(group.periodoFim)}`}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                            >
                              Ver Detalhes
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

            {/* Listagem detalhada de membros do período selecionado */}
            {filteredInvoicesByPeriod.length > 0 && (
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 ">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedPeriod
                      ? `Membros do Período (${format(parseISO(filteredInvoicesByPeriod[0]?.periodoInicio || ""), "dd/MM/yyyy", { locale: ptBR })} a ${format(parseISO(filteredInvoicesByPeriod[0]?.periodoFim || ""), "dd/MM/yyyy", { locale: ptBR })})`
                      : "Todos os Membros"}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          Membro
                        </th>
                        {!selectedPeriod && (
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                          >
                            Período
                          </th>
                        )}
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
                          Pago
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {(selectedPeriod
                        ? filteredInvoicesByPeriod[0]?.invoices
                        : filteredInvoicesByPeriod.flatMap((g) => g.invoices)
                      )?.map((invoice) => {
                        const user = users.get(invoice.userId);
                        const isPaid =
                          invoice.status === "pago" ||
                          invoice.status === "pagamentos_realizados";
                        return (
                          <tr
                            key={invoice.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {user?.name || "Usuário não encontrado"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user?.email || "-"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {!selectedPeriod && (
                                <div>
                                  {format(
                                    parseISO(invoice.periodoInicio),
                                    "dd/MM/yyyy",
                                    { locale: ptBR }
                                  )}{" "}
                                  a{" "}
                                  {format(
                                    parseISO(invoice.periodoFim),
                                    "dd/MM/yyyy",
                                    { locale: ptBR }
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {formatCurrency(invoice.valor)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  isPaid
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                                }`}
                              >
                                {isPaid ? "Sim" : "Não"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  isPaid
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                                    : invoice.status === "cancelado"
                                      ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                                      : invoice.status === "atrasado"
                                        ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                                        : invoice.status === "fatura_gerada"
                                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                                }`}
                              >
                                {invoice.status === "pago" ||
                                invoice.status === "pagamentos_realizados"
                                  ? "Pagamentos Realizados"
                                  : invoice.status === "cancelado"
                                    ? "Cancelado"
                                    : invoice.status === "atrasado"
                                      ? "Atrasado"
                                      : invoice.status === "fatura_gerada"
                                        ? "Fatura Gerada"
                                        : "Pendente"}
                              </span>
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
      )}

      {/* Modal Adicionar Membros */}
      <AddMembersToInvoiceModal
        isOpen={showAddMembersModal}
        onClose={() => setShowAddMembersModal(false)}
        periodoInicio={addMembersPeriod.inicio}
        periodoFim={addMembersPeriod.fim}
        existingMemberIds={addMembersPeriod.memberIds}
        onMembersAdded={async () => {
          await loadMemberInvoices();
          setShowAddMembersModal(false);
        }}
      />
    </div>
  );
}
