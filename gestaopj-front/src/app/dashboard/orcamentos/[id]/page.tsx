"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useOrcamentos } from "@/contexts/OrcamentoContext";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { exportOrcamentoToPdf } from "@/utils/exportOrcamento";
import { useFormatDate } from "@/hooks/useFormatDate";

export default function OrcamentoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { userCompanies } = useAuth();
  const { company } = useCompany();
  const { formatDate } = useFormatDate();

  // Verificar acesso - membros não podem acessar
  useEffect(() => {
    if (!company) return;
    const membership = userCompanies.find((m) => m.companyId === company.id);
    if (membership?.role === "member") {
      router.push("/dashboard");
    }
  }, [company, userCompanies, router]);
  const { getOrcamentoById, approveOrcamento, refreshOrcamentos } = useOrcamentos();
  const { getProjetoById } = useProjetos();

  const [exporting, setExporting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);

  const orcamento = getOrcamentoById(id);
  const projeto = orcamento ? getProjetoById(orcamento.projetoId) : undefined;

  const handleApprove = async () => {
    if (!orcamento) return;
    setApproving(true);
    try {
      await approveOrcamento(orcamento.id);
      await refreshOrcamentos();
      setShowConfirmApprove(false);
    } catch (error) {
      console.error("Erro ao aprovar orçamento:", error);
      alert("Erro ao aprovar orçamento. Tente novamente.");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/orcamentos"
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mb-2 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar para orçamentos
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Orçamento
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {!orcamento || !projeto ? (
          <p className="text-gray-600 dark:text-gray-400">Orçamento não encontrado.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {orcamento.titulo}
                  </p>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      orcamento.status === "aprovado"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                    }`}
                  >
                    {orcamento.status === "aprovado" ? "Aprovado" : "Aberto"}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {projeto.empresa} • {projeto.titulo}
                </p>
                {orcamento.status === "aprovado" && orcamento.aprovadoEm && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Aprovado em {formatDate(orcamento.aprovadoEm)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {orcamento.status === "aberto" && (
                  <>
                    <Link
                      href={`/dashboard/orcamentos/${orcamento.id}/editar`}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowConfirmApprove(true)}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                    >
                      Aprovar Orçamento
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={exporting}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      // Criar atividades virtuais para exportação
                      const valorHora = orcamento.valorHora ?? projeto?.valorHora ?? 0;
                      const atividadesVirtuais = orcamento.itens.map((item, idx) => ({
                        id: `virt_${idx}`,
                        projetoId: orcamento.projetoId,
                        titulo: item.titulo,
                        dataInicio: orcamento.dataInicioProjeto,
                        horasAtuacao: item.horasEstimadas,
                        horasUtilizadas: 0,
                        dataFimEstimada: orcamento.dataInicioProjeto,
                        custoTarefa: orcamento.custoTotal !== undefined
                          ? 0 // Será exibido como "-"
                          : item.horasEstimadas * valorHora,
                        status: "pendente" as const,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      }));

                      await exportOrcamentoToPdf({
                        orcamento,
                        projeto,
                        atividades: atividadesVirtuais,
                        empresa: projeto.empresa,
                        filename: `${orcamento.titulo}.pdf`,
                      });
                    } finally {
                      setExporting(false);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {exporting ? "Exportando..." : "Exportar PDF"}
                </button>
              </div>
            </div>

            {showConfirmApprove && (
              <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                  Confirmar Aprovação
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-4">
                  Ao aprovar este orçamento, {orcamento.itens.length} atividade(s) serão criadas no projeto. Esta ação não pode ser desfeita.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={approving}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {approving ? "Aprovando..." : "Confirmar Aprovação"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmApprove(false)}
                    disabled={approving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Configuração
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Atividades</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {orcamento.itens.length}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Campos</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {orcamento.camposSelecionados.length}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Etapas</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {orcamento.usarEntregaveis
                      ? orcamento.entregaveis?.length ?? 0
                      : "Não"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Status</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {orcamento.status === "aprovado" ? "Aprovado" : "Aberto"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Atividades do Orçamento
              </p>
              {orcamento.itens.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Nenhuma atividade cadastrada.
                </p>
              ) : (
                <div className="space-y-2">
                  {orcamento.itens
                    .slice()
                    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                    .map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.titulo}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {item.horasEstimadas}h estimadas
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
