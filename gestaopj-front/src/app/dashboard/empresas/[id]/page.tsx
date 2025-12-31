"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { usePermissions } from "@/hooks/usePermissions";
import { companyService } from "@/services/companyService";
import { companyMembershipService } from "@/services/companyMembershipService";
import { userService } from "@/services/userService";
import { inviteService } from "@/services/inviteService";
import { userCompanySettingsService } from "@/services/userCompanySettingsService";
import { atuacaoService } from "@/services/atuacaoService";
import { projetoService } from "@/services/projetoService";
import { Company } from "@/types/company";
import { CompanyMembership } from "@/types/companyMembership";
import { User } from "@/types/user";
import { UserRole } from "@/types/user";
import { UserCompanySettings } from "@/types/userCompanySettings";
import { Atuacao } from "@/types";

interface MemberWithUser extends CompanyMembership {
  user: User;
  settings?: UserCompanySettings;
  horasMesAtual?: number;
}

export default function EmpresaDetalhesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { user: currentUser, refreshAuth, userCompanies } = useAuth();
  const { company: currentCompany, updateCompany } = useCompany();
  const { configuracoes, updateConfiguracoes } = useConfiguracoes();
  const {
    canManageUsers,
    canChangeUserRoles,
    canRemoveUsers,
    canInviteUsers,
    canViewCompanyDetails,
  } = usePermissions();

  // Membros podem acessar, mas apenas visualizar (sem opções de edição)
  const isOwnerOrAdmin = useMemo(() => {
    if (!currentCompany) return false;
    const membership = userCompanies.find(
      (m) => m.companyId === currentCompany.id
    );
    return membership?.role === "owner" || membership?.role === "admin";
  }, [currentCompany, userCompanies]);

  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para modais/formulários
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithUser | null>(
    null
  );

  // Formulário de convite
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "member" as UserRole,
  });
  const [inviteLoading, setInviteLoading] = useState(false);

  // Formulário de membro
  const [memberForm, setMemberForm] = useState({
    horista: false,
    limiteMensalHoras: "",
    valorHora: "",
    valorFixo: "",
    contato: "",
    cpf: "",
  });
  const [memberLoading, setMemberLoading] = useState(false);

  // Estados para edição de empresa
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    diaInicioFaturamento: "",
    diaFimFaturamento: "",
    horasUteisPadrao: "",
  });
  const [companyFormLoading, setCompanyFormLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return;

      try {
        setLoading(true);

        // Carregar empresa
        const comp = await companyService.findById(companyId);
        if (!comp) {
          router.push("/dashboard/empresas");
          return;
        }
        setCompany(comp);

        await loadMembers();
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId, router]);

  const loadMembers = async () => {
    if (!companyId) return;

    // Carregar membros
    const memberships =
      await companyMembershipService.findByCompanyId(companyId);
    console.log("📋 Memberships encontrados:", memberships);
    const membersData: MemberWithUser[] = [];

    // Obter mês atual para calcular horas
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    // Carregar todas as atuações do mês atual
    const allAtuacoes = await atuacaoService.findAll();

    // Filtrar atuações do mês atual e que pertencem a projetos desta empresa
    const projetos = await projetoService.findAll(companyId);
    const projetosIds = new Set(projetos.map((p) => p.id));

    const atuacoesMesAtual = allAtuacoes.filter(
      (a) =>
        a.data >= firstDayOfMonth &&
        a.data <= lastDayOfMonth &&
        projetosIds.has(a.projetoId)
    );

    for (const membership of memberships) {
      const user = await userService.findById(membership.userId);

      if (!user) {
        console.warn(`⚠️ Usuário não encontrado para membership:`, {
          membershipId: membership.id,
          userId: membership.userId,
          role: membership.role,
          companyId: membership.companyId,
        });
        // Pular este membro se o usuário não existir
        continue;
      }

      const settings = await userCompanySettingsService.findByUserAndCompany(
        membership.userId,
        companyId
      );

      // Calcular horas do mês atual para este membro
      const horasMesAtual = atuacoesMesAtual
        .filter((a) => {
          // Se a atuação tem userId, usar ele para filtrar
          if (a.userId) {
            return a.userId === membership.userId;
          }
          // Se não tem userId, assumir que é do usuário atual logado (para compatibilidade com dados antigos)
          // Isso só funciona se o membro for o usuário atual
          return currentUser?.id === membership.userId;
        })
        .reduce((total, a) => total + (a.horasUtilizadas || 0), 0);

      membersData.push({
        ...membership,
        user,
        settings: settings ?? undefined,
        horasMesAtual,
      });
    }

    console.log("👥 Membros carregados:", membersData);
    setMembers(membersData);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !company) return;

    setInviteLoading(true);
    try {
      await inviteService.create(
        {
          companyId: company.id,
          email: inviteForm.email,
          role: inviteForm.role,
        },
        currentUser.id
      );

      setInviteForm({ email: "", role: "member" });
      setShowInviteModal(false);
      alert("Convite enviado com sucesso!");
    } catch (error: any) {
      alert(error.message || "Erro ao enviar convite");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: UserRole) => {
    if (!canChangeUserRoles) {
      alert("Você não tem permissão para alterar roles");
      return;
    }

    try {
      await companyMembershipService.changeRole(memberId, newRole);
      await loadMembers();
      alert("Role alterado com sucesso!");
    } catch (error: any) {
      alert(error.message || "Erro ao alterar role");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!canRemoveUsers) {
      alert("Você não tem permissão para remover membros");
      return;
    }

    if (
      !confirm(
        "Tem certeza que deseja remover este membro da empresa? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }

    try {
      await companyMembershipService.deactivate(memberId);
      await loadMembers();
      alert("Membro removido com sucesso!");
    } catch (error: any) {
      alert(error.message || "Erro ao remover membro");
    }
  };

  const handleSaveMemberSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !company) return;

    setMemberLoading(true);
    try {
      const limiteMensalHoras =
        memberForm.limiteMensalHoras && memberForm.limiteMensalHoras !== ""
          ? parseFloat(memberForm.limiteMensalHoras)
          : undefined;

      // Parsear valores monetários
      const parseCurrency = (value: string): number => {
        if (!value || value.trim() === "") return 0;
        return parseFloat(value.replace(/\./g, "").replace(",", "."));
      };

      const valorHora =
        memberForm.horista && memberForm.valorHora
          ? parseCurrency(memberForm.valorHora)
          : undefined;
      const valorFixo =
        !memberForm.horista && memberForm.valorFixo
          ? parseCurrency(memberForm.valorFixo)
          : undefined;

      if (selectedMember.settings) {
        // Atualizar configuração existente
        await userCompanySettingsService.update(selectedMember.settings.id, {
          horista: memberForm.horista,
          limiteMensalHoras: memberForm.horista ? limiteMensalHoras : undefined,
          valorHora: valorHora,
          valorFixo: valorFixo,
          contato: memberForm.contato || undefined,
          cpf: memberForm.cpf || undefined,
        });
      } else {
        // Criar nova configuração
        await userCompanySettingsService.create({
          userId: selectedMember.userId,
          companyId: company.id,
          horista: memberForm.horista,
          limiteMensalHoras: memberForm.horista ? limiteMensalHoras : undefined,
          valorHora: valorHora,
          valorFixo: valorFixo,
          contato: memberForm.contato || undefined,
          cpf: memberForm.cpf || undefined,
        });
      }

      await loadMembers();
      setShowEditMemberModal(false);
      setSelectedMember(null);
      setMemberForm({
        horista: false,
        limiteMensalHoras: "",
        valorHora: "",
        valorFixo: "",
        contato: "",
        cpf: "",
      });
      alert("Configurações salvas com sucesso!");
    } catch (error: any) {
      alert(error.message || "Erro ao salvar configurações");
    } finally {
      setMemberLoading(false);
    }
  };

  const formatCurrency = (value: number | undefined): string => {
    if (!value || value === 0) return "";
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
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

  const openEditMemberModal = (member: MemberWithUser) => {
    setSelectedMember(member);
    setMemberForm({
      horista: member.settings?.horista || false,
      limiteMensalHoras: member.settings?.limiteMensalHoras?.toString() || "",
      valorHora: formatCurrency(member.settings?.valorHora),
      valorFixo: formatCurrency(member.settings?.valorFixo),
      contato: member.settings?.contato || "",
      cpf: member.settings?.cpf || "",
    });
    setShowEditMemberModal(true);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: "Proprietário",
      admin: "Administrador",
      member: "Membro",
      viewer: "Visualizador",
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      owner:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      member:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      viewer: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return colors[role] || colors.viewer;
  };

  const currentMembership = members.find((m) => m.userId === currentUser?.id);

  // Carregar dados da empresa no formulário
  useEffect(() => {
    if (company) {
      setCompanyForm({
        diaInicioFaturamento: company.diaInicioFaturamento?.toString() || "",
        diaFimFaturamento: company.diaFimFaturamento?.toString() || "",
        horasUteisPadrao: configuracoes?.horasUteisPadrao?.toString() || "8",
      });
    }
  }, [company, configuracoes]);

  const handleOpenEditCompany = () => {
    if (company) {
      setCompanyForm({
        diaInicioFaturamento: company.diaInicioFaturamento?.toString() || "",
        diaFimFaturamento: company.diaFimFaturamento?.toString() || "",
        horasUteisPadrao: configuracoes?.horasUteisPadrao?.toString() || "8",
      });
      setShowEditCompanyModal(true);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    // Validação
    const diaInicio = companyForm.diaInicioFaturamento
      ? parseInt(companyForm.diaInicioFaturamento)
      : undefined;
    const diaFim = companyForm.diaFimFaturamento
      ? parseInt(companyForm.diaFimFaturamento)
      : undefined;

    if (diaInicio && (diaInicio < 1 || diaInicio > 31)) {
      alert("Dia de início deve ser entre 1 e 31");
      return;
    }

    if (diaFim && (diaFim < 1 || diaFim > 31)) {
      alert("Dia de fim deve ser entre 1 e 31");
      return;
    }

    // Validação horas úteis
    const parseHorasUteis = (value: string): number => {
      const normalized = value.replace(",", ".").trim();
      return parseFloat(normalized);
    };

    const horasUteis = parseHorasUteis(companyForm.horasUteisPadrao);
    if (isNaN(horasUteis) || horasUteis < 1 || horasUteis > 24) {
      alert("Horas úteis padrão deve ser entre 1 e 24");
      return;
    }

    setCompanyFormLoading(true);
    try {
      // Atualizar período de faturamento na empresa
      await updateCompany(company.id, {
        diaInicioFaturamento: diaInicio,
        diaFimFaturamento: diaFim,
      });

      // Atualizar horas úteis padrão nas configurações
      await updateConfiguracoes({
        horasUteisPadrao: horasUteis,
      });

      // Recarregar dados da empresa
      const updatedCompany = await companyService.findById(company.id);
      if (updatedCompany) {
        setCompany(updatedCompany);
      }

      setShowEditCompanyModal(false);
      alert("Configurações atualizadas com sucesso!");
    } catch (error: any) {
      alert(error.message || "Erro ao salvar configurações");
    } finally {
      setCompanyFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Empresa não encontrada
        </p>
        <Link
          href="/dashboard/empresas"
          className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          Voltar para empresas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/empresas"
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
            Voltar para empresas
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Detalhes da Empresa
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {company.name}
          </p>
        </div>
        <div className="flex gap-3">
          {isOwnerOrAdmin && (
            <button
              onClick={handleOpenEditCompany}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Editar Configurações
            </button>
          )}
          {canInviteUsers && canViewCompanyDetails && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Convidar Membro
            </button>
          )}
        </div>
      </div>

      {/* Informações básicas da empresa */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Informações da Empresa
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome
            </label>
            <p className="text-gray-900 dark:text-white">{company.name}</p>
          </div>
          {company.cnpj && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CNPJ
              </label>
              <p className="text-gray-900 dark:text-white">{company.cnpj}</p>
            </div>
          )}
          {company.email && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <p className="text-gray-900 dark:text-white">{company.email}</p>
            </div>
          )}
          {company.phone && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Telefone
              </label>
              <p className="text-gray-900 dark:text-white">{company.phone}</p>
            </div>
          )}
          {company.address && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Endereço
              </label>
              <p className="text-gray-900 dark:text-white">{company.address}</p>
            </div>
          )}
        </div>
      </div>

      {/* Configurações da Empresa */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Configurações
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Período de Faturamento
            </label>
            <p className="text-gray-900 dark:text-white">
              {company.diaInicioFaturamento && company.diaFimFaturamento
                ? `Do dia ${company.diaInicioFaturamento} ao dia ${company.diaFimFaturamento} de cada mês`
                : "Não configurado"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Exemplo: do dia 26 até o dia 25 do mês seguinte
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Horas Úteis Padrão
            </label>
            <p className="text-gray-900 dark:text-white">
              {configuracoes?.horasUteisPadrao || 8} horas por dia
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Valor padrão usado ao criar novos projetos
            </p>
          </div>
        </div>
      </div>

      {/* Lista de membros - apenas para quem tem permissão */}
      {canViewCompanyDetails && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Horas Utilizadas (Mês)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Limite Mensal de Horas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {members.map((member) => {
                  const isCurrentUser = member.userId === currentUser?.id;
                  const isOwner = member.role === "owner";
                  const canEdit =
                    canManageUsers &&
                    !isCurrentUser &&
                    !isOwner &&
                    currentMembership?.role !== "viewer";
                  const canRemove =
                    canRemoveUsers &&
                    !isCurrentUser &&
                    !isOwner &&
                    currentMembership?.role !== "viewer";

                  const limiteMensalHoras = member.settings?.horista
                    ? member.settings?.limiteMensalHoras?.toFixed(2) || "-"
                    : "-";

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => {
                        if (canManageUsers) {
                          openEditMemberModal(member);
                        }
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                            {member.user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .substring(0, 2)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {member.user.name}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                  (Você)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                            member.role
                          )}`}
                        >
                          {getRoleLabel(member.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {member.horasMesAtual?.toFixed(2) || "0.00"}h
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {limiteMensalHoras}
                          {limiteMensalHoras !== "-" && "h"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newRole =
                                  member.role === "viewer"
                                    ? "member"
                                    : member.role === "member"
                                      ? "admin"
                                      : "viewer";
                                handleChangeRole(member.id, newRole);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                              title="Alterar Role"
                            >
                              Alterar Role
                            </button>
                          )}
                          {canRemove && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveMember(member.id);
                              }}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              title="Remover"
                            >
                              Remover
                            </button>
                          )}
                          {canManageUsers && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditMemberModal(member);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                              title="Ver Detalhes"
                            >
                              Detalhes
                            </button>
                          )}
                          {!canEdit && !canRemove && !canManageUsers && (
                            <span className="text-gray-400 dark:text-gray-600">
                              -
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Convite */}
      {showInviteModal && canViewCompanyDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Convidar Membro
            </h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({
                      ...inviteForm,
                      role: e.target.value as UserRole,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                >
                  <option value="member">Membro</option>
                  <option value="admin">Administrador</option>
                  <option value="viewer">Visualizador</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Role "Proprietário" não pode ser atribuído via convite
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteForm({ email: "", role: "member" });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviteLoading ? "Enviando..." : "Enviar Convite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes/Edição do Membro */}
      {showEditMemberModal && selectedMember && canViewCompanyDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Detalhes do Membro
            </h2>
            <form onSubmit={handleSaveMemberSettings} className="space-y-4">
              {/* Informações básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={selectedMember.user.name}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Role
                  </label>
                  <select
                    value={selectedMember.role}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole;
                      handleChangeRole(selectedMember.id, newRole);
                    }}
                    disabled={
                      !canChangeUserRoles ||
                      selectedMember.userId === currentUser?.id ||
                      selectedMember.role === "owner"
                    }
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                  >
                    <option value="viewer">Visualizador</option>
                    <option value="member">Membro</option>
                    <option value="admin">Administrador</option>
                    {currentMembership?.role === "owner" && (
                      <option value="owner">Proprietário</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Horas Utilizadas no Mês
                  </label>
                  <input
                    type="text"
                    value={`${selectedMember.horasMesAtual?.toFixed(2) || "0.00"}h`}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <input
                    type="text"
                    value={selectedMember.active ? "Ativo" : "Inativo"}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Configurações editáveis */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Configurações
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={memberForm.horista}
                        onChange={(e) => {
                          setMemberForm({
                            ...memberForm,
                            horista: e.target.checked,
                            limiteMensalHoras: e.target.checked
                              ? memberForm.limiteMensalHoras
                              : "",
                            // Limpar campos quando mudar o tipo
                            valorHora: e.target.checked
                              ? memberForm.valorHora
                              : "",
                            valorFixo: !e.target.checked
                              ? memberForm.valorFixo
                              : "",
                          });
                        }}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Horista
                      </span>
                    </label>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Se marcado, o membro terá limite mensal de horas
                    </p>
                  </div>

                  {memberForm.horista && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Limite Mensal de Horas{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required={memberForm.horista}
                          value={memberForm.limiteMensalHoras}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              limiteMensalHoras: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                          placeholder="Ex: 160.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Valor por Hora (R$)
                        </label>
                        <input
                          type="text"
                          value={memberForm.valorHora}
                          onChange={(e) => {
                            const formatted = formatCurrencyInput(
                              e.target.value
                            );
                            setMemberForm({
                              ...memberForm,
                              valorHora: formatted,
                            });
                          }}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                          placeholder="0,00"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Valor que será usado para calcular o pagamento baseado
                          nas horas trabalhadas
                        </p>
                      </div>
                    </>
                  )}

                  {!memberForm.horista && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Valor Fixo Mensal (R$)
                      </label>
                      <input
                        type="text"
                        value={memberForm.valorFixo}
                        onChange={(e) => {
                          const formatted = formatCurrencyInput(e.target.value);
                          setMemberForm({
                            ...memberForm,
                            valorFixo: formatted,
                          });
                        }}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                        placeholder="0,00"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Valor fixo que será pago mensalmente
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contato
                    </label>
                    <input
                      type="text"
                      value={memberForm.contato}
                      onChange={(e) =>
                        setMemberForm({
                          ...memberForm,
                          contato: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                      placeholder="Telefone ou outro contato"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      CPF
                    </label>
                    <input
                      type="text"
                      value={memberForm.cpf}
                      onChange={(e) =>
                        setMemberForm({ ...memberForm, cpf: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditMemberModal(false);
                    setSelectedMember(null);
                    setMemberForm({
                      horista: false,
                      limiteMensalHoras: "",
                      valorHora: "",
                      valorFixo: "",
                      contato: "",
                      cpf: "",
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={memberLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {memberLoading ? "Salvando..." : "Salvar Configurações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Configurações */}
      {showEditCompanyModal && isOwnerOrAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Editar Configurações da Empresa
            </h2>
            <form onSubmit={handleSaveCompany}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dia de Início do Período de Faturamento (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={companyForm.diaInicioFaturamento}
                    onChange={(e) =>
                      setCompanyForm({
                        ...companyForm,
                        diaInicioFaturamento: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                    placeholder="Ex: 26"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Dia do mês em que o período de faturamento começa (ex: 26 =
                    do dia 26 até o dia 25 do mês seguinte)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dia de Fim do Período de Faturamento (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={companyForm.diaFimFaturamento}
                    onChange={(e) =>
                      setCompanyForm({
                        ...companyForm,
                        diaFimFaturamento: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                    placeholder="Ex: 25"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Dia do mês em que o período de faturamento termina
                  </p>
                </div>
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Horas Úteis Padrão
                  </label>
                  <input
                    type="text"
                    value={companyForm.horasUteisPadrao}
                    onChange={(e) =>
                      setCompanyForm({
                        ...companyForm,
                        horasUteisPadrao: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
                    placeholder="Ex: 8 ou 8,5"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Valor padrão usado ao criar novos projetos (1-24 horas,
                    decimal permitido)
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditCompanyModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={companyFormLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {companyFormLoading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
