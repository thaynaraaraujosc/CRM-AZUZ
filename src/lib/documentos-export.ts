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

/** Gera um .docx (OOXML) de verdade — parágrafo a parágrafo, com negrito/itálico/sublinhado preservados. */
export async function baixarDocx(titulo: string, paginas: PaginaDoc[]) {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
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

  function escaparXml(texto: string) {
    return texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function paginaParaParagrafosXml(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;
    const blocos = div.children.length > 0 ? Array.from(div.children) : [div];
    return blocos
      .map((bloco) => {
        const texto = escaparXml(bloco.textContent ?? "");
        const negrito = bloco.querySelector("b, strong") ? '<w:b/>' : "";
        const italico = bloco.querySelector("i, em") ? '<w:i/>' : "";
        const sublinhado = bloco.querySelector("u") ? '<w:u w:val="single"/>' : "";
        const props = negrito || italico || sublinhado ? `<w:rPr>${negrito}${italico}${sublinhado}</w:rPr>` : "";
        return `<w:p><w:r>${props}<w:t xml:space="preserve">${texto}</w:t></w:r></w:p>`;
      })
      .join("");
  }

  const corpo = paginas
    .map((p, i) => {
      const paragrafos = paginaParaParagrafosXml(p.conteudoHtml);
      const quebraPagina = i < paginas.length - 1 ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : "";
      return paragrafos + quebraPagina;
    })
    .join("");

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
  opcoes: { larguraMm: number; alturaMm: number; margemMm: number; corFundo: string },
) {
  const janela = window.open("", "_blank", "width=900,height=1000");
  if (!janela) {
    window.alert("O navegador bloqueou a janela de pré-visualização — permita pop-ups pra esse site e tente de novo.");
    return;
  }
  const paginasDiv = paginasHtml
    .map(
      (html) =>
        `<div class="folha" style="width:${opcoes.larguraMm}mm;min-height:${opcoes.alturaMm}mm;padding:${opcoes.margemMm}mm;background:${opcoes.corFundo};">${html}</div>`,
    )
    .join("");
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
