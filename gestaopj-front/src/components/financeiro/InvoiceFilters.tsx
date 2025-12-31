"use client";

import { StatusFatura } from "@/types";

interface InvoiceFiltersProps {
  searchName: string;
  onSearchNameChange: (value: string) => void;
  filterStatus: StatusFatura | "all";
  onFilterStatusChange: (value: StatusFatura | "all") => void;
  onClearFilters: () => void;
}

export function InvoiceFilters({
  searchName,
  onSearchNameChange,
  filterStatus,
  onFilterStatusChange,
  onClearFilters,
}: InvoiceFiltersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Pesquisar por Nome
        </label>
        <input
          type="text"
          value={searchName}
          onChange={(e) => onSearchNameChange(e.target.value)}
          placeholder="Digite o nome ou email..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Filtrar por Status
        </label>
        <select
          value={filterStatus}
          onChange={(e) =>
            onFilterStatusChange(e.target.value as StatusFatura | "all")
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        >
          <option value="all">Todos os Status</option>
          <option value="pendente">Pendente</option>
          <option value="fatura_gerada">Fatura Gerada</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      <div className="flex items-end">
        <button
          onClick={onClearFilters}
          className="w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <svg
            className="w-4 h-4"
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
          Limpar Filtros
        </button>
      </div>
    </div>
  );
}
