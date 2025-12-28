"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { TipoCobranca } from "@/types";

export default function NovoProjetoPage() {
  const router = useRouter();
  const { createProjeto } = useProjetos();
  const { configuracoes } = useConfiguracoes();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    empresa?: string;
    titulo?: string;
    valorHora?: string;
    valorFixo?: string;
    horasUteisPorDia?: string;
  }>({});

  const [formData, setFormData] = useState({
    empresa: "",
    titulo: "",
    valorHora: "",
    valorFixo: "",
    tipoCobranca: "horas" as TipoCobranca,
    horasUteisPorDia: "8",
  });

  // Inicializar com horas úteis padrão das configurações
  useEffect(() => {
    if (configuracoes.horasUteisPadrao) {
      setFormData((prev) => ({
        ...prev,
        horasUteisPorDia: String(configuracoes.horasUteisPadrao).replace(".", ","),
      }));
    }
  }, [configuracoes.horasUteisPadrao]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const formatCurrency = (value: string) => {
    // Remove tudo que não é dígito
    const digits = value.replace(/\D/g, "");
    // Converte para número e divide por 100 para ter os centavos
    const number = parseInt(digits, 10) / 100;
    // Formata como moeda brasileira
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  };

  const handleValorChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "valorHora" | "valorFixo"
  ) => {
    const value = e.target.value;
    const formatted = formatCurrency(value);
    setFormData((prev) => ({ ...prev, [field]: formatted }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const parseCurrency = (value: string): number => {
    return parseFloat(value.replace(/\./g, "").replace(",", "."));
  };

  // Função para parsear horas úteis (aceita ponto ou vírgula como separador decimal)
  const parseHorasUteis = (value: string): number => {
    // Substitui vírgula por ponto e remove espaços
    const normalized = value.replace(",", ".").trim();
    return parseFloat(normalized);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    // Validação
    const newErrors: {
      empresa?: string;
      titulo?: string;
      valorHora?: string;
      valorFixo?: string;
      horasUteisPorDia?: string;
    } = {};

    if (!formData.empresa.trim()) {
      newErrors.empresa = "Empresa contratante é obrigatória";
    }

    if (!formData.titulo.trim()) {
      newErrors.titulo = "Título do projeto é obrigatório";
    } else if (formData.titulo.trim().length < 3) {
      newErrors.titulo = "Título deve ter no mínimo 3 caracteres";
    }

    if (formData.tipoCobranca === "horas") {
      if (!formData.valorHora) {
        newErrors.valorHora = "Valor por hora é obrigatório";
      } else {
        const valor = parseCurrency(formData.valorHora);
        if (valor <= 0) {
          newErrors.valorHora = "Valor deve ser maior que zero";
        }
      }
    } else {
      if (!formData.valorFixo) {
        newErrors.valorFixo = "Valor do projeto é obrigatório";
      } else {
        const valor = parseCurrency(formData.valorFixo);
        if (valor <= 0) {
          newErrors.valorFixo = "Valor deve ser maior que zero";
        }
      }
    }

    const horasUteis = parseHorasUteis(formData.horasUteisPorDia);
    if (!formData.horasUteisPorDia) {
      newErrors.horasUteisPorDia = "Horas úteis por dia é obrigatório";
    } else if (isNaN(horasUteis) || horasUteis < 1 || horasUteis > 24) {
      newErrors.horasUteisPorDia = "Horas úteis por dia deve ser entre 1 e 24";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Criar projeto
    setIsLoading(true);
    try {
      const novoProjeto = await createProjeto({
        empresa: formData.empresa.trim(),
        titulo: formData.titulo.trim(),
        tipoCobranca: formData.tipoCobranca,
        valorHora: formData.tipoCobranca === "horas" ? parseCurrency(formData.valorHora) : undefined,
        valorFixo: formData.tipoCobranca === "fixo" ? parseCurrency(formData.valorFixo) : undefined,
        horasUteisPorDia: parseHorasUteis(formData.horasUteisPorDia),
      });
      
      // Redirecionar para detalhes do projeto criado
      router.push(`/dashboard/projetos/${novoProjeto.id}`);
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
      setErrors({
        titulo: "Erro ao criar projeto. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/projetos"
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
            Voltar para projetos
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Novo Projeto
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Crie um novo projeto para organizar suas atividades
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Empresa Contratante */}
          <div>
            <label
              htmlFor="empresa"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Empresa Contratante <span className="text-red-500">*</span>
            </label>
            <input
              id="empresa"
              name="empresa"
              type="text"
              required
              value={formData.empresa}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 ${
                errors.empresa
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300"
              }`}
              placeholder="Nome da empresa cliente"
            />
            {errors.empresa && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.empresa}
              </p>
            )}
          </div>

          {/* Título do Projeto */}
          <div>
            <label
              htmlFor="titulo"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Título do Projeto <span className="text-red-500">*</span>
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
              placeholder="Ex: Sistema de Gestão, Landing Page, etc."
            />
            {errors.titulo && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.titulo}
              </p>
            )}
          </div>

          {/* Tipo de Cobrança */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Cobrança
            </label>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="tipoCobranca"
                  value="horas"
                  checked={formData.tipoCobranca === "horas"}
                  onChange={handleChange}
                  className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                />
                <span className="ml-2 text-gray-700 dark:text-gray-300">
                  Por Hora
                </span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="tipoCobranca"
                  value="fixo"
                  checked={formData.tipoCobranca === "fixo"}
                  onChange={handleChange}
                  className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                />
                <span className="ml-2 text-gray-700 dark:text-gray-300">
                  Valor Fixo
                </span>
              </label>
            </div>
          </div>

          {/* Valor Financeiro */}
          <div>
            <label
              htmlFor={formData.tipoCobranca === "horas" ? "valorHora" : "valorFixo"}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {formData.tipoCobranca === "horas" ? "Valor por Hora" : "Valor do Projeto"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                R$
              </span>
              <input
                id={formData.tipoCobranca === "horas" ? "valorHora" : "valorFixo"}
                name={formData.tipoCobranca === "horas" ? "valorHora" : "valorFixo"}
                type="text"
                required
                value={
                  formData.tipoCobranca === "horas"
                    ? formData.valorHora
                    : formData.valorFixo
                }
                onChange={(e) =>
                  handleValorChange(
                    e,
                    formData.tipoCobranca === "horas" ? "valorHora" : "valorFixo"
                  )
                }
                className={`w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 ${
                  errors[formData.tipoCobranca === "horas" ? "valorHora" : "valorFixo"]
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0,00"
              />
            </div>
            {errors[formData.tipoCobranca === "horas" ? "valorHora" : "valorFixo"] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors[formData.tipoCobranca === "horas" ? "valorHora" : "valorFixo"]}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formData.tipoCobranca === "horas"
                ? "Este valor será usado para calcular a receita das atividades"
                : "Valor total fechado para o projeto"}
            </p>
          </div>

          {/* Horas úteis por dia */}
          <div>
            <label
              htmlFor="horasUteisPorDia"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Horas úteis por dia <span className="text-red-500">*</span>
            </label>
            <input
              id="horasUteisPorDia"
              name="horasUteisPorDia"
              type="text"
              required
              value={formData.horasUteisPorDia}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 ${
                errors.horasUteisPorDia
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300"
              }`}
              placeholder="8 ou 8,5 ou 8.5"
            />
            {errors.horasUteisPorDia && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.horasUteisPorDia}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Usado para calcular o término estimado das atividades (dias úteis).
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/dashboard/projetos"
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
                "Criar Projeto"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

