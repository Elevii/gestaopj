import type {
  Atividade,
  Orcamento,
  OrcamentoCampoAtividade,
  OrcamentoEntregavel,
  Projeto,
  StatusAtividade,
} from "@/types";
import { gerarCronogramaSequencial } from "@/utils/estimativas";

const statusLabel: Record<StatusAtividade, string> = {
  pendente: "Pendente",
  em_execucao: "Em execução",
  concluida: "Concluída",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDateBr(iso: string) {
  if (!iso) return "-";
  // Espera YYYY-MM-DD
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fieldLabel(field: OrcamentoCampoAtividade): string {
  switch (field) {
    case "titulo":
      return "Título";
    case "status":
      return "Status";
    case "dataInicio":
      return "Início";
    case "dataFimEstimada":
      return "Término";
    case "horasAtuacao":
      return "Horas";
    case "custoTarefa":
      return "Custo tarefa";
    case "custoCalculado":
      return "Custo calculado";
    case "horasUtilizadas":
      return "Horas (HU)";
  }
}

function fieldValue(params: {
  field: OrcamentoCampoAtividade;
  atividade: Atividade;
  projeto: Projeto;
}): string {
  const { field, atividade, projeto } = params;
  switch (field) {
    case "titulo":
      return atividade.titulo;
    case "status":
      return statusLabel[atividade.status];
    case "dataInicio":
      return formatDateBr(atividade.dataInicio);
    case "dataFimEstimada":
      return formatDateBr(atividade.dataFimEstimada);
    case "horasAtuacao":
      return `${atividade.horasAtuacao}h`;
    case "custoTarefa":
      return formatCurrency(atividade.custoTarefa);
    case "custoCalculado":
      return formatCurrency(atividade.horasAtuacao * (projeto.valorHora ?? 0));
    case "horasUtilizadas":
      return `${atividade.horasUtilizadas ?? 0}h`;
  }
}

function subtotalForEntregavel(params: {
  entregavel: OrcamentoEntregavel;
  itens: Orcamento["itens"];
  atividadesById: Map<string, Atividade>;
  projeto: Projeto;
}) {
  const atividadeIds = params.itens
    .filter((i) => i.entregavelId === params.entregavel.id)
    .map((i) => i.atividadeId);

  const horas = atividadeIds.reduce(
    (sum, id) => sum + (params.atividadesById.get(id)?.horasAtuacao ?? 0),
    0
  );
  const custoCalculado = horas * (params.projeto.valorHora ?? 0);
  const custoTarefa = atividadeIds.reduce(
    (sum, id) => sum + (params.atividadesById.get(id)?.custoTarefa ?? 0),
    0
  );

  return { horas, custoCalculado, custoTarefa };
}

export async function exportOrcamentoToPdf(params: {
  orcamento: Orcamento;
  projeto: Projeto;
  atividades: Atividade[];
  empresa: string;
  filename?: string;
}) {
  const jsPDFModule = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { jsPDF } = jsPDFModule;

  const atividadesById = new Map<string, Atividade>();
  for (const a of params.atividades) atividadesById.set(a.id, a);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;
  let cursorY = 40;

  const itensOrdenados = params.orcamento.itens
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const atividadesSelecionadas = itensOrdenados
    .map((i) => atividadesById.get(i.atividadeId))
    .filter(Boolean) as Atividade[];

  const totalHoras = atividadesSelecionadas.reduce(
    (sum, a) => sum + (a.horasAtuacao ?? 0),
    0
  );
  
  const totalCustoCalculado = 
    params.projeto.tipoCobranca === "fixo"
      ? (params.projeto.valorFixo ?? 0)
      : totalHoras * (params.projeto.valorHora ?? 0);

  const totalCustoTarefa = atividadesSelecionadas.reduce(
    (sum, a) => sum + (a.custoTarefa ?? 0),
    0
  );

  doc.setFontSize(16);
  doc.text(params.orcamento.titulo, marginX, cursorY);
  cursorY += 18;

  // Layout: Orçamento (Esquerda) | Resumo (Direita)
  const leftX = marginX;
  const rightX = doc.internal.pageSize.width / 2 + 20;

  const startY = cursorY;

  // Coluna Esquerda: Informações do Orçamento
  doc.setFontSize(12);
  doc.text("Projeto", leftX, cursorY);
  cursorY += 14;
  doc.setFontSize(10);
  doc.text(`Projeto: ${params.projeto.titulo}`, leftX, cursorY);
  cursorY += 12;
  doc.text(`Empresa: ${params.empresa}`, leftX, cursorY);
  cursorY += 12;
  
  if (params.projeto.tipoCobranca === "fixo") {
    doc.text(
      `Valor do Projeto: ${formatCurrency(params.projeto.valorFixo ?? 0)} | Horas úteis/dia: ${params.projeto.horasUteisPorDia}`,
      leftX,
      cursorY
    );
  } else {
    doc.text(
      `Valor/hora: ${formatCurrency(params.projeto.valorHora ?? 0)} | Horas úteis/dia: ${params.projeto.horasUteisPorDia}`,
      leftX,
      cursorY
    );
  }

  // Coluna Direita: Resumo Financeiro
  let rightCursorY = startY;
  doc.setFontSize(12);
  doc.text("Resumo", rightX, rightCursorY);
  rightCursorY += 14;
  doc.setFontSize(10);
  doc.text(`Horas estimadas: ${totalHoras}h`, rightX, rightCursorY);
  rightCursorY += 12;
  
  doc.text(
    `${params.projeto.tipoCobranca === "fixo" ? "Valor Total" : "Custo Calculado"}: ${formatCurrency(totalCustoCalculado)}`,
    rightX,
    rightCursorY
  );
  rightCursorY += 12;

  // Sincroniza cursorY com o maior dos dois
  cursorY = Math.max(cursorY, rightCursorY) + 30;

  if (params.orcamento.observacoes) {
    // Calcula largura total disponível
    const fullWidth = doc.internal.pageSize.width - 2 * marginX;

    // Título das observações (opcional, ou pode ser só o texto)
    doc.setFontSize(12);
    doc.text("Apresentação", marginX, cursorY);
    cursorY += 14;

    doc.setFontSize(10);
    // Quebra o texto para a largura total
    const splitText = doc.splitTextToSize(
      params.orcamento.observacoes,
      fullWidth
    );
    doc.text(splitText, marginX, cursorY);

    // Atualiza cursorY baseado na altura do texto + espaçamento extra
    cursorY += splitText.length * 12 + 30;
  }

  // Título centralizado
  doc.setFontSize(14);
  const textTitle = "Resumo de atividades";
  const textWidth = doc.getTextWidth(textTitle);
  doc.text(textTitle, (doc.internal.pageSize.width - textWidth) / 2, cursorY);
  cursorY += 30;

  // Cronograma (geração unificada para uso interno)
  const cronogramaFull = gerarCronogramaSequencial({
    dataInicioProjetoISO: params.orcamento.dataInicioProjeto,
    horasUteisPorDia: params.projeto.horasUteisPorDia,
    itens: itensOrdenados.map((it) => ({
      atividadeId: it.atividadeId,
      horasEstimadas: atividadesById.get(it.atividadeId)?.horasAtuacao ?? 0,
      inicioOverride: it.inicioOverride,
      fimOverride: it.fimOverride,
    })),
  });

  // Renderização por entregável (obrigatório agora)
  if (params.orcamento.entregaveis?.length) {
    const entregaveis = params.orcamento.entregaveis
      .slice()
      .sort((a, b) => a.ordem - b.ordem);

    for (const ent of entregaveis) {
      // Filtra itens deste entregável
      const itensEntregavelIds = itensOrdenados
        .filter((i) => i.entregavelId === ent.id)
        .map((i) => i.atividadeId);

      // Se entregável não tem itens e não tem checkpoints, pula (ou exibe vazio se desejar)
      if (itensEntregavelIds.length === 0 && ent.checkpoints.length === 0)
        continue;

      if (cursorY > 720) {
        doc.addPage();
        cursorY = 40;
      }

      // Cabeçalho do Entregável
      doc.setFontSize(12);
      doc.text(ent.titulo, marginX, cursorY);
      cursorY += 14;

      // Subtotais do Entregável
      const subtotal = subtotalForEntregavel({
        entregavel: ent,
        itens: itensOrdenados,
        atividadesById,
        projeto: params.projeto,
      });

      doc.setFontSize(10);
      doc.text(
        `Horas Estimadas: ${subtotal.horas}h | Custo Estimado: ${formatCurrency(subtotal.custoTarefa)}`,
        marginX,
        cursorY
      );
      cursorY += 14;

      // Tabela de atividades
      const atividadesDoEntregavel = itensOrdenados
        .filter((it) => it.entregavelId === ent.id)
        .map((it) => {
          const ativ = atividadesById.get(it.atividadeId);
          const crono = cronogramaFull.find(
            (c) => c.atividadeId === it.atividadeId
          );
          return { ativ, crono };
        })
        .filter((i) => i.ativ); // Remove nulos

      if (atividadesDoEntregavel.length > 0) {
        // Remove 'dataInicio' das colunas selecionadas para evitar duplicação com o cronograma
        const cols = params.orcamento.camposSelecionados.filter(
          (c) => c !== "dataInicio"
        );

        const head = [
          ...cols.map(fieldLabel),
          // Adiciona colunas de cronograma se não estiverem selecionadas explicitamente
          "Início",
          "Fim",
        ];

        const body = atividadesDoEntregavel.map(({ ativ, crono }) => {
          if (!ativ) return [];
          const rowData = cols.map((field) =>
            fieldValue({ field, atividade: ativ, projeto: params.projeto })
          );
          return [
            ...rowData,
            crono ? formatDateBr(crono.inicio) : "-",
            crono ? formatDateBr(crono.fim) : "-",
          ];
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore plugin
        autoTable(doc, {
          startY: cursorY,
          head: [head],
          body,
          styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
          headStyles: {
            fontSize: 10,
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
          },
          theme: "grid",
          margin: { left: marginX, right: marginX },
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore plugin
        cursorY = doc.lastAutoTable.finalY + 14;
      }

      // Checkpoints
      if (ent.checkpoints?.length) {
        if (cursorY > 740) {
          doc.addPage();
          cursorY = 40;
        }

        doc.setFontSize(10);
        doc.text("Entregas Planejadas:", marginX, cursorY);
        cursorY += 8;

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore plugin
        autoTable(doc, {
          startY: cursorY,
          head: [["Entrega", "Data Alvo"]],
          body: ent.checkpoints
            .slice()
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore type
            .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
            .map((c) => [
              `${ent.titulo} - ${c.titulo}`,
              formatDateBr(c.dataAlvo ?? ""),
            ]),
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: {
            fontSize: 10,
            fillColor: [250, 250, 250],
            textColor: [0, 0, 0],
          },
          theme: "grid",
          margin: { left: marginX, right: marginX },
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore plugin
        cursorY = doc.lastAutoTable.finalY + 20;
      } else {
        cursorY += 10;
      }
    }
  }

  doc.save(params.filename ?? "orcamento.pdf");
}
