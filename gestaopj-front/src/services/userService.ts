import { User, CreateUserDTO, UpdateUserDTO, UserRole } from "@/types/user";

class UserService {
  private storageKey = "gestaopj_users";

  // Hash simples de senha (em produção, usar bcrypt ou similar no backend)
  private hashPassword(password: string): string {
    // Simulação de hash - em produção isso deve ser feito no backend
    return btoa(password); // Apenas para demonstração, NÃO usar em produção
  }

  private verifyPasswordInternal(password: string, hash: string): boolean {
    return btoa(password) === hash; // Apenas para demonstração
  }

  private getUsersFromStorage(): User[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      return Array.isArray(parsed) ? (parsed as User[]) : [];
    } catch {
      return [];
    }
  }

  private saveUsersToStorage(users: User[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(users));
    } catch (error) {
      console.error("Erro ao salvar usuários:", error);
    }
  }

  async findAll(): Promise<User[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.getUsersFromStorage();
  }

  async findByCompanyId(companyId: string): Promise<User[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const users = this.getUsersFromStorage();
    return users.filter((u) => u.companyId === companyId && u.active);
  }

  async findById(id: string): Promise<User | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const users = this.getUsersFromStorage();
    return users.find((u) => u.id === id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const users = this.getUsersFromStorage();
    return users.find((u) => u.email === email) || null;
  }

  async create(data: CreateUserDTO): Promise<User> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Verificar se email já existe
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new Error("Email já cadastrado");
    }

    // Verificar se já existe Owner na empresa
    if (data.role === "owner") {
      const companyUsers = await this.findByCompanyId(data.companyId);
      const hasOwner = companyUsers.some((u) => u.role === "owner" && u.active);
      if (hasOwner) {
        throw new Error("Empresa já possui um Owner. Apenas um Owner por empresa.");
      }
    }

    const users = this.getUsersFromStorage();
    const now = new Date().toISOString();

    const novoUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: data.companyId,
      email: data.email,
      name: data.name,
      passwordHash: this.hashPassword(data.password),
      role: data.role || "member",
      active: data.active !== undefined ? data.active : true,
      createdAt: now,
      updatedAt: now,
    };

    users.push(novoUser);
    this.saveUsersToStorage(users);

    return novoUser;
  }

  async update(id: string, data: UpdateUserDTO): Promise<User> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const users = this.getUsersFromStorage();
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      throw new Error("Usuário não encontrado");
    }

    // Se mudando para Owner, verificar se já existe Owner na empresa
    if (data.role === "owner" && users[index].role !== "owner") {
      const companyUsers = users.filter(
        (u) => u.companyId === users[index].companyId && u.id !== id
      );
      const hasOwner = companyUsers.some((u) => u.role === "owner" && u.active);
      if (hasOwner) {
        throw new Error("Empresa já possui um Owner. Transfira a propriedade primeiro.");
      }
    }

    users[index] = {
      ...users[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.saveUsersToStorage(users);
    return users[index];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const users = this.getUsersFromStorage();
    const user = users.find((u) => u.id === id);

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Não permitir deletar Owner sem transferência
    if (user.role === "owner") {
      throw new Error("Não é possível remover o Owner. Transfira a propriedade primeiro.");
    }

    const filtered = users.filter((u) => u.id !== id);
    this.saveUsersToStorage(filtered);
  }

  async deactivate(id: string): Promise<User> {
    const users = this.getUsersFromStorage();
    const user = users.find((u) => u.id === id);

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Não permitir desativar Owner
    if (user.role === "owner") {
      throw new Error("Não é possível desativar o Owner.");
    }

    return this.update(id, { active: false });
  }

  async activate(id: string): Promise<User> {
    return this.update(id, { active: true });
  }

  async transferOwnership(
    currentOwnerId: string,
    newOwnerId: string
  ): Promise<{ oldOwner: User; newOwner: User }> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const users = this.getUsersFromStorage();
    const currentOwner = users.find((u) => u.id === currentOwnerId);
    const newOwner = users.find((u) => u.id === newOwnerId);

    if (!currentOwner || currentOwner.role !== "owner") {
      throw new Error("Usuário atual não é Owner");
    }

    if (!newOwner) {
      throw new Error("Novo Owner não encontrado");
    }

    if (currentOwner.companyId !== newOwner.companyId) {
      throw new Error("Usuários devem pertencer à mesma empresa");
    }

    // Transferir propriedade
    const oldOwnerIndex = users.findIndex((u) => u.id === currentOwnerId);
    const newOwnerIndex = users.findIndex((u) => u.id === newOwnerId);

    users[oldOwnerIndex] = {
      ...users[oldOwnerIndex],
      role: "admin", // Ex-owner vira admin
      updatedAt: new Date().toISOString(),
    };

    users[newOwnerIndex] = {
      ...users[newOwnerIndex],
      role: "owner",
      updatedAt: new Date().toISOString(),
    };

    this.saveUsersToStorage(users);

    return {
      oldOwner: users[oldOwnerIndex],
      newOwner: users[newOwnerIndex],
    };
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return this.verifyPasswordInternal(password, user.passwordHash);
  }
}

export const userService = new UserService();

