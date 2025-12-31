// Tipos para autenticação com backend
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
}

export interface RegisterDTO {
  email: string;
  name: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

