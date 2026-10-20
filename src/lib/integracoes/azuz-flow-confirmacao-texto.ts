import { dataCurta, dataIsoEmBrasilia, dataPorExtenso, horaEmBrasilia } from "@/lib/agenda/fuso";

/**
 * O texto da confirmação de reunião, montado a partir do que a agência escreveu na tela.
 *
 * Puro de propósito: é a parte que vai parar no WhatsApp de um cliente do cliente. Errar aqui não
 * dá erro em lugar nenhum — dá uma mensagem estranha chegando a uma pessoa de verdade. Por isso
 * toda regra daqui é provável sem banco e sem rede.
 */

/** O que cada variável vale nesta reunião. */
export type ValoresDaConfirmacao = {
  primeiroNome: string;
  /** Instante de início, em UTC. A conversão pro fuso de Brasília acontece aqui dentro. */
  inicio: Date;
  /** O link do Meet. Vazio ou nulo faz a LINHA INTEIRA sumir. Ver `montarTextoDaConfirmacao`. */
  link: string | null;
  /** O nome da agência, pra mensagem dizer de onde a pessoa veio. */
  empresa: string;
};

/**
 * O texto que a confirmação usa quando ninguém escreveu outro.
 *
 * Três coisas estão aqui de propósito, e nenhuma é enfeite:
 *
 *   - DE ONDE A PESSOA VEIO ("pelo formulário da ..."). Quem recebe não lembra de ter dado o número
 *     a ninguém; sem isso a mensagem é indistinguível de spam, e spam é o que faz um número ser
 *     denunciado e bloqueado.
 *   - COMO PARAR. Mesma razão: quem não consegue sair denuncia.
 *   - A LINHA DO LINK SOZINHA, pra poder sumir inteira quando não houver link. Uma frase "o link é:"
 *     sem link é pior do que não falar de link.
 */
export const TEXTO_PADRAO_DA_CONFIRMACAO = [
  "Oi, {{primeiroNome}}! Sua reunião está confirmada para {{data}}, às {{hora}}.",
  "{{link}}",
  "Você marcou esta conversa pelo formulário da {{empresa}}. Se não quiser mais receber mensagens, responda SAIR.",
].join("\n\n");

/**
 * O que cada variável devolve, já no fuso de Brasília.
 *
 * `data` é por extenso ("terça-feira, 20 de outubro") e `dataCurta` é numérica ("20/10/2026"),
 * porque as duas servem a frases diferentes e quem escreve o texto escolhe.
 */
function valoresDe(valores: ValoresDaConfirmacao): Record<string, string> {
  const dataIso = dataIsoEmBrasilia(valores.inicio);
  return {
    primeiroNome: primeiroNomeDe(valores.primeiroNome),
    data: dataPorExtenso(dataIso),
    dataCurta: dataCurta(dataIso),
    hora: horaEmBrasilia(valores.inicio),
    link: valores.link?.trim() ?? "",
    empresa: valores.empresa.trim(),
  };
}

/**
 * Só o primeiro nome.
 *
 * "Oi, Ana Paula Souza de Oliveira!" não é como ninguém escreve pra alguém. E o nome do contato no
 * CRM pode ter sufixo de homônimo, que ficaria à mostra na mensagem.
 */
function primeiroNomeDe(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/**
 * Troca as variáveis e devolve o texto pronto.
 *
 * A REGRA DA LINHA VAZIA é o que diferencia isto de um `replace` qualquer: quando uma variável
 * sozinha ocupa uma linha (ou um parágrafo) e ela vem vazia, a LINHA INTEIRA sai. É o caso do
 * link: reunião sem Meet não pode virar um parágrafo em branco no meio da mensagem, nem a palavra
 * "undefined".
 *
 * Variável desconhecida fica como está, visível. Apagá-la em silêncio esconderia um erro de
 * digitação de quem escreveu o texto; deixá-la à mostra faz a pessoa ver e corrigir.
 */
export function montarTextoDaConfirmacao(modelo: string, valores: ValoresDaConfirmacao): string {
  const mapa = valoresDe(valores);

  const linhas = modelo.split("\n").map((linha) => {
    const trocada = linha.replace(/\{\{(\w+)\}\}/g, (original, chave: string) =>
      chave in mapa ? mapa[chave] : original,
    );
    // A linha só é descartada quando ela era SÓ variáveis: "{{link}}" some, mas "Link: {{link}}"
    // fica — quem escreveu as duas palavras quis vê-las.
    const soVariaveis = /^\s*(\{\{\w+\}\}\s*)+$/.test(linha);
    return soVariaveis && !trocada.trim() ? null : trocada;
  });

  return linhas
    .filter((linha): linha is string => linha !== null)
    .join("\n")
    // Sobra de parágrafo: três quebras viram duas, pra não abrir um buraco onde a linha saiu.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** As variáveis que a tela oferece, pra listar embaixo do campo de texto. */
export const VARIAVEIS_DA_CONFIRMACAO = [
  { chave: "primeiroNome", explicacao: "O primeiro nome de quem preencheu" },
  { chave: "data", explicacao: "A data por extenso (terça-feira, 20 de outubro)" },
  { chave: "dataCurta", explicacao: "A data em números (20/10/2026)" },
  { chave: "hora", explicacao: "A hora em Brasília (14:30)" },
  { chave: "link", explicacao: "O link da reunião. Sozinho numa linha, a linha some quando não houver link" },
  { chave: "empresa", explicacao: "O nome da sua empresa" },
] as const;
