import type { Atuacao, StatusAtividade, TipoAtuacao } from "@/types";
import { parseISODateToLocal, formatDateBR } from "./estimativas";

export type AtuacaoColumn =
  | "numero"
  | "data"
  | "horarioInicio"
  | "projeto"
  | "atividade"
  | "tipo"
  | "status"
  | "hd"
  | "hu"
  | "descricao"
  | "impacto";

export const COLUMN_LABELS: Record<AtuacaoColumn, string> = {
  numero: "#",
  data: "Data",
  horarioInicio: "Início",
  projeto: "Projeto",
  atividade: "Atividade",
  tipo: "Tipo",
  status: "Status",
  hd: "HD",
  hu: "HU",
  descricao: "Descrição",
  impacto: "Impacto",
};

export type AtuacaoExportRow = {
  numero: number;
  data: string;
  horarioInicio: string;
  projeto: string;
  atividade: string;
  tipo: string;
  status: string;
  hd: number;
  hu: number;
  descricao: string;
  impacto: string;
  evidenciaUrl: string;
};

const tipoLabel: Record<TipoAtuacao, string> = {
  reuniao: "Reunião",
  execucao: "Execução",
  planejamento: "Planejamento",
};

const statusLabel: Record<StatusAtividade, string> = {
  pendente: "Pendente",
  em_execucao: "Em execução",
  concluida: "Concluída",
};

// Função para reordenar colunas: número primeiro, depois data, depois atividade
function reorderColumns(cols: AtuacaoColumn[]): AtuacaoColumn[] {
  const ordered: AtuacaoColumn[] = [];
  const remaining = [...cols];

  // Sempre colocar "numero" primeiro se existir
  if (remaining.includes("numero")) {
    ordered.push("numero");
    remaining.splice(remaining.indexOf("numero"), 1);
  }

  // Sempre colocar "data" depois do número se existir
  if (remaining.includes("data")) {
    ordered.push("data");
    remaining.splice(remaining.indexOf("data"), 1);
  }

  // Colocar "atividade" logo após "data" se existir
  if (remaining.includes("atividade")) {
    ordered.push("atividade");
    remaining.splice(remaining.indexOf("atividade"), 1);
  }

  // Adicionar as demais colunas na ordem original
  remaining.forEach((col) => ordered.push(col));

  return ordered;
}

function toRows(params: {
  atuacoes: Atuacao[];
  projetoTitleById: Map<string, string>;
  atividadeTitleById: Map<string, string>;
  hdByAtuacaoId?: Map<string, number>;
  formatoData?: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
  fusoHorario?: string;
}): AtuacaoExportRow[] {
  return params.atuacoes.map((a, index) => {
    // Verificar se é atividade avulsa
    const isAtividadeAvulsa = a.atividadeId.startsWith("__ATIVIDADE_AVULSA__");
    const tituloAvulsa = a.tituloAvulsa || "(Atividade avulsa)";
    const atividadeNome = isAtividadeAvulsa 
      ? `[ ! ] - ${tituloAvulsa}`
      : (params.atividadeTitleById.get(a.atividadeId) ?? "");
    
    // HD sempre 0 para atividade avulsa, caso contrário usa o valor do map
    const hd = isAtividadeAvulsa ? 0 : (params.hdByAtuacaoId?.get(a.id) ?? 0);
    
    return {
      numero: index + 1,
      data: formatDateBR(a.data, {
        formatoData: params.formatoData,
        fusoHorario: params.fusoHorario,
      }),
      horarioInicio: (a as any).horarioInicio ?? "",
      projeto: params.projetoTitleById.get(a.projetoId) ?? "",
      atividade: atividadeNome,
      tipo: tipoLabel[a.tipo],
      status:
        statusLabel[
          (a.statusAtividadeNoRegistro ?? "pendente") as StatusAtividade
        ],
      hd,
      hu: a.horasUtilizadas,
      descricao: a.descricao ?? "",
      impacto: a.impactoGerado ?? "",
      evidenciaUrl: (a as any).evidenciaUrl ?? "",
    };
  });
}

export async function exportAtuacoesToExcel(params: {
  atuacoes: Atuacao[];
  projetoTitleById: Map<string, string>;
  atividadeTitleById: Map<string, string>;
  hdByAtuacaoId?: Map<string, number>;
  filename?: string;
  selectedColumns?: AtuacaoColumn[];
  formatoData?: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
  fusoHorario?: string;
}) {
  const XLSX = await import("xlsx");
  const rows = toRows(params);

  // Se selectedColumns não for fornecido, inclui todas as colunas (exceto HD que é interno)
  const columnsRaw = params.selectedColumns || [
    "numero",
    "data",
    "horarioInicio",
    "projeto",
    "atividade",
    "tipo",
    "status",
    "hu",
    "descricao",
    "impacto",
  ];
  const columns = reorderColumns(columnsRaw);

  const headers = columns.map((col) => COLUMN_LABELS[col]);
  const data = rows.map((row) =>
    columns.map((col) => {
      if (col === "numero") {
        return row.numero;
      }
      if (col === "hd" || col === "hu") {
        return row[col];
      }
      // Para outras colunas, usar type assertion seguro
      const value = row[col as keyof AtuacaoExportRow];
      return String(value || "");
    })
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Atuacoes");

  XLSX.writeFile(workbook, params.filename ?? "atuacoes.xlsx", {
    compression: true,
  });
}

const COLUMN_WIDTHS: Record<AtuacaoColumn, number> = {
  numero: 30,
  data: 70,
  horarioInicio: 55,
  projeto: 140,
  atividade: 200,
  tipo: 90,
  status: 90,
  hd: 55,
  hu: 55,
  descricao: 220,
  impacto: 220,
};

export async function exportAtuacoesToPdf(params: {
  atuacoes: Atuacao[];
  projetoTitleById: Map<string, string>;
  atividadeTitleById: Map<string, string>;
  hdByAtuacaoId?: Map<string, number>;
  filename?: string;
  titulo?: string;
  selectedColumns?: AtuacaoColumn[];
  includeSummary?: boolean;
  includeDetails?: boolean;
  formatoData?: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
  fusoHorario?: string;
}) {
  const jsPDFModule = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { jsPDF } = jsPDFModule;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const rows = toRows(params);

  // Colunas para resumo (sempre inclui número, sem HD, sem descricao/impacto no resumo)
  const summaryColumnsRaw: AtuacaoColumn[] = [
    "numero", // Sempre incluir número no resumo
    ...(params.selectedColumns?.filter(
      (col) => col !== "hd" && col !== "descricao" && col !== "impacto"
    ) || [
      "data",
      "horarioInicio",
      "projeto",
      "atividade",
      "tipo",
      "status",
      "hu",
    ]),
  ];
  const summaryColumns = reorderColumns(summaryColumnsRaw);

  // Colunas para detalhamento (sem HD, com mais detalhes)
  const detailColumnsRaw: AtuacaoColumn[] = params.selectedColumns?.filter(
    (col) => col !== "hd"
  ) || [
    "data",
    "horarioInicio",
    "projeto",
    "atividade",
    "tipo",
    "status",
    "hu",
    "descricao",
    "impacto",
  ];
  const detailColumns = reorderColumns(detailColumnsRaw);

  let currentY = 40;

  // Seção: Resumo de atuações
  if (params.includeSummary !== false) {
    doc.setFontSize(14);
    doc.text("Resumo de atuações", 40, currentY);
    currentY += 20;

    const summaryHeaders = summaryColumns.map((col) => COLUMN_LABELS[col]);
    const summaryBody = rows.map((r) =>
      summaryColumns.map((col) => {
        if (col === "numero") {
          return String(r.numero);
        }
        if (col === "hu") {
          return String(r.hu);
        }
        return String(r[col] || "");
      })
    );

    const totalWidth = summaryColumns.reduce(
      (sum, col) => sum + COLUMN_WIDTHS[col],
      0
    );
    const scale = (doc.internal.pageSize.getWidth() - 80) / totalWidth;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: autotable é adicionado ao protótipo do jsPDF pelo plugin
    autoTable(doc, {
      startY: currentY,
      head: [summaryHeaders],
      body: summaryBody,
      styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fontSize: 10 },
      columnStyles: summaryColumns.reduce(
        (acc, col, idx) => {
          acc[idx.toString()] = {
            cellWidth: COLUMN_WIDTHS[col] * scale,
            halign: (col === "hu" || col === "numero" ? "center" : "left") as
              | "left"
              | "center"
              | "right"
              | "justify",
          };
          return acc;
        },
        {} as Record<
          string,
          { cellWidth: number; halign: "left" | "center" | "right" | "justify" }
        >
      ),
    });

    currentY = ((doc as any).lastAutoTable?.finalY || currentY + 100) + 10;

    // Legenda para HU se estiver selecionado
    if (summaryColumns.includes("hu")) {
      currentY += 10;
      doc.setFontSize(8);
      doc.text(
        "Legenda: HU = Horas Utilizadas registradas nesta atuação.",
        40,
        currentY
      );
      currentY += 15;
    }
  }

  // Seção: Detalhamento de Atuações
  if (params.includeDetails !== false && rows.length > 0) {
    // Nova página se necessário
    if (currentY > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      currentY = 40;
    }

    // Adicionar 2 linhas de quebra antes do título
    currentY += 20;

    doc.setFontSize(14);
    doc.text("Detalhamento de Atuações", 40, currentY);
    currentY += 20;

    // Formatar detalhamento como texto formalizado
    const marginX = 40;
    const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
    doc.setFontSize(10);

    params.atuacoes.forEach((atuacao, index) => {
      // Verificar se precisa de nova página
      if (currentY > doc.internal.pageSize.getHeight() - 150) {
        doc.addPage();
        currentY = 40;
      }

      const projetoNome =
        params.projetoTitleById.get(atuacao.projetoId) ||
        "Projeto não encontrado";
      const isAtividadeAvulsa = atuacao.atividadeId.startsWith("__ATIVIDADE_AVULSA__");
      const tituloAvulsa = atuacao.tituloAvulsa || "(Atividade avulsa)";
      const atividadeNome = isAtividadeAvulsa
        ? `[ ! ] - ${tituloAvulsa}`
        : (params.atividadeTitleById.get(atuacao.atividadeId) || "Atividade não encontrada");
      const dataFormatada = formatDateBR(atuacao.data, {
        formatoData: params.formatoData,
        fusoHorario: params.fusoHorario,
      });
      const horarioInicio = (atuacao as any).horarioInicio || "";
      const tipoTexto = tipoLabel[atuacao.tipo];
      const statusTexto =
        statusLabel[
          (atuacao.statusAtividadeNoRegistro ?? "pendente") as StatusAtividade
        ];
      const descricao = atuacao.descricao || "";
      const impacto = atuacao.impactoGerado || "";
      const evidenciaUrl = (atuacao as any).evidenciaUrl || "";

      // Título da atuação
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${index + 1}. ${atividadeNome}`, marginX, currentY);
      currentY += 12;

      // Informações básicas
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const infoLines = [
        `Data: ${dataFormatada}${horarioInicio ? ` às ${horarioInicio}` : ""}`,
        `Projeto: ${projetoNome}`,
        `Tipo de atuação: ${tipoTexto}`,
        `Status da atividade: ${statusTexto}`,
        `Horas utilizadas: ${atuacao.horasUtilizadas}h`,
      ];

      infoLines.forEach((line) => {
        if (currentY > doc.internal.pageSize.getHeight() - 50) {
          doc.addPage();
          currentY = 40;
        }
        doc.text(line, marginX, currentY);
        currentY += 12;
      });

      // Descrição
      if (descricao) {
        currentY += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Descrição:", marginX, currentY);
        currentY += 12;
        doc.setFont("helvetica", "normal");
        const descLines = doc.splitTextToSize(descricao, maxWidth);
        descLines.forEach((line: string) => {
          if (currentY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            currentY = 40;
          }
          doc.text(line, marginX, currentY);
          currentY += 12;
        });
      }

      // Impacto gerado
      if (impacto) {
        currentY += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Impacto gerado:", marginX, currentY);
        currentY += 12;
        doc.setFont("helvetica", "normal");
        const impactoLines = doc.splitTextToSize(impacto, maxWidth);
        impactoLines.forEach((line: string) => {
          if (currentY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            currentY = 40;
          }
          doc.text(line, marginX, currentY);
          currentY += 12;
        });
      }

      // Evidência (URL)
      if (evidenciaUrl) {
        currentY += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Evidência:", marginX, currentY);
        currentY += 12;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 255);
        const urlLines = doc.splitTextToSize(evidenciaUrl, maxWidth);
        urlLines.forEach((line: string, lineIndex: number) => {
          if (currentY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            currentY = 40;
          }
          const textWidth = doc.getTextWidth(line);
          doc.text(line, marginX, currentY);
          // Adicionar link clicável sobre o texto
          doc.link(marginX, currentY - 10, textWidth, 12, {
            url: evidenciaUrl,
          });
          currentY += 12;
        });
        doc.setTextColor(0, 0, 0);
      }

      // Espaçamento entre atuações
      currentY += 20;
    });
  }

  doc.save(params.filename ?? "atuacoes.pdf");
}
