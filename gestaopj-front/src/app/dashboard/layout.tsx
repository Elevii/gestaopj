"use client";

import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { ProjetoProvider } from "@/contexts/ProjetoContext";
import { AtividadeProvider } from "@/contexts/AtividadeContext";
import { AtuacaoProvider } from "@/contexts/AtuacaoContext";
import { OrcamentoProvider } from "@/contexts/OrcamentoContext";
import { FaturamentoProvider } from "@/contexts/FaturamentoContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
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
  );
}

