"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import MemberPaymentClosure from "@/components/financeiro/MemberPaymentClosure";
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, setDate } from "date-fns";
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
      inicio = setDate(inicioMonth, Math.min(defaultDiaInicio, endOfMonth(inicioMonth).getDate()));
      
      // Fim: dia de fim no mês seguinte
      const fimMonth = addMonths(baseMonth, 1);
      fim = setDate(fimMonth, Math.min(defaultDiaFim, endOfMonth(fimMonth).getDate()));
    } else {
      // Período dentro do mesmo mês
      inicio = setDate(baseMonth, Math.min(defaultDiaInicio, endOfMonth(baseMonth).getDate()));
      fim = setDate(baseMonth, Math.min(defaultDiaFim, endOfMonth(baseMonth).getDate()));
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

export default function GestaoFinanceiraPage() {
  const { userCompanies } = useAuth();
  const { company } = useCompany();
  const router = useRouter();
  const [memberInvoices, setMemberInvoices] = useState<MemberInvoice[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [loadingMemberInvoices, setLoadingMemberInvoices] = useState(false);
  const [activeTab, setActiveTab] = useState<"fechamento" | "faturas-geradas">("fechamento");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

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
  useEffect(() => {
    if (!company || !isOwnerOrAdmin) return;
    
    const loadMemberInvoices = async () => {
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

    loadMemberInvoices();
  }, [company, isOwnerOrAdmin]);

  // Gerar períodos de faturamento disponíveis
  const availablePeriods = useMemo(() => {
    if (!company) return [];
    return generateBillingPeriods(
      company.diaInicioFaturamento,
      company.diaFimFaturamento,
      -1, // 1 mês antes
      12  // até 12 meses à frente
    );
  }, [company]);

  // Definir período selecionado padrão (primeiro período se disponível)
  useEffect(() => {
    if (availablePeriods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(availablePeriods[0].value);
    }
  }, [availablePeriods, selectedPeriod]);

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
      .map(([key, invoices]) => ({
        periodoInicio: invoices[0].periodoInicio,
        periodoFim: invoices[0].periodoFim,
        invoices,
        totalValor: invoices.reduce((sum, inv) => sum + inv.valor, 0),
        totalPago: invoices
          .filter((inv) => inv.status === "pago" || inv.status === "pagamentos_realizados")
          .reduce((sum, inv) => sum + inv.valor, 0),
        totalPendente: invoices
          .filter((inv) => inv.status === "pendente" || inv.status === "fatura_gerada" || inv.status === "atrasado")
          .reduce((sum, inv) => sum + inv.valor, 0),
      }))
      .sort(
        (a, b) =>
          new Date(b.periodoInicio).getTime() - new Date(a.periodoInicio).getTime()
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
          <MemberPaymentClosure />
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
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
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
                <p className="text-gray-600 dark:text-gray-400">Carregando faturas...</p>
              </div>
            ) : filteredInvoicesByPeriod.length === 0 ? (
              <div className="p-12 text-center">
                <div className="flex justify-center mb-4">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhuma fatura de membro encontrada</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">As faturas aparecerão aqui quando forem geradas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Período
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Membros
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Pago
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                            {format(parseISO(group.periodoInicio), "dd/MM/yyyy", { locale: ptBR })} a{" "}
                            {format(parseISO(group.periodoFim), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {group.invoices.length} {group.invoices.length === 1 ? "membro" : "membros"}
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
                          <Link
                            href={`/dashboard/financeiro/membros/${encodeURIComponent(group.periodoInicio)}_${encodeURIComponent(group.periodoFim)}`}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Ver Detalhes
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

