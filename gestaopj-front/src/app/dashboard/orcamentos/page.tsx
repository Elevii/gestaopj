"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EmptyState from "@/components/dashboard/EmptyState";
import { useOrcamentos } from "@/contexts/OrcamentoContext";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useMemo } from "react";
import { useFormatDate } from "@/hooks/useFormatDate";

export default function OrcamentosPage() {
  const router = useRouter();
  const { orcamentos, loading, deleteOrcamento } = useOrcamentos();
  const { projetos } = useProjetos();
  const { formatDate } = useFormatDate();
  const { userCompanies } = useAuth();
  const { company } = useCompany();

  // Verificar acesso - apenas admins e proprietários podem acessar
  useEffect(() => {
    if (!company) return;
    const membership = userCompanies.find((m) => m.companyId === company.id);
    const isAdminOrOwner = membership?.role === "admin" || membership?.role === "owner";
    if (!isAdminOrOwner) {
      router.push("/dashboard");
    }
  }, [company, userCompanies, router]);

  const projetoById = useMemo(() => {
    const map = new Map<string, { titulo: string; empresa: string }>();
    for (const p of projetos) map.set(p.id, { titulo: p.titulo, empresa: p.empresa });
    return map;
  }, [projetos]);

  const isAdminOrOwner = useMemo(() => {
    if (!company) return false;
    const membership = userCompanies.find((m) => m.companyId === company.id);
    return membership?.role === "admin" || membership?.role === "owner";
  }, [company, userCompanies]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Orçamentos
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Crie orçamentos de projetos e exporte em PDF
          </p>
        </div>
        {isAdminOrOwner && (
          <Link
            href="/dashboard/orcamentos/novo"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Novo Orçamento
          </Link>
        )}
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">Carregando orçamentos...</p>
        </div>
      ) : orcamentos.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <EmptyState
            icon={
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
            }
            title="Nenhum orçamento criado"
            description="Crie seu primeiro orçamento adicionando atividades e configurando quais dados serão exibidos."
            action={{
              label: "Novo Orçamento",
              href: "/dashboard/orcamentos/novo",
            }}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Orçamento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Projeto
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Atividades
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {orcamentos
                  .slice()
                  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                  .map((o) => {
                    const proj = projetoById.get(o.projetoId);
                    return (
                      <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {o.titulo}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(o.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {proj?.titulo ?? "Projeto removido"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {proj?.empresa ?? ""}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {o.itens.length}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              o.status === "aprovado"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            }`}
                          >
                            {o.status === "aprovado" ? "Aprovado" : "Aberto"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/dashboard/orcamentos/${o.id}`}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              Abrir
                            </Link>
                            {isAdminOrOwner && (
                              <button
                                onClick={() => {
                                  if (confirm("Tem certeza que deseja excluir este orçamento?")) {
                                    deleteOrcamento(o.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Excluir
                              </button>
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

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <Link
          href="/dashboard/projetos"
          className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          Ver projetos
        </Link>
      </div>
    </div>
  );
}
