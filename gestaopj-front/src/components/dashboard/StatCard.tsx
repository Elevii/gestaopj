interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
    period: string;
  };
  icon: React.ReactNode;
  iconBgColor?: string;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
}

export default function StatCard({
  title,
  value,
  change,
  icon,
  iconBgColor = "bg-indigo-500",
  trend,
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {change && (
            <div className="mt-2 flex items-center">
              <span
                className={`text-sm font-medium ${
                  change.type === "increase"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {change.type === "increase" ? "+" : ""}
                {change.value}%
              </span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                vs {change.period}
              </span>
            </div>
          )}
          {trend && (
            <div className="mt-2 flex items-center">
              <svg
                className={`w-4 h-4 ${
                  trend.direction === "up"
                    ? "text-green-500"
                    : "text-red-500"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {trend.direction === "up" ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                  />
                )}
              </svg>
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                {trend.value}% em relação ao mês anterior
              </span>
            </div>
          )}
        </div>
        <div className={`${iconBgColor} rounded-lg p-3 text-white`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

