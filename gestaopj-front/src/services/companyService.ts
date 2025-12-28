import { Company, CreateCompanyDTO, UpdateCompanyDTO } from "@/types/company";

class CompanyService {
  private storageKey = "gestaopj_companies";

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  private getCompaniesFromStorage(): Company[] {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? (JSON.parse(stored) as any[]) : [];
      return Array.isArray(parsed) ? (parsed as Company[]) : [];
    } catch {
      return [];
    }
  }

  private saveCompaniesToStorage(companies: Company[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(companies));
    } catch (error) {
      console.error("Erro ao salvar empresas:", error);
    }
  }

  async findAll(): Promise<Company[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.getCompaniesFromStorage();
  }

  async findById(id: string): Promise<Company | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const companies = this.getCompaniesFromStorage();
    return companies.find((c) => c.id === id) || null;
  }

  async findBySlug(slug: string): Promise<Company | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const companies = this.getCompaniesFromStorage();
    return companies.find((c) => c.slug === slug) || null;
  }

  async create(data: CreateCompanyDTO): Promise<Company> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const companies = this.getCompaniesFromStorage();
    const now = new Date().toISOString();
    const slug = this.generateSlug(data.name);

    // Verificar se slug já existe
    let finalSlug = slug;
    let counter = 1;
    while (companies.some((c) => c.slug === finalSlug)) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    const novaCompany: Company = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: data.name,
      slug: finalSlug,
      cnpj: data.cnpj,
      email: data.email,
      phone: data.phone,
      address: data.address,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    companies.push(novaCompany);
    this.saveCompaniesToStorage(companies);

    return novaCompany;
  }

  async update(id: string, data: UpdateCompanyDTO): Promise<Company> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const companies = this.getCompaniesFromStorage();
    const index = companies.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new Error("Empresa não encontrada");
    }

    let slug = companies[index].slug;
    if (data.name && data.name !== companies[index].name) {
      slug = this.generateSlug(data.name);
      // Verificar se novo slug já existe
      let finalSlug = slug;
      let counter = 1;
      while (
        companies.some((c) => c.slug === finalSlug && c.id !== id)
      ) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
      slug = finalSlug;
    }

    companies[index] = {
      ...companies[index],
      ...data,
      slug: data.slug || slug,
      updatedAt: new Date().toISOString(),
    };

    this.saveCompaniesToStorage(companies);
    return companies[index];
  }

  async delete(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const companies = this.getCompaniesFromStorage();
    const filtered = companies.filter((c) => c.id !== id);
    this.saveCompaniesToStorage(filtered);
  }

  async deactivate(id: string): Promise<Company> {
    return this.update(id, { active: false });
  }

  async activate(id: string): Promise<Company> {
    return this.update(id, { active: true });
  }
}

export const companyService = new CompanyService();

