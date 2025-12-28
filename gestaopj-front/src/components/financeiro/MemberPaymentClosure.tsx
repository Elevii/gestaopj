"use client";

import { useState, useEffect, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { companyMembershipService } from "@/services/companyMembershipService";
import { userService } from "@/services/userService";
import { userCompanySettingsService } from "@/services/userCompanySettingsService";
import { atuacaoService } from "@/services/atuacaoService";
import { projetoService } from "@/services/projetoService";
import { memberInvoiceService } from "@/services/memberInvoiceService";
import { CompanyMembership } from "@/types/companyMembership";
import { User } from "@/types/user";
import { UserCompanySettings } from "@/types/userCompanySettings";
import { Lembrete } from "@/types/index";
import { differenceInDays, format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MemberWithData extends CompanyMembership {
  user: User;
  settings?: UserCompanySettings;
  horasMesAtual: number;
  maisDe30Dias: boolean;
}

export default function MemberPaymentClosure() {
  const { company } = useCompany();
  const [members, setMembers] = useState<MemberWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingValue, setEditingValue] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");
  const [etapas, setEtapas] = useState<Array<{ nome: string; data: string }>>([]);
  const [novaEtapaNome, setNovaEtapaNome] = useState("");
  const [novaEtapaData, setNovaEtapaData] = useState("");
  
  // Datas do período - padrão: primeiro e último dia do mês atual
  const getFirstDayOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const getLastDayOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  };

  const [dataInicio, setDataInicio] = useState(() => {
    return format(getFirstDayOfMonth(), "yyyy-MM-dd");
  });
  const [dataFim, setDataFim] = useState(() => {
    return format(getLastDayOfMonth(), "yyyy-MM-dd");
  });

  useEffect(() => {
    if (!company) return;
    loadMembers();
  }, [company, dataInicio, dataFim]);

  const loadMembers = async () => {
    if (!company) return;

    try {
      setLoading(true);

      // Carregar membros ativos
      const memberships = await companyMembershipService.findByCompanyId(
        company.id
      );
      const activeMemberships = memberships.filter((m) => m.active);

      // Usar as datas informadas pelo usuário
      const periodoInicio = dataInicio;
      const periodoFim = dataFim;

      // Carregar todas as atuações
      const allAtuacoes = await atuacaoService.findAll();

      // Filtrar atuações do mês atual e que pertencem a projetos desta empresa
      const projetos = await projetoService.findAll(company.id);
      const projetosIds = new Set(projetos.map((p) => p.id));

      const atuacoesPeriodo = allAtuacoes.filter(
        (a) =>
          a.data >= periodoInicio &&
          a.data <= periodoFim &&
          projetosIds.has(a.projetoId)
      );

      // Não precisamos mais carregar pagamentos, pois agora usamos faturas diretamente

      const membersData: MemberWithData[] = [];

      for (const membership of activeMemberships) {
        const user = await userService.findById(membership.userId);
        if (!user) continue;

        const settings = await userCompanySettingsService.findByUserAndCompany(
          membership.userId,
          company.id
        );

        // Calcular horas do período para este membro
        const horasPeriodo = atuacoesPeriodo
          .filter((a) => a.userId === membership.userId)
          .reduce((total, a) => total + (a.horasUtilizadas || 0), 0);

        // Verificar se tem mais de 30 dias de cadastro
        const diasCadastro = differenceInDays(
          new Date(),
          new Date(membership.createdAt)
        );
        const maisDe30Dias = diasCadastro >= 30;

        membersData.push({
          ...membership,
          user,
          settings: settings ?? undefined,
          horasMesAtual: horasPeriodo,
          maisDe30Dias,
        });
      }

      setMembers(membersData);
      // Inicializar todos os membros como selecionados
      setSelectedMembers(new Set(membersData.map((m) => m.id)));
    } catch (error) {
      console.error("Erro ao carregar membros:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculateDefaultValue = (member: MemberWithData): number => {
    // Se é horista, calcular baseado nas horas e valor por hora configurado
    if (member.settings?.horista) {
      const valorPorHora = member.settings.valorHora || 0;
      return member.horasMesAtual * valorPorHora;
    }

    // Se não é horista, usar valor fixo configurado ou 0
    return member.settings?.valorFixo || 0;
  };

  const formatCurrencyInput = (value: string): string => {
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

  const parseCurrency = (value: string): number => {
    return parseFloat(value.replace(/\./g, "").replace(",", "."));
  };

  const handleValueChange = (memberId: string, value: string) => {
    const formatted = formatCurrencyInput(value);
    setEditingValue((prev) => ({
      ...prev,
      [memberId]: formatted,
    }));
  };

  const handleSaveValue = async (member: MemberWithData) => {
    if (!company) return;

    const valueStr = editingValue[member.id] || "";
    const valor = parseCurrency(valueStr);

    if (isNaN(valor) || valor < 0) {
      alert("Valor inválido");
      return;
    }

    setSaving((prev) => ({ ...prev, [member.id]: true }));

    try {
      // Não precisamos mais salvar em memberPaymentService, vamos gerar faturas diretamente
      // O valor calculado será usado quando gerar a fatura

      // Recarregar membros
      await loadMembers();
      setEditingValue((prev) => {
        const newState = { ...prev };
        delete newState[member.id];
        return newState;
      });
    } catch (error: any) {
      alert(error.message || "Erro ao salvar valor");
    } finally {
      setSaving((prev => {
        const newState = { ...prev };
        delete newState[member.id];
        return newState;
      }));
    }
  };

  const handleEditClick = (member: MemberWithData) => {
    const currentValue = calculateDefaultValue(member);
    // Formatar como input de moeda (sem R$)
    const formatted = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(currentValue);
    setEditingValue((prev) => ({
      ...prev,
      [member.id]: formatted,
    }));
  };

  // Filtrar membros por busca - DEVE estar antes de qualquer return condicional
  const filteredMembers = useMemo(() => {
    if (!memberSearch) return members;
    const searchLower = memberSearch.toLowerCase();
    return members.filter(
      (m) =>
        m.user.name.toLowerCase().includes(searchLower) ||
        m.user.email.toLowerCase().includes(searchLower)
    );
  }, [members, memberSearch]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-600 dark:text-gray-400">Carregando membros...</p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Nenhum membro ativo encontrado.
        </p>
      </div>
    );
  }

  const handleOpenSummary = () => {
    if (!dataInicio || !dataFim) {
      alert("Por favor, informe as datas de início e término do período");
      return;
    }

    if (new Date(dataInicio) > new Date(dataFim)) {
      alert("A data de início deve ser anterior à data de término");
      return;
    }

    setShowSummaryModal(true);
    // Garantir que todos os membros estão selecionados
    setSelectedMembers(new Set(members.map((m) => m.id)));
  };

  const handleToggleMember = (memberId: string) => {
    setSelectedMembers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const handleAddEtapa = () => {
    if (!novaEtapaNome || !novaEtapaData) {
      alert("Por favor, preencha o nome e a data da etapa");
      return;
    }

    // Validar formato de data dd/MM/yyyy
    try {
      parse(novaEtapaData, "dd/MM/yyyy", new Date());
    } catch {
      alert("Data inválida. Use o formato dd/MM/yyyy");
      return;
    }

    setEtapas([...etapas, { nome: novaEtapaNome, data: novaEtapaData }]);
    setNovaEtapaNome("");
    setNovaEtapaData("");
  };

  const handleRemoveEtapa = (index: number) => {
    setEtapas(etapas.filter((_, i) => i !== index));
  };

  const handleGenerateInvoices = async () => {
    if (!company) return;

    const selectedMembersList = members.filter((m) => selectedMembers.has(m.id));
    
    if (selectedMembersList.length === 0) {
      alert("Selecione pelo menos um membro");
      return;
    }

    // Verificar se já existem faturas para os membros selecionados no mesmo período
    try {
      const existingInvoices = await memberInvoiceService.findByCompanyId(company.id);
      const conflictingInvoices: Array<{ member: MemberWithData; invoice: any }> = [];
      
      for (const member of selectedMembersList) {
        const existingInvoice = existingInvoices.find(
          (inv) =>
            inv.userId === member.userId &&
            inv.periodoInicio === dataInicio &&
            inv.periodoFim === dataFim &&
            inv.status !== "cancelado"
        );
        
        if (existingInvoice) {
          conflictingInvoices.push({ member, invoice: existingInvoice });
        }
      }
      
      if (conflictingInvoices.length > 0) {
        const membersList = conflictingInvoices.map((c) => c.member.user.name).join(", ");
        const message = `Os seguintes membros já possuem faturas geradas para este período (${format(new Date(dataInicio), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(dataFim), "dd/MM/yyyy", { locale: ptBR })}):\n\n${membersList}\n\nDeseja cancelar as faturas existentes e gerar novas, ou deseja alterar o período?`;
        
        const userChoice = confirm(message + "\n\nClique OK para cancelar as faturas existentes e gerar novas.\nClique Cancelar para alterar o período manualmente.");
        
        if (userChoice) {
          // Cancelar faturas existentes
          for (const { invoice } of conflictingInvoices) {
            await memberInvoiceService.update(invoice.id, {
              status: "cancelado",
            });
          }
        } else {
          // Usuário escolheu alterar o período manualmente
          alert("Por favor, altere o período manualmente e tente novamente.");
          return;
        }
      }
    } catch (error) {
      console.error("Erro ao verificar faturas existentes:", error);
      alert("Erro ao verificar faturas existentes. Tente novamente.");
      return;
    }

    // Converter data de vencimento da última etapa ou usar data fim + 30 dias
    let dataVencimento: string;
    if (etapas.length > 0) {
      const ultimaEtapa = etapas[etapas.length - 1];
      try {
        const parsedDate = parse(ultimaEtapa.data, "dd/MM/yyyy", new Date());
        dataVencimento = format(parsedDate, "yyyy-MM-dd");
      } catch {
        alert("Data da última etapa inválida");
        return;
      }
    } else {
      // Se não houver etapas, usar data fim + 30 dias
      const dataFimDate = new Date(dataFim);
      dataFimDate.setDate(dataFimDate.getDate() + 30);
      dataVencimento = format(dataFimDate, "yyyy-MM-dd");
    }

    try {
      for (const member of selectedMembersList) {
        const valor = calculateDefaultValue(member);
        
        if (valor <= 0) {
          continue; // Pular membros sem valor
        }

        const titulo = `Fatura - ${member.user.name} - ${format(new Date(dataInicio), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(dataFim), "dd/MM/yyyy", { locale: ptBR })}`;

        // Criar lembretes das etapas
        const lembretes: Lembrete[] = etapas.map((etapa, index) => {
          try {
            const parsedDate = parse(etapa.data, "dd/MM/yyyy", new Date());
            return {
              id: `lemb_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
              faturaId: "", // Será preenchido após criar a fatura
              titulo: etapa.nome,
              data: format(parsedDate, "yyyy-MM-dd"),
              concluido: false,
            };
          } catch {
            return null;
          }
        }).filter((l): l is Lembrete => l !== null);

        await memberInvoiceService.create({
          userId: member.userId,
          companyId: company.id,
          titulo,
          valor,
          dataVencimento,
          periodoInicio: dataInicio,
          periodoFim: dataFim,
          horasTrabalhadas: member.horasMesAtual,
          tipoCalculo: member.settings?.horista ? "horas" : "fixo",
          valorPorHora: member.settings?.horista ? member.settings.valorHora : undefined,
          valorFixo: !member.settings?.horista ? member.settings?.valorFixo : undefined,
          lembretes,
        });
      }

      alert("Faturas geradas com sucesso!");
      setShowSummaryModal(false);
      setEtapas([]);
      await loadMembers();
    } catch (error: any) {
      alert(error.message || "Erro ao gerar faturas");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Fechamento de Membros
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gerencie os valores a serem pagos aos membros ativos
            </p>
          </div>
          <button
            onClick={handleOpenSummary}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Gerar Faturas
          </button>
        </div>
        
        {/* Campos de data */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data Término
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Horista
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Horas (Período)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Mais de 30 dias
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Valor a ser Pago
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {members.map((member) => {
              const isEditing = editingValue[member.id] !== undefined;
              const currentValue = calculateDefaultValue(member);
              // Sempre mostrar o valor calculado por padrão
              const displayValue = isEditing
                ? editingValue[member.id]
                : formatCurrency(currentValue);

              return (
                <tr
                  key={member.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {member.user.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {member.user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.settings?.horista
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {member.settings?.horista ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {member.horasMesAtual.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.maisDe30Dias
                          ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                      }`}
                    >
                      {member.maisDe30Dias ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          R$
                        </span>
                        <input
                          type="text"
                          value={editingValue[member.id]}
                          onChange={(e) =>
                            handleValueChange(member.id, e.target.value)
                          }
                          className="w-32 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                          placeholder="0,00"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {displayValue}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSaveValue(member)}
                          disabled={saving[member.id]}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 disabled:opacity-50"
                        >
                          {saving[member.id] ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingValue((prev) => {
                              const newState = { ...prev };
                              delete newState[member.id];
                              return newState;
                            });
                          }}
                          className="text-gray-600 hover:text-gray-900 dark:text-gray-400"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditClick(member)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Resumo */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Resumo de Geração de Faturas
                </h2>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Período */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Período
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Data de Início
                    </label>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                      {format(new Date(dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Data de Término
                    </label>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                      {format(new Date(dataFim), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Membros */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Membros
                </h3>
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  {filteredMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(member.id)}
                        onChange={() => handleToggleMember(member.id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <div className="ml-3 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.user.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {member.user.email}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Valor: {formatCurrency(calculateDefaultValue(member))}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Etapas */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Etapas
                </h3>
                <div className="space-y-2 mb-3">
                  {etapas.map((etapa, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {etapa.nome}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          - {etapa.data}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveEtapa(index)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome da etapa"
                    value={novaEtapaNome}
                    onChange={(e) => setNovaEtapaNome(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="dd/MM/yyyy"
                    value={novaEtapaData}
                    onChange={(e) => setNovaEtapaData(e.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    maxLength={10}
                  />
                  <button
                    onClick={handleAddEtapa}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerateInvoices}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Gerar Faturas ({selectedMembers.size} {selectedMembers.size === 1 ? "membro" : "membros"})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

