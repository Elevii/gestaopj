import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { formatDateBR } from "@/utils/estimativas";

/**
 * Hook para formatar datas usando as configurações do usuário
 */
export function useFormatDate() {
  const { configuracoes } = useConfiguracoes();

  const formatDate = (dateISO: string | null | undefined): string => {
    return formatDateBR(dateISO, {
      formatoData: configuracoes.formatoData,
      fusoHorario: configuracoes.fusoHorario,
    });
  };

  return { formatDate };
}

