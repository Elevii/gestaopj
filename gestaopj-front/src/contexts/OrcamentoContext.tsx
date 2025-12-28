"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { CreateOrcamentoDTO, Orcamento } from "@/types";
import { orcamentoService } from "@/services/orcamentoService";

interface OrcamentoContextType {
  orcamentos: Orcamento[];
  loading: boolean;
  refreshOrcamentos: () => Promise<void>;
  createOrcamento: (data: CreateOrcamentoDTO) => Promise<Orcamento>;
  updateOrcamento: (id: string, data: Partial<CreateOrcamentoDTO>) => Promise<Orcamento>;
  deleteOrcamento: (id: string) => Promise<void>;
  getOrcamentoById: (id: string) => Orcamento | undefined;
}

const OrcamentoContext = createContext<OrcamentoContextType | undefined>(undefined);

export function OrcamentoProvider({ children }: { children: ReactNode }) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshOrcamentos = useCallback(async () => {
    try {
      setLoading(true);
      const all = await orcamentoService.findAll();
      setOrcamentos(all);
    } catch (error) {
      console.error("Erro ao carregar orçamentos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrcamentos();
  }, [refreshOrcamentos]);

  const createOrcamento = useCallback(async (data: CreateOrcamentoDTO) => {
    const novo = await orcamentoService.create(data);
    const all = await orcamentoService.findAll();
    setOrcamentos(all);
    return novo;
  }, []);

  const updateOrcamento = useCallback(async (id: string, data: Partial<CreateOrcamentoDTO>) => {
    const updated = await orcamentoService.update(id, data);
    const all = await orcamentoService.findAll();
    setOrcamentos(all);
    return updated;
  }, []);

  const deleteOrcamento = useCallback(async (id: string) => {
    await orcamentoService.delete(id);
    const all = await orcamentoService.findAll();
    setOrcamentos(all);
  }, []);

  const getOrcamentoById = useCallback(
    (id: string) => orcamentos.find((o) => o.id === id),
    [orcamentos]
  );

  return (
    <OrcamentoContext.Provider
      value={{
        orcamentos,
        loading,
        refreshOrcamentos,
        createOrcamento,
        updateOrcamento,
        deleteOrcamento,
        getOrcamentoById,
      }}
    >
      {children}
    </OrcamentoContext.Provider>
  );
}

export function useOrcamentos() {
  const ctx = useContext(OrcamentoContext);
  if (!ctx) throw new Error("useOrcamentos deve ser usado dentro de OrcamentoProvider");
  return ctx;
}



