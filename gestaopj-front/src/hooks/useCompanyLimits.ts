import { useMemo, useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { projetoService } from "@/services/projetoService";
import { userService } from "@/services/userService";

interface LimitsStatus {
  projects: {
    current: number;
    limit: number | null;
    allowed: boolean;
  };
  members: {
    current: number;
    limit: number | null;
    allowed: boolean;
  };
}

export function useCompanyLimits() {
  const { company, limits, checkLimit } = useCompany();
  const [projectsCount, setProjectsCount] = useState(0);
  const [membersCount, setMembersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCounts = async () => {
      if (!company) {
        setLoading(false);
        return;
      }

      try {
        // Contar projetos ativos
        const projetos = await projetoService.findAll();
        const projetosAtivos = projetos.filter(
          (p) => p.companyId === company.id && p.status === "ativo"
        );
        setProjectsCount(projetosAtivos.length);

        // Contar membros ativos
        const usuarios = await userService.findByCompanyId(company.id);
        setMembersCount(usuarios.length);
      } catch (error) {
        console.error("Erro ao carregar contagens:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCounts();
  }, [company]);

  const limitsStatus = useMemo<LimitsStatus | null>(() => {
    if (!company || !limits) {
      return null;
    }

    const projectsLimit = limits.maxProjects;
    const membersLimit = limits.maxMembers;

    return {
      projects: {
        current: projectsCount,
        limit: projectsLimit,
        allowed:
          projectsLimit === null || projectsCount < projectsLimit,
      },
      members: {
        current: membersCount,
        limit: membersLimit,
        allowed: membersLimit === null || membersCount < membersLimit,
      },
    };
  }, [company, limits, projectsCount, membersCount]);

  const canCreateProject = async (): Promise<boolean> => {
    if (!company) return false;

    const result = await checkLimit("maxProjects", projectsCount);
    return result.allowed;
  };

  const canAddMember = async (): Promise<boolean> => {
    if (!company) return false;

    const result = await checkLimit("maxMembers", membersCount);
    return result.allowed;
  };

  return {
    limits,
    limitsStatus,
    loading,
    canCreateProject,
    canAddMember,
    refresh: async () => {
      setLoading(true);
      // Recarregar contagens
      if (company) {
        const projetos = await projetoService.findAll();
        const projetosAtivos = projetos.filter(
          (p) => p.companyId === company.id && p.status === "ativo"
        );
        setProjectsCount(projetosAtivos.length);

        const usuarios = await userService.findByCompanyId(company.id);
        setMembersCount(usuarios.length);
      }
      setLoading(false);
    },
  };
}

