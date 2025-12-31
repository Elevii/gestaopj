"use client";

interface InvoiceStatsProps {
  total: number;
  pago: number;
  pendente: number;
  formatCurrency: (value: number) => string;
}

export function InvoiceStats({ total, pago, pendente, formatCurrency }: InvoiceStatsProps) {
  const percentualPago = total > 0 ? (pago / total) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total do Período
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(total)}
            </p>
          </div>
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Recebido
            </h3>
            <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(pago)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {percentualPago.toFixed(1)}% do total
            </p>
          </div>
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              A Receber
            </h3>
            <p className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatCurrency(pendente)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {(100 - percentualPago).toFixed(1)}% do total
            </p>
          </div>
          <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
