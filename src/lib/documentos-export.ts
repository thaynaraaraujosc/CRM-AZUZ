import JSZip from "jszip";

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
