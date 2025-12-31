"use client";

import MyInvoices from "@/components/financeiro/MyInvoices";

export default function MeuFinanceiroPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Meu Financeiro
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Visualização de suas faturas
            </p>
          </div>
        </div>
      </div>

      <MyInvoices />
    </div>
  );
}



