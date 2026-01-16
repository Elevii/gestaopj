import { UserRole } from "./user";

export interface CompanyMembership {
  id: string;
  userId: string;
  companyId: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyMembershipDTO {
  userId: string;
  companyId: string;
  role: UserRole;
  active?: boolean;
}

export interface UpdateCompanyMembershipDTO {
  role?: UserRole;
  active?: boolean;
}




