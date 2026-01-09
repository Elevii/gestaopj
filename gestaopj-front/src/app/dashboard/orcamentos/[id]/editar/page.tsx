"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useOrcamentos } from "@/contexts/OrcamentoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import {
  OrcamentoCampoAtividade,
  OrcamentoEntregavel,
  OrcamentoItem,
} from "@/types";
import {
  formatTodayISODateLocal,
  gerarCronogramaSequencial,
} from "@/utils/estimativas";

interface AtividadeOrcamento {
  id: string;
  titulo: string;
  horasEstimadas: number;
}

export default function EditarOrcamentoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { userCompanies } = useAuth();
  const { company } = useCompany();

  // Verificar acesso - membros não podem acessar
  useEffect(() => {
    if (!company) return;
    const membership = userCompanies.find((m) => m.companyId === company.id);
    if (membership?.role === "member") {
      router.push("/dashboard");
    }
  }, [company, userCompanies, router]);

  const { projetos } = useProjetos();
  const { getOrcamentoById, updateOrcamento } = useOrcamentos();
  const orcamento = getOrcamentoById(id);

  // Verificar se orçamento existe e está aberto
  useEffect(() => {
    if (orcamento && orcamento.status !== "aberto") {
      router.push(`/dashboard/orcamentos/${id}`);
    }
  }, [orcamento, id, router]);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const camposDisponiveis: { key: OrcamentoCampoAtividade; label: string }[] = [
    { key: "titulo", label: "Título" },
    { key: "status", label: "Status" },
    { key: "dataInicio", label: "Data início" },
    { key: "dataFimEstimada", label: "Término estimado" },
    { key: "horasAtuacao", label: "Horas estimadas" },
    { key: "custoTarefa", label: "Custo da tarefa" },
    { key: "custoCalculado", label: "Custo calculado (horas × valor/hora)" },
    { key: "horasUtilizadas", label: "Horas utilizadas" },
  ];

  const [form, setForm] = useState({
    projetoId: orcamento?.projetoId || "",
    titulo: orcamento?.titulo || "Orçamento",
    dataInicioProjeto: orcamento?.dataInicioProjeto || formatTodayISODateLocal(),
    camposSelecionados: (orcamento?.camposSelecionados || [
      "titulo",
      "dataInicio",
      "horasAtuacao",
      "custoTarefa",
    ]) as OrcamentoCampoAtividade[],
    usarEntregaveis: orcamento?.usarEntregaveis ?? true,
    mostrarSubtotaisPorEntregavel: orcamento?.mostrarSubtotaisPorEntregavel ?? true,
    mostrarDatasCronograma: orcamento?.mostrarDatasCronograma ?? true,
    introText: orcamento?.observacoes || "",
    tipoCalculo: (orcamento?.valorHora ? "valorHora" : "custoTotal") as "valorHora" | "custoTotal",
    valorHora: orcamento?.valorHora,
    custoTotal: orcamento?.custoTotal,
  });

  const [atividadesOrcamento, setAtividadesOrcamento] = useState<AtividadeOrcamento[]>(() => {
    if (!orcamento) return [];
    return orcamento.itens.map((item, idx) => ({
      id: `ativ_${idx}_${Date.now()}`,
      titulo: item.titulo,
      horasEstimadas: item.horasEstimadas,
    }));
  });

  const [novaAtividade, setNovaAtividade] = useState({ titulo: "", horasEstimadas: "" });

  const projeto = useMemo(
    () => projetos.find((p) => p.id === form.projetoId),
    [form.projetoId, projetos]
  );

  const [itemMeta, setItemMeta] = useState<
    Record<
      string,
      { entregavelId?: string; inicioOverride?: string; fimOverride?: string }
    >
  >(() => {
    if (!orcamento) return {};
    const meta: Record<string, { entregavelId?: string; inicioOverride?: string; fimOverride?: string }> = {};
    orcamento.itens.forEach((item, idx) => {
      const atividadeId = atividadesOrcamento[idx]?.id || `ativ_${idx}`;
      meta[atividadeId] = {
        entregavelId: item.entregavelId,
        inicioOverride: item.inicioOverride,
        fimOverride: item.fimOverride,
      };
    });
    return meta;
  });

  const [entregaveis, setEntregaveis] = useState<OrcamentoEntregavel[]>(() => {
    return orcamento?.entregaveis || [
      {
        id: "ent_default_1",
        titulo: "Etapa 1",
        ordem: 0,
        checkpoints: [],
      },
    ];
  });

  const itens: OrcamentoItem[] = useMemo(() => {
    return atividadesOrcamento.map((atividade, idx) => ({
      titulo: atividade.titulo,
      horasEstimadas: atividade.horasEstimadas,
      ordem: idx,
      entregavelId: itemMeta[atividade.id]?.entregavelId || entregaveis[0]?.id,
      inicioOverride: itemMeta[atividade.id]?.inicioOverride,
      fimOverride: itemMeta[atividade.id]?.fimOverride,
    }));
  }, [atividadesOrcamento, itemMeta, entregaveis]);

  const cronogramaPreview = useMemo(() => {
    if (!projeto) return [];
    if (itens.length === 0) return [];

    return gerarCronogramaSequencial({
      dataInicioProjetoISO: form.dataInicioProjeto,
      horasUteisPorDia: projeto.horasUteisPorDia,
      itens: itens.map((it, idx) => ({
        atividadeId: atividadesOrcamento[idx]?.id || `temp_${idx}`,
        horasEstimadas: it.horasEstimadas,
        inicioOverride: it.inicioOverride,
        fimOverride: it.fimOverride,
      })),
    });
  }, [atividadesOrcamento, form.dataInicioProjeto, itens, projeto]);

  const addEntregavel = () => {
    const ordem = entregaveis.length;
    setEntregaveis((prev) => [
      ...prev,
      {
        id: `ent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        titulo: `Etapa ${ordem + 1}`,
        ordem,
        checkpoints: [],
      },
    ]);
  };

  const removeEntregavel = (id: string) => {
    if (entregaveis.length <= 1) return;

    setEntregaveis((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      const firstId = filtered[0].id;

      setItemMeta((meta) => {
        const newMeta = { ...meta };
        Object.keys(newMeta).forEach((key) => {
          if (newMeta[key].entregavelId === id) {
            newMeta[key] = { ...newMeta[key], entregavelId: firstId };
          }
        });
        return newMeta;
      });

      return filtered;
    });
  };

  const addCheckpoint = (entregavelId: string) => {
    setEntregaveis((prev) =>
      prev.map((e) => {
        if (e.id !== entregavelId) return e;
        const ordem = e.checkpoints.length;
        return {
          ...e,
          checkpoints: [
            ...e.checkpoints,
            {
              id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              titulo: `Checkpoint ${ordem + 1}`,
              ordem,
            },
          ],
        };
      })
    );
  };

  const adicionarAtividade = () => {
    const titulo = novaAtividade.titulo.trim();
    const horas = parseFloat(novaAtividade.horasEstimadas);

    if (!titulo) {
      setErrors((prev) => ({ ...prev, novaAtividade: "Título é obrigatório" }));
      return;
    }

    if (isNaN(horas) || horas <= 0) {
      setErrors((prev) => ({ ...prev, novaAtividade: "Horas estimadas deve ser maior que zero" }));
      return;
    }

    setAtividadesOrcamento((prev) => [
      ...prev,
      {
        id: `ativ_temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        titulo,
        horasEstimadas: horas,
      },
    ]);

    setNovaAtividade({ titulo: "", horasEstimadas: "" });
    setErrors((prev) => {
      const { novaAtividade: _, ...rest } = prev;
      return rest;
    });
  };

  const removerAtividade = (id: string) => {
    setAtividadesOrcamento((prev) => prev.filter((a) => a.id !== id));
    setItemMeta((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSave = async () => {
    if (!orcamento) return;

    setErrors({});
    const nextErrors: Record<string, string> = {};
    if (!form.projetoId) nextErrors.projetoId = "Projeto é obrigatório";
    if (!form.titulo.trim()) nextErrors.titulo = "Título é obrigatório";
    if (atividadesOrcamento.length === 0)
      nextErrors.atividades = "Adicione ao menos uma atividade";
    if (form.camposSelecionados.length === 0)
      nextErrors.camposSelecionados = "Selecione ao menos um campo";
    if (form.tipoCalculo === "valorHora" && (!form.valorHora || form.valorHora <= 0)) {
      nextErrors.valorHora = "Valor por hora é obrigatório e deve ser maior que zero";
    }
    if (form.tipoCalculo === "custoTotal" && (!form.custoTotal || form.custoTotal <= 0)) {
      nextErrors.custoTotal = "Custo total é obrigatório e deve ser maior que zero";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const data = {
        projetoId: form.projetoId,
        titulo: form.titulo.trim(),
        dataInicioProjeto: form.dataInicioProjeto,
        camposSelecionados: form.camposSelecionados,
        itens,
        usarEntregaveis: form.usarEntregaveis,
        mostrarSubtotaisPorEntregavel: form.usarEntregaveis
          ? form.mostrarSubtotaisPorEntregavel
          : false,
        mostrarDatasCronograma: form.mostrarDatasCronograma,
        entregaveis: form.usarEntregaveis ? entregaveis : undefined,
        observacoes: form.introText,
        valorHora: form.tipoCalculo === "valorHora" ? form.valorHora : undefined,
        custoTotal: form.tipoCalculo === "custoTotal" ? form.custoTotal : undefined,
      };
      await updateOrcamento(orcamento.id, data);
      router.push(`/dashboard/orcamentos/${orcamento.id}`);
    } catch (e) {
      console.error(e);
      setErrors({ submit: "Erro ao salvar orçamento. Tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  if (!orcamento) {
    return (
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400">Orçamento não encontrado.</p>
      </div>
    );
  }

  if (orcamento.status !== "aberto") {
    return (
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400">
          Este orçamento não pode ser editado porque já foi aprovado.
        </p>
        <Link
          href={`/dashboard/orcamentos/${orcamento.id}`}
          className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          Voltar para detalhes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/orcamentos/${id}`}
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
          Voltar para orçamento
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Editar Orçamento
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Edite as informações do orçamento
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {errors.submit && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30">
            {errors.submit}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Projeto <span className="text-red-500">*</span>
          </label>
          <select
            value={form.projetoId}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                projetoId: e.target.value,
              }))
            }
            disabled
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white bg-gray-50 cursor-not-allowed"
          >
            <option value="">Selecione...</option>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo} ({p.empresa})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            O projeto não pode ser alterado após a criação do orçamento.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            value={form.titulo}
            onChange={(e) =>
              setForm((p) => ({ ...p, titulo: e.target.value }))
            }
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors.titulo ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Ex: Orçamento - Projeto X"
          />
          {errors.titulo && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.titulo}
            </p>
          )}

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4 mb-2">
            Texto Introdutório (opcional)
          </label>
          <textarea
            value={form.introText}
            onChange={(e) => {
              if (e.target.value.length <= 1000) {
                setForm((p) => ({ ...p, introText: e.target.value }));
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
            placeholder="Adicione um texto introdutório ao orçamento (máx 1000 caracteres)"
            rows={3}
          />
          <p className="text-xs text-right text-gray-500 dark:text-gray-400 mt-1">
            {form.introText.length}/1000
          </p>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cálculo de Custo
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipoCalculo"
                  value="valorHora"
                  checked={form.tipoCalculo === "valorHora"}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      tipoCalculo: "valorHora",
                      custoTotal: undefined,
                    }))
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Valor por hora
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipoCalculo"
                  value="custoTotal"
                  checked={form.tipoCalculo === "custoTotal"}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      tipoCalculo: "custoTotal",
                      valorHora: undefined,
                    }))
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Custo total
                </span>
              </label>
            </div>

            {form.tipoCalculo === "valorHora" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valor por hora (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valorHora ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      valorHora: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white ${
                    errors.valorHora ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  O custo de cada tarefa será calculado como: horas estimadas × valor/hora
                </p>
                {errors.valorHora && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {errors.valorHora}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custo Total (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.custoTotal ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      custoTotal: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white ${
                    errors.custoTotal ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  O custo de cada tarefa será exibido como "-"
                </p>
                {errors.custoTotal && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {errors.custoTotal}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Atividades <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {atividadesOrcamento.length} adicionada(s)
                </span>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={novaAtividade.titulo}
                    onChange={(e) =>
                      setNovaAtividade((prev) => ({
                        ...prev,
                        titulo: e.target.value,
                      }))
                    }
                    placeholder="Título da atividade"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarAtividade();
                      }
                    }}
                  />
                  <input
                    type="number"
                    value={novaAtividade.horasEstimadas}
                    onChange={(e) =>
                      setNovaAtividade((prev) => ({
                        ...prev,
                        horasEstimadas: e.target.value,
                      }))
                    }
                    placeholder="Horas"
                    min="0.1"
                    step="0.1"
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarAtividade();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={adicionarAtividade}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    Adicionar
                  </button>
                </div>
                {errors.novaAtividade && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {errors.novaAtividade}
                  </p>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {atividadesOrcamento.map((atividade) => (
                    <div
                      key={atividade.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {atividade.titulo}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {atividade.horasEstimadas}h estimadas
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removerAtividade(atividade.id)}
                        className="ml-3 text-red-600 hover:text-red-800 dark:text-red-400 p-1"
                        title="Remover atividade"
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
                  ))}
                  {atividadesOrcamento.length === 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
                      Nenhuma atividade adicionada. Adicione atividades acima.
                    </p>
                  )}
                </div>
              </div>
              {errors.atividades && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.atividades}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Campos do orçamento <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {camposDisponiveis.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.camposSelecionados.includes(c.key)}
                      onChange={() =>
                        setForm((prev) => {
                          const has = prev.camposSelecionados.includes(c.key);
                          return {
                            ...prev,
                            camposSelecionados: has
                              ? prev.camposSelecionados.filter(
                                  (x) => x !== c.key
                                )
                              : [...prev.camposSelecionados, c.key],
                          };
                        })
                      }
                      className="mt-1"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {c.label}
                    </span>
                  </label>
                ))}
              </div>
              {errors.camposSelecionados && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.camposSelecionados}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Cronograma (preview)
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Sequencial por dias úteis, com possibilidade de override por
                    atividade.
                  </p>
                </div>
                <div className="w-44">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Início do cronograma
                  </label>
                  <input
                    type="date"
                    value={form.dataInicioProjeto}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        dataInicioProjeto: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Atividade
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Início
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Fim
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Alterar datas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {cronogramaPreview.map((c, idx) => {
                      const atividade = atividadesOrcamento[idx];
                      return (
                        <tr key={atividade?.id || idx}>
                          <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                            {atividade?.titulo ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                            {c.inicio}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                            {c.fim}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={
                                  itemMeta[atividade?.id || ""]?.inicioOverride ?? ""
                                }
                                onChange={(e) =>
                                  setItemMeta((prev) => ({
                                    ...prev,
                                    [atividade?.id || ""]: {
                                      ...prev[atividade?.id || ""],
                                      inicioOverride:
                                        e.target.value || undefined,
                                    },
                                  }))
                                }
                                className="w-36 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                              />
                              <input
                                type="date"
                                value={
                                  itemMeta[atividade?.id || ""]?.fimOverride ?? ""
                                }
                                onChange={(e) =>
                                  setItemMeta((prev) => ({
                                    ...prev,
                                    [atividade?.id || ""]: {
                                      ...prev[atividade?.id || ""],
                                      fimOverride: e.target.value || undefined,
                                    },
                                  }))
                                }
                                className="w-36 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setItemMeta((prev) => {
                                    const { [atividade?.id || ""]: _, ...rest } = prev;
                                    return rest;
                                  })
                                }
                                className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                              >
                                limpar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {cronogramaPreview.length === 0 && (
                      <tr>
                        <td
                          className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400"
                          colSpan={4}
                        >
                          Adicione atividades para ver o cronograma.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Etapas / Entregas Planejadas
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Organize o orçamento em etapas. Sempre haverá pelo menos
                    uma etapa padrão.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.mostrarSubtotaisPorEntregavel}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        mostrarSubtotaisPorEntregavel: e.target.checked,
                      }))
                    }
                  />
                  Mostrar subtotais por etapa no PDF
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.mostrarDatasCronograma}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        mostrarDatasCronograma: e.target.checked,
                      }))
                    }
                  />
                  Exibir colunas de data de início e término no PDF
                </label>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Etapas: {entregaveis.length}
                  </p>
                  <button
                    type="button"
                    onClick={addEntregavel}
                    className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    Adicionar etapa
                  </button>
                </div>

                {entregaveis.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <input
                        value={e.titulo}
                        onChange={(ev) =>
                          setEntregaveis((prev) =>
                            prev.map((x) =>
                              x.id === e.id
                                ? { ...x, titulo: ev.target.value }
                                : x
                            )
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        placeholder="Nome da etapa"
                      />
                      {entregaveis.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEntregavel(e.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 p-2"
                          title="Remover etapa"
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
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          (Opcional) Entregas Planejadas: {e.checkpoints.length}
                        </p>
                        <button
                          type="button"
                          onClick={() => addCheckpoint(e.id)}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                        >
                          Adicionar entrega
                        </button>
                      </div>

                      {e.checkpoints.map((c) => (
                        <div
                          key={c.id}
                          className="grid grid-cols-1 md:grid-cols-3 gap-2"
                        >
                          <input
                            value={c.titulo}
                            onChange={(ev) =>
                              setEntregaveis((prev) =>
                                prev.map((x) => {
                                  if (x.id !== e.id) return x;
                                  return {
                                    ...x,
                                    checkpoints: x.checkpoints.map((k) =>
                                      k.id === c.id
                                        ? { ...k, titulo: ev.target.value }
                                        : k
                                    ),
                                  };
                                })
                              )
                            }
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                            placeholder="Título da entrega"
                          />
                          <input
                            type="date"
                            value={c.dataAlvo ?? ""}
                            onChange={(ev) =>
                              setEntregaveis((prev) =>
                                prev.map((x) => {
                                  if (x.id !== e.id) return x;
                                  return {
                                    ...x,
                                    checkpoints: x.checkpoints.map((k) =>
                                      k.id === c.id
                                        ? {
                                            ...k,
                                            dataAlvo:
                                              ev.target.value || undefined,
                                          }
                                        : k
                                    ),
                                  };
                                })
                              )
                            }
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEntregaveis((prev) =>
                                prev.map((x) => {
                                  if (x.id !== e.id) return x;
                                  return {
                                    ...x,
                                    checkpoints: x.checkpoints.filter(
                                      (k) => k.id !== c.id
                                    ),
                                  };
                                })
                              )
                            }
                            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {entregaveis.length > 0 && atividadesOrcamento.length > 0 && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Atribuição de atividades
                    </p>
                    <div className="space-y-2">
                      {atividadesOrcamento.map((atividade) => (
                        <div
                          key={atividade.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="text-sm text-gray-900 dark:text-white truncate">
                            {atividade.titulo}
                          </span>
                          <select
                            value={
                              itemMeta[atividade.id]?.entregavelId ||
                              entregaveis[0].id
                            }
                            onChange={(ev) =>
                              setItemMeta((prev) => ({
                                ...prev,
                                [atividade.id]: {
                                  ...prev[atividade.id],
                                  entregavelId:
                                    ev.target.value || undefined,
                                },
                              }))
                            }
                            className="w-56 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                          >
                            {entregaveis
                              .slice()
                              .sort((x, y) => x.ordem - y.ordem)
                              .map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.titulo}
                                </option>
                              ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href={`/dashboard/orcamentos/${id}`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

