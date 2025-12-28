"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ProjetoProvider } from "@/contexts/ProjetoContext";
import { AtividadeProvider } from "@/contexts/AtividadeContext";
import { AtuacaoProvider } from "@/contexts/AtuacaoContext";
import { OrcamentoProvider } from "@/contexts/OrcamentoContext";
import { FaturamentoProvider } from "@/contexts/FaturamentoContext";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <CompanyProvider>
      <ProjetoProvider>
        <AtividadeProvider>
          <AtuacaoProvider>
            <OrcamentoProvider>
              <FaturamentoProvider>
                <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
                  <Sidebar
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(!sidebarOpen)}
                  />

                  <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
                    <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

                    <main className="flex-1 overflow-y-auto p-6">{children}</main>
                  </div>
                </div>
              </FaturamentoProvider>
            </OrcamentoProvider>
          </AtuacaoProvider>
        </AtividadeProvider>
      </ProjetoProvider>
    </CompanyProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}

