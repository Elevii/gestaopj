import { UserRole } from "./user";

export type InviteStatus = "pending" | "accepted" | "rejected" | "expired";

export interface Invite {
  id: string;
  companyId: string;
  email: string;
  role: UserRole;
  status: InviteStatus;
  token: string;
  expiresAt: string;
  createdBy: string; // userId que criou o convite
  createdAt: string;
  updatedAt: string;
}

export interface CreateInviteDTO {
  companyId: string;
  email: string;
  role: UserRole;
  expiresInDays?: number; // Padrão: 7 dias
}

export interface UpdateInviteDTO {
  status?: InviteStatus;
}




