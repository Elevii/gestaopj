export interface MemberPayment {
  id: string;
  userId: string;
  companyId: string;
  valor: number; // Valor a ser pago (pode ser editado)
  mes: string; // Formato YYYY-MM (mês/ano do fechamento)
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberPaymentDTO {
  userId: string;
  companyId: string;
  valor: number;
  mes: string; // Formato YYYY-MM
}

export interface UpdateMemberPaymentDTO {
  valor?: number;
}



