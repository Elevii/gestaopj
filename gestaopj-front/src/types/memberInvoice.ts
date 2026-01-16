import { StatusFatura, Lembrete } from "./index";

export interface MemberInvoice {
  id: string;
  userId: string;
  companyId: string;
  titulo: string;
  valor: number;
  dataVencimento: string; // ISO date
  dataPagamento?: string; // ISO date
  status: StatusFatura;
  periodoInicio: string; // ISO date - início do período de faturamento
  periodoFim: string; // ISO date - fim do período de faturamento
  horasTrabalhadas: number; // Horas trabalhadas no período
  tipoCalculo: "horas" | "fixo"; // Baseado em UserCompanySettings
  valorPorHora?: number; // Para cálculo quando horista
  valorFixo?: number; // Para cálculo quando não horista
  valorManual?: boolean; // Indica se o valor foi editado manualmente
  lembretes: Lembrete[];
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberInvoiceDTO {
  userId: string;
  companyId: string;
  titulo: string;
  valor: number;
  dataVencimento: string; // ISO date
  periodoInicio: string; // ISO date
  periodoFim: string; // ISO date
  horasTrabalhadas: number;
  tipoCalculo: "horas" | "fixo";
  valorPorHora?: number;
  valorFixo?: number;
  observacoes?: string;
  lembretes?: Lembrete[];
}

export interface UpdateMemberInvoiceDTO {
  titulo?: string;
  valor?: number;
  valorManual?: boolean; // Indica se o valor foi editado manualmente
  dataVencimento?: string;
  dataPagamento?: string;
  status?: StatusFatura;
  periodoInicio?: string;
  periodoFim?: string;
  horasTrabalhadas?: number;
  observacoes?: string;
  lembretes?: Lembrete[];
}



