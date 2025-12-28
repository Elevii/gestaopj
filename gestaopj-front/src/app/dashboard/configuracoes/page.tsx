"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

const FUSOS_HORARIOS = [
  { value: "America/Sao_Paulo", label: "São Paulo (UTC-3)" },
  { value: "America/Manaus", label: "Manaus (UTC-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (UTC-5)" },
  { value: "America/Fortaleza", label: "Fortaleza (UTC-3)" },
  { value: "America/Recife", label: "Recife (UTC-3)" },
  { value: "America/Bahia", label: "Bahia (UTC-3)" },
  { value: "America/Belem", label: "Belém (UTC-3)" },
  { value: "America/Campo_Grande", label: "Campo Grande (UTC-4)" },
  { value: "America/Cuiaba", label: "Cuiabá (UTC-4)" },
];

const FORMATOS_DATA = [
  { value: "dd/MM/yyyy", label: "DD/MM/AAAA (Brasil)" },
  { value: "MM/dd/yyyy", label: "MM/DD/AAAA (EUA)" },
  { value: "yyyy-MM-dd", label: "AAAA-MM-DD (ISO)" },
];

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { configuracoes, loading, updateConfiguracoes } = useConfiguracoes();
  const { userCompanies } = useAuth();
  const { company } = useCompany();
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  // Verificar acesso - membros não podem acessar
  useEffect(() => {
    if (!company) return;
    const membership = userCompanies.find((m) => m.companyId === company.id);
    if (membership?.role === "member") {
      router.push("/dashboard");
    }
  }, [company, userCompanies, router]);
  const [errors, setErrors] = useState<{
    nomeEmpresa?: string;
    horasUteisPadrao?: string;
  }>({});

  const [formData, setFormData] = useState({
    nomeEmpresa: "",
    horasUteisPadrao: "8",
    fusoHorario: "America/Sao_Paulo",
    formatoData: "dd/MM/yyyy" as "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd",
  });

  useEffect(() => {
    if (configuracoes) {
      setFormData({
        nomeEmpresa: configuracoes.nomeEmpresa,
        horasUteisPadrao: configuracoes.horasUteisPadrao.toString(),
        fusoHorario: configuracoes.fusoHorario,
        formatoData: configuracoes.formatoData,
      });
    }
  }, [configuracoes]);

  const parseHorasUteis = (value: string): number => {
    const normalized = value.replace(",", ".").trim();
    return parseFloat(normalized);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage(false);

    const newErrors: {
      nomeEmpresa?: string;
      horasUteisPadrao?: string;
    } = {};

    // Validação do nome da empresa
    if (formData.nomeEmpresa.trim() && formData.nomeEmpresa.trim().length < 2) {
      newErrors.nomeEmpresa = "Nome da empresa deve ter no mínimo 2 caracteres";
    } else if (formData.nomeEmpresa.trim().length > 100) {
      newErrors.nomeEmpresa = "Nome da empresa deve ter no máximo 100 caracteres";
    }

    // Validação das horas úteis
    const horas = parseHorasUteis(formData.horasUteisPadrao);
    if (isNaN(horas) || horas < 1 || horas > 24) {
      newErrors.horasUteisPadrao = "Horas úteis deve ser entre 1 e 24";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      await updateConfiguracoes({
        nomeEmpresa: formData.nomeEmpresa.trim(),
        horasUteisPadrao: horas,
        fusoHorario: formData.fusoHorario,
        formatoData: formData.formatoData,
      });

      setSuccessMessage(true);
      setTimeout(() => setSuccessMessage(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Preview do formato de data
  const getDatePreview = () => {
    const hoje = new Date();
    const formato = formData.formatoData;
    const fuso = formData.fusoHorario;

    const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
      timeZone: fuso,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(hoje);

    if (formato === "dd/MM/yyyy") {
      return dataFormatada;
    } else if (formato === "MM/dd/yyyy") {
      const [dia, mes, ano] = dataFormatada.split("/");
      return `${mes}/${dia}/${ano}`;
    } else {
      const [dia, mes, ano] = dataFormatada.split("/");
      return `${ano}-${mes}-${dia}`;
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Carregando configurações...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Configurações
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Personalize as configurações do sistema
        </p>
      </div>

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm text-green-800 dark:text-green-200">
            Configurações salvas com sucesso!
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações da Empresa */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Informações da Empresa
          </h2>
          <div>
            <label
              htmlFor="nomeEmpresa"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Nome da Empresa
            </label>
            <input
              id="nomeEmpresa"
              name="nomeEmpresa"
              type="text"
              maxLength={100}
              value={formData.nomeEmpresa}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.nomeEmpresa ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Nome do usuário cadastrado"
            />
            {errors.nomeEmpresa && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.nomeEmpresa}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Este campo será preenchido automaticamente quando o sistema de
              cadastro for implementado
            </p>
          </div>
        </div>

        {/* Horas Úteis Padrão */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Horas Úteis Padrão
          </h2>
          <div>
            <label
              htmlFor="horasUteisPadrao"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Horas úteis por dia
            </label>
            <input
              id="horasUteisPadrao"
              name="horasUteisPadrao"
              type="text"
              value={formData.horasUteisPadrao}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.horasUteisPadrao ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="8 ou 8,5 ou 8.5"
            />
            {errors.horasUteisPadrao && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.horasUteisPadrao}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Valor padrão usado ao criar novos projetos (1-24 horas, decimal
              permitido)
            </p>
          </div>
        </div>

        {/* Preferências de Localização */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Preferências de Localização
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="fusoHorario"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Fuso Horário
              </label>
              <select
                id="fusoHorario"
                name="fusoHorario"
                value={formData.fusoHorario}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
              >
                {FUSOS_HORARIOS.map((fuso) => (
                  <option key={fuso.value} value={fuso.value}>
                    {fuso.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="formatoData"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Formato de Data
              </label>
              <select
                id="formatoData"
                name="formatoData"
                value={formData.formatoData}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
              >
                {FORMATOS_DATA.map((formato) => (
                  <option key={formato.value} value={formato.value}>
                    {formato.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Preview:
                </p>
                <p className="text-sm font-mono text-gray-900 dark:text-white">
                  {getDatePreview()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </form>
    </div>
  );
}



