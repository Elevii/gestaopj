"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useOrcamentos } from "@/contexts/OrcamentoContext";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useAtividades } from "@/contexts/AtividadeContext";
import { exportOrcamentoToPdf } from "@/utils/exportOrcamento";

export default function OrcamentoDetalhePage() {
  const params = useParams();
  const id = params.id as string;
  const { getOrcamentoById } = useOrcamentos();
  const { getProjetoById } = useProjetos();
  const { atividades } = useAtividades();

  const [exporting, setExporting] = useState(false);

  const orcamento = getOrcamentoById(id);
  const projeto = orcamento ? getProjetoById(orcamento.projetoId) : undefined;

  const atividadesDoProjeto = useMemo(() => {
    if (!orcamento) return [];
    return atividades.filter((a) => a.projetoId === orcamento.projetoId);
  }, [atividades, orcamento]);

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
        <p className="mt-2 text-gray-600 dark:text-gray-400">ID: {id}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {!orcamento || !projeto ? (
          <p className="text-gray-600 dark:text-gray-400">Orçamento não encontrado.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {orcamento.titulo}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {projeto.empresa} • {projeto.titulo}
                </p>
              </div>
              <button
                type="button"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await exportOrcamentoToPdf({
                      orcamento,
                      projeto,
                      atividades: atividadesDoProjeto,
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

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Configuração
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Atividades selecionadas: {orcamento.itens.length} • Campos:{" "}
                {orcamento.camposSelecionados.length} • Etapas:{" "}
                {orcamento.usarEntregaveis ? "Sim" : "Não"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


