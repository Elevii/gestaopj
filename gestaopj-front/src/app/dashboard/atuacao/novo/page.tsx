"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useAtividades } from "@/contexts/AtividadeContext";
import { useAtuacoes } from "@/contexts/AtuacaoContext";
import { StatusAtividade, TipoAtuacao } from "@/types";
import { formatTodayISODateLocal } from "@/utils/estimativas";

type Errors = Partial<Record<string, string>> & {
  tituloAvulsa?: string;
};

const tipoOptions: { value: TipoAtuacao; label: string }[] = [
  { value: "reuniao", label: "Reunião" },
  { value: "execucao", label: "Execução" },
  { value: "planejamento", label: "Planejamento" },
];

const statusOptions: { value: StatusAtividade; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_execucao", label: "Em execução" },
  { value: "concluida", label: "Concluída" },
];

const statusLabel: Record<StatusAtividade, string> = {
  pendente: "Pendente",
  em_execucao: "Em execução",
  concluida: "Concluída",
};

export default function NovaAtuacaoPage() {
  const router = useRouter();
  const { projetos } = useProjetos();
  const { getAtividadesByProjeto } = useAtividades();
  const { createAtuacao } = useAtuacoes();

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [formData, setFormData] = useState({
    projetoId: "",
    atividadeId: "",
    data: formatTodayISODateLocal(),
    horarioInicio: "",
    horasUtilizadas: "",
    tipo: "execucao" as TipoAtuacao,
    statusAtividadeNoRegistro: "em_execucao" as StatusAtividade,
    tituloAvulsa: "",
    descricao: "",
    impactoGerado: "",
    evidenciaUrl: "",
  });
  const [statusManual, setStatusManual] = useState(false);

  useEffect(() => {
    // Pré-seleciona o primeiro projeto (se existir) para reduzir cliques.
    if (!formData.projetoId && projetos.length > 0) {
      setFormData((prev) => ({ ...prev, projetoId: projetos[0].id }));
    }
  }, [formData.projetoId, projetos]);

  const atividadesDoProjeto = useMemo(() => {
    if (!formData.projetoId) return [];
    
    const todas = getAtividadesByProjeto(formData.projetoId);
    // Filtra atividades concluídas, mas sempre mantém a atividade avulsa
    const atividadeAvulsa = todas.find((a) => a.id.startsWith("__ATIVIDADE_AVULSA__"));
    const outras = todas.filter((a) => a.status !== "concluida" && !a.id.startsWith("__ATIVIDADE_AVULSA__"));
    
    // Atividade avulsa sempre aparece no final
    return atividadeAvulsa ? [...outras, atividadeAvulsa] : outras;
  }, [formData.projetoId, getAtividadesByProjeto]);

  const atividadesOrdenadas = useMemo(() => {
    const prioridade: Record<StatusAtividade, number> = {
      em_execucao: 0,
      pendente: 1,
      concluida: 2,
    };

    // Separa atividade avulsa das outras
    const atividadeAvulsa = atividadesDoProjeto.find((a) => a.id.startsWith("__ATIVIDADE_AVULSA__"));
    const outras = atividadesDoProjeto.filter((a) => !a.id.startsWith("__ATIVIDADE_AVULSA__"));

    // Ordena as outras atividades
    const outrasOrdenadas = outras.sort((a, b) => {
      const pa = prioridade[a.status] ?? 99;
      const pb = prioridade[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.titulo.localeCompare(b.titulo, "pt-BR");
    });

    // Atividade avulsa sempre no final
    return atividadeAvulsa ? [...outrasOrdenadas, atividadeAvulsa] : outrasOrdenadas;
  }, [atividadesDoProjeto]);

  const atividadeSelecionada = useMemo(() => {
    return atividadesDoProjeto.find((a) => a.id === formData.atividadeId);
  }, [atividadesDoProjeto, formData.atividadeId]);

  const isAtividadeAvulsa = atividadeSelecionada?.id.startsWith("__ATIVIDADE_AVULSA__") ?? false;
  const horasEstimadas = isAtividadeAvulsa ? Infinity : (atividadeSelecionada?.horasAtuacao ?? 0);
  const horasUtilizadasAtuais = atividadeSelecionada?.horasUtilizadas ?? 0;
  const horasNovaAtuacao = parseFloat(formData.horasUtilizadas || "0") || 0;
  const totalHorasAposSalvar = horasUtilizadasAtuais + horasNovaAtuacao;
  const saldoAposSalvar = isAtividadeAvulsa ? Infinity : (horasEstimadas - totalHorasAposSalvar);

  useEffect(() => {
    // Default do registro: "Em execução", a menos que a atividade já esteja "Concluída".
    if (!atividadeSelecionada) return;
    setStatusManual(false);
    setFormData((prev) => ({
      ...prev,
      statusAtividadeNoRegistro:
        atividadeSelecionada.status === "concluida" ? "concluida" : "em_execucao",
    }));
  }, [atividadeSelecionada]);

  useEffect(() => {
    // Se a atividade selecionada não pertence ao projeto atual, reseta.
    if (!formData.atividadeId) return;
    const exists = atividadesDoProjeto.some((a) => a.id === formData.atividadeId);
    if (!exists) {
      setFormData((prev) => ({ ...prev, atividadeId: "" }));
    }
  }, [atividadesDoProjeto, formData.atividadeId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const nextErrors: Errors = {};
    if (!formData.projetoId) nextErrors.projetoId = "Projeto é obrigatório";
    if (!formData.atividadeId) nextErrors.atividadeId = "Atividade é obrigatória";
    if (!formData.data) nextErrors.data = "Data da atuação é obrigatória";

    const horas = parseFloat(formData.horasUtilizadas);
    if (!formData.horasUtilizadas) {
      nextErrors.horasUtilizadas = "Horas utilizadas é obrigatório";
    } else if (isNaN(horas) || horas <= 0) {
      nextErrors.horasUtilizadas = "Horas utilizadas deve ser maior que zero";
    }

    if (!formData.tipo) nextErrors.tipo = "Tipo é obrigatório";
    if (!formData.statusAtividadeNoRegistro)
      nextErrors.statusAtividadeNoRegistro = "Status é obrigatório";

    // Validação do título para atividade avulsa
    if (isAtividadeAvulsa) {
      if (!formData.tituloAvulsa || !formData.tituloAvulsa.trim()) {
        nextErrors.tituloAvulsa = "Título é obrigatório para atividade avulsa";
      } else if (formData.tituloAvulsa.trim().length > 30) {
        nextErrors.tituloAvulsa = "Título deve ter no máximo 30 caracteres";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsLoading(true);
    try {
      await createAtuacao({
        projetoId: formData.projetoId,
        atividadeId: formData.atividadeId,
        data: formData.data,
        horarioInicio: formData.horarioInicio || undefined,
        horasEstimadasNoRegistro: isAtividadeAvulsa ? 0 : horasEstimadas,
        horasUtilizadas: horas,
        tipo: formData.tipo,
        statusAtividadeNoRegistro: formData.statusAtividadeNoRegistro,
        tituloAvulsa: isAtividadeAvulsa ? formData.tituloAvulsa.trim() : undefined,
        descricao: formData.descricao.trim() || undefined,
        impactoGerado: formData.impactoGerado.trim() || undefined,
        evidenciaUrl: formData.evidenciaUrl.trim() || undefined,
      });

      router.push("/dashboard/atuacao");
    } catch (error) {
      console.error("Erro ao registrar atuação:", error);
      setErrors({ submit: "Erro ao registrar atuação. Tente novamente." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/atuacao"
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mb-2 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar para atuações
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Registrar Atuação
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Registre o que foi feito em uma atividade
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="projetoId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Projeto <span className="text-red-500">*</span>
              </label>
              <select
                id="projetoId"
                name="projetoId"
                value={formData.projetoId}
                onChange={(e) => {
                  // trocar projeto deve resetar atividade
                  handleChange(e);
                  setFormData((prev) => ({ ...prev, projetoId: e.target.value, atividadeId: "" }));
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.projetoId ? "border-red-500" : "border-gray-300"
                }`}
              >
                <option value="">Selecione um projeto</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.empresa} - {p.titulo}
                  </option>
                ))}
              </select>
              {errors.projetoId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.projetoId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="atividadeId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Atividade <span className="text-red-500">*</span>
              </label>
              <select
                id="atividadeId"
                name="atividadeId"
                value={formData.atividadeId}
                onChange={handleChange}
                disabled={!formData.projetoId}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.atividadeId ? "border-red-500" : "border-gray-300"
                } ${!formData.projetoId ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <option value="">Selecione uma atividade</option>
                {atividadesOrdenadas.map((a) => {
                  const isAvulsa = a.id.startsWith("__ATIVIDADE_AVULSA__");
                  return (
                    <option key={a.id} value={a.id}>
                      {isAvulsa ? "📌 " : ""}
                      {isAvulsa ? a.titulo : `(${statusLabel[a.status]}) - ${a.titulo}`}
                    </option>
                  );
                })}
              </select>
              {errors.atividadeId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.atividadeId}
                </p>
              )}
            </div>
          </div>

          {/* Campo de título para atividade avulsa */}
          {formData.projetoId && formData.atividadeId && isAtividadeAvulsa && (
            <div>
              <label
                htmlFor="tituloAvulsa"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Título da atividade avulsa <span className="text-red-500">*</span>
              </label>
              <input
                id="tituloAvulsa"
                name="tituloAvulsa"
                type="text"
                maxLength={30}
                required
                value={formData.tituloAvulsa}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.tituloAvulsa ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Ex: Reunião com cliente, Planejamento sprint..."
              />
              <div className="mt-1 flex items-center justify-between">
                {errors.tituloAvulsa ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.tituloAvulsa}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Descreva brevemente a atividade avulsa
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formData.tituloAvulsa.length}/30
                </p>
              </div>
            </div>
          )}

          {formData.projetoId && formData.atividadeId && (
            <>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      Detalhes da atuação
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Preencha primeiro os campos obrigatórios para registrar a atuação.
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Campos obrigatórios <span className="text-red-500">*</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Obrigatórios */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="data"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                          Data <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="data"
                          name="data"
                          type="date"
                          value={formData.data}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                            errors.data ? "border-red-500" : "border-gray-300"
                          }`}
                        />
                        {errors.data && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.data}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="horasUtilizadas"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                          Horas utilizadas (HU) <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="horasUtilizadas"
                          name="horasUtilizadas"
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={formData.horasUtilizadas}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                            errors.horasUtilizadas ? "border-red-500" : "border-gray-300"
                          }`}
                          placeholder="Ex: 2"
                        />
                        {errors.horasUtilizadas && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.horasUtilizadas}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="tipo"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                          Tipo <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="tipo"
                          name="tipo"
                          value={formData.tipo}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                            errors.tipo ? "border-red-500" : "border-gray-300"
                          }`}
                        >
                          {tipoOptions.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        {errors.tipo && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.tipo}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="statusAtividadeNoRegistro"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                          Status da atividade <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="statusAtividadeNoRegistro"
                          name="statusAtividadeNoRegistro"
                          value={formData.statusAtividadeNoRegistro}
                          onChange={(e) => {
                            setStatusManual(true);
                            handleChange(e);
                          }}
                          disabled={!formData.atividadeId}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                            errors.statusAtividadeNoRegistro ? "border-red-500" : "border-gray-300"
                          } ${!formData.atividadeId ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          {statusOptions.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        {errors.statusAtividadeNoRegistro && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.statusAtividadeNoRegistro}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Esse status será salvo na atuação e aplicado na atividade do projeto.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contexto da atividade */}
                  <div className="lg:col-span-1">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Horas estimadas (HE)
                        </p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {!atividadeSelecionada ? "-" : isAtividadeAvulsa ? "Ilimitadas" : `${horasEstimadas}h`}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Após salvar
                        </p>
                        <div
                          className={`w-full px-4 py-3 border rounded-lg ${
                            !atividadeSelecionada
                              ? "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-300"
                              : isAtividadeAvulsa
                              ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300"
                              : saldoAposSalvar >= 0
                              ? "border-green-300 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300"
                              : "border-red-300 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                          }`}
                        >
                          {!atividadeSelecionada ? (
                            <span>-</span>
                          ) : isAtividadeAvulsa ? (
                            <span>
                              <span className="font-semibold">Atividade avulsa</span>
                              <br />
                              <span className="text-xs">Sem limite de horas</span>
                            </span>
                          ) : saldoAposSalvar >= 0 ? (
                            <span>
                              Disponíveis:{" "}
                              <span className="font-semibold">
                                {saldoAposSalvar.toFixed(2)}h
                              </span>
                            </span>
                          ) : (
                            <span>
                              Ultrapassadas:{" "}
                              <span className="font-semibold">
                                {Math.abs(saldoAposSalvar).toFixed(2)}h
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {isAtividadeAvulsa
                            ? "Use para registrar tarefas não mapeadas, reuniões ou planejamentos."
                            : "Calculado a partir de HE e HU acumulado."}
                        </p>
                      </div>

                      <details className="group">
                        <summary className="cursor-pointer select-none text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          Campos opcionais
                        </summary>
                        <div className="mt-3 space-y-4">
                          <div>
                            <label
                              htmlFor="horarioInicio"
                              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                              Horário de início
                            </label>
                            <input
                              id="horarioInicio"
                              name="horarioInicio"
                              type="time"
                              value={formData.horarioInicio}
                              onChange={handleChange}
                              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Usado em relatórios
                            </p>
                          </div>

                          <div>
                            <label
                              htmlFor="descricao"
                              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                              Descrição do que foi feito
                            </label>
                            <textarea
                              id="descricao"
                              name="descricao"
                              value={formData.descricao}
                              onChange={handleChange}
                              rows={3}
                              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                              placeholder="Descreva brevemente o que foi realizado..."
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="impactoGerado"
                              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                              Impacto gerado
                            </label>
                            <textarea
                              id="impactoGerado"
                              name="impactoGerado"
                              value={formData.impactoGerado}
                              onChange={handleChange}
                              rows={2}
                              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                              placeholder="Ex.: Redução de tempo, melhoria de performance, alinhamento com stakeholder..."
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="evidenciaUrl"
                              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                              Link da evidência
                            </label>
                            <input
                              id="evidenciaUrl"
                              name="evidenciaUrl"
                              type="url"
                              value={formData.evidenciaUrl}
                              onChange={handleChange}
                              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                              placeholder="https://exemplo.com/evidencia"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              URL da evidência que comprova a atuação realizada
                            </p>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  href="/dashboard/atuacao"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? "Salvando..." : "Registrar Atuação"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}


