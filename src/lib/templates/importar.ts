import { mapearVariaveis, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import { normalizarNomeMeta, validarTemplate, type CanalTemplate } from "./regras";

/**
 * VÁRIOS TEMPLATES DE UMA VEZ, a partir de texto colado.
 *
 * Sete modelos escritos fora do CRM viram sete idas ao editor: nome, categoria, idioma, corpo,
 * variável, botão, salvar, enviar pra análise. Sete vezes. O trabalho de verdade — escrever a
 * mensagem — já estava feito; o que sobrava era digitação, e digitação repetida é onde o erro
 * entra sem ninguém ver.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * O LEITOR É TOLERANTE, E A TELA É QUE CONFERE.
 *
 * Isto lê o formato em que as pessoas realmente escrevem — título, categoria numa linha solta,
 * "Nome:", o texto, os botões embaixo —, não um formato que alguém teria que aprender. Em troca,
 * ele ERRA às vezes: separar botão de última frase é palpite, não certeza.
 *
 * Por isso nada é criado direto. O que sai daqui é desenhado na tela, modelo por modelo, com os
 * problemas de cada um, e só então ela confirma. Palpite mostrado é palpite corrigível; palpite
 * aplicado em silêncio é um template errado pedindo aprovação à Meta.
 */

export type TemplateImportado = {
  nome: string;
  categoria: string | null;
  corpo: string;
  botoes: { texto: string }[];
  variaveis: MapeamentoVariavel[];
  /** O que impede este modelo de ser criado. Vazio = pronto. */
  problemas: string[];
};

/** Linhas que são rótulo de tela, não conteúdo. Vêm junto quando alguém copia de uma página. */
const RUIDO = /^(copiar( mensagem)?|bot(õ|o)es( sugeridos)?|mensagem|texto|corpo)\s*:?\s*$/i;

const CATEGORIAS: { teste: RegExp; valor: string }[] = [
  { teste: /^marketing$/i, valor: "MARKETING" },
  { teste: /^(utilidade|utility)$/i, valor: "UTILITY" },
  { teste: /^(autentica(ç|c)(ã|a)o|authentication)$/i, valor: "AUTHENTICATION" },
];

/** Linha de abertura de um modelo: o título numerado ou a categoria solta. Não é conteúdo. */
function ehCabecalho(linha: string): boolean {
  return /^\d+\s*[.)-]\s/.test(linha) || categoriaDe(linha) !== null;
}

function categoriaDe(linha: string): string | null {
  const limpa = linha.replace(/^categoria\s*:\s*/i, "").trim();
  return CATEGORIAS.find((c) => c.teste.test(limpa))?.valor ?? null;
}

/**
 * `{{1}}` → `{{primeiroNome}}`.
 *
 * Quem escreve modelo pra Meta escreve numerado, porque é assim que a Meta mostra. O CRM trabalha
 * com variável NOMEADA, e é ela que sabe de onde o valor vem — `mapearVariaveis` adivinha a origem
 * pelo nome (`{{empresa}}` é do contato, `{{hora}}` é da reunião). Deixar o número viraria uma
 * variável chamada "1", sem origem nenhuma, que na hora do envio deixa um buraco na frase.
 *
 * `{{1}}` é o primeiro nome em praticamente todo modelo de abertura, e é o que se assume. As
 * outras viram `var2`, `var3`: sem origem de propósito, pra aparecerem como pendência na tela em
 * vez de passarem direto. Adivinhar a segunda seria adivinhar demais.
 */
export function numeradasParaNomeadas(texto: string): string {
  return texto.replace(/\{\{\s*(\d+)\s*\}\}/g, (_todo, n: string) =>
    n === "1" ? "{{primeiroNome}}" : `{{var${n}}}`,
  );
}

/** Um bloco de linhas (já sem ruído) vira um template. */
function lerBloco(nome: string, categoria: string | null, linhas: string[], canal: CanalTemplate): TemplateImportado {
  /*
   * ONDE O CORPO ACABA E OS BOTÕES COMEÇAM.
   *
   * Os botões são as ÚLTIMAS linhas curtas do bloco. "Curta" é o próprio limite da Meta (25
   * caracteres), então a conta não é inventada: o que não caberia num botão não é um botão.
   *
   * E a pontuação desempata o caso perigoso. "Podemos conversar?" é a última frase de um dos
   * modelos e "Podemos conversar" é um botão de outro — a diferença entre os dois é a interrogação.
   * Frase termina com pontuação final; rótulo de botão, não.
   */
  const botoes: string[] = [];
  let fim = linhas.length;
  while (fim > 0) {
    const linha = linhas[fim - 1];
    if (linha.length > 25 || /[.?!:;]$/.test(linha)) break;
    botoes.unshift(linha);
    fim -= 1;
  }
  // Um bloco inteiro de linhas curtas não é "só botões": é um corpo curto. Sem corpo não há
  // template, e devolver zero texto com três botões seria transformar a mensagem em rótulo.
  if (fim === 0 && botoes.length) {
    linhas = [botoes.shift() as string];
    fim = 1;
  }

  const corpo = numeradasParaNomeadas(linhas.slice(0, fim).join("\n").trim());
  const variaveis = mapearVariaveis(corpo);
  const editavel = {
    nome: normalizarNomeMeta(nome),
    canal,
    categoria,
    idioma: "pt_BR",
    assunto: null,
    corpo,
    variaveis,
    botoes: botoes.map((texto) => ({ texto })),
  };

  const problemas = validarTemplate(editavel);
  /*
   * VARIÁVEL SEM ORIGEM é pendência, não erro de formato — e é o defeito que já está no ar: a
   * prévia escreve o nome da variável entre colchetes exatamente quando não tem valor pra pôr ali,
   * e o modelo segue aprovado mandando a frase com buraco. Sai como problema aqui pra ser resolvido
   * ANTES de ir pra análise.
   */
  for (const v of variaveis) {
    if (v.origem === "texto" && !v.valor?.trim()) {
      problemas.push(`A variável {{${v.chave}}} não tem origem: escolha de onde vem o valor antes de criar.`);
    }
  }
  return { nome: editavel.nome, categoria, corpo, botoes: editavel.botoes, variaveis, problemas };
}

/**
 * Lê o texto colado e devolve um template por "Nome:" encontrado.
 *
 * A categoria pode vir antes do nome (é como as pessoas escrevem: o título, a categoria, o nome) ou
 * como `Categoria:` dentro do bloco. As duas valem.
 */
export function lerTemplatesColados(
  texto: string,
  canal: CanalTemplate = "whatsapp_oficial",
): TemplateImportado[] {
  const linhas = texto
    .split("\n")
    .map((l) => l.replace(/ /g, " ").trim())
    .filter((l) => l && !RUIDO.test(l));

  const ancoras: number[] = [];
  linhas.forEach((l, i) => {
    if (/^nome\s*:/i.test(l)) ancoras.push(i);
  });
  if (!ancoras.length) return [];

  return ancoras.map((inicio, ordem) => {
    /*
     * O BLOCO ACABA ANTES DO CABEÇALHO DO PRÓXIMO.
     *
     * Entre o último botão de um modelo e o `Nome:` do seguinte vêm as linhas de abertura dele: o
     * título numerado ("2. Primeiro contato — Apresentação") e a categoria numa linha solta
     * ("Marketing"). Sem cortá-las aqui, "Marketing" é curta e sem pontuação — vira um botão do
     * modelo ANTERIOR, e o título entra no corpo dele.
     */
    const proxima = ancoras[ordem + 1] ?? linhas.length;
    let fim = proxima;
    while (fim > inicio + 1 && ehCabecalho(linhas[fim - 1])) fim -= 1;
    const nome = linhas[inicio].replace(/^nome\s*:\s*/i, "").replace(/[`"']/g, "").trim();

    // A categoria olha pra trás (linha solta antes do nome, como as pessoas escrevem) e pra
    // dentro do bloco (`Categoria: Marketing`). O limite de três linhas pra trás evita pegar a
    // categoria do modelo ANTERIOR quando este veio sem nenhuma.
    const anterior = ancoras[ordem - 1] ?? -1;
    let categoria: string | null = null;
    for (let i = inicio - 1; i > anterior && i >= inicio - 3; i--) {
      categoria = categoriaDe(linhas[i]);
      if (categoria) break;
    }
    const corpoDoBloco: string[] = [];
    for (let i = inicio + 1; i < fim; i++) {
      const daLinha = categoriaDe(linhas[i]);
      if (daLinha && /^categoria\s*:/i.test(linhas[i])) {
        categoria = daLinha;
        continue;
      }
      corpoDoBloco.push(linhas[i].replace(/^(mensagem|texto|corpo)\s*:\s*/i, ""));
    }
    return lerBloco(nome, categoria, corpoDoBloco, canal);
  });
}
