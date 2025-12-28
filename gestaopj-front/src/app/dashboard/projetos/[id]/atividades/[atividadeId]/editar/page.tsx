"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useAtividades } from "@/contexts/AtividadeContext";
import { StatusAtividade } from "@/types";
import { calcularDataFimEstimada } from "@/utils/estimativas";
import { useFormatDate } from "@/hooks/useFormatDate";

export default function EditarAtividadePage() {
  const router = useRouter();
  const params = useParams();
  const projetoId = params.id as string;
  const atividadeId = params.atividadeId as string;
  const { getProjetoById } = useProjetos();
  const { getAtividadeById, updateAtividade } = useAtividades();
  const { formatDate } = useFormatDate();

  const projeto = getProjetoById(projetoId);
  const atividade = getAtividadeById(atividadeId);

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    titulo?: string;
    dataInicio?: string;
    horasAtuacao?: string;
  }>({});

  const [formData, setFormData] = useState({
    titulo: "",
    dataInicio: "",
    horasAtuacao: "",
    horasUtilizadas: "",
    custoTarefa: "",
    status: "pendente" as StatusAtividade,
  });
  const [custoManual, setCustoManual] = useState(false);
  const lastHorasAtuacaoRef = useRef<string>("");

  useEffect(() => {
    if (atividade) {
      setFormData({
        titulo: atividade.titulo,
        dataInicio: atividade.dataInicio,
        horasAtuacao: atividade.horasAtuacao.toString(),
        horasUtilizadas: (atividade.horasUtilizadas || 0).toString(),
        custoTarefa: (
          // fallback para dados antigos caso ainda existam no state
          (atividade as any).custoTarefa ?? (atividade as any).lucroEstimado ?? 0
        ).toString(),
        status: atividade.status || "pendente",
      });
      // inicializa a ref para não disparar "reset" na primeira interação
      lastHorasAtuacaoRef.current = atividade.horasAtuacao.toString();
    }
  }, [atividade]);

  // Regra: alterou horas estimadas => volta para cálculo automático (último valor passa a ser o cálculo)
  useEffect(() => {
    const last = lastHorasAtuacaoRef.current;
    const current = formData.horasAtuacao;

    if (last !== "" && last !== current && custoManual) {
      setCustoManual(false);
    }

    lastHorasAtuacaoRef.current = current;
  }, [custoManual, formData.horasAtuacao]);

  // Cálculo automático do custo quando o usuário não está editando manualmente
  useEffect(() => {
    if (!projeto) return;
    if (custoManual) return;

    const horasAtuacao = parseFloat(formData.horasAtuacao || "0");
    const custo = horasAtuacao * (projeto.valorHora ?? 0);

    if (!Number.isFinite(custo)) return;
    setFormData((prev) => ({ ...prev, custoTarefa: custo.toFixed(2) }));
  }, [custoManual, formData.horasAtuacao, projeto]);

  if (!projeto || !atividade) {
    return (
      <div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Projeto ou atividade não encontrado
          </p>
          <Link
            href={`/dashboard/projetos/${projetoId || ""}`}
            className="mt-4 inline-block text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            Voltar para o projeto
          </Link>
        </div>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "custoTarefa") {
      setCustoManual(true);
    }
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const newErrors: {
      titulo?: string;
      dataInicio?: string;
      horasAtuacao?: string;
    } = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = "Título da atividade é obrigatório";
    } else if (formData.titulo.trim().length < 3) {
      newErrors.titulo = "Título deve ter no mínimo 3 caracteres";
    }

    if (!formData.dataInicio) {
      newErrors.dataInicio = "Data de início é obrigatória";
    }

    if (!formData.horasAtuacao) {
      newErrors.horasAtuacao = "Horas de atuação são obrigatórias";
    } else {
      const horas = parseFloat(formData.horasAtuacao);
      if (isNaN(horas) || horas <= 0) {
        newErrors.horasAtuacao = "Horas devem ser um número maior que zero";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const custoNumerico = parseFloat(formData.custoTarefa || "0");
      await updateAtividade(atividadeId, {
        titulo: formData.titulo.trim(),
        dataInicio: formData.dataInicio,
        horasAtuacao: parseFloat(formData.horasAtuacao),
        horasUtilizadas: parseFloat(formData.horasUtilizadas || "0"),
        status: formData.status,
        ...(custoManual
          ? {
              custoTarefa: isNaN(custoNumerico) ? 0 : custoNumerico,
            }
          : {}),
      });

      router.push(`/dashboard/projetos/${projetoId}`);
    } catch (error) {
      console.error("Erro ao atualizar atividade:", error);
      setErrors({
        titulo: "Erro ao atualizar atividade. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };


  const custoCalculado = parseFloat(formData.custoTarefa || "0");
  const horasAtuacaoNum = parseFloat(formData.horasAtuacao || "0");
  const terminoEstimadoISO =
    formData.dataInicio && horasAtuacaoNum > 0
      ? calcularDataFimEstimada(
          formData.dataInicio,
          horasAtuacaoNum,
          projeto.horasUteisPorDia
        )
      : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/projetos/${projetoId}`}
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
          Voltar para o projeto
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Editar Atividade
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Atualize as informações da atividade
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Título */}
              <div>
                <label
                  htmlFor="titulo"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Título da Atividade <span className="text-red-500">*</span>
                </label>
                <input
                  id="titulo"
                  name="titulo"
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 ${
                    errors.titulo
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300"
                  }`}
                  placeholder="Ex: Desenvolvimento da API, Design do layout..."
                />
                {errors.titulo && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.titulo}
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_execucao">Em execução</option>
                  <option value="concluida">Concluída</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  O status será atualizado pela tela de atuações
                </p>
              </div>

              {/* Data de Início */}
              <div>
                <label
                  htmlFor="dataInicio"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Estimativa de Início <span className="text-red-500">*</span>
                </label>
                <input
                  id="dataInicio"
                  name="dataInicio"
                  type="date"
                  required
                  value={formData.dataInicio}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors.dataInicio
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300"
                  }`}
                />
                {errors.dataInicio && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.dataInicio}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Horas Estimadas */}
                <div>
                  <label
                    htmlFor="horasAtuacao"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Horas Estimadas <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="horasAtuacao"
                    name="horasAtuacao"
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    value={formData.horasAtuacao}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 ${
                      errors.horasAtuacao
                        ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="Ex: 40"
                  />
                  {errors.horasAtuacao && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.horasAtuacao}
                    </p>
                  )}
                </div>

                {/* Horas Utilizadas */}
                <div>
                  <label
                    htmlFor="horasUtilizadas"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Horas Utilizadas
                  </label>
                  <input
                    id="horasUtilizadas"
                    name="horasUtilizadas"
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.horasUtilizadas}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="Ex: 35"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Atualizado pela tela de atuações
                  </p>
                </div>
              </div>

              {/* Custo da Tarefa */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="custoTarefa"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Custo da Tarefa
                  </label>
                  {custoManual && (
                    <button
                      type="button"
                      onClick={() => setCustoManual(false)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      Usar cálculo automático
                    </button>
                  )}
                </div>
                <input
                  id="custoTarefa"
                  name="custoTarefa"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.custoTarefa}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  placeholder="Calculado automaticamente"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {custoManual ? "Valor ajustado manualmente" : "Calculado automaticamente"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  href={`/dashboard/projetos/${projetoId}`}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Salvando...
                    </span>
                  ) : (
                    "Salvar Alterações"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Resumo
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Status
                </p>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    formData.status === "concluida"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : formData.status === "em_execucao"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {formData.status === "concluida"
                    ? "Concluída"
                    : formData.status === "em_execucao"
                      ? "Em execução"
                      : "Pendente"}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Horas Utilizadas
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {formData.horasUtilizadas || "0"}h
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Término Estimado
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {formatDate(terminoEstimadoISO)}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Baseado em {formData.horasAtuacao || "0"}h estimadas
                </p>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Custo da Tarefa
                </p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(custoCalculado)}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formData.horasAtuacao || "0"}h ×{" "}
                  {formatCurrency(projeto.valorHora ?? 0)}/h
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



