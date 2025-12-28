export type UserRole = "owner" | "admin" | "member";

export interface User {
  id: string;
  companyId: string;
  email: string;
  name: string;
  passwordHash: string; // Em produção, nunca deve ser exposto ao frontend
  role: UserRole;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDTO {
  companyId: string;
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  active?: boolean;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  role?: UserRole;
  active?: boolean;
}

export interface LoginDTO {
  email: string;
  password: string;
}

