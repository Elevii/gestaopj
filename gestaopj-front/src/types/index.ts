export interface Projeto {
  id: string;
  companyId: string; // ID da empresa (novo campo)
  empresa: string; // Nome da empresa (mantido para compatibilidade)
  titulo: string;
  tipoCobranca?: TipoCobranca;
  valorFixo?: number;
  valorHora?: number;
  /**
   * Horas úteis por dia (1..24). Usado para estimativas de término.
   */
  horasUteisPorDia: number;
  status: StatusProjeto;
  createdAt: string;
  updatedAt: string;
}

export type TipoCobranca = "horas" | "fixo";

export type StatusProjeto = "ativo" | "pausado" | "concluido" | "cancelado";

export type StatusAtividade = "pendente" | "em_execucao" | "concluida";

export type TipoAtuacao = "reuniao" | "execucao" | "planejamento";

export interface Atividade {
  id: string;
  projetoId: string;
  titulo: string;
  dataInicio: string;
  horasAtuacao: number;
  horasUtilizadas: number;
  dataFimEstimada: string;
  custoTarefa: number;
  status: StatusAtividade;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjetoDTO {
  companyId?: string; // ID da empresa (opcional - será adicionado automaticamente pelo contexto se não fornecido)
  empresa: string; // Nome da empresa (mantido para compatibilidade)
  titulo: string;
  tipoCobranca: TipoCobranca;
  valorFixo?: number;
  valorHora?: number;
  horasUteisPorDia: number;
  status?: StatusProjeto;
}

export interface ProjectMember {
  id: string;
  projetoId: string;
  userId: string;
  companyId: string; // Para facilitar filtragem
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectMemberDTO {
  projetoId: string;
  userId: string;
}

export interface CreateAtividadeDTO {
  projetoId: string;
  titulo: string;
  dataInicio: string;
  horasAtuacao: number;
  status?: StatusAtividade;
  horasUtilizadas?: number;
  /**
   * Custo da tarefa (BRL). Se não informado, será calculado automaticamente:
   * horasAtuacao * valorHora
   */
  custoTarefa?: number;
}

export interface Atuacao {
  id: string;
  companyId: string; // ID da empresa
  projetoId: string;
  atividadeId: string;
  /**
   * ID do usuário que registrou a atuação
   */
  userId?: string;
  /**
   * Data da atuação no formato ISO date (YYYY-MM-DD)
   */
  data: string;
  /**
   * Horário de início (HH:mm). Opcional, usado em relatórios.
   */
  horarioInicio?: string;
  /**
   * Horas estimadas (HE) da atividade no momento do registro.
   */
  horasEstimadasNoRegistro: number;
  horasUtilizadas: number;
  tipo: TipoAtuacao;
  /**
   * Status da atividade no momento do registro.
   */
  statusAtividadeNoRegistro: StatusAtividade;
  /**
   * Título personalizado para atividade avulsa (até 30 caracteres)
   */
  tituloAvulsa?: string;
  descricao?: string;
  impactoGerado?: string;
  /**
   * URL da evidência da atuação (link para comprovação)
   */
  evidenciaUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAtuacaoDTO {
  projetoId: string;
  atividadeId: string;
  userId?: string;
  data: string;
  horarioInicio?: string;
  horasEstimadasNoRegistro: number;
  horasUtilizadas: number;
  tipo: TipoAtuacao;
  statusAtividadeNoRegistro: StatusAtividade;
  /**
   * Título personalizado para atividade avulsa (até 30 caracteres)
   */
  tituloAvulsa?: string;
  descricao?: string;
  impactoGerado?: string;
  evidenciaUrl?: string;
}

export type OrcamentoCampoAtividade =
  | "titulo"
  | "status"
  | "dataInicio"
  | "dataFimEstimada"
  | "horasAtuacao"
  | "custoTarefa"
  | "custoCalculado"
  | "horasUtilizadas";

export interface OrcamentoCheckpoint {
  id: string;
  titulo: string;
  dataAlvo?: string; // ISO date
  descricao?: string;
  ordem: number;
}

export interface OrcamentoEntregavel {
  id: string;
  titulo: string;
  descricao?: string;
  ordem: number;
  checkpoints: OrcamentoCheckpoint[];
}

export interface OrcamentoItem {
  atividadeId: string;
  ordem?: number;
  entregavelId?: string;
  inicioOverride?: string; // ISO date
  fimOverride?: string; // ISO date
}

export interface Orcamento {
  id: string;
  companyId: string; // ID da empresa
  projetoId: string;
  titulo: string;
  /**
   * Data de início do cronograma do orçamento (ISO date).
   */
  dataInicioProjeto: string;
  camposSelecionados: OrcamentoCampoAtividade[];
  itens: OrcamentoItem[];
  observacoes?: string;
  usarEntregaveis: boolean;
  mostrarSubtotaisPorEntregavel: boolean;
  mostrarDatasCronograma?: boolean; // Se true, exibe colunas de início e término do cronograma
  entregaveis?: OrcamentoEntregavel[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrcamentoDTO {
  projetoId: string;
  titulo: string;
  dataInicioProjeto: string;
  camposSelecionados: OrcamentoCampoAtividade[];
  itens: OrcamentoItem[];
  observacoes?: string;
  usarEntregaveis: boolean;
  mostrarSubtotaisPorEntregavel: boolean;
  mostrarDatasCronograma?: boolean; // Se true, exibe colunas de início e término do cronograma
  entregaveis?: OrcamentoEntregavel[];
}

export type StatusFatura = "pendente" | "pago" | "cancelado" | "fatura_gerada";

// Tipos para Etapas de Faturamento
export type TipoEtapa = "envio_relatorio" | "geracao_nota_fiscal" | "outro";
export type StatusEtapa = "pendente" | "enviado" | "aprovado" | "rejeitado";

export interface FaturaEtapa {
  id: string;
  companyId: string; // Etapas são sempre por empresa
  nome: string;
  tipo: TipoEtapa;
  dataLimite?: string; // ISO date, opcional
  requerAnexo: boolean;
  ordem: number; // Para ordenação
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFaturaEtapaDTO {
  companyId: string;
  nome: string;
  tipo: TipoEtapa;
  dataLimite?: string;
  requerAnexo: boolean;
  ordem?: number;
}

export interface UpdateFaturaEtapaDTO {
  nome?: string;
  tipo?: TipoEtapa;
  dataLimite?: string;
  requerAnexo?: boolean;
  ordem?: number;
  ativo?: boolean;
}

export interface FaturaEtapaStatus {
  id: string;
  faturaId: string;
  etapaId: string;
  status: StatusEtapa;
  anexoUrl?: string; // URL do arquivo anexado
  anexoNome?: string; // Nome original do arquivo
  observacoes?: string;
  aprovadoPor?: string; // userId do aprovador
  aprovadoEm?: string; // ISO date
  createdAt: string;
  updatedAt: string;
}

export interface CreateFaturaEtapaStatusDTO {
  faturaId: string;
  etapaId: string;
  status: StatusEtapa;
  anexoUrl?: string;
  anexoNome?: string;
  observacoes?: string;
}

export interface UpdateFaturaEtapaStatusDTO {
  status?: StatusEtapa;
  anexoUrl?: string;
  anexoNome?: string;
  observacoes?: string;
  aprovadoPor?: string;
  aprovadoEm?: string;
}

export interface Lembrete {
  id: string;
  faturaId: string;
  titulo: string;
  data: string; // ISO date
  concluido: boolean;
}

export interface Fatura {
  id: string;
  companyId: string; // ID da empresa
  projetoId: string;
  userId?: string; // ID do usuário associado à fatura
  titulo: string;
  valor: number;
  dataVencimento: string; // ISO date
  dataPagamento?: string; // ISO date
  status: StatusFatura;
  cobrancaEnviada: boolean;
  notaFiscalEmitida: boolean;
  comprovanteEnviado: boolean;
  lembretes: Lembrete[];
  observacoes?: string;
  // Novos campos para gestão de faturamento
  periodoInicio: string; // ISO date - início do período de faturamento
  periodoFim: string; // ISO date - fim do período de faturamento
  horasTrabalhadas: number; // Horas trabalhadas no período
  tipoCalculo: "horas" | "fixo"; // Baseado em UserCompanySettings
  valorPorHora?: number; // Para cálculo quando horista
  aprovada: boolean; // Para workflow de aprovação
  aprovadaPor?: string; // userId do aprovador
  aprovadaEm?: string; // ISO date
  createdAt: string;
  updatedAt: string;
}

export type FrequenciaRecorrencia = "semanal" | "quinzenal" | "mensal" | "anual";

export interface RecorrenciaDTO {
  frequencia: FrequenciaRecorrencia;
  repeticoes: number; // 2 a 12
}

export interface CreateLembreteDTO {
  titulo: string;
  diasAntesVencimento?: number; // Se definido, calcula data baseada no vencimento
  dataFixa?: string; // ISO date, se diasAntesVencimento não for usado
}

export interface CreateFaturaDTO {
  projetoId: string;
  userId?: string; // ID do usuário associado à fatura
  titulo: string;
  valor: number;
  dataVencimento: string; // ISO date
  periodoInicio?: string; // ISO date - início do período de faturamento
  periodoFim?: string; // ISO date - fim do período de faturamento
  horasTrabalhadas?: number;
  tipoCalculo?: "horas" | "fixo";
  valorPorHora?: number;
  observacoes?: string;
  recorrencia?: RecorrenciaDTO;
  lembretesIniciais?: CreateLembreteDTO[];
}

export interface UpdateFaturaDTO {
  titulo?: string;
  valor?: number;
  dataVencimento?: string;
  dataPagamento?: string;
  status?: StatusFatura;
  cobrancaEnviada?: boolean;
  notaFiscalEmitida?: boolean;
  comprovanteEnviado?: boolean;
  observacoes?: string;
  lembretes?: Lembrete[];
  // Novos campos
  periodoInicio?: string;
  periodoFim?: string;
  horasTrabalhadas?: number;
  tipoCalculo?: "horas" | "fixo";
  valorPorHora?: number;
  aprovada?: boolean;
  aprovadaPor?: string;
  aprovadaEm?: string;
}

export interface Configuracoes {
  tema: "claro" | "escuro" | "sistema";
  nomeEmpresa: string;
  horasUteisPadrao: number;
  fusoHorario: string; // Ex: "America/Sao_Paulo"
  formatoData: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
  createdAt: string;
  updatedAt: string;
}

export interface UpdateConfiguracoesDTO {
  tema?: "claro" | "escuro" | "sistema";
  nomeEmpresa?: string;
  horasUteisPadrao?: number;
  fusoHorario?: string;
  formatoData?: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
}

// Exportar novos tipos
export * from "./user";
export * from "./auth";
export * from "./company";
export * from "./subscription";
export * from "./permissions";
