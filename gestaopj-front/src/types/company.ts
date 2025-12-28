export interface Company {
  id: string;
  name: string;
  slug: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  active: boolean;
  diaInicioFaturamento?: number; // Dia do mês (1-31) para início do período de faturamento
  diaFimFaturamento?: number; // Dia do mês (1-31) para fim do período de faturamento
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyDTO {
  name: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateCompanyDTO {
  name?: string;
  slug?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  active?: boolean;
  diaInicioFaturamento?: number;
  diaFimFaturamento?: number;
}

