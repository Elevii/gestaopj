"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import EmptyState from "@/components/dashboard/EmptyState";
import { useProjetos } from "@/contexts/ProjetoContext";
import { StatusProjeto } from "@/types";

type FiltroStatus = "todos" | "ativo" | "pausado" | "concluido";

export default function ProjetosPage() {
  const { projetos, loading } = useProjetos();
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");

  const projetosFiltrados = useMemo(() => {
    if (filtroStatus === "todos") {
      return projetos.filter((p) => p.status !== "cancelado");
    }
    return projetos.filter((p) => p.status === filtroStatus);
  }, [projetos, filtroStatus]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: StatusProjeto | undefined) => {
    const statusAtual = status || "ativo";
    
    const badges = {
      ativo: {
        label: "Em andamento",
        className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
      },
      pausado: {
        label: "Planejamento",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      },
      concluido: {
        label: "Concluído",
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      },
      cancelado: {
        label: "Cancelado",
        className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      },
    };

    return badges[statusAtual] || badges.ativo;
  };

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Projetos
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Gerencie todos os seus projetos
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  const projetosDisponiveis = projetos.filter((p) => p.status !== "cancelado");

  if (projetosDisponiveis.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Projetos
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Gerencie todos os seus projetos
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <EmptyState
            icon={
              <svg
                className="w-16 h-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
            title="Nenhum projeto encontrado"
            description="Comece criando seu primeiro projeto para organizar suas atividades e acompanhar seu progresso."
            action={{
              label: "Criar Projeto",
              href: "/dashboard/projetos/novo",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Projetos
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Gerencie todos os seus projetos
          </p>
        </div>
        <Link
          href="/dashboard/projetos/novo"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Novo Projeto
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroStatus("todos")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filtroStatus === "todos"
              ? "bg-indigo-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          Todos ({projetosDisponiveis.length})
        </button>
        <button
          onClick={() => setFiltroStatus("ativo")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filtroStatus === "ativo"
              ? "bg-indigo-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          Em andamento ({projetosDisponiveis.filter((p) => p.status === "ativo").length})
        </button>
        <button
          onClick={() => setFiltroStatus("pausado")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filtroStatus === "pausado"
              ? "bg-indigo-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          Planejamento ({projetosDisponiveis.filter((p) => p.status === "pausado").length})
        </button>
        <button
          onClick={() => setFiltroStatus("concluido")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filtroStatus === "concluido"
              ? "bg-indigo-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          Concluídos ({projetosDisponiveis.filter((p) => p.status === "concluido").length})
        </button>
      </div>

      {projetosFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <EmptyState
            icon={
              <svg
                className="w-16 h-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
            title={`Nenhum projeto ${filtroStatus === "todos" ? "encontrado" : filtroStatus === "ativo" ? "em andamento" : filtroStatus === "pausado" ? "em planejamento" : "concluído"}`}
            description={
              filtroStatus === "todos"
                ? "Comece criando seu primeiro projeto para organizar suas atividades e acompanhar seu progresso."
                : `Não há projetos ${filtroStatus === "ativo" ? "em andamento" : filtroStatus === "pausado" ? "em planejamento" : "concluídos"} no momento.`
            }
            action={
              filtroStatus === "todos"
                ? {
                    label: "Criar Projeto",
                    href: "/dashboard/projetos/novo",
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projetosFiltrados.map((projeto) => {
            const statusBadge = getStatusBadge(projeto.status);
            return (
            <Link
              key={projeto.id}
              href={`/dashboard/projetos/${projeto.id}`}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {projeto.titulo}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge.className}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {projeto.empresa}
                  </p>
                </div>
              </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {projeto.tipoCobranca === "fixo" ? "Valor do Projeto" : "Valor/hora"}
              </span>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {formatCurrency(
                  projeto.tipoCobranca === "fixo"
                    ? projeto.valorFixo ?? 0
                    : projeto.valorHora ?? 0
                )}
              </span>
            </div>
          </Link>
          );
          })}
        </div>
      )}
    </div>
  );
}

