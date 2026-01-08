
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/dashboard/EmptyState";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useAtividades } from "@/contexts/AtividadeContext";
import { useAtuacoes } from "@/contexts/AtuacaoContext";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { StatusAtividade, TipoAtuacao } from "@/types";
import { exportAtuacoesToExcel, exportAtuacoesToPdf, type AtuacaoColumn, COLUMN_LABELS } from "@/utils/exportAtuacoes";
import { parseISODateToLocal, formatDateBR } from "@/utils/estimativas";

const tipoLabel: Record<TipoAtuacao, string> = {
  reuniao: "Reunião",
  execucao: "Execução",
  planejamento: "Planejamento",
};

const statusLabel: Record<StatusAtividade, string> = {
  pendente: "Pendente",
  em_execucao: "Em execução",
  concluida: "Concluída",
};

export default function AtuacaoPage() {
  const { projetos } = useProjetos();
  const { atividades, getAtividadeById } = useAtividades();
  const { atuacoes, loading, deleteAtuacao, getAtuacaoById } = useAtuacoes();
  const { configuracoes } = useConfiguracoes();

  const [filters, setFilters] = useState({
    projetoId: "",
    dataInicio: "",
    dataFim: "",
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<null | "pdf" | "excel">(null);
  const [tooltipOpen, setTooltipOpen] = useState<null | "HD" | "HU">(null);
  const [showExportModal, setShowExportModal] = useState<null | "pdf" | "excel">(null);
  const [selectedAtuacaoId, setSelectedAtuacaoId] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<AtuacaoColumn[]>([
    "data",
    "horarioInicio",
    "projeto",
    "atividade",
    "tipo",
    "status",
    "hu",
  ]);
  const [exibirDetalhamentoCompleto, setExibirDetalhamentoCompleto] = useState(false);

  const atividadesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of atividades) map.set(a.id, a.titulo);
    return map;
  }, [atividades]);

  const projetosById = useMemo(() => {
    const map = new Map<string, { titulo: string; empresa: string }>();
    for (const p of projetos) map.set(p.id, { titulo: p.titulo, empresa: p.empresa });
    return map;
  }, [projetos]);


  // HD por atuação: horas disponíveis para a atividade ANTES do registro
  const hdByAtuacaoId = useMemo(() => {
    const sorted = [...atuacoes].sort((a, b) => {
      const aKey = `${a.data}|${(a as any).horarioInicio ?? ""}|${a.createdAt}`;
      const bKey = `${b.data}|${(b as any).horarioInicio ?? ""}|${b.createdAt}`;
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });

    const acumuladoPorAtividade = new Map<string, number>();
    const result = new Map<string, number>();

    for (const a of sorted) {
      const acumulado = acumuladoPorAtividade.get(a.atividadeId) ?? 0;
      const he = (a as any).horasEstimadasNoRegistro ?? 0;
      result.set(a.id, he - acumulado);
      acumuladoPorAtividade.set(a.atividadeId, acumulado + (a.horasUtilizadas ?? 0));
    }

    return result;
  }, [atuacoes]);

  const filteredAtuacoes = useMemo(() => {
    return atuacoes
      .filter((a) => (filters.projetoId ? a.projetoId === filters.projetoId : true))
      .filter((a) => (filters.dataInicio ? a.data >= filters.dataInicio : true))
      .filter((a) => (filters.dataFim ? a.data <= filters.dataFim : true))
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }, [atuacoes, filters.dataFim, filters.dataInicio, filters.projetoId, projetosById]);

  // Agrupar atuações por mês/ano
  const atuacoesPorMesAno = useMemo(() => {
    const grupos = new Map<string, typeof filteredAtuacoes>();
    
    filteredAtuacoes.forEach((atuacao) => {
      const data = parseISODateToLocal(atuacao.data);
      if (!data) return;
      
      const mes = data.getMonth();
      const ano = data.getFullYear();
      const chave = `${ano}-${String(mes + 1).padStart(2, "0")}`;
      
      if (!grupos.has(chave)) {
        grupos.set(chave, []);
      }
      grupos.get(chave)!.push(atuacao);
    });

    // Converter para array e ordenar por data (mais recente primeiro)
    return Array.from(grupos.entries())
      .sort(([chaveA], [chaveB]) => {
        // Comparar ano e mês
        const [anoA, mesA] = chaveA.split("-").map(Number);
        const [anoB, mesB] = chaveB.split("-").map(Number);
        if (anoA !== anoB) return anoB - anoA; // Ano mais recente primeiro
        return mesB - mesA; // Mês mais recente primeiro
      })
      .map(([chave, atuacoes]) => {
        const [ano, mes] = chave.split("-").map(Number);
        const data = new Date(ano, mes - 1, 1);
        const nomeMes = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        return {
          chave,
          mesAno: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1),
          atuacoes,
        };
      });
  }, [filteredAtuacoes]);

  const formatDate = (iso: string) => formatDateBR(iso, {
    formatoData: configuracoes.formatoData,
    fusoHorario: configuracoes.fusoHorario,
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteAtuacao(id);
    } finally {
      setDeletingId(null);
    }
  };

  const exportData = useMemo(() => {
    const projetoTitleById = new Map<string, string>();
    for (const p of projetos) projetoTitleById.set(p.id, p.titulo);

    const atividadeTitleById = new Map<string, string>();
    for (const a of atividades) atividadeTitleById.set(a.id, a.titulo);

    return { projetoTitleById, atividadeTitleById };
  }, [atividades, projetos]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Minha Atuação
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Registre suas atividades realizadas e acompanhe sua atuação como PJ
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={loading || exporting !== null || filteredAtuacoes.length === 0}
            onClick={() => setShowExportModal("pdf")}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Exportar PDF
          </button>
          <button
            type="button"
            disabled={loading || exporting !== null || filteredAtuacoes.length === 0}
            onClick={() => setShowExportModal("excel")}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Exportar Excel
          </button>
          <Link
            href="/dashboard/atuacao/novo"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Registrar Atuação
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Projeto
            </label>
            <select
              value={filters.projetoId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, projetoId: e.target.value }))
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
            >
              <option value="">Todos</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data início
            </label>
            <input
              type="date"
              value={filters.dataInicio}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dataInicio: e.target.value }))
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data término
            </label>
            <input
              type="date"
              value={filters.dataFim}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dataFim: e.target.value }))
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                setFilters({ projetoId: "", dataInicio: "", dataFim: "" })
              }
              className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">Carregando atuações...</p>
        </div>
      ) : filteredAtuacoes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <EmptyState
            icon={
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
            title="Nenhuma atuação registrada"
            description="Comece registrando suas primeiras atividades realizadas para acompanhar seu trabalho e comprovar sua atuação."
            action={{
              label: "Registrar Atuação",
              href: "/dashboard/atuacao/novo",
            }}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {atuacoesPorMesAno.map((grupo) => (
            <div
              key={grupo.chave}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Cabeçalho do mês/ano */}
              <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {grupo.mesAno}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {grupo.atuacoes.length} {grupo.atuacoes.length === 1 ? "atuação" : "atuações"}
                </p>
              </div>

              {/* Tabela de atuações do mês */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Título
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <div className="relative inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setTooltipOpen((prev) => (prev === "HD" ? null : "HD"))
                            }
                            className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline decoration-dotted"
                            title="Clique para ver o que é HD"
                          >
                            HD
                          </button>
                          {tooltipOpen === "HD" && (
                            <div className="absolute z-10 top-full left-0 mt-2 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg text-xs text-gray-700 dark:text-gray-200">
                              HD = Horas Disponíveis para a atividade antes do registro (HE - HU acumulado).
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => setTooltipOpen(null)}
                                  className="text-indigo-600 dark:text-indigo-400 font-medium"
                                >
                                  Fechar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <div className="relative inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setTooltipOpen((prev) => (prev === "HU" ? null : "HU"))
                            }
                            className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline decoration-dotted"
                            title="Clique para ver o que é HU"
                          >
                            HU
                          </button>
                          {tooltipOpen === "HU" && (
                            <div className="absolute z-10 top-full left-0 mt-2 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg text-xs text-gray-700 dark:text-gray-200">
                              HU = Horas Utilizadas registradas nesta atuação.
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => setTooltipOpen(null)}
                                  className="text-indigo-600 dark:text-indigo-400 font-medium"
                                >
                                  Fechar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {grupo.atuacoes.map((a) => {
                      const isAtividadeAvulsa = a.atividadeId.startsWith("__ATIVIDADE_AVULSA__");
                      const tituloAtividade = isAtividadeAvulsa 
                        ? (a.tituloAvulsa || "(Atividade avulsa)")
                        : (atividadesById.get(a.atividadeId) ?? "Atividade removida");
                      const projeto = projetosById.get(a.projetoId);
                      const nomeProjeto = projeto?.titulo ?? "Projeto removido";
                      const nomeEmpresa = projeto?.empresa ?? "Empresa não informada";

                      return (
                        <tr 
                          key={a.id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                          onClick={() => setSelectedAtuacaoId(a.id)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {formatDate(a.data)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {nomeEmpresa} • {nomeProjeto}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {tituloAtividade}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                              {tipoLabel[a.tipo]}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                              {statusLabel[(a.statusAtividadeNoRegistro ?? "pendente") as StatusAtividade]}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {(hdByAtuacaoId.get(a.id) ?? 0).toFixed(2)}h
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {a.horasUtilizadas}h
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {(() => {
                                if (isAtividadeAvulsa) {
                                  return "Nenhuma descrição adicional";
                                }
                                const atividadeRelacionada = getAtividadeById(a.atividadeId);
                                return atividadeRelacionada?.descricao || "Nenhuma descrição adicional";
                              })()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/dashboard/atuacao/${a.id}/editar`}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            title="Editar atuação"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Editar
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(a.id);
                            }}
                            disabled={deletingId === a.id}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                            title="Excluir atuação"
                          >
                            {deletingId === a.id ? "Excluindo..." : "Excluir"}
                          </button>
                        </div>
                      </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de seleção de colunas */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Selecionar Colunas para Exportação
              </h2>
              <button
                onClick={() => setShowExportModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {(Object.keys(COLUMN_LABELS) as AtuacaoColumn[]).map((column) => {
                // HD e número não devem aparecer nas opções (são campos de uso interno/automático)
                if (column === "hd" || column === "numero") return null;
                
                // Descrição e impacto devem vir desabilitados
                const isDisabled = column === "descricao" || column === "impacto";
                const isSelected = selectedColumns.includes(column);
                
                return (
                  <label
                    key={column}
                    className={`flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 ${
                      isDisabled 
                        ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900/30" 
                        : "hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedColumns([...selectedColumns, column]);
                        } else {
                          setSelectedColumns(selectedColumns.filter((c) => c !== column));
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"
                    />
                    <span className={`text-sm font-medium ${
                      isDisabled 
                        ? "text-gray-400 dark:text-gray-500" 
                        : "text-gray-900 dark:text-white"
                    }`}>
                      {COLUMN_LABELS[column]}
                    </span>
                    {column === "hu" && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        (Horas Utilizadas)
                      </span>
                    )}
                    {isDisabled && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                        (Disponível apenas no detalhamento completo)
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Opção de detalhamento completo */}
            <div className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exibirDetalhamentoCompleto}
                  onChange={(e) => setExibirDetalhamentoCompleto(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Exibir detalhamento Completo
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Se selecionado, o relatório mostrará o detalhamento completo de todas as atuações com todos os dados disponíveis (incluindo descrição e impacto). Caso contrário, mostrará apenas o resumo com as colunas selecionadas.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowExportModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!exibirDetalhamentoCompleto && selectedColumns.length === 0) {
                    alert("Selecione pelo menos uma coluna ou marque 'Exibir detalhamento Completo'");
                    return;
                  }
                  
                  setExporting(showExportModal);
                  setShowExportModal(null);
                  
                  try {
                    if (showExportModal === "pdf") {
                      await exportAtuacoesToPdf({
                        atuacoes: filteredAtuacoes,
                        ...exportData,
                        hdByAtuacaoId,
                        filename: "atuacoes.pdf",
                        selectedColumns: exibirDetalhamentoCompleto ? undefined : selectedColumns,
                        includeSummary: true, // Sempre mostrar resumo
                        includeDetails: exibirDetalhamentoCompleto, // Detalhamento apenas se marcado
                        formatoData: configuracoes.formatoData,
                        fusoHorario: configuracoes.fusoHorario,
                      });
                    } else {
                      await exportAtuacoesToExcel({
                        atuacoes: filteredAtuacoes,
                        ...exportData,
                        hdByAtuacaoId,
                        filename: "atuacoes.xlsx",
                        selectedColumns: exibirDetalhamentoCompleto ? undefined : selectedColumns,
                        formatoData: configuracoes.formatoData,
                        fusoHorario: configuracoes.fusoHorario,
                      });
                    }
                  } finally {
                    setExporting(null);
                  }
                }}
                disabled={!exibirDetalhamentoCompleto && selectedColumns.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting === showExportModal ? "Exportando..." : "Exportar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalhes da atuação */}
      {selectedAtuacaoId && (() => {
        const atuacao = getAtuacaoById(selectedAtuacaoId);
        if (!atuacao) return null;
        
        const isAtividadeAvulsa = atuacao.atividadeId.startsWith("__ATIVIDADE_AVULSA__");
        const tituloAtividade = isAtividadeAvulsa 
          ? (atuacao.tituloAvulsa || "(Atividade avulsa)")
          : (atividadesById.get(atuacao.atividadeId) ?? "Atividade removida");
        const projeto = projetosById.get(atuacao.projetoId);
        const nomeProjeto = projeto?.titulo ?? "Projeto removido";
        const nomeEmpresa = projeto?.empresa ?? "Empresa não informada";
        const hd = hdByAtuacaoId.get(atuacao.id) ?? 0;

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70"
            onClick={() => setSelectedAtuacaoId(null)}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Detalhes da Atuação
                </h2>
                <button
                  onClick={() => setSelectedAtuacaoId(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Data</p>
                    <p className="text-base text-gray-900 dark:text-white">{formatDate(atuacao.data)}</p>
                  </div>
                  {atuacao.horarioInicio && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Horário de Início</p>
                      <p className="text-base text-gray-900 dark:text-white">{atuacao.horarioInicio}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Empresa</p>
                  <p className="text-base text-gray-900 dark:text-white">{nomeEmpresa}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Projeto</p>
                  <p className="text-base text-gray-900 dark:text-white">{nomeProjeto}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Atividade</p>
                  <p className="text-base text-gray-900 dark:text-white">{tituloAtividade}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipo</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                      {tipoLabel[atuacao.tipo]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      {statusLabel[atuacao.statusAtividadeNoRegistro]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Horas Utilizadas (HU)</p>
                    <p className="text-base text-gray-900 dark:text-white">{atuacao.horasUtilizadas}h</p>
                  </div>
                </div>

                {!isAtividadeAvulsa && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Horas Disponíveis (HD)</p>
                    <p className="text-base text-gray-900 dark:text-white">{hd.toFixed(2)}h</p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Descrição</p>
                  {(() => {
                    if (isAtividadeAvulsa) {
                      return (
                        <p className="text-base text-gray-500 dark:text-gray-400 italic">
                          Nenhuma descrição adicional
                        </p>
                      );
                    }
                    const atividadeRelacionada = getAtividadeById(atuacao.atividadeId);
                    const descricaoAtividade = atividadeRelacionada?.descricao;
                    return (
                      <p className="text-base text-gray-900 dark:text-white whitespace-pre-wrap">
                        {descricaoAtividade || "Nenhuma descrição adicional"}
                      </p>
                    );
                  })()}
                </div>

                {atuacao.impactoGerado && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Impacto Gerado</p>
                    <p className="text-base text-gray-900 dark:text-white whitespace-pre-wrap">{atuacao.impactoGerado}</p>
                  </div>
                )}

                {atuacao.evidenciaUrl && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Evidência</p>
                    <a 
                      href={atuacao.evidenciaUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 break-all"
                    >
                      {atuacao.evidenciaUrl}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedAtuacaoId(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Fechar
                </button>
                <Link
                  href={`/dashboard/atuacao/${atuacao.id}/editar`}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  onClick={() => setSelectedAtuacaoId(null)}
                >
                  Editar Atuação
                </Link>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

