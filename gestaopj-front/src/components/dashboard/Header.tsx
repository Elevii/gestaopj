"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { companyService } from "@/services/companyService";
import { Company } from "@/types/company";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const { user, userCompanies, switchCompany, logout } = useAuth();
  const { company } = useCompany();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [companiesData, setCompaniesData] = useState<Company[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadCompanies = async () => {
      if (userCompanies.length > 0) {
        const companies = await Promise.all(
          userCompanies.map((membership) =>
            companyService.findById(membership.companyId)
          )
        );
        setCompaniesData(companies.filter((c): c is Company => c !== null));
      }
    };

    loadCompanies();
  }, [userCompanies]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
      if (
        companyRef.current &&
        !companyRef.current.contains(event.target as Node)
      ) {
        setIsCompanyOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleSwitchCompany = async (companyId: string) => {
    try {
      await switchCompany(companyId);
      setIsCompanyOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Erro ao trocar empresa:", error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: "Proprietário",
      admin: "Administrador",
      member: "Membro",
      viewer: "Visualizador",
    };
    return labels[role] || role;
  };

  const currentMembership = userCompanies.find(
    (m) => m.companyId === company?.id
  );

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Menu button para mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
          aria-label="Abrir menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Search bar - opcional */}
        <div className="flex-1 max-w-xl mx-4 hidden md:block">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white text-sm"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Company selector (se múltiplas empresas) */}
          {companiesData.length > 1 && (
            <div className="relative" ref={companyRef}>
              <button
                onClick={() => setIsCompanyOpen(!isCompanyOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
              >
                <svg
                  className="w-5 h-5 text-gray-500 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {company?.name || "Selecionar empresa"}
                  </p>
                  {currentMembership && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {getRoleLabel(currentMembership.role)}
                    </p>
                  )}
                </div>
                <svg
                  className="w-4 h-4 text-gray-500 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Company dropdown */}
              {isCompanyOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                  {companiesData.map((comp) => {
                    const membership = userCompanies.find(
                      (m) => m.companyId === comp.id
                    );
                    const isActive = comp.id === company?.id;
                    return (
                      <button
                        key={comp.id}
                        onClick={() => handleSwitchCompany(comp.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          isActive
                            ? "bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-600"
                            : ""
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {comp.name}
                        </p>
                        {membership && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {getRoleLabel(membership.role)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 relative">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500"></span>
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                {user ? getInitials(user.name) : "U"}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.name || "Usuário"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {company?.name || "Sem empresa"}
                </p>
              </div>
              <svg
                className="w-5 h-5 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 border border-gray-200 dark:border-gray-700 z-50">
                <Link
                  href="/dashboard/perfil"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Meu Perfil
                </Link>
                <Link
                  href="/dashboard/configuracoes"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Configurações
                </Link>
                <hr className="my-1 border-gray-200 dark:border-gray-700" />
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
