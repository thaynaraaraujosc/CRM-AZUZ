/**
 * Variáveis de mensagem: `{{nome}}`, `{{produto}}`… e como cada uma vira valor pra cada pessoa.
 *
 * A regra central deste arquivo: a pessoa ESCREVE com nomes (`{{nome}}`), porque é assim que se
 * escreve. A Meta EXIGE números (`{{1}}`), porque é assim que a API dela funciona. A conversão mora
 * aqui e em nenhum outro lugar. Quem usa este módulo nunca vê `{{1}}`, exceto na hora de montar o
 * pedido pra Graph API.
 *
 * Tudo aqui é puro (sem banco, sem rede) de propósito: é o que permite testar cada regra sozinha,
 * e é o que o construtor de automações vai reaproveitar depois sem arrastar o Prisma junto.
 */

import { dataCurta, dataPorExtenso } from "@/lib/agenda/fuso";
import type { ReuniaoParaVariaveis } from "@/lib/agenda/reuniao-tipos";

/** De onde sai o valor de uma variável. `texto` = valor fixo digitado na hora do disparo. */
export type OrigemVariavel =
  | "contato.nome"
  /**
   * Só a primeira palavra, sem o sufixo de homônimo.
   *
   * `contato.nome` é o nome-chave do CRM, e ele carrega coisa que não é nome de gente: quando dois
   * leads diferentes têm o mesmo nome, o segundo entra como "Marina Alves (Consultoria grátis)".
   * Mandar isso num "Olá, {{nome}}" escancara pro cliente um detalhe interno do cadastro.
   *
   * Uma origem própria, e não um ajuste dentro de `contato.nome`, porque as duas coisas são
   * legítimas: cabeçalho de proposta quer o nome inteiro, saudação quer o primeiro.
   */
  | "contato.primeiroNome"
  | "contato.sobrenome"
  | "contato.empresa"
  | "contato.cargo"
  | "contato.cidade"
  | "contato.email"
  | "contato.whatsapp"
  | "contato.responsavel"
  /**
   * A PRÓXIMA reunião do contato que ainda não aconteceu e não foi cancelada.
   *
   * Lida do banco na hora do envio, não congelada no momento em que o lead entrou: reunião é a
   * coisa que mais muda de horário, e confirmar com o cliente um horário remarcado é pior do que
   * não confirmar nada.
   *
   * Quatro origens em vez de uma porque cada uma vai num lugar diferente da frase — "sua reunião
   * de {{data}} às {{hora}}" não é a mesma coisa que "entre por {{link}}" — e a Meta cobra um
   * parâmetro por posição.
   */
  | "reuniao.data"
  | "reuniao.dataCurta"
  | "reuniao.hora"
  | "reuniao.link"
  | "texto";

export type MapeamentoVariavel = {
  /** Nome como aparece na mensagem, sem chaves: `nome`, `produto`. */
  chave: string;
  /** Posição na versão numerada (`{{1}}`), fixa desde a criação: a Meta identifica por ela. */
  indice: number;
  origem: OrigemVariavel;
  /** Só quando `origem === "texto"`. */
  valor?: string;
  /**
   * O que usar quando o campo do contato está vazio ("se estiver vazio, usar: …").
   *
   * Existe porque a Meta recusa o ENVIO INTEIRO quando um parâmetro vai vazio, e campo vazio é o
   * caso comum, não a exceção: o lead não preencheu "empresa", e a mensagem não sai. Com reserva,
   * `{{empresa}}` vira "sua empresa" e o envio acontece.
   *
   * Sem reserva o envio não é tentado: ver `prepararEnvioDeModelo`.
   */
  reserva?: string;
};

/** Campos do contato que uma variável pode ler, com o rótulo pra tela. */
export const ORIGENS_DO_CONTATO: { origem: OrigemVariavel; label: string }[] = [
  { origem: "contato.nome", label: "Nome" },
  { origem: "contato.primeiroNome", label: "Primeiro nome" },
  { origem: "contato.sobrenome", label: "Sobrenome" },
  { origem: "contato.empresa", label: "Empresa" },
  { origem: "contato.cargo", label: "Cargo" },
  { origem: "contato.cidade", label: "Cidade" },
  { origem: "contato.email", label: "E-mail" },
  { origem: "contato.whatsapp", label: "WhatsApp" },
  { origem: "contato.responsavel", label: "Responsável" },
];

/** As origens que saem da Agenda, com o rótulo pra tela. */
export const ORIGENS_DA_REUNIAO: { origem: OrigemVariavel; label: string }[] = [
  { origem: "reuniao.data", label: "Data da reunião" },
  { origem: "reuniao.dataCurta", label: "Data da reunião (curta)" },
  { origem: "reuniao.hora", label: "Hora da reunião" },
  { origem: "reuniao.link", label: "Link da reunião" },
];

/**
 * O nome que a tela escreve na mensagem pra uma origem: `contato.empresa` → `empresa`.
 *
 * É o outro lado da adivinhação de `mapearVariaveis`: o botão escreve `{{empresa}}` e a
 * adivinhação devolve `contato.empresa`. Tirar o prefixo num lugar só evita que um dos dois lados
 * mude e as duas coisas deixem de se encontrar.
 */
export function chaveSugeridaDe(origem: OrigemVariavel): string {
  return origem.slice(origem.indexOf(".") + 1);
}

/** Tudo que uma variável pode ler de um contato. É esta lista que a adivinhação pelo nome usa. */
export const ORIGENS_DISPONIVEIS: { origem: OrigemVariavel; label: string }[] = [
  ...ORIGENS_DO_CONTATO,
  ...ORIGENS_DA_REUNIAO,
];

/** O pedaço do contato que as variáveis enxergam. É o `select` que quem busca no banco deve usar. */
export type ContatoParaVariaveis = {
  nome: string;
  sobrenome?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  cidade?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  responsavel?: string | null;
  /** `null` quando o contato não tem reunião futura. Quem monta isto é `proximaReuniaoDoContato`. */
  reuniao?: ReuniaoParaVariaveis | null;
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
    // A comparação é sem caixa: quem escreve `{{primeiroNome}}` e quem escreve `{{primeironome}}`
    // querem a mesma coisa, e errar aqui deixa a variável como "texto" — a pessoa preenche na mão e
    // nunca entende por que aquela não puxou sozinha.
    //
    // E tenta os dois prefixos: `{{empresa}}` é do contato, `{{hora}}` é da reunião. Quem escreve
    // não digita o prefixo, então quem procura tem que olhar nos dois lugares.
    const alvos = [`contato.${chave}`.toLowerCase(), `reuniao.${chave}`.toLowerCase()];
    const origemAdivinhada = ORIGENS_DISPONIVEIS.find((o) => alvos.includes(o.origem.toLowerCase()))?.origem;
    return { chave, indice: proximoIndiceLivre(), origem: origemAdivinhada ?? "texto" };
  });
}

/** Substitui `{{chave}}` pelos valores. Variável sem valor fica como está, visível: melhor do que
 * mandar "Olá, ." pra pessoa e ninguém perceber. */
export function preencherVariaveis(texto: string, valores: Record<string, string>): string {
  return texto.replace(PADRAO_NOMEADA, (original, chave: string) => {
    const valor = valores[chave];
    return valor?.trim() ? valor : original;
  });
}

/** Resolve os valores de UMA pessoa a partir do mapeamento. É isto que vai congelado em
 * `CampanhaDestinatario.parametros`. */
/**
 * A primeira palavra do nome, sem o sufixo de homônimo.
 *
 * O nome-chave do CRM pode ser "Marina Alves (Consultoria grátis)": quando dois leads diferentes
 * têm o mesmo nome, o segundo ganha o sufixo pra não fundir com o primeiro. Isso é cadastro, não é
 * como a pessoa se chama — tirar o parêntese final antes de cortar a primeira palavra cobre também
 * o caso de nome de uma palavra só ("Marina (Consultoria grátis)").
 */
export function primeiroNomeDe(nome: string): string {
  const semSufixo = nome.replace(/\s*\([^()]*\)\s*$/, "").trim();
  return (semSufixo || nome).split(/\s+/)[0] ?? "";
}

/**
 * O valor cru de uma origem, antes da reserva.
 *
 * A formatação da data mora aqui e não em quem lê do banco: `Compromisso` guarda "2026-10-20" e
 * "14:00" (hora local de Brasília), e é esta função que decide que `reuniao.data` vira
 * "terça-feira, 20 de outubro". Assim os três lugares que mandam modelo escrevem a data igual.
 */
function valorDaOrigem(origem: OrigemVariavel, contato: ContatoParaVariaveis | null): string {
  if (origem === "contato.primeiroNome") return primeiroNomeDe(contato?.nome ?? "");

  if (origem.startsWith("reuniao.")) {
    // Contato sem reunião futura: devolve vazio, e aí vale a reserva — ou o envio não acontece e
    // a execução diz qual variável faltou. Mandar "" faria a Meta recusar a mensagem inteira.
    const reuniao = contato?.reuniao;
    if (!reuniao) return "";
    if (origem === "reuniao.data") return dataPorExtenso(reuniao.dataIso);
    if (origem === "reuniao.dataCurta") return dataCurta(reuniao.dataIso);
    if (origem === "reuniao.hora") return reuniao.hora;
    return reuniao.link ?? "";
  }

  const campo = origem.slice("contato.".length) as keyof ContatoParaVariaveis;
  const valor = contato?.[campo];
  return typeof valor === "string" ? valor : "";
}

/** O modelo usa alguma variável da Agenda? Quem envia só busca a reunião quando precisa dela. */
export function usaReuniao(variaveis: MapeamentoVariavel[]): boolean {
  return variaveis.some((v) => v.origem.startsWith("reuniao."));
}

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
    const bruto = valorDaOrigem(v.origem, contato);

    // A reserva entra DEPOIS de resolver, não no lugar de resolver: ela é o que fazer quando o
    // campo está vazio, e campo vazio é o caso comum (o lead não preencheu "empresa").
    valores[v.chave] = bruto.trim() || (v.reserva ?? "").trim();
  }
  return valores;
}

/** Quais chaves ficaram sem valor pra esta pessoa. A tela avisa antes, o worker não manda vazio. */
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
 * aceita nome, só posição: e recusa o envio inteiro se faltar um ou se um vier vazio. Devolve
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

/**
 * Prepara o envio de um modelo: resolve os valores desta pessoa e diz se dá pra mandar.
 *
 * Existe porque a regra "não mande com variável vazia" precisa valer nos TRÊS lugares que mandam
 * modelo (bloco de automação, campanha e retomada), e uma regra escrita três vezes é uma regra que
 * um dia vai divergir em duas.
 *
 * E ela não é preciosismo: a Meta recusa o envio INTEIRO quando um parâmetro vai vazio. O CRM
 * mandava `""` e levava a recusa — erro técnico em inglês, longe da causa, um destinatário por vez,
 * gastando cota. Agora quem não tem valor nem reserva nem chega a sair, e a execução diz qual
 * variável faltou e pra quem.
 */
export function prepararEnvioDeModelo(
  variaveis: MapeamentoVariavel[],
  contato: ContatoParaVariaveis | null,
):
  | { ok: true; parametros: Record<string, string>; componentes: ReturnType<typeof componentesParaMeta> }
  | { ok: false; faltando: string[]; motivo: string } {
  const parametros = resolverParametros(variaveis, contato);
  const faltando = variaveisSemValor(variaveis, parametros);
  if (faltando.length) {
    return { ok: false, faltando, motivo: motivoDeVariavelVazia(faltando) };
  }
  return { ok: true, parametros, componentes: componentesParaMeta(variaveis, parametros) };
}

/** A frase que aparece na tela de execuções. Diz a variável e diz que nada saiu — as duas coisas,
 *  porque "falhou" sem dizer o quê é o que fazia ninguém conseguir corrigir. */
export function motivoDeVariavelVazia(chaves: string[]): string {
  const lista = chaves.map((c) => `{{${c}}}`).join(", ");
  const concorda = chaves.length === 1 ? "está vazia" : "estão vazias";
  return `A variável ${lista} ${concorda} para este contato; nada foi enviado. Preencha o contato ou defina um valor reserva no modelo.`;
}
