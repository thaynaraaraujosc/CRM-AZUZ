import jsPDF from "jspdf";

/**
 * Gerador de PDF real (vetorial, via jsPDF) — substitui o antigo botão
 * "Gerar PDF" que só abria `window.print()` do navegador (documento vazio,
 * cabeçalho/rodapé do navegador, sem controle de conteúdo). Aqui o
 * documento é construído programaticamente: só o relatório, nada de
 * interface, sem URL nem data automática do navegador.
 */

export type LinhaRelatorio = { label: string; value: string };
export type BarraRelatorio = { label: string; meta: string; percentual: number };

export type SecaoRelatorio = {
  titulo: string;
  linhas?: LinhaRelatorio[];
  barras?: BarraRelatorio[];
  tabela?: { colunas: string[]; linhas: string[][] };
  observacao?: string;
};

export type ConfigRelatorioPdf = {
  nomeArquivo: string;
  titulo: string;
  subtitulo: string;
  empresa: { nome: string; segmento?: string };
  periodoLabel: string;
  secoes: SecaoRelatorio[];
  incluirCapa?: boolean;
  incluirLogotipo?: boolean;
  orientacao?: "p" | "l";
};

const MARGEM = 16;
const AZUL: [number, number, number] = [46, 107, 255];
const CINZA: [number, number, number] = [110, 118, 148];
const TINTA: [number, number, number] = [11, 21, 51];

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Gera o documento em memória — quem chama decide se salva (`doc.save()`) ou inspeciona antes. */
export function gerarPdfRelatorio(config: ConfigRelatorioPdf): jsPDF {
  const doc = new jsPDF({ orientation: config.orientacao ?? "p", unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  let y = MARGEM;

  function novaPaginaSeNecessario(alturaNecessaria: number) {
    if (y + alturaNecessaria > altura - MARGEM) {
      doc.addPage();
      y = MARGEM;
    }
  }

  function cabecalho() {
    const comLogo = config.incluirLogotipo !== false;
    if (comLogo) {
      doc.setFillColor(...AZUL);
      doc.roundedRect(MARGEM, y, 12, 12, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(iniciais(config.empresa.nome), MARGEM + 6, y + 8, { align: "center" });
    }

    const xNome = comLogo ? MARGEM + 16 : MARGEM;
    doc.setTextColor(...TINTA);
    doc.setFontSize(11);
    doc.text(config.empresa.nome, xNome, y + 5);
    if (config.empresa.segmento) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...CINZA);
      doc.text(config.empresa.segmento, xNome, y + 10);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...CINZA);
    doc.text(config.periodoLabel, largura - MARGEM, y + 5, { align: "right" });

    y += 16;
    doc.setDrawColor(...TINTA);
    doc.setLineWidth(0.4);
    doc.line(MARGEM, y, largura - MARGEM, y);
    y += 8;
  }

  function capa() {
    doc.setFillColor(...AZUL);
    doc.roundedRect(largura / 2 - 12, altura / 2 - 40, 24, 24, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(iniciais(config.empresa.nome), largura / 2, altura / 2 - 26, { align: "center" });

    doc.setTextColor(...TINTA);
    doc.setFontSize(22);
    doc.text(config.titulo, largura / 2, altura / 2, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...CINZA);
    doc.text(config.subtitulo, largura / 2, altura / 2 + 10, { align: "center" });
    doc.text(config.periodoLabel, largura / 2, altura / 2 + 18, { align: "center" });

    doc.setFontSize(9);
    doc.text(config.empresa.nome, largura / 2, altura - MARGEM, { align: "center" });

    doc.addPage();
    y = MARGEM;
  }

  function tituloSecao(titulo: string) {
    novaPaginaSeNecessario(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...TINTA);
    doc.text(titulo, MARGEM, y);
    y += 3;
    doc.setDrawColor(...AZUL);
    doc.setLineWidth(0.6);
    doc.line(MARGEM, y, MARGEM + 26, y);
    y += 7;
  }

  function linhasKV(linhas: LinhaRelatorio[]) {
    doc.setFontSize(10);
    for (const l of linhas) {
      novaPaginaSeNecessario(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...CINZA);
      doc.text(l.label, MARGEM, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TINTA);
      doc.text(l.value, largura - MARGEM, y, { align: "right" });
      y += 6.5;
      doc.setDrawColor(230, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(MARGEM, y - 2.2, largura - MARGEM, y - 2.2);
    }
    y += 3;
  }

  function barras(itens: BarraRelatorio[]) {
    const larguraBarra = largura - MARGEM * 2;
    for (const b of itens) {
      novaPaginaSeNecessario(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...TINTA);
      doc.text(b.label, MARGEM, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...CINZA);
      doc.text(b.meta, MARGEM, y + 4.5);
      y += 7;
      doc.setFillColor(230, 232, 240);
      doc.roundedRect(MARGEM, y, larguraBarra, 3.2, 1.6, 1.6, "F");
      doc.setFillColor(...AZUL);
      const w = Math.max(2, (Math.min(100, b.percentual) / 100) * larguraBarra);
      doc.roundedRect(MARGEM, y, w, 3.2, 1.6, 1.6, "F");
      y += 9;
    }
    y += 2;
  }

  function tabela(t: { colunas: string[]; linhas: string[][] }) {
    const colWidth = (largura - MARGEM * 2) / t.colunas.length;
    novaPaginaSeNecessario(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...CINZA);
    t.colunas.forEach((c, i) => doc.text(c, MARGEM + i * colWidth, y));
    y += 5;
    doc.setDrawColor(...TINTA);
    doc.line(MARGEM, y - 3, largura - MARGEM, y - 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TINTA);
    for (const linha of t.linhas) {
      novaPaginaSeNecessario(7);
      linha.forEach((v, i) => doc.text(String(v), MARGEM + i * colWidth, y));
      y += 6;
    }
    y += 3;
  }

  if (config.incluirCapa) capa();
  cabecalho();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...TINTA);
  doc.text(config.titulo, MARGEM, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...CINZA);
  doc.text(config.subtitulo, MARGEM, y);
  y += 10;

  for (const secao of config.secoes) {
    tituloSecao(secao.titulo);
    if (secao.linhas?.length) linhasKV(secao.linhas);
    if (secao.barras?.length) barras(secao.barras);
    if (secao.tabela) tabela(secao.tabela);
    if (secao.observacao) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...CINZA);
      const linhasTexto = doc.splitTextToSize(secao.observacao, largura - MARGEM * 2);
      novaPaginaSeNecessario(linhasTexto.length * 5 + 4);
      doc.text(linhasTexto, MARGEM, y);
      y += linhasTexto.length * 5 + 4;
    }
  }

  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text(`${config.empresa.nome} · página ${p} de ${totalPaginas}`, largura / 2, altura - 8, {
      align: "center",
    });
  }

  return doc;
}
