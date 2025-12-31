"use client";

import { useState, useEffect, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/contexts/ToastContext";
import { companyMembershipService } from "@/services/companyMembershipService";
import { memberInvoiceService } from "@/services/memberInvoiceService";
import { userService } from "@/services/userService";
import { User } from "@/types/user";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AddMembersToInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodoInicio: string;
  periodoFim: string;
  existingMemberIds: string[];
  onMembersAdded: () => void;
}

export default function AddMembersToInvoiceModal({
  isOpen,
  onClose,
  periodoInicio,
  periodoFim,
  existingMemberIds,
  onMembersAdded,
}: AddMembersToInvoiceModalProps) {
  const { company } = useCompany();
  const { showToast } = useToast();
  const [availableMembers, setAvailableMembers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberValues, setMemberValues] = useState<{
    [userId: string]: string;
  }>({}); // Valores por membro
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  useEffect(() => {
    if (!isOpen || !company) return;

    const loadAvailableMembers = async () => {
      try {
        setLoading(true);

        // Buscar todos os membros da empresa
        const memberships = await companyMembershipService.findByCompanyId(
          company.id
        );
        const activeMembers = memberships.filter((m) => m.active);

        // Buscar dados dos usuários que não estão na fatura
        const users: User[] = [];
        for (const membership of activeMembers) {
          const user = await userService.findById(membership.userId);
          if (user && !existingMemberIds.includes(user.id)) {
            users.push(user);
          }
        }

        setAvailableMembers(users);
        console.log(`📋 Membros disponíveis para adicionar: ${users.length}`);
      } catch (error) {
        console.error("Erro ao carregar membros disponíveis:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAvailableMembers();
  }, [isOpen, company, existingMemberIds]);

  const handleToggleMember = (userId: string) => {
    setSelectedMembers((prev) => {
      const isSelected = prev.includes(userId);
      if (isSelected) {
        // Remover
        const newValues = { ...memberValues };
        delete newValues[userId];
        setMemberValues(newValues);
        return prev.filter((id) => id !== userId);
      } else {
        // Adicionar com valor padrão vazio
        setMemberValues({ ...memberValues, [userId]: "" });
        return [...prev, userId];
      }
    });
  };

  const handleValueChange = (userId: string, value: string) => {
    // Permitir apenas números e vírgula
    const cleanValue = value.replace(/[^0-9,]/g, "");
    setMemberValues({ ...memberValues, [userId]: cleanValue });
  };

  const parseValue = (valueStr: string): number => {
    if (!valueStr) return 0;
    // Converter vírgula para ponto e parsear
    return parseFloat(valueStr.replace(",", ".")) || 0;
  };

  const totalValue = useMemo(() => {
    return selectedMembers.reduce((sum, userId) => {
      return sum + parseValue(memberValues[userId] || "0");
    }, 0);
  }, [selectedMembers, memberValues]);

  const hasInvalidValues = useMemo(() => {
    return selectedMembers.some(
      (userId) => parseValue(memberValues[userId] || "0") <= 0
    );
  }, [selectedMembers, memberValues]);

  const handleToggleAll = () => {
    if (selectedMembers.length === availableMembers.length) {
      setSelectedMembers([]);
      setMemberValues({});
    } else {
      const allIds = availableMembers.map((m) => m.id);
      setSelectedMembers(allIds);
      const newValues: { [userId: string]: string } = {};
      allIds.forEach((id) => {
        newValues[id] = "";
      });
      setMemberValues(newValues);
    }
  };

  const handleAddMembers = async () => {
    if (!company || selectedMembers.length === 0) {
      showToast("Selecione pelo menos um membro", "warning");
      return;
    }

    if (hasInvalidValues) {
      showToast(
        "Todos os membros selecionados devem ter valores maiores que R$ 0,00",
        "error"
      );
      return;
    }

    try {
      setAdding(true);

      console.log(
        `➕ Adicionando ${selectedMembers.length} membros à fatura do período`
      );

      // Criar faturas para os membros selecionados com valores definidos
      const promises = selectedMembers.map((userId) => {
        const valor = parseValue(memberValues[userId]);
        return memberInvoiceService.create({
          companyId: company.id,
          userId,
          periodoInicio,
          periodoFim,
          titulo: `Fatura - ${format(parseISO(periodoInicio), "MMM/yyyy", { locale: ptBR })}`,
          valor,
          dataVencimento: periodoFim,
          horasTrabalhadas: 0,
          tipoCalculo: "fixo",
          valorFixo: valor,
        });
      });

      await Promise.all(promises);

      console.log("✅ Membros adicionados com sucesso");
      showToast(
        `${selectedMembers.length} membro(s) adicionado(s) à fatura com sucesso!`,
        "success"
      );

      onMembersAdded();
      handleClose();
    } catch (error) {
      console.error("Erro ao adicionar membros:", error);
      showToast("Erro ao adicionar membros. Tente novamente.", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setSelectedMembers([]);
    setMemberValues({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Adicionar Membros à Fatura
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Período:{" "}
                {format(parseISO(periodoInicio), "dd/MM/yyyy", {
                  locale: ptBR,
                })}{" "}
                a {format(parseISO(periodoFim), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="py-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Carregando membros...
              </p>
            </div>
          ) : availableMembers.length === 0 ? (
            <div className="py-8 text-center">
              <svg
                className="mx-auto w-12 h-12 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">
                Todos os membros ativos já estão incluídos nesta fatura
              </p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMembers.length === availableMembers.length}
                    onChange={handleToggleAll}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Selecionar todos ({availableMembers.length})
                  </span>
                </label>
              </div>

              {/* Member List */}
              <div className="space-y-3">
                {availableMembers.map((member) => {
                  const isSelected = selectedMembers.includes(member.id);
                  const value = memberValues[member.id] || "";
                  const numValue = parseValue(value);
                  const hasError = isSelected && numValue <= 0;

                  return (
                    <div
                      key={member.id}
                      className={`
                        p-4 rounded-lg border transition-all
                        ${
                          isSelected
                            ? hasError
                              ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10"
                              : "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/10"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center h-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleMember(member.id)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {member.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {member.email}
                          </div>
                        </div>
                        <div className="w-40">
                          {isSelected ? (
                            <div>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                                  R$
                                </span>
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) =>
                                    handleValueChange(member.id, e.target.value)
                                  }
                                  placeholder="0,00"
                                  className={`
                                    w-full pl-10 pr-3 py-2 text-sm rounded-lg transition-all
                                    ${
                                      hasError
                                        ? "border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500"
                                        : "border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                                    }
                                    dark:bg-gray-700 dark:text-white
                                  `}
                                />
                              </div>
                              {hasError && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                  Valor obrigatório
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                              Não selecionado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              {selectedMembers.length > 0 && (
                <div
                  className={`
                    mt-6 p-4 rounded-lg border-2
                    ${
                      hasInvalidValues
                        ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
                        : "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20"
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Membros selecionados:
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedMembers.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      Valor Total:
                    </span>
                    <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(totalValue)}
                    </span>
                  </div>
                  {hasInvalidValues && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Preencha todos os valores antes de adicionar
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={adding}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleAddMembers}
            disabled={
              adding || selectedMembers.length === 0 || hasInvalidValues
            }
            className="
              px-6 py-2 text-sm font-medium text-white rounded-lg transition-all
              bg-indigo-600 hover:bg-indigo-700
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
            "
          >
            {adding && (
              <svg
                className="animate-spin h-4 w-4"
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
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {adding ? "Adicionando..." : "Adicionar Membros"}
          </button>
        </div>
      </div>
    </div>
  );
}
