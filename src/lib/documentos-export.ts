import JSZip from "jszip";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import type { PaginaDoc } from "./documentos-context";

function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** Extrai texto puro de um HTML — usa o próprio DOM do navegador, sem parser externo. */
function htmlParaTexto(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

export function baixarTxt(titulo: string, paginas: PaginaDoc[]) {
  const texto = paginas.map((p) => htmlParaTexto(p.conteudoHtml)).join("\n\n");
  baixarBlob(new Blob([texto], { type: "text/plain;charset=utf-8" }), `${titulo}.txt`);
}

export function baixarHtml(titulo: string, paginas: PaginaDoc[]) {
  const corpo = paginas
    .map((p) => `<div style="page-break-after: always;">${p.conteudoHtml}</div>`)
    .join("\n");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title></head><body>${corpo}</body></html>`;
  baixarBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${titulo}.html`);
}

/** RTF simples — preserva parágrafos, sem parser externo (formato bem estabelecido, gerado à mão). */
export function baixarRtf(titulo: string, paginas: PaginaDoc[]) {
  const paragrafos = paginas
    .map((p) => htmlParaTexto(p.conteudoHtml))
    .join("\n")
    .split("\n")
    .map((linha) => linha.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}"))
    .map((linha) => `\\par ${linha}`)
    .join("\n");
  const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs24 ${paragrafos}}`;
  baixarBlob(new Blob([rtf], { type: "application/rtf" }), `${titulo}.rtf`);
}

type FormatacaoTexto = { negrito: boolean; italico: boolean; sublinhado: boolean; tachado: boolean; corHex: string | null };

type RunDocx =
  | { tipo: "texto"; texto: string; fmt: FormatacaoTexto }
  | { tipo: "quebra" }
  | { tipo: "imagem"; src: string; idNumero: number; larguraPx: number; alturaPx: number };

const MIME_PARA_EXTENSAO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/webp": "png", // Word não abre webp de forma confiável; tratamos como png (o navegador ainda decodifica certo na hora de exibir, mas o arquivo final é salvo com a extensão png para compatibilidade)
};

/** Converte "#rrggbb" ou "rgb(r,g,b)" pro formato hex sem # que a OOXML espera (w:color w:val="RRGGBB"). */
function corParaHexOoxml(cor: string): string | null {
  const hex = cor.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) return hex[1].toUpperCase();
  const rgb = cor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return null;
}

/**
 * Gera um .docx (OOXML) de verdade — parágrafo a parágrafo, percorrendo cada nó em vez de olhar só o
 * bloco inteiro. Preserva negrito/itálico/sublinhado/tachado/cor por trecho de texto (não o bloco todo
 * de uma vez, então "só metade em negrito" sai correto), e embute imagens de verdade (não vira texto
 * nem link — a imagem vai dentro do word/media/ com o relacionamento OOXML correto).
 */
export async function baixarDocx(titulo: string, paginas: PaginaDoc[]) {
  const zip = new JSZip();

  const imagensEmbutidas: { nomeArquivo: string; base64: string }[] = [];
  const relacionamentosImagem: { rId: string; nomeArquivo: string }[] = [];
  const extensoesUsadas = new Set<string>();
  let proximoIdImagem = 1;

  function escaparXml(texto: string) {
    return texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function registrarImagem(dataUrl: string): { rId: string; idNumero: number } | null {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const idNumero = proximoIdImagem;
    proximoIdImagem += 1;
    const extensao = MIME_PARA_EXTENSAO[match[1]] ?? "png";
    const nomeArquivo = `image${idNumero}.${extensao}`;
    const rId = `rIdImg${idNumero}`;
    extensoesUsadas.add(extensao);
    imagensEmbutidas.push({ nomeArquivo, base64: match[2] });
    relacionamentosImagem.push({ rId, nomeArquivo });
    return { rId, idNumero };
  }

  /** Elementos que representam um parágrafo/linha de verdade — tudo que não é isso é formatação inline. */
  const TAGS_DE_BLOCO = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE"]);

  function noParaRuns(no: Node, heranca: FormatacaoTexto): RunDocx[] {
    if (no.nodeType === Node.TEXT_NODE) {
      const texto = no.textContent ?? "";
      return texto ? [{ tipo: "texto", texto, fmt: heranca }] : [];
    }
    if (no.nodeType !== Node.ELEMENT_NODE) return [];
    const el = no as HTMLElement;
    if (el.tagName === "IMG") {
      const registro = registrarImagem(el.getAttribute("src") ?? "");
      if (!registro) return [];
      const larguraPx = parseFloat(el.style.width) || Number(el.getAttribute("width")) || 300;
      const alturaPx = parseFloat(el.style.height) || Number(el.getAttribute("height")) || 300;
      return [{ tipo: "imagem", src: registro.rId, idNumero: registro.idNumero, larguraPx, alturaPx }];
    }
    if (el.tagName === "BR") return [{ tipo: "quebra" }];
    const corInline = el.style.color ? corParaHexOoxml(el.style.color) : null;
    const novaHeranca: FormatacaoTexto = {
      negrito: heranca.negrito || el.tagName === "B" || el.tagName === "STRONG",
      italico: heranca.italico || el.tagName === "I" || el.tagName === "EM",
      sublinhado: heranca.sublinhado || el.tagName === "U",
      tachado: heranca.tachado || el.tagName === "S" || el.tagName === "STRIKE",
      corHex: corInline ?? heranca.corHex,
    };
    // Elemento de bloco (ex.: <table>/<tr>/<td> não mapeados aqui) some como parágrafo próprio na hora
    // de percorrer os filhos diretos da página — aqui, dentro de um bloco pai já aberto, tudo vira runs
    // do MESMO parágrafo (é assim que uma tabela citada dentro de um parágrafo sai como texto corrido).
    return Array.from(el.childNodes).flatMap((filho) => noParaRuns(filho, novaHeranca));
  }

  function coletarRuns(container: Node, heranca: FormatacaoTexto): RunDocx[] {
    return Array.from(container.childNodes).flatMap((no) => noParaRuns(no, heranca));
  }

  function runParaXml(run: RunDocx): string {
    if (run.tipo === "quebra") return "<w:r><w:br/></w:r>";
    if (run.tipo === "imagem") {
      const cx = Math.round(run.larguraPx * 9525);
      const cy = Math.round(run.alturaPx * 9525);
      const id = run.idNumero;
      return `<w:r><w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="${id}" name="Picture ${id}"/>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr><pic:cNvPr id="${id}" name="Picture ${id}"/><pic:cNvPicPr/></pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${run.src}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing></w:r>`;
    }
    const { negrito, italico, sublinhado, tachado, corHex } = run.fmt;
    const propsPartes = [
      negrito ? "<w:b/>" : "",
      italico ? "<w:i/>" : "",
      sublinhado ? '<w:u w:val="single"/>' : "",
      tachado ? "<w:strike/>" : "",
      corHex ? `<w:color w:val="${corHex}"/>` : "",
    ].join("");
    const props = propsPartes ? `<w:rPr>${propsPartes}</w:rPr>` : "";
    return `<w:r>${props}<w:t xml:space="preserve">${escaparXml(run.texto)}</w:t></w:r>`;
  }

  /**
   * Percorre os filhos DIRETOS da página. Um elemento de bloco (parágrafo/título/item de lista/citação)
   * vira seu próprio <w:p>. Qualquer outra coisa no nível superior — texto solto, ou formatação inline
   * (negrito/itálico/imagem) sem um parágrafo container — é acumulada no MESMO parágrafo corrente até o
   * próximo bloco aparecer. Isso corrige o caso comum do editor: digitar texto simples, alternar negrito/
   * itálico e inserir uma imagem sem nunca apertar Enter gera um monte de nós irmãos soltos (texto, <b>,
   * <i>, <img>) direto na página, sem nenhum <div>/<p> ao redor — juntar tudo é o comportamento certo.
   */
  function paginaParaParagrafosXml(html: string): string {
    const raiz = document.createElement("div");
    raiz.innerHTML = html;
    const formatacaoVazia: FormatacaoTexto = { negrito: false, italico: false, sublinhado: false, tachado: false, corHex: null };
    const paragrafosXml: string[] = [];
    let runsAtual: RunDocx[] = [];

    function flush() {
      if (runsAtual.length > 0) {
        paragrafosXml.push(`<w:p>${runsAtual.map(runParaXml).join("")}</w:p>`);
        runsAtual = [];
      }
    }

    Array.from(raiz.childNodes).forEach((no) => {
      if (no.nodeType === Node.ELEMENT_NODE && TAGS_DE_BLOCO.has((no as HTMLElement).tagName)) {
        flush();
        const runsDoBloco = coletarRuns(no, formatacaoVazia);
        paragrafosXml.push(runsDoBloco.length > 0 ? `<w:p>${runsDoBloco.map(runParaXml).join("")}</w:p>` : "<w:p/>");
        return;
      }
      runsAtual.push(...noParaRuns(no, formatacaoVazia));
    });
    flush();

    return paragrafosXml.length > 0 ? paragrafosXml.join("") : "<w:p/>";
  }

  const corpo = paginas
    .map((p, i) => {
      const paragrafos = paginaParaParagrafosXml(p.conteudoHtml);
      const quebraPagina = i < paginas.length - 1 ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : "";
      return paragrafos + quebraPagina;
    })
    .join("");

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${[...extensoesUsadas].map((ext) => `<Default Extension="${ext}" ContentType="image/${ext === "jpeg" ? "jpeg" : ext}"/>`).join("\n  ")}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.folder("word")?.folder("_rels")?.file(
    "document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relacionamentosImagem
    .map((r) => `<Relationship Id="${r.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${r.nomeArquivo}"/>`)
    .join("\n  ")}
</Relationships>`,
  );

  const pastaMedia = zip.folder("word")?.folder("media");
  for (const img of imagensEmbutidas) {
    pastaMedia?.file(img.nomeArquivo, img.base64, { base64: true });
  }

  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${corpo || "<w:p/>"}
    <w:sectPr/>
  </w:body>
</w:document>`,
  );

  const conteudo = await zip.generateAsync({ type: "blob" });
  baixarBlob(
    conteudo,
    `${titulo}.docx`,
  );
}

export function imprimirOuSalvarPdf() {
  window.print();
}

/**
 * Interpreta uma seleção de páginas no formato "1,3,5", "2-7" ou combinado "1-3,6,9-12".
 * Retorna índices 0-based, ordenados e sem repetição, ou `null` se a string for inválida
 * (vazia, fora do intervalo 1..total, ou com sintaxe que não bate com número/intervalo).
 */
export function analisarSelecaoPaginas(texto: string, total: number): number[] | null {
  const limpo = texto.trim();
  if (!limpo) return null;
  const indices = new Set<number>();
  for (const parteBruta of limpo.split(",")) {
    const parte = parteBruta.trim();
    if (!parte) continue;
    const intervalo = parte.match(/^(\d+)\s*-\s*(\d+)$/);
    if (intervalo) {
      const de = Number(intervalo[1]);
      const ate = Number(intervalo[2]);
      if (de < 1 || ate < 1 || de > total || ate > total || de > ate) return null;
      for (let n = de; n <= ate; n++) indices.add(n - 1);
      continue;
    }
    if (/^\d+$/.test(parte)) {
      const n = Number(parte);
      if (n < 1 || n > total) return null;
      indices.add(n - 1);
      continue;
    }
    return null;
  }
  if (indices.size === 0) return null;
  return [...indices].sort((a, b) => a - b);
}

/**
 * Gera um PDF de verdade a partir dos elementos das páginas já renderizadas na tela — sem passar
 * pela janela de impressão do navegador. Cada página é rasterizada (html2canvas) e embutida como
 * imagem num PDF real (jsPDF), respeitando tamanho, orientação e margens exatamente como aparecem
 * no editor. Faz o download diretamente, sem abrir aba nova.
 *
 * Limitação honesta: como cada página vira uma imagem, o texto do PDF resultante não fica
 * selecionável/pesquisável (é um retrato fiel do documento, não um PDF com texto vetorial).
 */
export async function baixarPdfReal(
  titulo: string,
  elementos: HTMLElement[],
  larguraMm: number,
  alturaMm: number,
) {
  if (elementos.length === 0) return;
  const orientacao = larguraMm > alturaMm ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation: orientacao, unit: "mm", format: [larguraMm, alturaMm] });
  for (let i = 0; i < elementos.length; i++) {
    const canvas = await html2canvas(elementos[i], { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    if (i > 0) pdf.addPage([larguraMm, alturaMm], orientacao);
    pdf.addImage(dataUrl, "JPEG", 0, 0, larguraMm, alturaMm);
  }
  pdf.save(`${titulo}.pdf`);
}

/**
 * Abre uma janela própria e limpa, contendo só o conteúdo do documento (sem menu, barra de
 * ferramentas, régua ou botões da aplicação), e dispara a impressão dessa janela isolada.
 * Isso evita que a interface do app apareça na impressão. O cabeçalho/rodapé automático do
 * PRÓPRIO NAVEGADOR (data, URL, título) fica fora do alcance do JavaScript — é uma opção do
 * diálogo de impressão do navegador ("Cabeçalhos e rodapés") que só o usuário pode desligar ali.
 */
export function abrirPreviaImpressaoLimpa(
  titulo: string,
  paginasHtml: string[],
  opcoes: {
    larguraMm: number;
    alturaMm: number;
    margemSuperiorMm: number;
    margemInferiorMm: number;
    margemEsquerdaMm: number;
    margemDireitaMm: number;
    corFundo: string;
    qtdColunas?: number;
    colunasEspacoMm?: number;
    colunasLinha?: boolean;
  },
) {
  const janela = window.open("", "_blank", "width=900,height=1000");
  if (!janela) {
    window.alert("O navegador bloqueou a janela de pré-visualização — permita pop-ups pra esse site e tente de novo.");
    return;
  }
  const padding = `${opcoes.margemSuperiorMm}mm ${opcoes.margemDireitaMm}mm ${opcoes.margemInferiorMm}mm ${opcoes.margemEsquerdaMm}mm`;
  const paginasDiv = paginasHtml
    .map(
      (html) =>
        `<div class="folha" style="width:${opcoes.larguraMm}mm;min-height:${opcoes.alturaMm}mm;padding:${padding};background:${opcoes.corFundo};">${html}</div>`,
    )
    .join("");
  const qtdColunas = opcoes.qtdColunas ?? 1;
  // O corpo (texto do documento) fica dentro de .doc-corpo-impresso — as colunas só se aplicam a ele,
  // nunca ao cabeçalho/rodapé repetido (que continua em largura cheia, uma linha só, como no editor).
  const cssColunas =
    qtdColunas > 1
      ? `.doc-corpo-impresso { column-count: ${qtdColunas}; column-gap: ${opcoes.colunasEspacoMm ?? 10}mm; ${
          opcoes.colunasLinha ? "column-rule: 1px solid currentColor;" : ""
        } }`
      : "";
  janela.document.open();
  janela.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${titulo}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #e7e9f0; font-family: Arial, sans-serif; }
  .folha { margin: 12mm auto; box-shadow: 0 4px 20px rgba(0,0,0,.15); overflow-wrap: break-word; }
  .doc-cabecalho-repetido { font-size: 11px; color: #666; padding-bottom: 10px; margin-bottom: 14px; border-bottom: 1px solid #e2e2e2; }
  .doc-rodape-repetido { font-size: 11px; color: #666; padding-top: 10px; margin-top: 14px; border-top: 1px solid #e2e2e2; }
  ${cssColunas}
  @media print {
    body { background: #fff; }
    .folha { margin: 0; box-shadow: none; page-break-after: always; }
    .folha:last-child { page-break-after: auto; }
    @page { size: ${opcoes.larguraMm}mm ${opcoes.alturaMm}mm; margin: 0; }
  }
</style>
</head>
<body>${paginasDiv}</body>
</html>`);
  janela.document.close();
  janela.focus();
  setTimeout(() => {
    janela.print();
  }, 350);
}
