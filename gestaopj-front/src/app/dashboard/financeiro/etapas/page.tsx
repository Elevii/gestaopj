"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFaturaEtapa } from "@/contexts/FaturaEtapaContext";
import { useFaturaPermissions } from "@/hooks/useFaturaPermissions";
import { FaturaEtapa, TipoEtapa } from "@/types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_ETAPA_LABELS: Record<TipoEtapa, string> = {
  envio_relatorio: "Envio de Relatório",
  geracao_nota_fiscal: "Geração de Nota Fiscal",
  outro: "Outro",
};

export default function EtapasManagementPage() {
  const router = useRouter();
  const { etapas, loading, deleteEtapa, reorderEtapas } = useFaturaEtapa();
  const { canManageInvoiceSteps } = useFaturaPermissions();

  const [selectedEtapa, setSelectedEtapa] = useState<FaturaEtapa | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Verificar permissões
  if (!canManageInvoiceSteps) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Você não tem permissão para gerenciar etapas de faturamento.
          </p>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!selectedEtapa) return;

    try {
      await deleteEtapa(selectedEtapa.id);
      setShowDeleteModal(false);
      setSelectedEtapa(null);
    } catch (error) {
      console.error("Erro ao deletar etapa:", error);
      alert("Erro ao deletar etapa. Tente novamente.");
    }
  };

  const handleMoveUp = async (etapa: FaturaEtapa) => {
    const currentIndex = etapas.findIndex((e) => e.id === etapa.id);
    if (currentIndex <= 0) return;

    const newOrder = [...etapas];
    [newOrder[currentIndex - 1], newOrder[currentIndex]] = [
      newOrder[currentIndex],
      newOrder[currentIndex - 1],
    ];

    const etapaIds = newOrder.map((e) => e.id);
    await reorderEtapas(etapaIds);
  };

  const handleMoveDown = async (etapa: FaturaEtapa) => {
    const currentIndex = etapas.findIndex((e) => e.id === etapa.id);
    if (currentIndex >= etapas.length - 1) return;

    const newOrder = [...etapas];
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [
      newOrder[currentIndex + 1],
      newOrder[currentIndex],
    ];

    const etapaIds = newOrder.map((e) => e.id);
    await reorderEtapas(etapaIds);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando etapas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Gestão de Etapas de Faturamento
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure as etapas obrigatórias para o faturamento da empresa
          </p>
        </div>
        <Link
          href="/dashboard/financeiro/etapas/novo"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Nova Etapa
        </Link>
      </div>

      {etapas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            Nenhuma etapa configurada
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Comece criando uma nova etapa de faturamento.
          </p>
          <Link
            href="/dashboard/financeiro/etapas/novo"
            className="mt-6 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Criar Primeira Etapa
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ordem
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Data Limite
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Requer Anexo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {etapas.map((etapa, index) => (
                  <tr key={etapa.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleMoveUp(etapa)}
                          disabled={index === 0}
                          className={`p-1 rounded ${
                            index === 0
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600"
                          }`}
                        >
                          ↑
                        </button>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {etapa.ordem + 1}
                        </span>
                        <button
                          onClick={() => handleMoveDown(etapa)}
                          disabled={index === etapas.length - 1}
                          className={`p-1 rounded ${
                            index === etapas.length - 1
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600"
                          }`}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {etapa.nome}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {TIPO_ETAPA_LABELS[etapa.tipo]}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {etapa.dataLimite
                          ? format(parseISO(etapa.dataLimite), "dd/MM/yyyy", { locale: ptBR })
                          : "Não definida"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {etapa.requerAnexo ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Sim
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            Não
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {etapa.ativo ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Ativa
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            Inativa
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link
                          href={`/dashboard/financeiro/etapas/${etapa.id}/editar`}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => {
                            setSelectedEtapa(etapa);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && selectedEtapa && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Confirmar Exclusão
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Tem certeza que deseja excluir a etapa "{selectedEtapa.nome}"? Esta ação não pode ser
              desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedEtapa(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

