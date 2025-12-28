export interface UserCompanySettings {
  id: string;
  userId: string;
  companyId: string;
  horista: boolean; // Se é horista ou não
  limiteMensalHoras?: number; // Limite mensal de horas (null se horista)
  contato?: string; // Telefone ou outro contato
  cpf?: string; // CPF do membro
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserCompanySettingsDTO {
  userId: string;
  companyId: string;
  horista: boolean;
  limiteMensalHoras?: number;
  contato?: string;
  cpf?: string;
}

export interface UpdateUserCompanySettingsDTO {
  horista?: boolean;
  limiteMensalHoras?: number;
  contato?: string;
  cpf?: string;
}


