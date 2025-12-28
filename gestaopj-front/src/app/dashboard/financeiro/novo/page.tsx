"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjetos } from "@/contexts/ProjetoContext";
import { useFaturamento } from "@/contexts/FaturamentoContext";
import { useFaturaPermissions } from "@/hooks/useFaturaPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatTodayISODateLocal } from "@/utils/estimativas";
import { CreateLembreteDTO, FrequenciaRecorrencia } from "@/types";
import { addDays, addMonths, addWeeks, addYears, format, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFormatDate } from "@/hooks/useFormatDate";
import { companyMembershipService } from "@/services/companyMembershipService";
import { userService } from "@/services/userService";
import { atuacaoService } from "@/services/atuacaoService";
import { userCompanySettingsService } from "@/services/userCompanySettingsService";

export default function NovaFaturaPage() {
  const router = useRouter();
  const { projetos } = useProjetos();
  const { createFatura, faturas } = useFaturamento();
  const { formatDate } = useFormatDate();
  const { canGenerateInvoices } = useFaturaPermissions();
  const { user } = useAuth();
  const { company } = useCompany();

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  // Estados para membros e cálculo
  const [availableMembers, setAvailableMembers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [calculatedHours, setCalculatedHours] = useState<number | null>(null);
  const [calculatedValue, setCalculatedValue] = useState<number | null>(null);
  const [calculationType, setCalculationType] = useState<"horas" | "fixo" | null>(null);

  // Período padrão: mês anterior
  const lastMonth = subMonths(new Date(), 1);
  const defaultPeriodStart = format(startOfMonth(lastMonth), "yyyy-MM-dd");
  const defaultPeriodEnd = format(endOfMonth(lastMonth), "yyyy-MM-dd");

  const [formData, setFormData] = useState({
    projetoId: "",
    userId: "",
    titulo: "",
    valor: "",
    dataVencimento: formatTodayISODateLocal(),
    periodoInicio: defaultPeriodStart,
    periodoFim: defaultPeriodEnd,
    observacoes: "",
  });

  // Recorrência
  const [usarRecorrencia, setUsarRecorrencia] = useState(false);
  const [recorrencia, setRecorrencia] = useState<{
    frequencia: FrequenciaRecorrencia;
    repeticoes: number;
  }>({
    frequencia: "mensal",
    repeticoes: 2,
  });

  // Lembretes
  const [lembretes, setLembretes] = useState<CreateLembreteDTO[]>([]);
  const [novoLembrete, setNovoLembrete] = useState<{
    titulo: string;
    tipo: "relativo" | "fixo";
    diasAntes: string;
    dataFixa: string;
  }>({
    titulo: "",
    tipo: "relativo",
    diasAntes: "5",
    dataFixa: "",
  });

  const [suggestedValue, setSuggestedValue] = useState<number | null>(null);

  // Carregar membros da empresa
  useEffect(() => {
    const loadMembers = async () => {
      if (!company) {
        setLoadingMembers(false);
        return;
      }

      try {
        setLoadingMembers(true);
        const memberships = await companyMembershipService.findByCompanyId(company.id);
        const membersData = await Promise.all(
          memberships.map(async (membership) => {
            const userData = await userService.findById(membership.userId);
            return userData ? { id: userData.id, name: userData.name, email: userData.email } : null;
          })
        );
        setAvailableMembers(membersData.filter((m): m is { id: string; name: string; email: string } => m !== null));
      } catch (error) {
        console.error("Erro ao carregar membros:", error);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [company]);

  // Pre-selecionar usuário atual se for membro
  useEffect(() => {
    if (!canGenerateInvoices && user && availableMembers.length > 0) {
      const isMember = availableMembers.find(m => m.id === user.id);
      if (isMember && !formData.userId) {
        setFormData((prev) => ({ ...prev, userId: user.id }));
      }
    }
  }, [canGenerateInvoices, user, availableMembers, formData.userId]);

  useEffect(() => {
    // Pre-seleciona primeiro projeto
    if (!formData.projetoId && projetos.length > 0) {
      setFormData((prev) => ({ ...prev, projetoId: projetos[0].id }));
    }
  }, [formData.projetoId, projetos]);

  // Calcular horas e valor automaticamente
  useEffect(() => {
    const calculateHoursAndValue = async () => {
      if (!formData.projetoId || !formData.userId || !formData.periodoInicio || !formData.periodoFim) {
        setCalculatedHours(null);
        setCalculatedValue(null);
        setCalculationType(null);
        return;
      }

      try {
        const projeto = projetos.find((p) => p.id === formData.projetoId);
        if (!projeto) return;

        // Calcular horas trabalhadas
        const atuacoes = await atuacaoService.findAll(projeto.companyId);
        const periodoInicio = parseISO(formData.periodoInicio);
        const periodoFim = parseISO(formData.periodoFim);
        
        const atuacoesDoPeriodo = atuacoes.filter((a) => {
          if (a.projetoId !== formData.projetoId || a.userId !== formData.userId) return false;
          const dataAtuacao = parseISO(a.data);
          return dataAtuacao >= periodoInicio && dataAtuacao <= periodoFim;
        });

        const horas = atuacoesDoPeriodo.reduce((total, a) => total + (a.horasUtilizadas || 0), 0);
        setCalculatedHours(horas);

        // Determinar tipo de cálculo
        const settings = await userCompanySettingsService.findByUserAndCompany(
          formData.userId,
          projeto.companyId
        );

        const tipoCalculo: "horas" | "fixo" = settings?.horista || projeto.tipoCobranca === "horas" ? "horas" : "fixo";
        setCalculationType(tipoCalculo);

        let valor: number;
        if (tipoCalculo === "horas") {
          const valorPorHora = projeto.valorHora || 0;
          valor = horas * valorPorHora;
        } else {
          valor = projeto.valorFixo || 0;
        }

        setCalculatedValue(valor);
        
        // Atualizar valor no formulário se não foi preenchido manualmente
        if (!formData.valor || parseFloat(formData.valor) === 0) {
          setFormData((prev) => ({ ...prev, valor: valor.toString() }));
        }
      } catch (error) {
        console.error("Erro ao calcular horas/valor:", error);
      }
    };

    calculateHoursAndValue();
  }, [formData.projetoId, formData.userId, formData.periodoInicio, formData.periodoFim, projetos]);

  useEffect(() => {
    if (!formData.projetoId) return;

    const projeto = projetos.find((p) => p.id === formData.projetoId);
    if (!projeto) return;

    if (projeto.tipoCobranca === "fixo" && projeto.valorFixo) {
      const faturasDoProjeto = faturas.filter(
        (f) => f.projetoId === projeto.id && f.status !== "cancelado"
      );
      const totalFaturado = faturasDoProjeto.reduce(
        (acc, curr) => acc + curr.valor,
        0
      );
      const restante = Math.max(0, projeto.valorFixo - totalFaturado);

      setSuggestedValue(restante);
      // Sugere o valor restante se o campo estiver vazio
      if (!formData.valor) {
        setFormData((prev) => ({ ...prev, valor: restante.toString() }));
      }
    } else {
      setSuggestedValue(null);
    }
  }, [formData.projetoId, faturas, projetos, formData.valor]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const addLembrete = () => {
    if (!novoLembrete.titulo) return;

    const lembrete: CreateLembreteDTO = {
      titulo: novoLembrete.titulo,
    };

    if (novoLembrete.tipo === "relativo") {
      const dias = parseInt(novoLembrete.diasAntes);
      if (isNaN(dias)) return;
      lembrete.diasAntesVencimento = dias;
    } else {
      if (!novoLembrete.dataFixa) return;
      lembrete.dataFixa = novoLembrete.dataFixa;
    }

    setLembretes([...lembretes, lembrete]);
    setNovoLembrete({
      titulo: "",
      tipo: "relativo",
      diasAntes: "5",
      dataFixa: "",
    });
  };

  const removeLembrete = (index: number) => {
    setLembretes(lembretes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const nextErrors: Partial<Record<string, string>> = {};
    if (!formData.projetoId) nextErrors.projetoId = "Projeto é obrigatório";
    if (!formData.userId) nextErrors.userId = "Usuário é obrigatório";
    if (!formData.titulo) nextErrors.titulo = "Título é obrigatório";
    if (!formData.dataVencimento)
      nextErrors.dataVencimento = "Data de vencimento é obrigatória";
    if (!formData.periodoInicio) nextErrors.periodoInicio = "Período de início é obrigatório";
    if (!formData.periodoFim) nextErrors.periodoFim = "Período de fim é obrigatório";

    if (formData.periodoInicio && formData.periodoFim) {
      const inicio = parseISO(formData.periodoInicio);
      const fim = parseISO(formData.periodoFim);
      if (inicio > fim) {
        nextErrors.periodoFim = "Data de fim deve ser posterior à data de início";
      }
    }

    const valorNum = parseFloat(formData.valor);
    if (!formData.valor) {
      nextErrors.valor = "Valor é obrigatório";
    } else if (isNaN(valorNum) || valorNum <= 0) {
      nextErrors.valor = "Valor deve ser maior que zero";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsLoading(true);
    try {
      await createFatura({
        projetoId: formData.projetoId,
        userId: formData.userId,
        titulo: formData.titulo,
        valor: valorNum,
        dataVencimento: formData.dataVencimento,
        periodoInicio: formData.periodoInicio,
        periodoFim: formData.periodoFim,
        horasTrabalhadas: calculatedHours || undefined,
        observacoes: formData.observacoes.trim() || undefined,
        recorrencia: usarRecorrencia ? recorrencia : undefined,
        lembretesIniciais: lembretes, // Sempre envia lembretes se houver
      });

      router.push("/dashboard/gestao-financeira");
    } catch (error) {
      console.error("Erro ao criar fatura:", error);
      setErrors({ submit: "Erro ao criar fatura. Tente novamente." });
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

  // Preview das Datas
  const getPreviewDates = () => {
    if (!formData.dataVencimento) return [];
    const dates: Date[] = [];
    const baseDate = parseISO(formData.dataVencimento);
    const count = usarRecorrencia ? recorrencia.repeticoes : 1;

    for (let i = 0; i < count; i++) {
        let nextDate = baseDate;
        if (usarRecorrencia && i > 0) {
            switch (recorrencia.frequencia) {
                case "semanal": nextDate = addWeeks(baseDate, i); break;
                case "quinzenal": nextDate = addWeeks(baseDate, i * 2); break;
                case "mensal": nextDate = addMonths(baseDate, i); break;
                case "anual": nextDate = addYears(baseDate, i); break;
            }
        }
        dates.push(nextDate);
    }
    return dates;
  };

  const previewDates = getPreviewDates();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/gestao-financeira"
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
          Voltar para financeiro
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Nova Fatura
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Lance uma nova fatura ou previsão de recebimento
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
                  setFormData((prev) => ({
                    ...prev,
                    projetoId: e.target.value,
                    valor: "",
                  }));
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.projetoId ? "border-red-500" : "border-gray-300"
                }`}
              >
                <option value="">Selecione um projeto</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo}
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
                htmlFor="userId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Usuário <span className="text-red-500">*</span>
              </label>
              <select
                id="userId"
                name="userId"
                value={formData.userId}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    userId: e.target.value,
                    valor: "",
                  }));
                }}
                disabled={loadingMembers || !canGenerateInvoices}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.userId ? "border-red-500" : "border-gray-300"
                } ${loadingMembers || !canGenerateInvoices ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <option value="">Selecione um usuário</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
              {errors.userId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.userId}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="periodoInicio"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Período de Início <span className="text-red-500">*</span>
              </label>
              <input
                id="periodoInicio"
                name="periodoInicio"
                type="date"
                value={formData.periodoInicio}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.periodoInicio ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.periodoInicio && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.periodoInicio}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="periodoFim"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Período de Fim <span className="text-red-500">*</span>
              </label>
              <input
                id="periodoFim"
                name="periodoFim"
                type="date"
                value={formData.periodoFim}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.periodoFim ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.periodoFim && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.periodoFim}
                </p>
              )}
            </div>
          </div>

          {/* Preview do cálculo */}
          {(calculatedHours !== null || calculatedValue !== null) && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-2">
                Cálculo Automático
              </h4>
              <div className="space-y-1 text-sm">
                {calculatedHours !== null && (
                  <p className="text-indigo-700 dark:text-indigo-300">
                    Horas trabalhadas no período: <strong>{calculatedHours.toFixed(2)}h</strong>
                  </p>
                )}
                {calculationType && (
                  <p className="text-indigo-700 dark:text-indigo-300">
                    Tipo de cálculo: <strong>{calculationType === "horas" ? "Por horas" : "Valor fixo"}</strong>
                  </p>
                )}
                {calculatedValue !== null && (
                  <p className="text-indigo-700 dark:text-indigo-300">
                    Valor calculado: <strong>{formatCurrency(calculatedValue)}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="titulo"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Título <span className="text-red-500">*</span>
              </label>
              <input
                id="titulo"
                name="titulo"
                type="text"
                value={formData.titulo}
                onChange={handleChange}
                placeholder="Ex: Parcela 1, Fatura #001"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.titulo ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.titulo && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.titulo}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="valor"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Valor (R$) <span className="text-red-500">*</span>
              </label>
              <input
                id="valor"
                name="valor"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.valor ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.valor && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.valor}
                </p>
              )}
              {suggestedValue !== null && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Restante do contrato: {formatCurrency(suggestedValue)}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="dataVencimento"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {usarRecorrencia ? "Data do Primeiro Vencimento" : "Data de Vencimento"} <span className="text-red-500">*</span>
              </label>
              <input
                id="dataVencimento"
                name="dataVencimento"
                type="date"
                value={formData.dataVencimento}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.dataVencimento ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.dataVencimento && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.dataVencimento}
                </p>
              )}
              {usarRecorrencia && formData.dataVencimento && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      As próximas datas serão calculadas a partir desta.
                  </p>
              )}
            </div>
          </div>

          {/* Recorrência */}
          <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="usarRecorrencia"
                checked={usarRecorrencia}
                onChange={(e) => setUsarRecorrencia(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
              />
              <label
                htmlFor="usarRecorrencia"
                className="ml-2 block text-sm font-semibold text-gray-900 dark:text-white cursor-pointer"
              >
                Fatura Recorrente?
              </label>
            </div>

            {usarRecorrencia && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Frequência
                    </label>
                    <select
                        value={recorrencia.frequencia}
                        onChange={(e) =>
                        setRecorrencia({
                            ...recorrencia,
                            frequencia: e.target.value as FrequenciaRecorrencia,
                        })
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="semanal">Semanal (Toda semana)</option>
                        <option value="quinzenal">Quinzenal (A cada 15 dias)</option>
                        <option value="mensal">Mensal (Todo mês)</option>
                        <option value="anual">Anual (Todo ano)</option>
                    </select>
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Repetições (Quantidade)
                    </label>
                    <input
                        type="number"
                        min="2"
                        max="12"
                        value={recorrencia.repeticoes}
                        onChange={(e) =>
                        setRecorrencia({
                            ...recorrencia,
                            repeticoes: parseInt(e.target.value),
                        })
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    </div>
                </div>
                
                {previewDates.length > 0 && (
                    <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                            Datas que serão geradas:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {previewDates.map((date, idx) => (
                                <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                                    {format(date, "dd/MM/yyyy")}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
              </div>
            )}
          </div>

          {/* Lembretes */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Lembretes & Checklist
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Defina tarefas ou lembretes. Ex: Enviar Relatório, Cobrar Cliente.
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Título do Lembrete
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Enviar NF"
                      value={novoLembrete.titulo}
                      onChange={(e) =>
                        setNovoLembrete({
                          ...novoLembrete,
                          titulo: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Quando?
                    </label>
                    <select
                      value={novoLembrete.tipo}
                      onChange={(e) =>
                        setNovoLembrete({
                          ...novoLembrete,
                          tipo: e.target.value as "relativo" | "fixo",
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="relativo">Dias antes do Venc.</option>
                      <option value="fixo">Em uma data específica</option>
                    </select>
                  </div>

                  {novoLembrete.tipo === "relativo" ? (
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Dias antes
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={novoLembrete.diasAntes}
                        onChange={(e) =>
                          setNovoLembrete({
                            ...novoLembrete,
                            diasAntes: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                  ) : (
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {usarRecorrencia ? "Data (1ª ocorrência)" : "Data"}
                      </label>
                      <input
                        type="date"
                        value={novoLembrete.dataFixa}
                        onChange={(e) =>
                          setNovoLembrete({
                            ...novoLembrete,
                            dataFixa: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                  )}

                  <div className="md:col-span-1">
                    <button
                        type="button"
                        onClick={addLembrete}
                        className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex justify-center items-center h-[42px]"
                        title="Adicionar"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                  </div>
                </div>
                
                {usarRecorrencia && novoLembrete.tipo === "fixo" && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        * O lembrete de data fixa também será repetido seguindo a frequência da fatura.
                    </p>
                )}

                {lembretes.length > 0 && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    {lembretes.map((l, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {l.titulo}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded ml-2">
                                {l.dataFixa
                                ? formatDate(l.dataFixa)
                                : `${l.diasAntesVencimento} dias antes`}
                            </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLembrete(index)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>

          <div>
            <label
              htmlFor="observacoes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Observações
            </label>
            <textarea
              id="observacoes"
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              placeholder="Informações adicionais..."
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/dashboard/gestao-financeira"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Salvando..." : "Criar Fatura"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
