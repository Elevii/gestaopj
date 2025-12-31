"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { FaturaEtapa, CreateFaturaEtapaDTO, UpdateFaturaEtapaDTO } from "@/types";
import { faturaEtapaService } from "@/services/faturaEtapaService";
import { useCompany } from "./CompanyContext";

interface FaturaEtapaContextType {
  etapas: FaturaEtapa[];
  loading: boolean;
  loadEtapas: () => Promise<void>;
  createEtapa: (data: CreateFaturaEtapaDTO) => Promise<FaturaEtapa>;
  updateEtapa: (id: string, data: UpdateFaturaEtapaDTO) => Promise<FaturaEtapa>;
  deleteEtapa: (id: string) => Promise<void>;
  reorderEtapas: (etapaIds: string[]) => Promise<void>;
  etapasAtivas: FaturaEtapa[];
}

const FaturaEtapaContext = createContext<FaturaEtapaContextType | undefined>(undefined);

export function FaturaEtapaProvider({ children }: { children: React.ReactNode }) {
  const { company } = useCompany();
  const [etapas, setEtapas] = useState<FaturaEtapa[]>([]);
  const [loading, setLoading] = useState(false);

  const loadEtapas = useCallback(async () => {
    if (!company) {
      setEtapas([]);
      return;
    }

    try {
      setLoading(true);
      const etapasDaEmpresa = await faturaEtapaService.findByCompanyId(company.id);
      setEtapas(etapasDaEmpresa);
    } catch (error) {
      console.error("Erro ao carregar etapas:", error);
      setEtapas([]);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    loadEtapas();
  }, [loadEtapas]);

  const createEtapa = useCallback(
    async (data: CreateFaturaEtapaDTO): Promise<FaturaEtapa> => {
      if (!company) {
        throw new Error("Empresa não selecionada");
      }

      const novaEtapa = await faturaEtapaService.create({
        ...data,
        companyId: company.id,
      });
      await loadEtapas();
      return novaEtapa;
    },
    [company, loadEtapas]
  );

  const updateEtapa = useCallback(
    async (id: string, data: UpdateFaturaEtapaDTO): Promise<FaturaEtapa> => {
      const etapaAtualizada = await faturaEtapaService.update(id, data);
      await loadEtapas();
      return etapaAtualizada;
    },
    [loadEtapas]
  );

  const deleteEtapa = useCallback(
    async (id: string): Promise<void> => {
      await faturaEtapaService.delete(id);
      await loadEtapas();
    },
    [loadEtapas]
  );

  const reorderEtapas = useCallback(
    async (etapaIds: string[]): Promise<void> => {
      if (!company) {
        throw new Error("Empresa não selecionada");
      }

      await faturaEtapaService.reorder(company.id, etapaIds);
      await loadEtapas();
    },
    [company, loadEtapas]
  );

  const etapasAtivas = etapas.filter((e) => e.ativo);

  return (
    <FaturaEtapaContext.Provider
      value={{
        etapas,
        loading,
        loadEtapas,
        createEtapa,
        updateEtapa,
        deleteEtapa,
        reorderEtapas,
        etapasAtivas,
      }}
    >
      {children}
    </FaturaEtapaContext.Provider>
  );
}

export function useFaturaEtapa() {
  const context = useContext(FaturaEtapaContext);
  if (context === undefined) {
    throw new Error("useFaturaEtapa deve ser usado dentro de FaturaEtapaProvider");
  }
  return context;
}


