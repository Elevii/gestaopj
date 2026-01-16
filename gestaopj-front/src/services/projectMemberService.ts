import { ProjectMember, CreateProjectMemberDTO } from "@/types";
import { projetoService } from "./projetoService";

const STORAGE_KEY = "atuapj_project_members";

class ProjectMemberService {
  private getMembersFromStorage(): ProjectMember[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as ProjectMember[];
    } catch {
      return [];
    }
  }

  private saveMembersToStorage(members: ProjectMember[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  }

  async create(data: CreateProjectMemberDTO): Promise<ProjectMember> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Buscar projeto para obter companyId
    const projeto = await projetoService.findById(data.projetoId);
    if (!projeto) {
      throw new Error("Projeto não encontrado");
    }

    const members = this.getMembersFromStorage();

    // Verificar se já existe associação
    const existing = members.find(
      (m) => m.projetoId === data.projetoId && m.userId === data.userId
    );
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const newMember: ProjectMember = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projetoId: data.projetoId,
      userId: data.userId,
      companyId: projeto.companyId,
      createdAt: now,
      updatedAt: now,
    };

    members.push(newMember);
    this.saveMembersToStorage(members);

    return newMember;
  }

  async findByProjectId(projetoId: string): Promise<ProjectMember[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const members = this.getMembersFromStorage();
    return members.filter((m) => m.projetoId === projetoId);
  }

  async findByUserId(userId: string, companyId?: string): Promise<ProjectMember[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const members = this.getMembersFromStorage();
    
    if (companyId) {
      return members.filter(
        (m) => m.userId === userId && m.companyId === companyId
      );
    }
    
    return members.filter((m) => m.userId === userId);
  }

  async findByProjectAndUser(
    projetoId: string,
    userId: string
  ): Promise<ProjectMember | null> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const members = this.getMembersFromStorage();
    return (
      members.find(
        (m) => m.projetoId === projetoId && m.userId === userId
      ) || null
    );
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const members = this.getMembersFromStorage();
    const filtered = members.filter((m) => m.id !== id);
    this.saveMembersToStorage(filtered);
  }

  async deleteByProject(projetoId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const members = this.getMembersFromStorage();
    const filtered = members.filter((m) => m.projetoId !== projetoId);
    this.saveMembersToStorage(filtered);
  }

  async deleteByUserAndProject(userId: string, projetoId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const members = this.getMembersFromStorage();
    const filtered = members.filter(
      (m) => !(m.userId === userId && m.projetoId === projetoId)
    );
    this.saveMembersToStorage(filtered);
  }
}

export const projectMemberService = new ProjectMemberService();



