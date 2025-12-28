import { User, CreateUserDTO, UpdateUserDTO } from "@/types/user";

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
      if (!Array.isArray(parsed)) return [];

      // Migração: remover companyId e role de usuários antigos
      let needsSave = false;
      const migrated = parsed.map((raw: any) => {
        if (raw && typeof raw === "object") {
          // Se tem companyId ou role, remover (formato antigo)
          if (raw.companyId !== undefined || raw.role !== undefined) {
            needsSave = true;
            const { companyId, role, ...user } = raw;
            return user;
          }
          return raw;
        }
        return raw;
      }) as User[];

      if (needsSave) {
        this.saveUsersToStorage(migrated);
      }

      return migrated;
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

    const users = this.getUsersFromStorage();
    const now = new Date().toISOString();

    const novoUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: data.email,
      name: data.name,
      passwordHash: this.hashPassword(data.password),
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

    const filtered = users.filter((u) => u.id !== id);
    this.saveUsersToStorage(filtered);
  }

  async deactivate(id: string): Promise<User> {
    return this.update(id, { active: false });
  }

  async activate(id: string): Promise<User> {
    return this.update(id, { active: true });
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return this.verifyPasswordInternal(password, user.passwordHash);
  }
}

export const userService = new UserService();

