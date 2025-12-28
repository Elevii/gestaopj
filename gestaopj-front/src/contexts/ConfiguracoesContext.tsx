"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Configuracoes, UpdateConfiguracoesDTO } from "@/types";
import { configuracoesService } from "@/services/configuracoesService";

interface ConfiguracoesContextType {
  configuracoes: Configuracoes;
  loading: boolean;
  updateConfiguracoes: (data: UpdateConfiguracoesDTO) => Promise<Configuracoes>;
  refreshConfiguracoes: () => Promise<void>;
}

const ConfiguracoesContext = createContext<ConfiguracoesContextType | undefined>(
  undefined
);

export function ConfiguracoesProvider({ children }: { children: ReactNode }) {
  const [configuracoes, setConfiguracoes] = useState<Configuracoes>({
    tema: "escuro",
    nomeEmpresa: "",
    horasUteisPadrao: 8,
    fusoHorario: "America/Sao_Paulo",
    formatoData: "dd/MM/yyyy",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);

  // Aplicar tema escuro fixo sempre
  useEffect(() => {
    if (typeof window !== "undefined") {
      const root = document.documentElement;
      root.classList.add("dark");
    }
  }, []);

  const loadConfiguracoes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await configuracoesService.findAll();
      setConfiguracoes(data);
      // Garantir que tema escuro está sempre aplicado
      if (typeof window !== "undefined") {
        document.documentElement.classList.add("dark");
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfiguracoes();
  }, [loadConfiguracoes]);

  const updateConfiguracoes = async (
    data: UpdateConfiguracoesDTO
  ): Promise<Configuracoes> => {
    const atualizado = await configuracoesService.update(data);
    setConfiguracoes(atualizado);
    
    // Garantir que tema escuro está sempre aplicado
    if (typeof window !== "undefined") {
      document.documentElement.classList.add("dark");
    }
    
    return atualizado;
  };

  return (
    <ConfiguracoesContext.Provider
      value={{
        configuracoes,
        loading,
        updateConfiguracoes,
        refreshConfiguracoes: loadConfiguracoes,
      }}
    >
      {children}
    </ConfiguracoesContext.Provider>
  );
}

export function useConfiguracoes() {
  const context = useContext(ConfiguracoesContext);
  if (context === undefined) {
    throw new Error(
      "useConfiguracoes deve ser usado dentro de ConfiguracoesProvider"
    );
  }
  return context;
}

