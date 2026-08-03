import jsPDF from "jspdf";
import { formatarDataComRelativo, formatarDataPorExtenso, HOJE } from "@/lib/datas";

/**
 * Gerador de PDF real (vetorial, via jsPDF) — documento com proporção A4 de
 * verdade: mede a altura de cada seção antes de desenhar (pra nunca deixar
 * um título sozinho no fim da página), calcula largura de coluna de tabela
 * a partir do conteúdo (com quebra de texto, sem vazar da margem) e repete
 * o cabeçalho da tabela quando ela continua na página seguinte. Nenhum
 * elemento sai da área imprimível.
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

export type ModoCapa = "nenhuma" | "compacta" | "completa" | "personalizada";

export type ConfigRelatorioPdf = {
  nomeArquivo: string;
  titulo: string;
  subtitulo: string;
  empresa: { nome: string; segmento?: string };
  periodoLabel: string;
  secoes: SecaoRelatorio[];
  capa?: ModoCapa;
  /** Só usada quando `capa === "personalizada"`. */
  corCapa?: [number, number, number];
  incluirLogotipo?: boolean;
  incluirCabecalho?: boolean;
  incluirRodape?: boolean;
  orientacao?: "p" | "l";
  tamanhoPapel?: "a4" | "letter";
};

const MARGEM = 16;
const AZUL: [number, number, number] = [46, 107, 255];
const CINZA: [number, number, number] = [110, 118, 148];
const TINTA: [number, number, number] = [11, 21, 51];
const LINHA_CLARA: [number, number, number] = [230, 232, 240];
const LARGURA_MIN_COLUNA = 22;

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Data absoluta padronizada — nunca o texto relativo cru dentro de um documento arquivado. */
export function dataParaDocumento(raw: string): string {
  return formatarDataComRelativo(raw);
}

/** Gera o documento em memória — quem chama decide se salva (`doc.save()`) ou inspeciona antes. */
export function gerarPdfRelatorio(config: ConfigRelatorioPdf): jsPDF {
  const modoCapa = config.capa ?? "nenhuma";
  const comLogo = config.incluirLogotipo !== false;
  const comCabecalho = config.incluirCabecalho !== false;
  const comRodape = config.incluirRodape !== false;
  const corCapa = config.corCapa ?? AZUL;

  const doc = new jsPDF({
    orientation: config.orientacao ?? "p",
    unit: "mm",
    format: config.tamanhoPapel ?? "a4",
  });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const areaUtil = largura - MARGEM * 2;
  let y = MARGEM;

  function espacoRestante(): number {
    return altura - MARGEM - y;
  }

  function novaPagina() {
    doc.addPage();
    y = MARGEM;
    if (comCabecalho) cabecalho();
  }

  function novaPaginaSeNecessario(alturaNecessaria: number) {
    if (alturaNecessaria > espacoRestante()) novaPagina();
  }

  function cabecalho() {
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

  function capaCompacta() {
    doc.setFillColor(...corCapa);
    doc.roundedRect(MARGEM, y, areaUtil, 30, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(config.titulo, MARGEM + 10, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${config.subtitulo} · ${config.periodoLabel}`, MARGEM + 10, y + 23);
    y += 38;
  }

  function capaCompleta() {
    doc.setFillColor(...corCapa);
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
    doc.text(`${config.empresa.nome} · gerado em ${formatarDataPorExtenso(HOJE)}`, largura / 2, altura - MARGEM, {
      align: "center",
    });

    doc.addPage();
    y = MARGEM;
  }

  function tituloSecao(titulo: string) {
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

  function alturaLinhasKV(n: number): number {
    return n * 6.5 + 3;
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
      doc.setDrawColor(...LINHA_CLARA);
      doc.setLineWidth(0.2);
      doc.line(MARGEM, y - 2.2, largura - MARGEM, y - 2.2);
    }
    y += 3;
  }

  function alturaBarras(n: number): number {
    return n * 9 + 2;
  }

  function barras(itens: BarraRelatorio[]) {
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
      doc.setFillColor(...LINHA_CLARA);
      doc.roundedRect(MARGEM, y, areaUtil, 3.2, 1.6, 1.6, "F");
      doc.setFillColor(...AZUL);
      const w = Math.max(2, (Math.min(100, b.percentual) / 100) * areaUtil);
      doc.roundedRect(MARGEM, y, w, 3.2, 1.6, 1.6, "F");
      y += 9;
    }
    y += 2;
  }

  /** Larguras de coluna proporcionais ao conteúdo, com piso mínimo pra nunca espremer demais. */
  function calcularLargurasColuna(t: { colunas: string[]; linhas: string[][] }): number[] {
    const pesos = t.colunas.map((c, i) => {
      const maiorCelula = Math.max(c.length, ...t.linhas.map((l) => (l[i] ?? "").length));
      return Math.min(maiorCelula, 40); // não deixa uma coluna gigante engolir todas as outras
    });
    const somaPesos = pesos.reduce((s, p) => s + p, 0) || 1;
    const larguras = pesos.map((p) => Math.max(LARGURA_MIN_COLUNA, (p / somaPesos) * areaUtil));
    const somaLarguras = larguras.reduce((s, w) => s + w, 0);
    // se os pisos mínimos estouraram a largura disponível, reduz proporcionalmente
    if (somaLarguras > areaUtil) {
      const fator = areaUtil / somaLarguras;
      return larguras.map((w) => w * fator);
    }
    return larguras;
  }

  function desenharCabecalhoTabela(colunas: string[], larguras: number[]) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...CINZA);
    let x = MARGEM;
    colunas.forEach((c, i) => {
      doc.text(c, x, y);
      x += larguras[i];
    });
    y += 5;
    doc.setDrawColor(...TINTA);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, y - 3, largura - MARGEM, y - 3);
  }

  function tabela(t: { colunas: string[]; linhas: string[][] }) {
    const larguras = calcularLargurasColuna(t);
    novaPaginaSeNecessario(14);
    desenharCabecalhoTabela(t.colunas, larguras);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TINTA);

    for (const linha of t.linhas) {
      const celulasQuebradas = linha.map((v, i) => doc.splitTextToSize(String(v ?? ""), larguras[i] - 2));
      const maiorNumeroLinhas = Math.max(1, ...celulasQuebradas.map((c) => c.length));
      const alturaLinha = maiorNumeroLinhas * 4.2 + 2.5;

      // nunca corta uma linha entre duas páginas — quebra antes se não couber inteira
      if (alturaLinha > espacoRestante()) {
        novaPagina();
        desenharCabecalhoTabela(t.colunas, larguras);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TINTA);
      }

      let x = MARGEM;
      celulasQuebradas.forEach((textoQuebrado, i) => {
        doc.text(textoQuebrado, x, y);
        x += larguras[i];
      });
      y += alturaLinha;
      doc.setDrawColor(...LINHA_CLARA);
      doc.setLineWidth(0.15);
      doc.line(MARGEM, y - 1.5, largura - MARGEM, y - 1.5);
    }
    y += 3;
  }

  function alturaObservacao(texto: string): number {
    const linhasTexto = doc.splitTextToSize(texto, areaUtil);
    return linhasTexto.length * 5 + 4;
  }

  function observacao(texto: string) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...CINZA);
    const linhasTexto = doc.splitTextToSize(texto, areaUtil);
    doc.text(linhasTexto, MARGEM, y);
    y += linhasTexto.length * 5 + 4;
  }

  // ---- montagem do documento ----

  if (modoCapa === "completa" || modoCapa === "personalizada") capaCompleta();
  if (comCabecalho) cabecalho();
  if (modoCapa === "compacta") capaCompacta();

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
    // Estima a altura mínima (título + um primeiro pedaço de conteúdo) pra
    // decidir se quebra a página ANTES de desenhar o título — nunca deixa
    // um título sozinho no fim da página, sem nada abaixo dele.
    let alturaMinima = 10;
    if (secao.linhas?.length) alturaMinima += Math.min(alturaLinhasKV(secao.linhas.length), 20);
    if (secao.barras?.length) alturaMinima += Math.min(alturaBarras(secao.barras.length), 20);
    if (secao.tabela) alturaMinima += 14;
    if (secao.observacao) alturaMinima += Math.min(alturaObservacao(secao.observacao), 20);
    novaPaginaSeNecessario(alturaMinima);

    tituloSecao(secao.titulo);
    if (secao.linhas?.length) linhasKV(secao.linhas);
    if (secao.barras?.length) barras(secao.barras);
    if (secao.tabela) tabela(secao.tabela);
    if (secao.observacao) {
      novaPaginaSeNecessario(alturaObservacao(secao.observacao));
      observacao(secao.observacao);
    }
  }

  if (comRodape) {
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
  }

  return doc;
}

/** Estimativa de quantidade de páginas — usada na etapa "Conteúdo" do assistente, antes de gerar a prévia de verdade. */
export function estimarPaginas(config: ConfigRelatorioPdf): number {
  const alturaPagina = 297 - MARGEM * 2;
  let total = 20; // cabeçalho + título
  if ((config.capa ?? "nenhuma") !== "nenhuma") total += (config.capa === "completa" || config.capa === "personalizada") ? alturaPagina : 30;
  for (const secao of config.secoes) {
    total += 10;
    if (secao.linhas) total += secao.linhas.length * 6.5;
    if (secao.barras) total += secao.barras.length * 9;
    if (secao.tabela) total += 5 + secao.tabela.linhas.length * 6.5;
    if (secao.observacao) total += Math.ceil(secao.observacao.length / 90) * 5 + 4;
  }
  return Math.max(1, Math.ceil(total / alturaPagina));
}

export type AvisoValidacao = {
  nivel: "erro" | "aviso";
  mensagem: string;
  secao?: string;
};

/**
 * Validação estrutural do relatório antes de liberar a exportação (seção 20
 * do escopo). Não é análise pixel-a-pixel — verifica o que dá pra saber
 * antes de desenhar: seção vazia, tabela larga demais pra orientação
 * escolhida, nada selecionado. Erros bloqueiam "Aprovar relatório";
 * avisos não bloqueiam, só alertam.
 */
export function validarConteudoRelatorio(
  secoes: SecaoRelatorio[],
  orientacao: "p" | "l",
): AvisoValidacao[] {
  const avisos: AvisoValidacao[] = [];

  if (secoes.length === 0) {
    avisos.push({ nivel: "erro", mensagem: "Nenhuma seção selecionada — volte em \"Conteúdo\" e marque ao menos uma." });
    return avisos;
  }

  for (const secao of secoes) {
    const vazia =
      !secao.linhas?.length && !secao.barras?.length && !secao.tabela?.linhas.length && !secao.observacao;
    if (vazia) {
      avisos.push({ nivel: "aviso", mensagem: `A seção "${secao.titulo}" está vazia no período selecionado.`, secao: secao.titulo });
    }
    if (secao.tabela && secao.tabela.colunas.length > 5 && orientacao === "p") {
      avisos.push({
        nivel: "aviso",
        mensagem: `A tabela de "${secao.titulo}" tem ${secao.tabela.colunas.length} colunas — considere orientação paisagem pra não espremer o texto.`,
        secao: secao.titulo,
      });
    }
    if (secao.tabela && secao.tabela.linhas.some((l) => l.some((v) => !v || v === "undefined"))) {
      avisos.push({ nivel: "aviso", mensagem: `A tabela de "${secao.titulo}" tem células vazias.`, secao: secao.titulo });
    }
  }

  return avisos;
}
