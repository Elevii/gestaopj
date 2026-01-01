"use client";

import { useState, useEffect } from "react";
import { MemberInvoice } from "@/types/memberInvoice";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: MemberInvoice | null;
  onInvoiceUpdated: () => void;
  formatCurrency: (value: number) => string;
}

export function EditInvoiceModal({
  isOpen,
  onClose,
  invoice,
  onInvoiceUpdated,
  formatCurrency,
}: EditInvoiceModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    valor: "",
    titulo: "",
    dataVencimento: "",
    observacoes: "",
  });

  useEffect(() => {
    if (invoice && isOpen) {
      setFormData({
        valor: invoice.valor.toString().replace(".", ","),
        titulo: invoice.titulo || "",
        dataVencimento: invoice.dataVencimento
          ? format(parseISO(invoice.dataVencimento), "yyyy-MM-dd")
          : "",
        observacoes: invoice.observacoes || "",
      });
    }
  }, [invoice, isOpen]);

  const handleClose = () => {
    setFormData({
      valor: "",
      titulo: "",
      dataVencimento: "",
      observacoes: "",
    });
    onClose();
  };

  const parseValue = (str: string): number => {
    if (!str) return 0;
    return parseFloat(str.replace(",", ".")) || 0;
  };

  const handleValueChange = (value: string) => {
    // Permitir apenas números e vírgula
    const cleaned = value.replace(/[^0-9,]/g, "");
    setFormData({ ...formData, valor: cleaned });
  };

  const valorAtual = parseValue(formData.valor);
  const valorOriginal = invoice?.valor || 0;
  const hasInvalidValue = valorAtual <= 0;
  const hasChanges =
    valorAtual !== valorOriginal ||
    formData.titulo !== (invoice?.titulo || "") ||
    formData.dataVencimento !==
      (invoice?.dataVencimento
        ? format(parseISO(invoice.dataVencimento), "yyyy-MM-dd")
        : "") ||
    formData.observacoes !== (invoice?.observacoes || "");

  const handleSave = async () => {
    if (!invoice) return;
    if (hasInvalidValue) return;

    setSaving(true);
    try {
      const { memberInvoiceService } =
        await import("@/services/memberInvoiceService");
      const { showToast } = await import("@/contexts/ToastContext").then(
        (mod) => mod.useToast()
      );

      const updates: any = {
        titulo: formData.titulo,
        dataVencimento: formData.dataVencimento,
        observacoes: formData.observacoes || undefined,
      };

      // Se o valor mudou, marcar como manual
      if (valorAtual !== valorOriginal) {
        updates.valor = valorAtual;
        updates.valorManual = true;
      }

      await memberInvoiceService.update(invoice.id, updates);

      console.log("✅ Fatura atualizada");
      onInvoiceUpdated();
      handleClose();
    } catch (error) {
      console.error("Erro ao atualizar fatura:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                <svg
                  className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
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
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Editar Fatura
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Atualize os dados da fatura
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Valor Original vs Novo */}
            {valorAtual !== valorOriginal && !hasInvalidValue && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Alteração de Valor Detectada
                    </h4>
                    <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      <p>
                        Valor original:{" "}
                        <span className="font-semibold">
                          {formatCurrency(valorOriginal)}
                        </span>
                      </p>
                      <p>
                        Novo valor:{" "}
                        <span className="font-semibold">
                          {formatCurrency(valorAtual)}
                        </span>
                      </p>
                      <p className="text-xs mt-2 opacity-90">
                        ℹ️ Esta fatura será marcada como "Valor Manual"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Título da Fatura
                </label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) =>
                    setFormData({ ...formData, titulo: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ex: Fatura - Jan/2025"
                />
              </div>

              {/* Valor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valor
                  {hasInvalidValue && (
                    <span className="text-red-600 dark:text-red-400 ml-2">
                      * Deve ser maior que R$ 0,00
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                    R$
                  </span>
                  <input
                    type="text"
                    value={formData.valor}
                    onChange={(e) => handleValueChange(e.target.value)}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      hasInvalidValue
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="0,00"
                  />
                </div>
                {valorAtual > 0 && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Valor formatado: {formatCurrency(valorAtual)}
                  </p>
                )}
              </div>

              {/* Data de Vencimento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data de Vencimento
                </label>
                <input
                  type="date"
                  value={formData.dataVencimento}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dataVencimento: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Observações
                  <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">
                    (opcional)
                  </span>
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Adicione observações ou notas sobre esta fatura..."
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {hasChanges ? (
                <span className="text-yellow-600 dark:text-yellow-400">
                  ⚠️ Alterações não salvas
                </span>
              ) : (
                "Sem alterações"
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || hasInvalidValue || !hasChanges}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 mr-2"
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
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
