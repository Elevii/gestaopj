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
  orcamento: Orcamento;
}): string {
  const { field, atividade, projeto, orcamento } = params;
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
      // Se orçamento tem custoTotal, mostra "-", senão mostra o custo calculado
      if (orcamento.custoTotal !== undefined) {
        return "-";
      }
      return formatCurrency(atividade.custoTarefa);
    case "custoCalculado":
      // Se orçamento tem custoTotal, mostra "-", senão calcula
      if (orcamento.custoTotal !== undefined) {
        return "-";
      }
      const valorHora = orcamento.valorHora ?? projeto.valorHora ?? 0;
      return formatCurrency(atividade.horasAtuacao * valorHora);
    case "horasUtilizadas":
      return `${atividade.horasUtilizadas ?? 0}h`;
  }
}

function subtotalForEntregavel(params: {
  entregavel: OrcamentoEntregavel;
  itens: Orcamento["itens"];
  atividadesById: Map<string, Atividade>;
  projeto: Projeto;
  orcamento: Orcamento;
}) {
  // Filtrar itens do entregável e usar índice para mapear atividades
  const itensDoEntregavel = params.itens
    .filter((i) => i.entregavelId === params.entregavel.id)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const horas = itensDoEntregavel.reduce(
    (sum, item) => sum + item.horasEstimadas,
    0
  );
  
  // Se orçamento tem custoTotal, não calcula por entregável (mostra "-")
  if (params.orcamento.custoTotal !== undefined) {
    return { horas, custoCalculado: 0, custoTarefa: 0 };
  }
  
  const valorHora = params.orcamento.valorHora ?? params.projeto.valorHora ?? 0;
  const custoCalculado = horas * valorHora;
  const custoTarefa = itensDoEntregavel.reduce(
    (sum, item) => sum + (item.horasEstimadas * valorHora),
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

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;
  let cursorY = 40;

  const itensOrdenados = params.orcamento.itens
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  
  // Criar atividades virtuais a partir dos itens do orçamento
  const atividadesVirtuais: Atividade[] = itensOrdenados.map((item, idx) => {
    // Tentar encontrar atividade real se existir (para compatibilidade)
    const atividadeReal = params.atividades.find((a) => 
      a.titulo === item.titulo && a.horasAtuacao === item.horasEstimadas
    );
    
    if (atividadeReal) {
      return atividadeReal;
    }
    
    // Criar atividade virtual a partir do item
    // Se orçamento tem valorHora, calcula custo. Se tem custoTotal, usa 0 (será exibido como "-")
    const valorHora = params.orcamento.valorHora ?? params.projeto.valorHora ?? 0;
    const custoTarefa = params.orcamento.custoTotal !== undefined 
      ? 0 // Será exibido como "-"
      : item.horasEstimadas * valorHora;
    return {
      id: `virt_${idx}`,
      projetoId: params.orcamento.projetoId,
      titulo: item.titulo,
      dataInicio: params.orcamento.dataInicioProjeto,
      horasAtuacao: item.horasEstimadas,
      horasUtilizadas: 0,
      dataFimEstimada: params.orcamento.dataInicioProjeto,
      custoTarefa,
      status: "pendente" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const atividadesSelecionadas = atividadesVirtuais;
  const atividadesById = new Map<string, Atividade>();
  for (const a of atividadesSelecionadas) {
    atividadesById.set(a.id, a);
  }

  const totalHoras = atividadesSelecionadas.reduce(
    (sum, a) => sum + (a.horasAtuacao ?? 0),
    0
  );
  
  // Se orçamento tem custoTotal, usa ele. Senão, calcula baseado no tipo de cobrança do projeto
  const totalCustoCalculado = params.orcamento.custoTotal !== undefined
    ? params.orcamento.custoTotal
    : params.projeto.tipoCobranca === "fixo"
      ? (params.projeto.valorFixo ?? 0)
      : totalHoras * (params.orcamento.valorHora ?? params.projeto.valorHora ?? 0);

  // Se orçamento tem custoTotal, o total de custo tarefa é o custoTotal
  // Senão, soma os custos das tarefas
  const totalCustoTarefa = params.orcamento.custoTotal !== undefined
    ? params.orcamento.custoTotal
    : atividadesSelecionadas.reduce(
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
  
  // Determinar valor do projeto baseado no orçamento
  let valorProjetoTexto: string;
  let valorHoraTexto: string;
  
  if (params.orcamento.custoTotal !== undefined) {
    // Se tem custoTotal, é valor fixo
    valorProjetoTexto = `Valor do Projeto: ${formatCurrency(params.orcamento.custoTotal)}`;
    valorHoraTexto = "";
  } else if (params.orcamento.valorHora !== undefined) {
    // Se tem valorHora, calcula soma das tarefas e mostra valor/hora
    valorProjetoTexto = `Valor do Projeto: ${formatCurrency(totalCustoTarefa)}`;
    valorHoraTexto = `Valor/hora: ${formatCurrency(params.orcamento.valorHora)}`;
  } else {
    // Fallback para valores do projeto
    if (params.projeto.tipoCobranca === "fixo") {
      valorProjetoTexto = `Valor do Projeto: ${formatCurrency(params.projeto.valorFixo ?? 0)}`;
      valorHoraTexto = "";
    } else {
      valorProjetoTexto = `Valor do Projeto: ${formatCurrency(totalCustoTarefa)}`;
      valorHoraTexto = `Valor/hora: ${formatCurrency(params.projeto.valorHora ?? 0)}`;
    }
  }
  
  doc.text(
    `${valorProjetoTexto}${valorHoraTexto ? ` | ${valorHoraTexto}` : ""}`,
    leftX,
    cursorY
  );

  // Coluna Direita: Resumo Financeiro
  let rightCursorY = startY;
  doc.setFontSize(12);
  doc.text("Resumo", rightX, rightCursorY);
  rightCursorY += 14;
  doc.setFontSize(10);
  doc.text(`Horas estimadas: ${totalHoras}h`, rightX, rightCursorY);
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
        atividadeId: `item_${itensOrdenados.indexOf(it)}`,
        horasEstimadas: it.horasEstimadas,
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
      const itensDoEntregavel = itensOrdenados
        .filter((i) => i.entregavelId === ent.id)
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

      // Se entregável não tem itens e não tem checkpoints, pula (ou exibe vazio se desejar)
      if (itensDoEntregavel.length === 0 && ent.checkpoints.length === 0)
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
        orcamento: params.orcamento,
      });

      doc.setFontSize(10);
      const custoTexto = params.orcamento.custoTotal !== undefined
        ? "-"
        : formatCurrency(subtotal.custoTarefa);
      doc.text(
        `Horas Estimadas: ${subtotal.horas}h | Custo Estimado: ${custoTexto}`,
        marginX,
        cursorY
      );
      cursorY += 14;

      // Tabela de atividades
      const atividadesDoEntregavel = itensDoEntregavel
        .map((it, idx) => {
          // Encontrar atividade correspondente pelo índice ou criar virtual
          const ativ = atividadesSelecionadas.find((a, aIdx) => {
            const itemOriginal = itensOrdenados.find((orig, origIdx) => origIdx === aIdx);
            return itemOriginal && itemOriginal.titulo === it.titulo && itemOriginal.horasEstimadas === it.horasEstimadas;
          }) || atividadesSelecionadas[itensOrdenados.indexOf(it)];
          
          const crono = cronogramaFull.find(
            (c, cIdx) => {
              const itemCrono = itensOrdenados[cIdx];
              return itemCrono && itemCrono.titulo === it.titulo && itemCrono.horasEstimadas === it.horasEstimadas;
            }
          );
          return { ativ, crono };
        })
        .filter((i) => i.ativ); // Remove nulos

      if (atividadesDoEntregavel.length > 0) {
        // Remove 'dataInicio' das colunas selecionadas para evitar duplicação com o cronograma
        const cols = params.orcamento.camposSelecionados.filter(
          (c) => c !== "dataInicio"
        );

        // Adiciona colunas de cronograma apenas se o usuário optou por exibir
        const mostrarDatas = params.orcamento.mostrarDatasCronograma === true;
        const head = [
          ...cols.map(fieldLabel),
          ...(mostrarDatas ? ["Início", "Fim"] : []),
        ];

        const body = atividadesDoEntregavel.map(({ ativ, crono }) => {
          if (!ativ) return [];
          const rowData = cols.map((field) =>
            fieldValue({ field, atividade: ativ, projeto: params.projeto, orcamento: params.orcamento })
          );
          return [
            ...rowData,
            ...(mostrarDatas
              ? [
                  crono ? formatDateBr(crono.inicio) : "-",
                  crono ? formatDateBr(crono.fim) : "-",
                ]
              : []),
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
