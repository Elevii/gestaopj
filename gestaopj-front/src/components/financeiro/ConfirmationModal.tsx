"use client";

import { useState } from "react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  requireTypedConfirmation?: boolean;
  confirmationWord?: string;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  type = "warning",
  requireTypedConfirmation = false,
  confirmationWord = "CONFIRMAR",
}: ConfirmationModalProps) {
  const [loading, setLoading] = useState(false);
  const [typedText, setTypedText] = useState("");

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (requireTypedConfirmation && typedText !== confirmationWord) {
      return;
    }

    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Erro na confirmação:", error);
    } finally {
      setLoading(false);
      setTypedText("");
    }
  };

  const colors = {
    danger: {
      bg: "bg-red-100 dark:bg-red-900/30",
      icon: "text-red-600 dark:text-red-400",
      button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    },
    warning: {
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      icon: "text-yellow-600 dark:text-yellow-400",
      button: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
    },
    info: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      icon: "text-blue-600 dark:text-blue-400",
      button: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    },
  };

  const isConfirmDisabled = requireTypedConfirmation && typedText !== confirmationWord;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 animate-scale-in">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 p-3 rounded-full ${colors[type].bg}`}>
              <svg
                className={`w-6 h-6 ${colors[type].icon}`}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                {message}
              </p>

              {requireTypedConfirmation && (
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Digite <span className="font-bold text-gray-900 dark:text-white">{confirmationWord}</span> para confirmar:
                  </label>
                  <input
                    type="text"
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder={confirmationWord}
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || isConfirmDisabled}
            className={`
              px-4 py-2 text-sm font-medium text-white rounded-lg transition-all
              ${colors[type].button}
              focus:outline-none focus:ring-2 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
            `}
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
