export interface Company {
  id: string;
  name: string;
  slug: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  active: boolean;
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
}

