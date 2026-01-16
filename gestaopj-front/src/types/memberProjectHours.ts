export interface MemberProjectHoursLimit {
  id: string;
  companyId: string;
  userId: string;
  projetoId: string;
  maxHours: number; // Teto máximo de horas para este membro neste projeto
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberProjectHoursLimitDTO {
  companyId: string;
  userId: string;
  projetoId: string;
  maxHours: number;
}

export interface UpdateMemberProjectHoursLimitDTO {
  maxHours?: number;
}





