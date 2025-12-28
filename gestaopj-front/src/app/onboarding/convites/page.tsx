"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { inviteService } from "@/services/inviteService";
import { companyService } from "@/services/companyService";
import { companyMembershipService } from "@/services/companyMembershipService";
import { Invite } from "@/types/invite";
import { Company } from "@/types/company";

interface InviteWithCompany extends Invite {
  company?: Company;
}

export default function ConvitesPage() {
  const router = useRouter();
  const { user, refreshAuth } = useAuth();
  const [invites, setInvites] = useState<InviteWithCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInvites = async () => {
      if (!user) return;

      try {
        setLoading(true);
        // Expirar convites antigos primeiro
        await inviteService.expireOldInvites();
        const pendingInvites = await inviteService.findPendingByEmail(user.email);
        
        // Buscar dados das empresas
        const invitesWithCompanies = await Promise.all(
          pendingInvites.map(async (invite) => {
            const company = await companyService.findById(invite.companyId);
            return { ...invite, company };
          })
        );

        setInvites(invitesWithCompanies);
      } catch (error) {
        console.error("Erro ao carregar convites:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadInvites();
    }
  }, [user]);

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

      // Atualizar autenticação e redirecionar
      await refreshAuth();
      router.push("/dashboard");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/onboarding"
              className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-4"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Voltar
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Convites Pendentes
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Aceite ou rejeite convites para se juntar a empresas
            </p>
          </div>

          {/* Lista de Convites */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando convites...</p>
            </div>
          ) : invites.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
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
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Você não possui convites pendentes no momento
              </p>
              <Link
                href="/onboarding"
                className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Voltar para onboarding
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {invite.company?.name || "Empresa"}
                      </h3>
                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <p>
                          <span className="font-medium">Role oferecido:</span>{" "}
                          {getRoleLabel(invite.role)}
                        </p>
                        <p>
                          <span className="font-medium">Expira em:</span>{" "}
                          {new Date(invite.expiresAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        {invite.company?.email && (
                          <p>
                            <span className="font-medium">Email:</span> {invite.company.email}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


