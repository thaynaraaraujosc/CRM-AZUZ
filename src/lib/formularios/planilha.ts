import type { Formulario, RespostaFormulario } from "@/lib/formularios-context";
import { TIPOS_LAYOUT, TIPOS_UPLOAD } from "@/lib/formularios-context";

/**
 * As respostas de um formulário em CSV, do jeito que o Excel em português abre sem pedir nada
 * (2026-09-30, trazido do AZUZ Formulários).
 *
 * Três detalhes decidem se a planilha abre certa ou vira uma coluna só com texto quebrado:
 * - Separador `;`: o Excel em português usa a vírgula como decimal e lê `,` como parte do texto.
 * - BOM no começo: sem ele o Excel abre como Latin-1, e "Não" vira "NÃ£o".
 * - Aspas em volta de todo valor, com aspas internas dobradas: resposta com `;` ou quebra de
 *   linha não empurra as colunas.
 *
 * ARQUIVO ENVIADO ENTRA SÓ PELO NOME: o conteúdo está dentro da resposta em base64 (ver
 * `campo-resposta.tsx`) e numa célula viraria um texto de megabytes.
 *
 * CÉLULA QUE COMEÇA COM `=`, `+`, `-` OU `@` GANHA UM APÓSTROFO NA FRENTE. Quem responde um
 * formulário é qualquer pessoa com o link, e o Excel executa como fórmula o que começa assim —
 * dá pra montar uma que vaza dado da planilha de quem abriu.
 */
function celula(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replace(/"/g, '""')}"`;
}

export function respostasEmCsv(
  formulario: Pick<Formulario, "paginas">,
  respostas: Pick<RespostaFormulario, "criadoEm" | "valores">[],
  formatarData: (iso: string) => string,
): string {
  const perguntas = formulario.paginas.flatMap((p) => p.perguntas).filter((q) => !TIPOS_LAYOUT.includes(q.tipo));
  const cabecalho = ["Data", ...perguntas.map((q) => q.rotulo || "Sem título")];

  const linhas = respostas.map((r) => {
    const valores = perguntas.map((q) => {
      const valor = r.valores[q.id] ?? "";
      if (TIPOS_UPLOAD.includes(q.tipo)) return valor.split("|")[0] ?? "";
      if (q.tipo === "assinatura") return valor ? "(assinatura enviada)" : "";
      // O consentimento chega de dois jeitos: pelo TIPO de campo ("Consentimento de WhatsApp", na
      // lista do "+ Adicionar campo") ou pelo MAPEAMENTO, marcado à mão num sim/não. Na planilha
      // os dois viram a mesma coluna de "Sim"/"Não": é o comprovante, e ele não pode sair em
      // branco só porque o formulário foi montado de outro jeito.
      if (q.tipo === "consentimento_whatsapp" || q.mapeamentoCrm === "consentimentoWhatsApp") {
        return valor.toLowerCase() === "sim" ? "Sim" : "Não";
      }
      return valor;
    });
    return [formatarData(r.criadoEm), ...valores];
  });

  return "﻿" + [cabecalho, ...linhas].map((linha) => linha.map(celula).join(";")).join("\r\n");
}

/** Nome do arquivo a partir do nome do formulário, sem o que o sistema de arquivos não aceita. */
export function nomeDoArquivo(nomeDoFormulario: string, hoje: Date = new Date()): string {
  const base =
    nomeDoFormulario
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "formulario";
  return `respostas-${base}-${hoje.toISOString().slice(0, 10)}.csv`;
}
