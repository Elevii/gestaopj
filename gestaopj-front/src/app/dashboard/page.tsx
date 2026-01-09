"use client";

import { useMemo, useState, useEffect } from "react";
import StatCard from "@/components/dashboard/StatCard";
import Link from "next/link";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useAtividades } from "@/contexts/AtividadeContext";
import { useAtuacoes } from "@/contexts/AtuacaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatRelativeTime } from "@/utils/dashboardMetrics";
import { format, parseISO } from "date-fns";
import { companyMembershipService } from "@/services/companyMembershipService";
import { atuacaoService } from "@/services/atuacaoService";
import { projetoService } from "@/services/projetoService";

interface RecentActivity {
  id: string;
  type: "project" | "atuacao" | "atividade";
  message: string;
  time: string;
  href?: string;
  timestamp?: number;
}

export default function DashboardPage() {
  const { metrics, loading } = useDashboardMetrics();
  const { projetos } = useProjetos();
  const { atividades } = useAtividades();
  const { atuacoes } = useAtuacoes();
  const { userCompanies } = useAuth();
  const { company } = useCompany();

  // Detectar role do usuário
  const isOwnerOrAdmin = useMemo(() => {
    if (!company) return false;
    const membership = userCompanies.find((m) => m.companyId === company.id);
    return membership?.role === "owner" || membership?.role === "admin";
  }, [company, userCompanies]);

  // Estados para métricas administrativas
  const [adminMetrics, setAdminMetrics] = useState({
    totalAtuacoes: 0,
    totalHorasUtilizadas: 0,
    membrosAtivos: 0,
    loading: true,
  });

  // Ícones para os cards
  const icons = {
    projetosAtivos: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    horasTotais: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    receitaTotal: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    receitaHora: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
    projetosNovos: (
      <svg
        className="w-8 h-8"
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
    ),
    totalAtuacoes: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
    membrosAtivos: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
  };

  // Calcular métricas administrativas
  useEffect(() => {
    if (!isOwnerOrAdmin || !company) {
      setAdminMetrics({
        totalAtuacoes: 0,
        totalHorasUtilizadas: 0,
        membrosAtivos: 0,
        loading: false,
      });
      return;
    }

    const loadAdminMetrics = async () => {
      try {
        setAdminMetrics((prev) => ({ ...prev, loading: true }));

        // Calcular total de registros de atuações do mês atual (primeiro e último dia do mês)
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        // Calcular primeiro e último dia do mês sem problemas de timezone
        // Formato: YYYY-MM-DD
        const firstDayOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const lastDayOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;

        // Buscar atuações da empresa (já filtra por companyId)
        const allAtuacoes = await atuacaoService.findAll(company.id);
        const projetos = await projetoService.findAll(company.id);
        const projetosIds = new Set(projetos.map((p) => p.id));

        // Filtrar atuações do mês atual que pertencem a projetos da empresa
        // Inclui atividades avulsas, pois elas têm projetoId válido
        const atuacoesPeriodo = allAtuacoes.filter((a) => {
          // Extrair apenas a data (YYYY-MM-DD) da atuação
          const dataAtuacao = a.data.includes("T")
            ? a.data.split("T")[0]
            : a.data;

          // Verificar se o projeto pertence à empresa (primeiro verificar isso)
          if (!projetosIds.has(a.projetoId)) {
            return false;
          }

          // Verificar se a data está no mês atual (comparação de strings YYYY-MM-DD funciona)
          const dataValida =
            dataAtuacao >= firstDayOfMonth && dataAtuacao <= lastDayOfMonth;

          return dataValida;
        });
        const totalAtuacoes = atuacoesPeriodo.length;

        // Calcular total de horas utilizadas das atuações do período
        const totalHorasUtilizadas = atuacoesPeriodo.reduce(
          (sum, a) => sum + (a.horasUtilizadas || 0),
          0
        );

        // Calcular membros ativos
        const memberships = await companyMembershipService.findByCompanyId(
          company.id
        );
        const membrosAtivos = memberships.filter((m) => m.active).length;

        setAdminMetrics({
          totalAtuacoes,
          totalHorasUtilizadas,
          membrosAtivos,
          loading: false,
        });
      } catch (error) {
        console.error("Erro ao carregar métricas administrativas:", error);
        setAdminMetrics({
          totalAtuacoes: 0,
          totalHorasUtilizadas: 0,
          membrosAtivos: 0,
          loading: false,
        });
      }
    };

    loadAdminMetrics();
  }, [isOwnerOrAdmin, company]);

  // Calcular atividades recentes
  const recentActivities = useMemo<RecentActivity[]>(() => {
    const activities: RecentActivity[] = [];

    // Projetos criados recentemente
    projetos.forEach((projeto) => {
      activities.push({
        id: `proj_${projeto.id}`,
        type: "project",
        message: `Novo projeto '${projeto.titulo}' criado`,
        time: formatRelativeTime(projeto.createdAt),
        href: `/dashboard/projetos/${projeto.id}`,
        timestamp: new Date(projeto.createdAt).getTime(),
      });
    });

    // Atuações registradas recentemente
    atuacoes.forEach((atuacao) => {
      const projeto = projetos.find((p) => p.id === atuacao.projetoId);
      if (projeto) {
        activities.push({
          id: `atu_${atuacao.id}`,
          type: "atuacao",
          message: `Atuação registrada no projeto '${projeto.titulo}'`,
          time: formatRelativeTime(atuacao.createdAt),
          href: `/dashboard/projetos/${projeto.id}`,
          timestamp: new Date(atuacao.createdAt).getTime(),
        });
      }
    });

    // Atividades atualizadas recentemente
    atividades.forEach((atividade) => {
      const projeto = projetos.find((p) => p.id === atividade.projetoId);
      if (projeto) {
        const statusText =
          atividade.status === "concluida"
            ? "concluída"
            : atividade.status === "em_execucao"
              ? "em execução"
              : "criada";
        activities.push({
          id: `ativ_${atividade.id}`,
          type: "atividade",
          message: `Atividade '${atividade.titulo}' ${statusText} - Projeto '${projeto.titulo}'`,
          time: formatRelativeTime(atividade.updatedAt),
          href: `/dashboard/projetos/${projeto.id}/atividades/${atividade.id}`,
          timestamp: new Date(atividade.updatedAt).getTime(),
        });
      }
    });

    // Ordenar por timestamp (mais recente primeiro) e limitar a 10
    return activities
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 10)
      .map(({ timestamp, ...rest }) => rest);
  }, [projetos, atuacoes, atividades]);

  // Calcular resumo de projetos por status
  const projectSummary = useMemo(() => {
    // Filtrar projetos não cancelados
    const projetosValidos = projetos.filter((p) => p.status !== "cancelado");

    // Mapear status do projeto para categorias do resumo
    // Projetos sem status são tratados como "ativo" (padrão)
    const projetosAtivos = projetosValidos.filter(
      (p) => !p.status || p.status === "ativo"
    );
    const projetosPausados = projetosValidos.filter(
      (p) => p.status === "pausado"
    );
    const projetosConcluidos = projetosValidos.filter(
      (p) => p.status === "concluido"
    );
    // Projetos cancelados não aparecem no resumo

    const emAndamento = projetosAtivos.length;
    const planejamento = projetosPausados.length;
    const concluidos = projetosConcluidos.length;
    const total = projetosValidos.length;

    return {
      emAndamento,
      planejamento,
      concluidos,
      total,
      emAndamentoPercent:
        total > 0 ? Math.round((emAndamento / total) * 100) : 0,
      planejamentoPercent:
        total > 0 ? Math.round((planejamento / total) * 100) : 0,
      concluidosPercent: total > 0 ? Math.round((concluidos / total) * 100) : 0,
    };
  }, [projetos]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Meu Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Visão geral da sua atividade como PJ
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            Carregando dados...
          </div>
        </div>
      </div>
    );
  }

  const hasNoProjects = projetos.length === 0;

  return (
    <div className="space-y-6 relative">
      {/* Overlay com blur quando não há projetos */}
      {hasNoProjects && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-gray-900/20 dark:bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 max-w-md mx-4 text-center z-50">
            <div className="mb-6">
              <svg
                className="w-16 h-16 mx-auto text-indigo-600 dark:text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Comece criando seu primeiro projeto
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Crie um projeto para começar a gerenciar suas atividades e
              acompanhar seu trabalho.
            </p>
            <Link
              href="/dashboard/projetos/novo"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Criar Novo Projeto
            </Link>
          </div>
        </div>
      )}

      <div
        className={
          hasNoProjects ? "blur-sm pointer-events-none space-y-6" : "space-y-6"
        }
      >
        {/* Header da página */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isOwnerOrAdmin ? "Dashboard da Empresa" : "Meu Dashboard"}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {isOwnerOrAdmin
              ? "Visão geral das métricas e atividades da empresa"
              : "Visão geral da sua atividade como PJ"}
          </p>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isOwnerOrAdmin ? (
            // Cards para Admin/Owner
            <>
              <StatCard
                title="Projetos Ativos"
                value={
                  projetos.filter((p) => !p.status || p.status === "ativo")
                    .length
                }
                icon={icons.projetosAtivos}
                iconBgColor="bg-green-500"
              />
              <StatCard
                title="Membros Ativos"
                value={
                  adminMetrics.loading
                    ? "Carregando..."
                    : adminMetrics.membrosAtivos.toString()
                }
                icon={icons.membrosAtivos}
                iconBgColor="bg-purple-500"
              />
              <StatCard
                title="Registros de Atuações (Mês)"
                value={
                  adminMetrics.loading
                    ? "Carregando..."
                    : `${adminMetrics.totalAtuacoes} | ${adminMetrics.totalHorasUtilizadas % 1 === 0 ? adminMetrics.totalHorasUtilizadas.toFixed(0) : adminMetrics.totalHorasUtilizadas.toFixed(1)}h`
                }
                icon={icons.totalAtuacoes}
                iconBgColor="bg-blue-500"
              />
            </>
          ) : (
            // Cards para Membros (dashboard atual)
            <>
              <StatCard
                title="Projetos Ativos"
                value={metrics.projetosAtivos.value}
                change={metrics.projetosAtivos.change}
                icon={icons.projetosAtivos}
                iconBgColor="bg-green-500"
              />
              <StatCard
                title="Horas Trabalhadas (Mês)"
                value={metrics.horasTotais.value}
                change={metrics.horasTotais.change}
                icon={icons.horasTotais}
                iconBgColor="bg-blue-500"
              />
              <StatCard
                title="Receita Total (Mês)"
                value={metrics.receitaTotal.value}
                change={metrics.receitaTotal.change}
                icon={icons.receitaTotal}
                iconBgColor="bg-yellow-500"
              />
              <StatCard
                title="Média por Hora"
                value={metrics.receitaHora.value}
                change={metrics.receitaHora.change}
                icon={icons.receitaHora}
                iconBgColor="bg-indigo-500"
              />
              <StatCard
                title="Projetos Novos (Mês)"
                value={metrics.projetosNovos.value}
                change={metrics.projetosNovos.change}
                icon={icons.projetosNovos}
                iconBgColor="bg-purple-500"
              />
            </>
          )}
        </div>

        {/* Seção de ações rápidas */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Ações Rápidas
          </h2>
          <div
            className={`grid grid-cols-1 ${isOwnerOrAdmin ? "md:grid-cols-3" : "md:grid-cols-1"} gap-4`}
          >
            <Link
              href="/dashboard/atuacao/novo"
              className="flex items-center space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="bg-indigo-100 dark:bg-indigo-900/50 rounded-lg p-3">
                <svg
                  className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
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
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Registrar Atuação
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Registrar atividades realizadas
                </p>
              </div>
            </Link>

            {isOwnerOrAdmin && (
              <>
                <Link
                  href="/dashboard/projetos/novo"
                  className="flex items-center space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="bg-green-100 dark:bg-green-900/50 rounded-lg p-3">
                    <svg
                      className="w-6 h-6 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Novo Projeto
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Criar novo projeto
                    </p>
                  </div>
                </Link>

                <Link
                  href="/dashboard/orcamentos"
                  className="flex items-center space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="bg-blue-100 dark:bg-blue-900/50 rounded-lg p-3">
                    <svg
                      className="w-6 h-6 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Orçamentos
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Criar e exportar orçamentos
                    </p>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Atividades recentes e resumo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Atividades Recentes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Atividades Recentes
              </h2>
            </div>
            <div className="space-y-4">
              {recentActivities.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Nenhuma atividade recente</p>
                </div>
              ) : (
                recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start space-x-3 pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {activity.href ? (
                        <Link
                          href={activity.href}
                          className="text-sm text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {activity.message}
                        </Link>
                      ) : (
                        <p className="text-sm text-gray-900 dark:text-white">
                          {activity.message}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Resumo de Projetos */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Resumo de Projetos
            </h2>
            <div className="space-y-4">
              {projectSummary.total === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Nenhum projeto cadastrado</p>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Em andamento
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {projectSummary.emAndamento}{" "}
                        {projectSummary.emAndamento === 1
                          ? "projeto"
                          : "projetos"}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${projectSummary.emAndamentoPercent}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Planejamento
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {projectSummary.planejamento}{" "}
                        {projectSummary.planejamento === 1
                          ? "projeto"
                          : "projetos"}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${projectSummary.planejamentoPercent}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Concluídos
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {projectSummary.concluidos}{" "}
                        {projectSummary.concluidos === 1
                          ? "projeto"
                          : "projetos"}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${projectSummary.concluidosPercent}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link
                      href="/dashboard/projetos"
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Ver meus projetos →
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
