export type UserRole = "owner" | "admin" | "member" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  // passwordHash removido - não vem mais do backend
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  password: string;
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

