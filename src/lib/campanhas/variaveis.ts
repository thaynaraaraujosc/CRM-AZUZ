/**
 * Variáveis de mensagem: `{{nome}}`, `{{produto}}`… e como cada uma vira valor pra cada pessoa.
 *
 * A regra central deste arquivo: a pessoa ESCREVE com nomes (`{{nome}}`), porque é assim que se
 * escreve. A Meta EXIGE números (`{{1}}`), porque é assim que a API dela funciona. A conversão mora
 * aqui e em nenhum outro lugar — quem usa este módulo nunca vê `{{1}}`, exceto na hora de montar o
 * pedido pra Graph API.
 *
 * Tudo aqui é puro (sem banco, sem rede) de propósito: é o que permite testar cada regra sozinha,
 * e é o que o construtor de automações vai reaproveitar depois sem arrastar o Prisma junto.
 */

/** De onde sai o valor de uma variável. `texto` = valor fixo digitado na hora do disparo. */
export type OrigemVariavel =
  | "contato.nome"
  | "contato.sobrenome"
  | "contato.empresa"
  | "contato.cargo"
  | "contato.cidade"
  | "contato.email"
  | "contato.whatsapp"
  | "contato.responsavel"
  | "texto";

export type MapeamentoVariavel = {
  /** Nome como aparece na mensagem, sem chaves: `nome`, `produto`. */
  chave: string;
  /** Posição na versão numerada (`{{1}}`), fixa desde a criação — a Meta identifica por ela. */
  indice: number;
  origem: OrigemVariavel;
  /** Só quando `origem === "texto"`. */
  valor?: string;
};

/** Campos do contato que uma variável pode ler, com o rótulo pra tela. */
export const ORIGENS_DO_CONTATO: { origem: OrigemVariavel; label: string }[] = [
  { origem: "contato.nome", label: "Nome" },
  { origem: "contato.sobrenome", label: "Sobrenome" },
  { origem: "contato.empresa", label: "Empresa" },
  { origem: "contato.cargo", label: "Cargo" },
  { origem: "contato.cidade", label: "Cidade" },
  { origem: "contato.email", label: "E-mail" },
  { origem: "contato.whatsapp", label: "WhatsApp" },
  { origem: "contato.responsavel", label: "Responsável" },
];

/** O pedaço do contato que as variáveis enxergam — é o `select` que quem busca no banco deve usar. */
export type ContatoParaVariaveis = {
  nome: string;
  sobrenome?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  cidade?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  responsavel?: string | null;
};

const PADRAO_NOMEADA = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const PADRAO_NUMERADA = /\{\{\s*(\d+)\s*\}\}/g;

/** Variáveis nomeadas de um texto, na ordem em que aparecem, sem repetição. */
export function extrairVariaveis(texto: string): string[] {
  const vistas = new Set<string>();
  const ordem: string[] = [];
  for (const m of texto.matchAll(PADRAO_NOMEADA)) {
    if (!vistas.has(m[1])) {
      vistas.add(m[1]);
      ordem.push(m[1]);
    }
  }
  return ordem;
}

/**
 * Mapeamento padrão de um texto: cada variável ganha um índice pela ordem em que aparece, e uma
 * origem adivinhada pelo nome quando bate com um campo do contato (`{{nome}}` → `contato.nome`,
 * `{{empresa}}` → `contato.empresa`). O que não bate fica como `texto`, pra pessoa preencher.
 *
 * Preserva índice e origem de um mapeamento anterior quando a chave já existia: editar o texto
 * não pode embaralhar o que a Meta já conhece como `{{1}}`.
 */
export function mapearVariaveis(texto: string, anterior: MapeamentoVariavel[] = []): MapeamentoVariavel[] {
  const chaves = extrairVariaveis(texto);
  const porChave = new Map(anterior.map((v) => [v.chave, v]));
  const indicesUsados = new Set(anterior.filter((v) => chaves.includes(v.chave)).map((v) => v.indice));
  let proximo = 1;
  const proximoIndiceLivre = () => {
    while (indicesUsados.has(proximo)) proximo++;
    indicesUsados.add(proximo);
    return proximo;
  };
  return chaves.map((chave) => {
    const existente = porChave.get(chave);
    if (existente) return existente;
    const origemAdivinhada = ORIGENS_DO_CONTATO.find((o) => o.origem === `contato.${chave.toLowerCase()}`)?.origem;
    return { chave, indice: proximoIndiceLivre(), origem: origemAdivinhada ?? "texto" };
  });
}

/** Substitui `{{chave}}` pelos valores. Variável sem valor fica como está, visível — melhor do que
 * mandar "Olá, ." pra pessoa e ninguém perceber. */
export function preencherVariaveis(texto: string, valores: Record<string, string>): string {
  return texto.replace(PADRAO_NOMEADA, (original, chave: string) => {
    const valor = valores[chave];
    return valor?.trim() ? valor : original;
  });
}

/** Resolve os valores de UMA pessoa a partir do mapeamento. É isto que vai congelado em
 * `CampanhaDestinatario.parametros`. */
export function resolverParametros(
  variaveis: MapeamentoVariavel[],
  contato: ContatoParaVariaveis | null,
): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const v of variaveis) {
    if (v.origem === "texto") {
      valores[v.chave] = v.valor ?? "";
      continue;
    }
    const campo = v.origem.slice("contato.".length) as keyof ContatoParaVariaveis;
    valores[v.chave] = (contato?.[campo] ?? "").toString().trim();
  }
  return valores;
}

/** Quais chaves ficaram sem valor pra esta pessoa — a tela avisa antes, o worker não manda vazio. */
export function variaveisSemValor(variaveis: MapeamentoVariavel[], parametros: Record<string, string>): string[] {
  return variaveis.filter((v) => !parametros[v.chave]?.trim()).map((v) => v.chave);
}

// ------------------------------------------------------------------ Meta (numeradas) --

/** `{{nome}}` → `{{1}}`, conforme o mapeamento. É o corpo que vai pra análise da Meta. */
export function paraNumeradas(texto: string, variaveis: MapeamentoVariavel[]): string {
  const indicePorChave = new Map(variaveis.map((v) => [v.chave, v.indice]));
  return texto.replace(PADRAO_NOMEADA, (original, chave: string) => {
    const indice = indicePorChave.get(chave);
    return indice ? `{{${indice}}}` : original;
  });
}

/** `{{1}}` → `{{nome}}`, pra mostrar um template importado da Meta do jeito que a pessoa lê. */
export function paraNomeadas(texto: string, variaveis: MapeamentoVariavel[]): string {
  const chavePorIndice = new Map(variaveis.map((v) => [v.indice, v.chave]));
  return texto.replace(PADRAO_NUMERADA, (original, n: string) => {
    const chave = chavePorIndice.get(Number(n));
    return chave ? `{{${chave}}}` : original;
  });
}

/** Quantas variáveis numeradas um corpo da Meta espera (`{{1}}`, `{{2}}`…). */
export function quantidadeNumeradas(texto: string): number {
  let maior = 0;
  for (const m of texto.matchAll(PADRAO_NUMERADA)) maior = Math.max(maior, Number(m[1]));
  return maior;
}

/**
 * O componente `body` do envio pela Cloud API, com os parâmetros NA ORDEM DOS ÍNDICES. A Meta não
 * aceita nome, só posição — e recusa o envio inteiro se faltar um ou se um vier vazio. Devolve
 * `undefined` quando o modelo não tem variável (mandar `components: []` também é recusado).
 */
export function componentesParaMeta(
  variaveis: MapeamentoVariavel[],
  parametros: Record<string, string>,
): { type: "body"; parameters: { type: "text"; text: string }[] }[] | undefined {
  if (!variaveis.length) return undefined;
  const ordenadas = [...variaveis].sort((a, b) => a.indice - b.indice);
  return [
    {
      type: "body",
      parameters: ordenadas.map((v) => ({ type: "text", text: parametros[v.chave] ?? "" })),
    },
  ];
}
