"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useAtividades } from "@/contexts/AtividadeContext";
import {
  calcularDataFimEstimada,
  formatTodayISODateLocal,
  parseISODateToLocal,
} from "@/utils/estimativas";
import { useFormatDate } from "@/hooks/useFormatDate";;

export default function NovaAtividadePage() {
  const router = useRouter();
  const params = useParams();
  const projetoId = params.id as string;
  const { getProjetoById } = useProjetos();
  const { createAtividade } = useAtividades();
  const { formatDate } = useFormatDate();

  const projeto = getProjetoById(projetoId);

  if (!projeto) {
    return (
      <div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Projeto não encontrado
          </p>
          <Link
            href="/dashboard/projetos"
            className="mt-4 inline-block text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            Voltar para projetos
          </Link>
        </div>
      </div>
    );
  }

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    titulo?: string;
    dataInicio?: string;
    horasAtuacao?: string;
  }>({});

  const [formData, setFormData] = useState({
    titulo: "",
    dataInicio: formatTodayISODateLocal(), // Data atual (local) como padrão
    horasAtuacao: "",
    custoTarefa: "",
    descricao: "",
  });
  const [custoManual, setCustoManual] = useState(false);
  const lastHorasAtuacaoRef = useRef<string>("");

  // Regra: alterou horas estimadas => volta para cálculo automático (último valor passa a ser o cálculo)
  useEffect(() => {
    const last = lastHorasAtuacaoRef.current;
    const current = formData.horasAtuacao;

    // ignora primeira execução (montagem)
    if (last !== "" && last !== current && custoManual) {
      setCustoManual(false);
    }

    lastHorasAtuacaoRef.current = current;
  }, [custoManual, formData.horasAtuacao]);

  // Calcular data fim estimada e custo
  const calcularEstimativas = () => {
    if (!formData.dataInicio || !formData.horasAtuacao || !projeto) {
      return { dataFim: null, custo: null };
    }

    const horas = parseFloat(formData.horasAtuacao);
    if (isNaN(horas) || horas <= 0) {
      return { dataFim: null, custo: null };
    }
    const dataFimISO = calcularDataFimEstimada(
      formData.dataInicio,
      horas,
      projeto.horasUteisPorDia
    );
    const custo = horas * (projeto?.valorHora || 0);

    return {
      dataFim: dataFimISO,
      custo: projeto.tipoCobranca === "fixo" ? 0 : custo,
    };
  };

  const estimativas = calcularEstimativas();

  // Cálculo automático do custo (a menos que o usuário tenha editado manualmente)
  useEffect(() => {
    if (custoManual) return;
    if (!projeto) return;

    if (projeto.tipoCobranca === "fixo") {
      setFormData((prev) => ({ ...prev, custoTarefa: "0" }));
      return;
    }

    const horas = parseFloat(formData.horasAtuacao);
    if (isNaN(horas) || horas <= 0) {
      setFormData((prev) => ({ ...prev, custoTarefa: "" }));
      return;
    }

    const custo = horas * (projeto.valorHora ?? 0);
    setFormData((prev) => ({ ...prev, custoTarefa: custo.toFixed(2) }));
  }, [custoManual, formData.horasAtuacao, projeto]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "custoTarefa") {
      setCustoManual(true);
    }
    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    // Validação
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
    } else {
      const dataInicio = parseISODateToLocal(formData.dataInicio);
      const hoje = parseISODateToLocal(formatTodayISODateLocal());
      if (!dataInicio || !hoje) {
        newErrors.dataInicio = "Data de início inválida";
      } else if (dataInicio < hoje) {
        newErrors.dataInicio = "Data de início não pode ser no passado";
      }
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

    // Criar atividade
    setIsLoading(true);
    try {
      const custoNumerico = parseFloat(formData.custoTarefa || "0");
      await createAtividade(
        {
          projetoId,
          titulo: formData.titulo.trim(),
          dataInicio: formData.dataInicio,
          horasAtuacao: parseFloat(formData.horasAtuacao),
          ...(formData.descricao.trim() ? { descricao: formData.descricao.trim() } : {}),
          ...(custoManual
            ? {
                custoTarefa: isNaN(custoNumerico) ? 0 : custoNumerico,
              }
            : {}),
        },
        projetoId
      );

      // Redirecionar para detalhes do projeto
      router.push(`/dashboard/projetos/${projetoId}`);
    } catch (error) {
      console.error("Erro ao criar atividade:", error);
      setErrors({
        titulo: "Erro ao criar atividade. Tente novamente.",
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
          Nova Atividade
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Adicione uma nova atividade ao projeto
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
                  min={formatTodayISODateLocal()}
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

              {/* Horas de Atuação */}
              <div>
                <label
                  htmlFor="horasAtuacao"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Horas de Atuação <span className="text-red-500">*</span>
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
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Estimativa de horas que serão dedicadas a esta atividade
                </p>
              </div>

              {/* Descrição */}
              <div>
                <label
                  htmlFor="descricao"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Descrição
                </label>
                <textarea
                  id="descricao"
                  name="descricao"
                  rows={4}
                  value={formData.descricao}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 resize-y"
                  placeholder="Descrição opcional da atividade..."
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Informações adicionais sobre esta atividade (opcional)
                </p>
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
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 border-gray-300"
                  placeholder="Calculado automaticamente"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {projeto?.tipoCobranca === "fixo"
                    ? "Projeto de valor fixo (custo por hora não se aplica)"
                    : `Padrão: ${formData.horasAtuacao || "0"}h × ${
                        projeto ? formatCurrency(projeto.valorHora ?? 0) : "R$ 0,00"
                      }/h. Você pode ajustar.`}
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
                      Criando...
                    </span>
                  ) : (
                    "Criar Atividade"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Preview das Estimativas */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Estimativas
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Término Estimado
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {formatDate(estimativas.dataFim)}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Baseado em {formData.horasAtuacao || "0"}h trabalhadas
                </p>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Custo da Tarefa
                </p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {formData.custoTarefa
                    ? formatCurrency(parseFloat(formData.custoTarefa) || 0)
                    : estimativas.custo
                      ? formatCurrency(estimativas.custo)
                      : "R$ 0,00"}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {custoManual ? "Valor ajustado manualmente" : "Calculado automaticamente"}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {projeto?.tipoCobranca === "fixo"
                    ? "Projeto de Valor Fixo"
                    : `${formData.horasAtuacao || "0"}h × ${
                        projeto ? formatCurrency(projeto.valorHora ?? 0) : "R$ 0,00"
                      }/h`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

