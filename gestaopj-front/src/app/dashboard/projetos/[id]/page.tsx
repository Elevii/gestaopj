"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useAtividades } from "@/contexts/AtividadeContext";
import { useFaturamento } from "@/contexts/FaturamentoContext";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { projectMemberService } from "@/services/projectMemberService";
import { userService } from "@/services/userService";
import { Atividade, PrioridadeAtividade } from "@/types";
import { useFormatDate } from "@/hooks/useFormatDate";
import { useEffect, useMemo } from "react";
import { parseISO } from "date-fns";

export default function ProjetoDetalhesPage() {
  const params = useParams();
  const router = useRouter();
  const projetoId = params.id as string;
  const { getProjetoById, deleteProjeto } = useProjetos();
  const { atividades, loading, deleteAtividade, getAtividadeById } = useAtividades();
  const { faturas, updateFatura } = useFaturamento();
  const { configuracoes } = useConfiguracoes();
  const { formatDate } = useFormatDate();
  const { canEditProject, canDeleteProject } = usePermissions();
  const { user, userCompanies } = useAuth();
  const { company } = useCompany();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);
  const [isDeletingActivity, setIsDeletingActivity] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [projectMembers, setProjectMembers] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [activeTab, setActiveTab] = useState<"atividades" | "financeiro">(
    "atividades"
  );

  const projeto = getProjetoById(projetoId);

  // Carregar membros do projeto
  useEffect(() => {
    const loadMembers = async () => {
      if (!projetoId) {
        setLoadingMembers(false);
        return;
      }

      try {
        setLoadingMembers(true);
        const members = await projectMemberService.findByProjectId(projetoId);
        const membersData = await Promise.all(
          members.map(async (pm) => {
            const user = await userService.findById(pm.userId);
            return user
              ? { id: user.id, name: user.name, email: user.email }
              : null;
          })
        );
        const validMembers = membersData.filter(
          (m): m is { id: string; name: string; email: string } => m !== null
        );
        setProjectMembers(validMembers);
      } catch (error) {
        console.error("Erro ao carregar membros do projeto:", error);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [projetoId]);

  // Verificar acesso ao projeto para Members
  useEffect(() => {
    const checkAccess = async () => {
      if (!projeto || !user || !company) {
        setHasAccess(false);
        return;
      }

      const membership = userCompanies.find((m) => m.companyId === company.id);
      const role = membership?.role;

      // Owner, Admin e Viewer sempre têm acesso
      if (role === "owner" || role === "admin" || role === "viewer") {
        setHasAccess(true);
        return;
      }

      // Member precisa estar associado ao projeto
      if (role === "member") {
        const projectMember = await projectMemberService.findByProjectAndUser(
          projetoId,
          user.id
        );
        setHasAccess(!!projectMember);
      } else {
        setHasAccess(false);
      }
    };

    checkAccess();
  }, [projeto, user, company, projetoId, userCompanies]);

  // Redirecionar se não tiver acesso
  useEffect(() => {
    if (hasAccess === false) {
      router.push("/dashboard/projetos");
    }
  }, [hasAccess, router]);

  // Função para ordenar atividades: urgente primeiro (exceto concluídas), depois por status, depois por data de início
  const ordenarAtividades = (atividadesList: Atividade[]): Atividade[] => {
    return [...atividadesList].sort((a, b) => {
      // Primeiro critério: Se está concluída, vai para o final
      const aConcluida = a.status === "concluida";
      const bConcluida = b.status === "concluida";
      
      if (aConcluida !== bConcluida) {
        return aConcluida ? 1 : -1; // Concluída vai para o final
      }
      
      // Se ambas não estão concluídas, urgente vem primeiro
      if (!aConcluida && !bConcluida) {
        const aUrgente = a.prioridade === "urgente";
        const bUrgente = b.prioridade === "urgente";
        
        if (aUrgente !== bUrgente) {
          return aUrgente ? -1 : 1; // Urgente vem primeiro
        }
      }
      
      // Segundo critério: Status (em_execucao = 1, pendente = 2, concluida = 3)
      const statusOrder: Record<string, number> = {
        em_execucao: 1,
        pendente: 2,
        concluida: 3,
      };
      const statusA = statusOrder[a.status] || 99;
      const statusB = statusOrder[b.status] || 99;
      
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      
      // Terceiro critério: Data de início (mais antiga primeiro)
      const dataA = new Date(a.dataInicio).getTime();
      const dataB = new Date(b.dataInicio).getTime();
      return dataA - dataB;
    });
  };

  const atividadesDoProjeto = useMemo(() => {
    const filtradas = atividades.filter((a) => a.projetoId === projetoId);
    return ordenarAtividades(filtradas);
  }, [atividades, projetoId]);

  if (hasAccess === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Verificando acesso...
          </p>
        </div>
      </div>
    );
  }

  if (!projeto || hasAccess === false) {
    return (
      <div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            {!projeto
              ? "Projeto não encontrado"
              : "Você não tem acesso a este projeto"}
          </p>
          <Link
            href="/dashboard/projetos"
            className="mt-4 inline-block text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            Voltar para projetos
          </Link>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleDeleteProjeto = async () => {
    setIsDeleting(true);
    try {
      // Excluir todas as atividades do projeto primeiro
      const atividadesParaExcluir = atividadesDoProjeto.map((a) => a.id);
      for (const atividadeId of atividadesParaExcluir) {
        await deleteAtividade(atividadeId);
      }
      // Depois excluir o projeto
      await deleteProjeto(projetoId);
      router.push("/dashboard/projetos");
    } catch (error) {
      console.error("Erro ao excluir projeto:", error);
      setIsDeleting(false);
    }
  };

  const handleDeleteAtividade = async (atividadeId: string) => {
    setIsDeletingActivity(true);
    try {
      await deleteAtividade(atividadeId);
      setActivityToDelete(null);
    } catch (error) {
      console.error("Erro ao excluir atividade:", error);
    } finally {
      setIsDeletingActivity(false);
    }
  };

  // Função para obter ícone de prioridade (apenas para urgente)
  const getPrioridadeIcon = (prioridade?: PrioridadeAtividade) => {
    if (prioridade === "urgente") {
      return (
        <svg
          className="w-5 h-5 text-red-600 dark:text-red-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-label="Urgente"
        >
          <title>Urgente</title>
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    return null;
  };

  const faturasDoProjeto = faturas
    .filter((f) => f.projetoId === projetoId)
    .sort(
      (a, b) =>
        new Date(a.dataVencimento).getTime() -
        new Date(b.dataVencimento).getTime()
    );

  const totalHorasEstimadas = atividadesDoProjeto.reduce(
    (sum, atividade) => sum + atividade.horasAtuacao,
    0
  );
  const totalHorasUtilizadas = atividadesDoProjeto.reduce(
    (sum, atividade) => sum + (atividade.horasUtilizadas || 0),
    0
  );
  const totalCusto = atividadesDoProjeto.reduce((sum, atividade) => {
    return sum + atividade.custoTarefa;
  }, 0);

  const lucroAtualEstimado =
    projeto.tipoCobranca === "fixo"
      ? (projeto.valorFixo ?? 0)
      : totalHorasUtilizadas * (projeto.valorHora ?? 0);

  // Cálculos financeiros
  const totalFaturado = faturasDoProjeto.reduce((acc, f) => acc + f.valor, 0);
  const totalRecebido = faturasDoProjeto
    .filter((f) => f.status === "pago")
    .reduce((acc, f) => acc + f.valor, 0);
  const totalPendente = faturasDoProjeto
    .filter((f) => f.status === "pendente" || f.status === "fatura_gerada")
    .reduce((acc, f) => acc + f.valor, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/projetos"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mb-2 inline-flex items-center"
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
            Voltar para projetos
          </Link>
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {projeto.titulo}
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                {projeto.empresa}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {canEditProject && (
            <Link
              href={`/dashboard/projetos/${projetoId}/editar`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Editar
            </Link>
          )}
          {canDeleteProject && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-600 text-sm font-medium rounded-lg text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Excluir
            </button>
          )}
          <Link
            href={`/dashboard/projetos/${projetoId}/atividades/nova`}
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nova Atividade
          </Link>
        </div>
      </div>

      {/* Confirmação de exclusão do Projeto */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Confirmar exclusão
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Tem certeza que deseja excluir o projeto "{projeto.titulo}"? Esta
              ação não pode ser desfeita e todas as atividades relacionadas
              também serão excluídas.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProjeto}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão da Atividade */}
      {activityToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Confirmar exclusão de atividade
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Tem certeza que deseja excluir esta atividade? Esta ação não pode
              ser desfeita.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setActivityToDelete(null)}
                disabled={isDeletingActivity}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteAtividade(activityToDelete)}
                disabled={isDeletingActivity}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingActivity ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {projeto.tipoCobranca === "fixo"
              ? "Valor do Projeto"
              : "Valor por Hora"}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(
              projeto.tipoCobranca === "fixo"
                ? (projeto.valorFixo ?? 0)
                : (projeto.valorHora ?? 0)
            )}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Horas Utilizadas
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {totalHorasUtilizadas}h
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            de {totalHorasEstimadas}h estimadas
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {projeto.tipoCobranca === "fixo"
                  ? "Valor do Projeto"
                  : "Lucro atual estimado"}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(lucroAtualEstimado)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {projeto.tipoCobranca === "fixo"
                  ? "Valor fixo fechado"
                  : `${totalHorasUtilizadas}h × ${formatCurrency(projeto.valorHora ?? 0)}/h`}
              </p>
            </div>
            <div className="sm:border-l sm:border-gray-200 sm:dark:border-gray-700 sm:pl-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Total Faturado
              </p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalFaturado)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Recebido: {formatCurrency(totalRecebido)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Membros do Projeto */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Membros do Projeto
        </h2>
        {loadingMembers ? (
          <div className="flex items-center justify-center py-8">
            <svg
              className="animate-spin h-6 w-6 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        ) : projectMembers.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Nenhum membro associado a este projeto
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {member.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {member.email}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("atividades")}
            className={`${
              activeTab === "atividades"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Atividades
          </button>
          <button
            onClick={() => setActiveTab("financeiro")}
            className={`${
              activeTab === "financeiro"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Financeiro
          </button>
        </nav>
      </div>

      {activeTab === "atividades" ? (
        /* Atividades por Período */
        loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Carregando atividades...
            </p>
          </div>
        ) : atividadesDoProjeto.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                Nenhuma atividade
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Comece criando sua primeira atividade para este projeto.
              </p>
              <div className="mt-6">
                <Link
                  href={`/dashboard/projetos/${projetoId}/atividades/nova`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Nova Atividade
                </Link>
              </div>
            </div>
          </div>
        ) : (
          Object.entries(
            atividadesDoProjeto.reduce(
              (acc, atividade) => {
                const date = new Date(atividade.dataInicio);
                // Formata o período usando o fuso horário configurado
                const periodo = new Intl.DateTimeFormat("pt-BR", {
                  timeZone: configuracoes.fusoHorario,
                  month: "long",
                  year: "numeric",
                }).format(date);

                if (!acc[periodo]) {
                  acc[periodo] = [];
                }
                acc[periodo].push(atividade);
                return acc;
              },
              {} as Record<string, Atividade[]>
            )
          ).map(([periodo, atividadesPeriodo]) => {
            // Ordena as atividades dentro de cada período
            const atividadesOrdenadas = ordenarAtividades(atividadesPeriodo);
            return [periodo, atividadesOrdenadas] as [string, Atividade[]];
          }).map(([periodo, atividadesPeriodo]) => (
            <div key={periodo} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                {periodo}
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Atividade
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Início
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Horas Estimadas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Horas Utilizadas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Término Estimado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Custo da Tarefa
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {atividadesPeriodo.map((atividade) => (
                        <tr
                          key={atividade.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getPrioridadeIcon(atividade.prioridade) && (
                                <div className="flex-shrink-0">
                                  {getPrioridadeIcon(atividade.prioridade)}
                                </div>
                              )}
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {atividade.titulo}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(atividade.dataInicio)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {atividade.horasAtuacao}h
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {atividade.horasUtilizadas || 0}h
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                atividade.status === "concluida"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : atividade.status === "em_execucao"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {atividade.status === "concluida"
                                ? "Concluída"
                                : atividade.status === "em_execucao"
                                  ? "Em execução"
                                  : "Pendente"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(atividade.dataFimEstimada)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                              {formatCurrency(atividade.custoTarefa)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => setSelectedActivityId(atividade.id)}
                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                title="Visualizar detalhes"
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
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                              </button>
                              <Link
                                href={`/dashboard/projetos/${projetoId}/atividades/${atividade.id}/editar`}
                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                title="Editar atividade"
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
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </Link>
                              <button
                                onClick={() =>
                                  setActivityToDelete(atividade.id)
                                }
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                title="Excluir atividade"
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
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Faturas do Projeto
              </h3>
              <Link
                href="/dashboard/financeiro/novo"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Nova Fatura
              </Link>
            </div>
            {faturasDoProjeto.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhuma fatura registrada para este projeto.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Vencimento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Título
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {faturasDoProjeto.map((fatura) => {
                      const isLate =
                        fatura.status !== "pago" &&
                        fatura.status !== "cancelado" &&
                        parseISO(fatura.dataVencimento) < new Date();
                      return (
                        <tr
                          key={fatura.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                fatura.status === "pago"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                                  : isLate
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                                    : fatura.status === "cancelado"
                                      ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                              }`}
                            >
                              {fatura.status === "pago"
                                ? "Pago"
                                : isLate
                                  ? "Atrasado"
                                  : fatura.status === "cancelado"
                                    ? "Cancelado"
                                    : "Pendente"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(fatura.dataVencimento)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {fatura.titulo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatCurrency(fatura.valor)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {fatura.status === "pendente" ||
                            fatura.status === "fatura_gerada" ? (
                              <button
                                onClick={() =>
                                  updateFatura(fatura.id, {
                                    status: "pago",
                                    dataPagamento: new Date().toISOString(),
                                  })
                                }
                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                              >
                                Marcar Pago
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de detalhes da atividade */}
      {selectedActivityId && (() => {
        const atividade = getAtividadeById(selectedActivityId);
        if (!atividade) return null;

        const statusLabel = atividade.status === "concluida"
          ? "Concluída"
          : atividade.status === "em_execucao"
            ? "Em execução"
            : "Pendente";

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70"
            onClick={() => setSelectedActivityId(null)}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Detalhes da Atividade
                </h2>
                <button
                  onClick={() => setSelectedActivityId(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Título</p>
                  <div className="flex items-center gap-2">
                    {getPrioridadeIcon(atividade.prioridade) && (
                      <div className="flex-shrink-0">
                        {getPrioridadeIcon(atividade.prioridade)}
                      </div>
                    )}
                    <p className="text-base text-gray-900 dark:text-white font-semibold">{atividade.titulo}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Data de Início</p>
                    <p className="text-base text-gray-900 dark:text-white">{formatDate(atividade.dataInicio)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Término Estimado</p>
                    <p className="text-base text-gray-900 dark:text-white">{formatDate(atividade.dataFimEstimada)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      atividade.status === "concluida"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : atividade.status === "em_execucao"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    }`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Prioridade</p>
                    <div className="flex items-center gap-2">
                      {getPrioridadeIcon(atividade.prioridade) ? (
                        <>
                          {getPrioridadeIcon(atividade.prioridade)}
                          <span className="text-base text-gray-900 dark:text-white">
                            {atividade.prioridade === "urgente" ? "Urgente" :
                             atividade.prioridade === "normal" ? "Normal" :
                             "Baixo"}
                          </span>
                        </>
                      ) : (
                        <span className="text-base text-gray-500 dark:text-gray-400">Não definida</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Horas Estimadas</p>
                    <p className="text-base text-gray-900 dark:text-white">{atividade.horasAtuacao}h</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Horas Utilizadas</p>
                  <p className="text-base text-gray-900 dark:text-white">{atividade.horasUtilizadas || 0}h</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Custo da Tarefa</p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(atividade.custoTarefa)}</p>
                </div>

                {atividade.descricao && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Descrição</p>
                    <p className="text-base text-gray-900 dark:text-white whitespace-pre-wrap">{atividade.descricao}</p>
                  </div>
                )}

                {!atividade.descricao && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Descrição</p>
                    <p className="text-base text-gray-500 dark:text-gray-400 italic">Nenhuma descrição adicional</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedActivityId(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Fechar
                </button>
                <Link
                  href={`/dashboard/projetos/${projetoId}/atividades/${atividade.id}/editar`}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  onClick={() => setSelectedActivityId(null)}
                >
                  Editar Atividade
                </Link>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
