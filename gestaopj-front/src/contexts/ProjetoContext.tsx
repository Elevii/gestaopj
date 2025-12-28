"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Projeto, CreateProjetoDTO } from "@/types";
import { projetoService } from "@/services/projetoService";
import { authService } from "@/services/authService";
import { useCompany } from "@/contexts/CompanyContext";

interface ProjetoContextType {
  projetos: Projeto[];
  loading: boolean;
  createProjeto: (data: CreateProjetoDTO) => Promise<Projeto>;
  updateProjeto: (id: string, data: Partial<CreateProjetoDTO>) => Promise<Projeto>;
  deleteProjeto: (id: string) => Promise<void>;
  getProjetoById: (id: string) => Projeto | undefined;
  refreshProjetos: () => Promise<void>;
}

const ProjetoContext = createContext<ProjetoContextType | undefined>(undefined);

export function ProjetoProvider({ children }: { children: ReactNode }) {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const { company } = useCompany();

  const loadProjetos = async () => {
    try {
      setLoading(true);
      const currentCompany = await authService.getCurrentCompany();
      
      if (!currentCompany) {
        setProjetos([]);
        return;
      }

      // Buscar projetos apenas da empresa ativa
      const projetosDaEmpresa = await projetoService.findAll(currentCompany.id);
      setProjetos(projetosDaEmpresa);
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
      setProjetos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjetos();
  }, [company?.id]);

  const createProjeto = async (data: CreateProjetoDTO): Promise<Projeto> => {
    // Garantir que companyId está presente
    if (!data.companyId) {
      const currentCompany = await authService.getCurrentCompany();
      if (!currentCompany) {
        throw new Error("Empresa não encontrada. Faça login novamente.");
      }
      data.companyId = currentCompany.id;
    }
    
    const novoProjeto = await projetoService.create(data);
    setProjetos((prev) => [...prev, novoProjeto]);
    return novoProjeto;
  };

  const updateProjeto = async (
    id: string,
    data: Partial<CreateProjetoDTO>
  ): Promise<Projeto> => {
    const projetoAtualizado = await projetoService.update(id, data);
    setProjetos((prev) =>
      prev.map((p) => (p.id === id ? projetoAtualizado : p))
    );
    return projetoAtualizado;
  };

  const deleteProjeto = async (id: string): Promise<void> => {
    await projetoService.delete(id);
    // TODO: Excluir atividades relacionadas quando houver integração com backend
    setProjetos((prev) => prev.filter((p) => p.id !== id));
  };

  const getProjetoById = (id: string): Projeto | undefined => {
    return projetos.find((p) => p.id === id);
  };

  return (
    <ProjetoContext.Provider
      value={{
        projetos,
        loading,
        createProjeto,
        updateProjeto,
        deleteProjeto,
        getProjetoById,
        refreshProjetos: loadProjetos,
      }}
    >
      {children}
    </ProjetoContext.Provider>
  );
}

export function useProjetos() {
  const context = useContext(ProjetoContext);
  if (context === undefined) {
    throw new Error("useProjetos deve ser usado dentro de ProjetoProvider");
  }
  return context;
}

