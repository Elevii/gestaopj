"use client";

import { useState } from "react";
import { MemberInvoice } from "@/types/memberInvoice";
import { User } from "@/types/user";

interface InvoiceWithUser extends MemberInvoice {
  user: User | null;
}

interface ReopenPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  invoices: InvoiceWithUser[];
  formatCurrency: (value: number) => string;
}

export function ReopenPeriodModal({
  isOpen,
  onClose,
  onConfirm,
  invoices,
  formatCurrency,
}: ReopenPeriodModalProps) {
  const [loading, setLoading] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");

  if (!isOpen) return null;

  const paidInvoices = invoices.filter((inv) => inv.status === "pago");
  const totalValue = paidInvoices.reduce((sum, inv) => sum + inv.valor, 0);

  const handleConfirm = async () => {
    if (typedConfirmation !== "REABRIR") return;

    setLoading(true);
    try {
      await onConfirm();
      setTypedConfirmation("");
      onClose();
    } catch (error) {
      console.error("Erro ao reabrir período:", error);
    } finally {
      setLoading(false);
    }
  };

  const isConfirmDisabled = typedConfirmation !== "REABRIR";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-700 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="shrink-0 p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <svg
                className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Reabrir Período de Faturamento
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Esta ação irá reverter todas as faturas pagas para o status
                &quot;Pendente&quot;. Use apenas se precisar refazer o
                fechamento do período.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Resumo do Impacto */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
              ⚠️ Impacto da Ação:
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-yellow-700 dark:text-yellow-300">
                  Faturas afetadas:
                </span>
                <p className="font-bold text-yellow-900 dark:text-yellow-100">
                  {paidInvoices.length} fatura(s)
                </p>
              </div>
              <div>
                <span className="text-yellow-700 dark:text-yellow-300">
                  Valor total:
                </span>
                <p className="font-bold text-yellow-900 dark:text-yellow-100">
                  {formatCurrency(totalValue)}
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Faturas que Serão Reabertas */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
              Faturas que serão reabertas:
            </h4>
            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      Membro
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paidInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                        {invoice.user?.name || "N/A"}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">
                        {formatCurrency(invoice.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirmação Digitada */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Para confirmar, digite{" "}
              <span className="font-bold text-red-600 dark:text-red-400">
                REABRIR
              </span>
              :
            </label>
            <input
              type="text"
              value={typedConfirmation}
              onChange={(e) =>
                setTypedConfirmation(e.target.value.toUpperCase())
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="Digite REABRIR"
              autoFocus
            />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
          <button
            onClick={() => {
              setTypedConfirmation("");
              onClose();
            }}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || isConfirmDisabled}
            className="
              px-4 py-2 text-sm font-medium text-white rounded-lg transition-all
              bg-yellow-600 hover:bg-yellow-700
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
            "
          >
            {loading && (
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
            Reabrir Período
          </button>
        </div>
      </div>
    </div>
  );
}
