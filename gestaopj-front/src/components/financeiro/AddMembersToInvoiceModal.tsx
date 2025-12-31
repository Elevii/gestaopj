"use client";

import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
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
  const [availableMembers, setAvailableMembers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberValues, setMemberValues] = useState<{ [userId: string]: string }>({}); // Valores por membro
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
        const memberships = await companyMembershipService.findByCompanyId(company.id);
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

  const handleToggleAll = () => {
    if (selectedMembers.length === availableMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(availableMembers.map((m) => m.id));
    }
  };

  const handleAddMembers = async () => {
    if (!company || selectedMembers.length === 0) return;

    try {
      setAdding(true);

      console.log(`➕ Adicionando ${selectedMembers.length} membros à fatura do período`);

      // Criar faturas para os membros selecionados
      const promises = selectedMembers.map((userId) =>
        memberInvoiceService.create({
          companyId: company.id,
          userId,
          periodoInicio,
          periodoFim,
          titulo: `Fatura - ${format(parseISO(periodoInicio), "MMM/yyyy", { locale: ptBR })}`,
          valor: 0, // Valor será definido manualmente ou posteriormente
          dataVencimento: periodoFim,
          horasTrabalhadas: 0,
          tipoCalculo: "fixo",
          valorFixo: 0, // Valor será definido manualmente ou posteriormente
        })
      );

      await Promise.all(promises);

      console.log("✅ Membros adicionados com sucesso");
      alert(`${selectedMembers.length} membro(s) adicionado(s) à fatura!`);

      onMembersAdded();
      handleClose();
    } catch (error) {
      console.error("Erro ao adicionar membros:", error);
      alert("Erro ao adicionar membros. Verifique o console.");
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
                Período: {format(parseISO(periodoInicio), "dd/MM/yyyy", { locale: ptBR })} a{" "}
                {format(parseISO(periodoFim), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="py-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">Carregando membros...</p>
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
              <div className="space-y-2">
                {availableMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => handleToggleMember(member.id)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {member.email}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                      A definir
                    </div>
                  </label>
                ))}
              </div>

              {/* Summary */}
              {selectedMembers.length > 0 && (
                <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-indigo-900 dark:text-indigo-300">
                      Membros selecionados:
                    </span>
                    <span className="text-lg font-bold text-indigo-900 dark:text-indigo-300">
                      {selectedMembers.length}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                    Os valores serão definidos posteriormente
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleAddMembers}
            disabled={selectedMembers.length === 0 || adding}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {adding
              ? "Adicionando..."
              : `Adicionar ${selectedMembers.length > 0 ? `(${selectedMembers.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
