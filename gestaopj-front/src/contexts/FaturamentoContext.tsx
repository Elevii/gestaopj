"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { CreateFaturaDTO, Fatura, UpdateFaturaDTO } from "@/types";
import { faturaService } from "@/services/faturaService";

interface FaturamentoContextType {
  faturas: Fatura[];
  loading: boolean;
  resumo: {
    recebidoMes: number;
    aReceber: number;
    atrasado: number;
  };
  refreshFaturas: () => Promise<void>;
  createFatura: (data: CreateFaturaDTO) => Promise<Fatura[]>;
  updateFatura: (id: string, data: UpdateFaturaDTO) => Promise<Fatura>;
  deleteFatura: (id: string) => Promise<void>;
  deleteFaturas: (ids: string[]) => Promise<void>;
  getFaturaById: (id: string) => Fatura | undefined;
}

const FaturamentoContext = createContext<FaturamentoContextType | undefined>(undefined);

export function FaturamentoProvider({ children }: { children: ReactNode }) {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState({
    recebidoMes: 0,
    aReceber: 0,
    atrasado: 0,
  });

  const refreshFaturas = useCallback(async () => {
    try {
      setLoading(true);
      const all = await faturaService.findAll();
      const res = await faturaService.getResumoFinanceiro();
      setFaturas(all);
      setResumo(res);
    } catch (error) {
      console.error("Erro ao carregar faturas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFaturas();
  }, [refreshFaturas]);

  const createFatura = useCallback(async (data: CreateFaturaDTO) => {
    const novas = await faturaService.create(data);
    await refreshFaturas();
    return novas;
  }, [refreshFaturas]);

  const updateFatura = useCallback(async (id: string, data: UpdateFaturaDTO) => {
    const updated = await faturaService.update(id, data);
    await refreshFaturas();
    return updated;
  }, [refreshFaturas]);

  const deleteFatura = useCallback(async (id: string) => {
    await faturaService.delete(id);
    await refreshFaturas();
  }, [refreshFaturas]);

  const deleteFaturas = useCallback(async (ids: string[]) => {
      // Como o service é localstorage, podemos iterar. 
      // Se fosse API, seria melhor um endpoint de bulk delete.
      for(const id of ids) {
          await faturaService.delete(id);
      }
      await refreshFaturas();
  }, [refreshFaturas]);

  const getFaturaById = useCallback(
    (id: string) => faturas.find((f) => f.id === id),
    [faturas]
  );

  return (
    <FaturamentoContext.Provider
      value={{
        faturas,
        loading,
        resumo,
        refreshFaturas,
        createFatura,
        updateFatura,
        deleteFatura,
        deleteFaturas,
        getFaturaById,
      }}
    >
      {children}
    </FaturamentoContext.Provider>
  );
}

export function useFaturamento() {
  const ctx = useContext(FaturamentoContext);
  if (!ctx) throw new Error("useFaturamento deve ser usado dentro de FaturamentoProvider");
  return ctx;
}
