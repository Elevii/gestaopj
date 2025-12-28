"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { inviteService } from "@/services/inviteService";
import { Invite } from "@/types/invite";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const loadInvites = async () => {
      if (!user) return;

      try {
        setLoadingInvites(true);
        // Expirar convites antigos primeiro
        await inviteService.expireOldInvites();
        const pendingInvites = await inviteService.findPendingByEmail(user.email);
        setInvites(pendingInvites);
      } catch (error) {
        console.error("Erro ao carregar convites:", error);
      } finally {
        setLoadingInvites(false);
      }
    };

    if (user) {
      loadInvites();
    }
  }, [user]);

  const handleAcceptInvite = async (invite: Invite) => {
    try {
      await inviteService.accept(invite.token);
      // Recarregar página para atualizar estado
      router.refresh();
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Bem-vindo ao AtuaPJ!
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Para começar, você precisa estar associado a uma empresa
            </p>
          </div>

          {/* Cards de ação */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Criar Empresa */}
            <Link
              href="/onboarding/criar-empresa"
              className="block p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-indigo-500"
            >
              <div className="flex items-center justify-center w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-indigo-600 dark:text-indigo-400"
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
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Criar Empresa
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Crie uma nova empresa e se torne o proprietário (Owner)
              </p>
            </Link>

            {/* Ver Convites */}
            <Link
              href="/onboarding/convites"
              className="block p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-indigo-500"
            >
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
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
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Ver Convites
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Aceite convites pendentes para se juntar a empresas existentes
              </p>
            </Link>
          </div>

          {/* Convites pendentes */}
          {loadingInvites ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          ) : invites.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Convites Pendentes
              </h3>
              <div className="space-y-4">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Convite para empresa
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Role: {invite.role} • Expira em:{" "}
                        {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptInvite(invite)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Aceitar
                      </button>
                      <button
                        onClick={() => handleRejectInvite(invite)}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


