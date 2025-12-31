"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { companyService } from "@/services/companyService";
import { inviteService } from "@/services/inviteService";
import { companyMembershipService } from "@/services/companyMembershipService";
import { authService } from "@/services/authService";
import { Company } from "@/types/company";
import { Invite } from "@/types/invite";
import { CompanyMembership } from "@/types/companyMembership";

interface CompanyWithMembership extends Company {
  membership: CompanyMembership;
}

interface InviteWithCompany extends Invite {
  company: Company | null;
}

export default function EmpresasPage() {
  const router = useRouter();
  const { user, userCompanies, switchCompany, refreshAuth } = useAuth();
  const { company: currentCompany } = useCompany();
  const [companies, setCompanies] = useState<CompanyWithMembership[]>([]);
  const [invites, setInvites] = useState<InviteWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"empresas" | "convites">(
    "empresas"
  );

  // Membros podem acessar, mas apenas visualizar (sem opções de edição)

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Carregar empresas
        const companiesData: CompanyWithMembership[] = [];
        for (const membership of userCompanies) {
          const company = await companyService.findById(membership.companyId);
          if (company && company.active) {
            // Garantir que o nome existe
            if (!company.name || company.name.trim() === "") {
              console.warn("Empresa sem nome encontrada:", company);
            }
            companiesData.push({
              ...company,
              membership,
            });
          }
        }
        setCompanies(companiesData);

        // Carregar convites pendentes
        await inviteService.expireOldInvites();
        const pendingInvites = await inviteService.findPendingByEmail(
          user.email
        );

        // Buscar dados das empresas dos convites
        const invitesWithCompanies = await Promise.all(
          pendingInvites.map(async (invite) => {
            const company = await companyService.findById(invite.companyId);
            return { ...invite, company };
          })
        );

        // Filtrar apenas convites com empresas válidas
        const validInvites = invitesWithCompanies.filter(
          (inv): inv is InviteWithCompany => inv.company !== null
        );
        setInvites(validInvites);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, userCompanies]);

  const handleSwitchCompany = async (companyId: string) => {
    try {
      await switchCompany(companyId);
      router.refresh();
    } catch (error) {
      console.error("Erro ao trocar empresa:", error);
      alert("Erro ao trocar empresa. Tente novamente.");
    }
  };

  const handleAcceptInvite = async (invite: InviteWithCompany) => {
    if (!user || !invite.company) return;

    try {
      // Aceitar convite
      await inviteService.accept(invite.token);

      // Criar membership
      await companyMembershipService.create({
        userId: user.id,
        companyId: invite.companyId,
        role: invite.role,
      });

      // Selecionar empresa aceita e atualizar autenticação
      await authService.switchCompany(invite.companyId);
      await refreshAuth();

      // Aguardar um pouco para garantir que o estado seja atualizado
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Recarregar página para atualizar estado
      window.location.reload();
    } catch (error: any) {
      alert(error.message || "Erro ao aceitar convite");
    }
  };

  const handleRejectInvite = async (invite: Invite) => {
    try {
      await inviteService.reject(invite.token);
      setInvites(invites.filter((inv) => inv.id !== invite.id));
    } catch (error: any) {
      alert(error.message || "Erro ao rejeitar convite");
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: "Proprietário",
      admin: "Administrador",
      member: "Membro",
      viewer: "Visualizador",
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      owner:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      member:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      viewer: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return colors[role] || colors.viewer;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Empresas
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Gerencie suas empresas e convites
          </p>
        </div>
        <Link
          href="/onboarding/criar-empresa"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Criar Empresa
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("empresas")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "empresas"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Minhas Empresas ({companies.length})
          </button>
          <button
            onClick={() => setActiveTab("convites")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors relative ${
              activeTab === "convites"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Convites Pendentes
            {invites.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                {invites.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === "empresas" ? (
        <div className="space-y-4">
          {companies.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Nenhuma empresa encontrada
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Você ainda não está associado a nenhuma empresa
              </p>
              <Link
                href="/onboarding/criar-empresa"
                className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Criar sua primeira empresa
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {companies.map((comp) => {
                const isCurrent = comp.id === currentCompany?.id;
                const companyName =
                  comp.name || comp.membership?.companyId || "Empresa sem nome";

                const handleCardClick = async () => {
                  // Se não for a empresa atual, trocar primeiro
                  if (!isCurrent) {
                    await handleSwitchCompany(comp.id);
                  }
                  // Redirecionar para detalhes da empresa
                  router.push(`/dashboard/empresas/${comp.id}`);
                };

                return (
                  <div
                    key={comp.id}
                    onClick={handleCardClick}
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 p-6 transition-all cursor-pointer hover:shadow-md ${
                      isCurrent
                        ? "border-indigo-500 dark:border-indigo-500"
                        : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {companyName}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                            comp.membership.role
                          )}`}
                        >
                          {getRoleLabel(comp.membership.role)}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                          Ativa
                        </span>
                      )}
                    </div>

                    {comp.email && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {comp.email}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {invites.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Nenhum convite pendente
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Você não possui convites pendentes no momento
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {invites.map((invite) => {
                const companyName =
                  invite.company?.name || invite.companyId || "Empresa";
                return (
                  <div
                    key={invite.id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {companyName}
                        </h3>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <p>
                            <span className="font-medium">Role oferecido:</span>{" "}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(
                                invite.role
                              )}`}
                            >
                              {getRoleLabel(invite.role)}
                            </span>
                          </p>
                          <p>
                            <span className="font-medium">Expira em:</span>{" "}
                            {new Date(invite.expiresAt).toLocaleDateString(
                              "pt-BR",
                              {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                              }
                            )}
                          </p>
                          {invite.company?.email && (
                            <p>
                              <span className="font-medium">Email:</span>{" "}
                              {invite.company.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3 ml-4">
                        <button
                          onClick={() => handleAcceptInvite(invite)}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                        >
                          Aceitar
                        </button>
                        <button
                          onClick={() => handleRejectInvite(invite)}
                          className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                        >
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
