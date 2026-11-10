/**
 * Avaliação pura: o gatilho casa com este evento? A condição é verdadeira pra este contato?
 *
 * Nada aqui executa nada. Não manda mensagem, não move card, não grava no banco. Quem EXECUTA é
 * `automacoes/motor-estado.ts`, e ele é o único.
 *
 * Este arquivo era o "motor" antigo: um segundo executor, síncrono e sem memória, que não sabia
 * esperar por resposta e mantinha a própria lista de blocos, sempre um pouco diferente da do
 * motor de verdade. A parte de execução foi removida; o que sobrou é o que sempre foi puro e é
 * usado pelos dois lados (o disparo por evento e o gatilho de etapa).
 */

import type {
  CondicaoGrupoData,
  FlowEdge,
  FlowNode,
  FlowNodeType,
  FluxoAutomacao,
  GrupoCondicoes,
} from "./types";
import { nosDeGatilho, tipoDoGatilhoQueCasa } from "./gatilhos-do-fluxo";
import { ehCampoPersonalizado, idDoCampoPersonalizado } from "./campos-condicao";
import { preencher } from "@/lib/automacoes/preencher-variaveis";

/* -------------------------------------------------------------------------- */
/* Contrato de execução                                                      */
/* -------------------------------------------------------------------------- */

/**
 * O que a avaliação enxerga do contato. Só leitura: avaliar não muda nada.
 *
 * Os campos nomeados são os que as condições usam direto; o resto entra pelo índice, porque campo
 * personalizado é criado pelo cliente e não dá pra listar aqui.
 */
export type ContextoExecucao = {
  contato: {
    nome: string;
    etiquetas: string[];
    origem?: string;
    responsavel?: string;
    camposPersonalizados?: Record<string, string>;
    funilId?: string;
    etapaTitulo?: string;
    ultimaRespostaEm?: string;
    [k: string]: unknown;
  };
  /** Timestamp ISO que substitui `new Date()`. Usado pelo simulador ao "avançar o relógio". */
  agora?: string;
};





/* -------------------------------------------------------------------------- */
/* Utilidades internas                                                       */
/* -------------------------------------------------------------------------- */



function saidasDoNo(edges: FlowEdge[], nodeId: string): FlowEdge[] {
  return edges.filter((e) => e.source === nodeId);
}

/**
 * O VALOR QUE UM CAMPO DE CONDIÇÃO TEM, pra este contato.
 *
 * O contexto da execução carrega a linha do contato inteira (ver `disparar-no-servidor.ts`), mais
 * o que o próprio evento trouxe — a mensagem, o canal, o comentário — e o rastreio de origem já
 * achatado em `utm_source`, `gclid` e companhia. Por isso a maioria dos campos cai no acesso
 * direto lá embaixo: o nome do campo É o nome da coluna.
 *
 * Os casos nomeados aqui são os em que não é: ou o nome na tela difere do nome no banco
 * ("Telefone (Cel.)" é `whatsapp`), ou a resposta é uma conta e não uma coluna ("Possui
 * agendamento" é "tem reunião futura carregada no contexto?").
 */
function valorDoCampo(campo: string, contato: ContextoExecucao["contato"]): string | undefined {
  const simOuNao = (v: unknown) => (v ? "sim" : "nao");
  switch (campo) {
    case "origem":
      return contato.origem;
    case "etapa":
      return contato.etapaTitulo ?? (typeof contato.etapa === "string" ? contato.etapa : undefined);
    case "funil":
      return contato.funilId;
    case "etiqueta":
      return contato.etiquetas?.join(",");
    case "responsavel":
    case "equipe":
      return contato.responsavel;
    case "respondeu":
      return texto(contato.respondeu) ?? simOuNao(contato.ultimaRespostaEm);
    /* Nomes de tela que não são os nomes das colunas. O nome do CAMPO ganha do nome da coluna:
       o simulador monta o contato com as chaves da condição, e um fluxo testado ali precisa se
       comportar igual quando rodar de verdade. */
    case "telefone_celular":
      return texto(contato.telefone_celular) ?? texto(contato.whatsapp);
    case "telefone_comercial":
      return texto(contato.telefone_comercial) ?? texto(contato.telefoneFixo);
    case "valor_negocio":
      return texto(contato.valor_negocio) ?? texto(contato.valor);
    /* Perguntas de sim/não que são uma conta, não uma coluna. */
    case "consentimento": {
      // `undefined` é "não se sabe" e não pode virar "não": todo contato anterior a esta coluna
      // nasceu sem ela, e tratar ausência como recusa cortaria quem já vinha conversando.
      const doCampo = texto(contato.consentimento);
      if (doCampo !== undefined) return doCampo;
      return contato.consentimentoWhatsApp === undefined || contato.consentimentoWhatsApp === null
        ? undefined
        : simOuNao(contato.consentimentoWhatsApp);
    }
    case "numero_salvo":
      return texto(contato.numero_salvo) ?? simOuNao(contato.salvoEm);
    case "possui_agendamento":
      return texto(contato.possui_agendamento) ?? simOuNao(contato.reuniao);
    /* ------------------------------- Instagram -------------------------------- */
    /*
     * AUSÊNCIA SOBE COMO AUSÊNCIA.
     *
     * Instagram desconectado, permissão não concedida, evento que não carrega o dado: a resposta é
     * `undefined`, e a regra responde "não existe". Devolver "nao" aqui mandaria todo mundo pelo
     * caminho de quem não segue — incluindo os seguidores, no dia em que o token vencesse.
     */
    case "ig_seguidor":
      return texto(contato.ig_seguidor) ?? simNaoOuNada(contato.igSegueVoce);
    case "ig_voce_segue":
      return texto(contato.ig_voce_segue) ?? simNaoOuNada(contato.igVoceSegue);
    case "ig_verificado":
      return texto(contato.ig_verificado) ?? simNaoOuNada(contato.igVerificado);
    case "ig_seguidores":
      return texto(contato.ig_seguidores) ?? texto(contato.igSeguidores);
    case "ig_arroba": {
      // O @ sem o arroba: é assim que a Meta manda e é assim que a pessoa digita na regra.
      const bruto = texto(contato.ig_arroba) ?? texto(contato.instagram) ?? texto(contato.username);
      return bruto?.replace(/^@/, "");
    }
    case "ig_janela_24h":
      return simNaoOuNada(contato.ig_janela_24h);
    case "ig_tipo_interacao":
      return texto(contato.ig_tipo_interacao);
    case "ig_post_id":
      return texto(contato.ig_post_id) ?? texto(contato.publicacaoId);
    case "ig_post_link":
      return texto(contato.ig_post_link);
    default: {
      const direto = contato[campo];
      if (typeof direto === "string") return direto;
      if (typeof direto === "number") return String(direto);
      return contato.camposPersonalizados?.[campo];
    }
  }
}

function texto(v: unknown): string | undefined {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined;
}

/** "sim"/"nao" pra booleano de verdade, e NADA pra nulo: ausência não é negativa. */
function simNaoOuNada(v: unknown): string | undefined {
  return typeof v === "boolean" ? (v ? "sim" : "nao") : undefined;
}

/**
 * O QUE O INSTAGRAM CONTA sobre quem escreveu, como resposta de sim/não.
 *
 * As três colunas (`igSegueVoce`, `igVoceSegue`, `igVerificado`) vêm do perfil que a Meta devolve
 * pra quem mandou mensagem pra conta conectada. Nulo é "a conta não concedeu essa permissão", e
 * isso NÃO é o mesmo que "não segue": por isso o indefinido sobe como indefinido, e uma regra
 * "Cliente é um seguidor" não manda ninguém pelo caminho errado quando o dado não existe.
 */
function perfilDoInstagram(opcao: string | undefined, contato: ContextoExecucao["contato"]): boolean | undefined {
  const bruto =
    opcao === "seguidor" ? contato.igSegueVoce : opcao === "seguido" ? contato.igVoceSegue : opcao === "verificado" ? contato.igVerificado : undefined;
  return typeof bruto === "boolean" ? bruto : undefined;
}

/**
 * COMO DUAS FRASES SÃO COMPARADAS: sem espaço sobrando, sem maiúscula e SEM ACENTO.
 *
 * Quem escreve a regra digita "consulta"; quem responde no WhatsApp escreve "Consulta ", "CONSULTA"
 * ou "consultá". Comparar tudo isso como texto cru faz o robô seguir pelo caminho errado por causa
 * de um acento — e a pessoa que montou o fluxo não tem como descobrir isso olhando a tela.
 *
 * `NFD` separa a letra do acento e o `replace` joga o acento fora; é a mesma normalização que o
 * resto do CRM usa pra casar palavra-chave.
 */
function textoComparavel(texto: string | undefined): string {
  return (texto ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * "R$ 4.800,50" VIRA 4800.5, e não NaN.
 *
 * O valor do negócio é texto no banco, do jeito que foi digitado — com cifrão, com ponto de milhar
 * e com vírgula decimal. `Number("R$ 4.800")` é NaN, e uma comparação com NaN é SEMPRE falsa: a
 * regra "valor do negócio maior que 1000" nunca batia, pra nenhum lead, e o caminho ficava morto
 * sem nenhum aviso.
 *
 * O ponto sozinho seguido de exatamente três dígitos é milhar ("1.200"), que é como se escreve
 * dinheiro aqui; nos outros casos ele é decimal ("1.5"), que é como se digita num campo de número.
 */
export function numeroDeTexto(valor: string | undefined): number | undefined {
  if (valor === undefined) return undefined;
  const limpo = valor.replace(/[^\d,.-]/g, "").trim();
  if (!limpo) return undefined;
  const temVirgula = limpo.includes(",");
  const normalizado = temVirgula
    ? limpo.replace(/\./g, "").replace(",", ".")
    : /\.\d{3}(\D|$)/.test(limpo)
      ? limpo.replace(/\./g, "")
      : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * ORDENAR DOIS VALORES que podem ser número, data, hora ou texto.
 *
 * Antes era `Number(a) > Number(b)` sempre. Data ("2026-11-05") e hora ("14:30") viram NaN ali, e
 * NaN não é maior nem menor que nada: "data da última conversa antes de 01/11" era falsa pra todo
 * mundo. Como data ISO e hora "HH:MM" se ordenam igual como texto, a comparação de texto resolve
 * as duas — e o número continua sendo comparado como número quando os dois lados são números.
 *
 * Devolve `undefined` quando um dos lados não existe: ausência não é maior nem menor, é ausência.
 */
function ordenar(a: string | undefined, b: string | undefined): number | undefined {
  if (a === undefined || a === "" || b === undefined || b === "") return undefined;
  const na = numeroDeTexto(a);
  const nb = numeroDeTexto(b);
  if (na !== undefined && nb !== undefined) return na - nb;
  const ta = textoComparavel(a);
  const tb = textoComparavel(b);
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

/**
 * O VALOR COM QUE A REGRA COMPARA, que nem sempre é o texto digitado.
 *
 * "manual" (o normal) é o texto como ele está. "vazio" compara com nada preenchido. Qualquer outra
 * fonte é um token de mensagem (`{primeiro_nome}`, `{etapa_funil}`) resolvido pro contato do
 * momento — é o que permite escrever "a última mensagem contém o nome do responsável" em vez de só
 * comparar com texto fixo.
 */
function alvoDaRegra(regra: GrupoCondicoes["regras"][number], contato: ContextoExecucao["contato"]): string | undefined {
  const fonte = regra.fonteValor;
  if (!fonte || fonte === "manual") return regra.valor;
  if (fonte === "vazio") return "";
  return preencher(fonte, contato as Record<string, unknown>);
}

/* -------------------------------------------------------------------------- */
/* Tipos de dado, operadores e tempo                                         */
/* -------------------------------------------------------------------------- */

/** O fuso em que "hoje" e "nos últimos 7 dias" são contados. O CRM é brasileiro. */
const FUSO = "America/Sao_Paulo";

/**
 * O DIA DE UMA DATA, EM SÃO PAULO, como "2026-11-10".
 *
 * Sem o fuso, "é hoje" às 22h de Brasília é amanhã pro servidor (que roda em UTC) e a regra
 * respondia falso pra uma conversa que acabou de acontecer. `en-CA` é o formato ISO já pronto, e
 * `Intl` faz a conversão de fuso sem biblioteca nenhuma.
 */
export function diaEmSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
}

/**
 * A data gravada num campo, como `Date`.
 *
 * Aceita o que o CRM guarda de verdade: ISO completo do banco, "2026-11-10" dos seletores, e
 * "10/11/2026" que veio de importação ou de campo digitado. Devolve `undefined` pro que não é
 * data — e aí a regra de data responde "não existe" em vez de comparar lixo.
 */
export function dataDoValor(valor: string | undefined): Date | undefined {
  if (!valor) return undefined;
  const texto = valor.trim();
  const brasileira = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (brasileira) {
    const d = new Date(`${brasileira[3]}-${brasileira[2]}-${brasileira[1]}T12:00:00`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  // Só data, sem hora: meio-dia evita que o fuso jogue o dia pro anterior.
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const d = new Date(`${texto}T12:00:00`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Quantos dias inteiros se passaram desde aquela data, contados no fuso de São Paulo. */
function diasDesde(valor: string | undefined, agora: Date): number | undefined {
  const data = dataDoValor(valor);
  if (!data) return undefined;
  const umDia = 86_400_000;
  const inicioDe = (d: Date) => new Date(`${diaEmSaoPaulo(d)}T00:00:00`).getTime();
  return Math.floor((inicioDe(agora) - inicioDe(data)) / umDia);
}

/**
 * O VALOR DE UM CAMPO BOOLEANO COMO SIM, NÃO OU NÃO SE SABE.
 *
 * Três respostas, não duas. "O Instagram não está conectado" e "a pessoa não te segue" levam o
 * lead por caminhos diferentes, e tratar ausência como falso mandaria todo mundo pelo mesmo.
 *
 * O texto é aceito porque é como o dado chega de colunas antigas e do simulador: "sim"/"não",
 * "true"/"false", "1"/"0".
 */
export function booleanoDoValor(bruto: unknown): boolean | undefined {
  if (typeof bruto === "boolean") return bruto;
  if (typeof bruto === "number") return bruto !== 0;
  if (typeof bruto !== "string") return undefined;
  const t = textoComparavel(bruto);
  if (!t) return undefined;
  if (["sim", "true", "1", "verdadeiro", "s", "y", "yes"].includes(t)) return true;
  if (["nao", "false", "0", "falso", "n", "no"].includes(t)) return false;
  return undefined;
}

/** O conjunto de um campo multi-valor (etiquetas): da lista real ou do texto grudado por vírgula. */
function conjuntoDoCampo(campo: string, contato: ContextoExecucao["contato"]): string[] | undefined {
  if (campo === "etiqueta") {
    const lista = contato.etiquetas;
    return Array.isArray(lista) ? lista.map((e) => textoComparavel(String(e))) : undefined;
  }
  const bruto = contato[campo];
  if (Array.isArray(bruto)) return bruto.map((e) => textoComparavel(String(e)));
  const texto = valorDoCampo(campo, contato);
  if (texto === undefined || texto === "") return undefined;
  return texto
    .split(",")
    .map((p) => textoComparavel(p))
    .filter(Boolean);
}

/** Os valores com que um operador de vários compara, já normalizados. */
function alvosDaRegra(regra: GrupoCondicoes["regras"][number]): string[] {
  const lista = regra.valores?.length ? regra.valores : regra.valor ? [regra.valor] : [];
  return lista.map((v) => textoComparavel(v)).filter(Boolean);
}

function avaliarRegra(
  regra: GrupoCondicoes["regras"][number],
  contato: ContextoExecucao["contato"],
  agora: Date,
): boolean {
  /*
   * CAMPO CRIADO PELA EMPRESA: `cp:<id>`. O valor mora em `camposExtras` (o JSON do contato, com o
   * id do campo como chave) ou em `camposPersonalizados`, que é como o simulador monta o contato.
   */
  const valorCampo = ehCampoPersonalizado(regra.campo)
    ? valorDoCampoPersonalizado(idDoCampoPersonalizado(regra.campo), contato)
    : regra.campo === "campo_personalizado"
      ? valorDoCampoPersonalizado(regra.campoPersonalizadoNome ?? "", contato)
      : valorDoCampo(regra.campo, contato);

  // "Cliente é um seguidor no Instagram" é a única regra cuja resposta depende da OPÇÃO escolhida,
  // e não do valor de uma coluna só: cada opção lê uma coluna diferente. Continua aqui porque há
  // fluxos publicados com ela; o grupo "Instagram" da lista de campos faz a mesma pergunta melhor.
  if (regra.campo === "cliente_perfil") {
    const resposta = perfilDoInstagram(regra.valor, contato);
    if (resposta === undefined) return regra.operador === "nao_existe";
    if (regra.operador === "existe") return true;
    if (regra.operador === "nao_existe") return false;
    if (regra.operador === "verdadeiro") return resposta;
    if (regra.operador === "falso") return !resposta;
    return regra.operador === "diferente" ? !resposta : resposta;
  }

  /*
   * O CONJUNTO VEM ANTES DO TEXTO, pros operadores que perguntam por pertencimento.
   *
   * "tem a etiqueta cliente" lido como texto comparava "cliente" com "vip,cliente,quente" grudado
   * por vírgula — e só batia em quem tivesse exatamente uma etiqueta. É o tipo de defeito que
   * passa despercebido porque a regra funciona nos testes feitos com um contato de uma etiqueta só.
   */
  if (["tem", "nao_tem", "tem_qualquer", "tem_todas", "nao_tem_nenhuma"].includes(regra.operador)) {
    const conjunto = conjuntoDoCampo(regra.campo, contato) ?? [];
    const alvos = alvosDaRegra(regra);
    switch (regra.operador) {
      case "tem":
        return alvos.length > 0 && alvos.every((a) => conjunto.includes(a));
      case "nao_tem":
        return alvos.length > 0 && !alvos.some((a) => conjunto.includes(a));
      case "tem_qualquer":
        return alvos.some((a) => conjunto.includes(a));
      case "tem_todas":
        return alvos.length > 0 && alvos.every((a) => conjunto.includes(a));
      default:
        return !alvos.some((a) => conjunto.includes(a));
    }
  }

  // Comparar com VÁRIAS opções de uma lista. Vazio não é "qualquer um": é regra pela metade, e
  // responder verdadeiro ali mandaria todo mundo pelo caminho.
  if (regra.operador === "um_destes" || regra.operador === "nenhum_destes") {
    const alvos = alvosDaRegra(regra);
    const campoTexto = textoComparavel(valorCampo);
    if (!alvos.length) return false;
    const achou = alvos.includes(campoTexto);
    return regra.operador === "um_destes" ? achou : !achou;
  }

  // O booleano responde com o que ele é, e "não se sabe" não é nem um nem outro.
  if (regra.operador === "verdadeiro" || regra.operador === "falso") {
    const bruto = booleanoDoValor(contato[regra.campo] ?? valorCampo);
    if (bruto === undefined) return false;
    return regra.operador === "verdadeiro" ? bruto : !bruto;
  }

  // Perguntas de calendário, contadas no fuso de São Paulo.
  if (regra.operador === "e_hoje") {
    const data = dataDoValor(valorCampo);
    return data !== undefined && diaEmSaoPaulo(data) === diaEmSaoPaulo(agora);
  }
  if (regra.operador === "ultimos_dias" || regra.operador === "ha_mais_de_dias") {
    const dias = diasDesde(valorCampo, agora);
    const limite = numeroDeTexto(regra.valor);
    if (dias === undefined || limite === undefined) return false;
    return regra.operador === "ultimos_dias" ? dias <= limite : dias > limite;
  }

  const alvoBruto = alvoDaRegra(regra, contato);
  const campo = textoComparavel(valorCampo);
  const alvo = textoComparavel(alvoBruto);

  switch (regra.operador) {
    case "existe":
      return valorCampo !== undefined && valorCampo !== "";
    case "nao_existe":
      return valorCampo === undefined || valorCampo === "";
    case "igual":
      return campo === alvo;
    case "diferente":
      return campo !== alvo;
    case "contem":
      return campo.includes(alvo);
    case "nao_contem":
      return !campo.includes(alvo);
    /*
     * "COMEÇA COM" E "TERMINA COM" NÃO EXISTIAM AQUI.
     *
     * Os dois estão na lista de operadores do formulário desde sempre, e caíam no `default`, que
     * devolve `true`. Ou seja: a regra passava SEMPRE, para qualquer valor — um caminho que parece
     * configurado e aceita todo mundo. É o pior tipo de defeito numa condição, porque o fluxo roda
     * e ninguém vê erro nenhum.
     */
    case "comeca_com":
      return campo.startsWith(alvo);
    case "termina_com":
      return campo.endsWith(alvo);
    case "maior_que": {
      const d = ordenar(valorCampo, alvoBruto);
      return d !== undefined && d > 0;
    }
    case "maior_igual": {
      const d = ordenar(valorCampo, alvoBruto);
      return d !== undefined && d >= 0;
    }
    case "menor_que": {
      const d = ordenar(valorCampo, alvoBruto);
      return d !== undefined && d < 0;
    }
    case "menor_igual": {
      const d = ordenar(valorCampo, alvoBruto);
      return d !== undefined && d <= 0;
    }
    case "entre": {
      const deBaixo = ordenar(valorCampo, alvoBruto);
      const deCima = ordenar(valorCampo, regra.valorFim);
      return deBaixo !== undefined && deCima !== undefined && deBaixo >= 0 && deCima <= 0;
    }
    /*
     * OPERADOR DESCONHECIDO É FALSO, não verdadeiro.
     *
     * Era `true`, e isso fazia uma regra que o motor não entende aceitar TODO MUNDO — o caminho
     * parecia configurado e pegava todos os leads. Falso deixa o lead seguir pro próximo caminho
     * ou pro "Nenhuma das condições", que é o desvio que existe justamente pra isso.
     */
    default:
      return false;
  }
}

/** O valor de um campo criado pela empresa, venha ele do banco (`camposExtras`) ou do simulador. */
function valorDoCampoPersonalizado(chave: string, contato: ContextoExecucao["contato"]): string | undefined {
  if (!chave) return undefined;
  const doSimulador = contato.camposPersonalizados?.[chave];
  if (typeof doSimulador === "string") return doSimulador;
  const extras = contato.camposExtras;
  if (extras && typeof extras === "object") {
    const v = (extras as Record<string, unknown>)[chave];
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

/**
 * O GRUPO INTEIRO: "E" quer todas verdadeiras, "OU" quer uma.
 *
 * `agora` entra por fora pra as perguntas de calendário ("é hoje", "nos últimos 7 dias") serem
 * testáveis e pro simulador poder adiantar o relógio. Sem ele, a mesma condição responderia
 * diferente conforme a hora em que o teste roda.
 *
 * GRUPO VAZIO É VERDADEIRO no "E" e FALSO no "OU", que é como a lógica funciona em qualquer
 * lugar — e é por isso que a validação cobra uma regra em toda condição: um "E" vazio pega todo
 * mundo e apaga os caminhos de baixo.
 */
export function avaliarGrupoCondicoes(
  grupo: GrupoCondicoes,
  contato: ContextoExecucao["contato"],
  agora: Date = new Date(),
): boolean {
  const resultadosRegras = grupo.regras.map((r) => avaliarRegra(r, contato, agora));
  const resultadosSubgrupos = grupo.subgrupos.map((g) => avaliarGrupoCondicoes(g, contato, agora));
  const todos = [...resultadosRegras, ...resultadosSubgrupos];

  if (grupo.tipo === "E") return todos.every(Boolean);
  if (grupo.tipo === "OU") return todos.some(Boolean);
  // "NAO" nega o resultado combinado (tratado aqui como E dos itens, negado).
  return !todos.every(Boolean);
}

/* -------------------------------------------------------------------------- */
/* avaliarGatilho                                                            */
/* -------------------------------------------------------------------------- */

function dentroDaJanela(fluxo: FluxoAutomacao, agora: Date): boolean {
  // `?? {}` e não `fluxo.configuracoes` direto: o tipo diz que o campo existe sempre, mas o que
  // chega aqui vem do banco por um cast, e um fluxo gravado antes desta coluna traz nulo. Sem isto
  // a leitura estoura e derruba a avaliação de TODOS os fluxos daquele disparo, não só o quebrado.
  const cfg = fluxo.configuracoes ?? ({} as typeof fluxo.configuracoes);
  if (cfg.diasAtivos && cfg.diasAtivos.length > 0) {
    const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
    const diaAtual = dias[agora.getDay()];
    if (!cfg.diasAtivos.includes(diaAtual)) return cfg.foraDaJanela === "aguardar";
  }
  if (cfg.usarHorario && cfg.horarioInicio && cfg.horarioFim) {
    const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    if (hhmm < cfg.horarioInicio || hhmm > cfg.horarioFim) {
      return cfg.foraDaJanela === "aguardar";
    }
  }
  return true;
}

export type EventoAutomacao = {
  tipo: FlowNodeType;
  funilId?: string;
  etapaId?: string;
  contatoNome?: string;
  [k: string]: unknown;
};

/** Tira acentos e caixa, pra "GUIA", "guia" e "guía" contarem como a mesma palavra. */
function normalizar(texto: string, ignorarAcentos: boolean): string {
  const minusculo = texto.toLowerCase().trim();
  return ignorarAcentos ? minusculo.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : minusculo;
}

export type ConfiguracaoDePalavras = {
  /** Lista configurada. `palavraChave` (campo antigo, uma só) continua valendo. */
  palavras?: string[];
  palavraChave?: string;
  /**
   * Como a palavra tem que aparecer na mensagem:
   *
   * - `qualquer`: qualquer uma das palavras, como PALAVRA INTEIRA.
   * - `exata`: a mensagem é exatamente aquilo, e nada mais.
   * - `contem` (padrão): a palavra aparece em qualquer lugar, mesmo colada em outra.
   * - `comeco`: a mensagem COMEÇA pela palavra.
   *
   * `comeco` nasceu do jeito como as pessoas respondem a um story ou a um post: "quero sim, me
   * manda", "link por favor". A intenção está na primeira palavra, e o resto é conversa. Com
   * `exata` isso não dispara, e com `contem` dispara também em "não quero" — que é o contrário.
   */
  modoPalavra?: "contem" | "exata" | "qualquer" | "comeco";
  /**
   * Acento conta? Padrão: não.
   *
   * MAIÚSCULA NUNCA CONTA, e não tem opção: a comparação sempre baixa os dois lados pra
   * minúscula. "ASOS", "Asos" e "asos" são a mesma palavra pra quem escreveu e pra quem montou a
   * automação; oferecer um botão pra diferenciá-las seria oferecer um jeito de a automação falhar
   * sem a pessoa entender por quê.
   */
  ignorarAcentos?: boolean;
};

/**
 * Se o texto recebido casa com as palavras configuradas no gatilho.
 *
 * Sem palavra configurada, casa com tudo: é o comportamento de "qualquer comentário dispara", que
 * é o que a pessoa espera ao deixar o campo vazio.
 *
 * "qualquer" compara PALAVRA INTEIRA de propósito: com "contém", uma automação de "quero" também
 * dispararia em "não quero", que é o oposto da intenção de quem montou o fluxo.
 */
export function textoCasaComPalavras(texto: string, config: ConfiguracaoDePalavras): boolean {
  const lista = (config.palavras ?? [])
    .concat(config.palavraChave ? [config.palavraChave] : [])
    .map((p) => p.trim())
    .filter(Boolean);
  if (!lista.length) return true;

  const ignorarAcentos = config.ignorarAcentos ?? true;
  const alvo = normalizar(texto, ignorarAcentos);
  const modo = config.modoPalavra ?? "contem";

  return lista.some((palavra) => {
    const p = normalizar(palavra, ignorarAcentos);
    if (!p) return false;
    if (modo === "exata") return alvo === p;
    /*
     * COMEÇA PELA PALAVRA, e a fronteira é conferida igual ao `qualquer`.
     *
     * Sem conferir o que vem depois, "quero" dispararia em "querosene". Com `\b` seria mais
     * curto, mas `\b` não enxerga acento em JavaScript, e metade das palavras daqui tem.
     */
    if (modo === "comeco") {
      if (!alvo.startsWith(p)) return false;
      const depois = alvo[p.length];
      return !(depois && /[\p{L}\p{N}]/u.test(depois));
    }
    if (modo === "qualquer") {
      // `\b` não funciona com acentos em JS; a fronteira é conferida na mão pelo que cerca a
      // ocorrência: só conta se não houver letra ou número colado dos dois lados.
      const posicao = alvo.indexOf(p);
      if (posicao < 0) return false;
      const antes = alvo[posicao - 1];
      const depois = alvo[posicao + p.length];
      const ehLetra = (c?: string) => Boolean(c && /[\p{L}\p{N}]/u.test(c));
      return !ehLetra(antes) && !ehLetra(depois);
    }
    return alvo.includes(p);
  });
}

/**
 * O evento aciona ESTE fluxo?
 *
 * Com vários blocos de gatilho, basta UM deles aceitar: a automação responde a comentário E a
 * resposta de story, e quem chega por qualquer um dos dois entra no mesmo primeiro passo.
 *
 * Quem precisa saber POR QUAL deles o evento entrou (o disparo, pra achar a aresta certa) usa
 * `avaliarNoDeGatilho` direto, com o bloco em mãos.
 */
export function avaliarGatilho(fluxo: FluxoAutomacao, evento: EventoAutomacao): boolean {
  return nosDeGatilho(fluxo.nodes).some((no) => avaliarNoDeGatilho(fluxo, no, evento));
}

/** O mesmo teste, para UM bloco de gatilho escolhido. */
export function avaliarNoDeGatilho(
  fluxo: FluxoAutomacao,
  noGatilho: FlowNode,
  evento: EventoAutomacao,
): boolean {
  if (noGatilho.category !== "gatilho") return false;
  if (!tipoDoGatilhoQueCasa(evento.tipo, noGatilho.type)) return false;

  const data = noGatilho.data as {
    funilId?: string;
    etapaId?: string;
    publicacaoId?: string;
    publicacaoIds?: string[];
    escopoPublicacao?: "especifico" | "qualquer" | "proxima";
    publicacoesConhecidas?: string[];
    storyId?: string;
    storyIds?: string[];
    escopoStory?: "especifico" | "qualquer" | "proxima";
  } & ConfiguracaoDePalavras;
  if (data.funilId && evento.funilId && data.funilId !== evento.funilId) return false;
  if (data.etapaId && evento.etapaId && data.etapaId !== evento.etapaId) return false;

  /*
   * EM QUAIS PUBLICAÇÕES A AUTOMAÇÃO VALE.
   *
   * Eram uma só (`publicacaoId`) ou todas. A tela passou a deixar escolher VÁRIAS, como a
   * referência mostra — uma campanha costuma ter três posts, e antes isso eram três automações
   * iguais. O campo antigo continua valendo sozinho: fluxo gravado com ele não precisa de
   * migração nenhuma.
   *
   * `evento.publicacaoId` ausente NÃO descarta, pelo mesmo motivo que já valia pro story: quando
   * o id vem ele decide, quando não vem a automação roda.
   */
  const idsDePublicacao = data.publicacaoIds?.length
    ? data.publicacaoIds
    : data.publicacaoId
      ? [data.publicacaoId]
      : [];
  const escopoPublicacao = data.escopoPublicacao ?? (idsDePublicacao.length ? "especifico" : "qualquer");
  // `EventoAutomacao` tem índice livre (`[k: string]: unknown`): o id só conta quando é texto.
  const publicacaoDoEvento = typeof evento.publicacaoId === "string" ? evento.publicacaoId : null;
  const storyDoEvento = typeof evento.storyId === "string" ? evento.storyId : null;
  if (escopoPublicacao === "especifico" && idsDePublicacao.length && publicacaoDoEvento) {
    if (!idsDePublicacao.includes(publicacaoDoEvento)) return false;
  }
  /*
   * "MEU PRÓXIMO POST": vale pro que for publicado DEPOIS da escolha.
   *
   * A tela guarda os ids que existiam naquele momento, e aqui a pergunta é só "esta publicação
   * estava na lista?". Guardar a data não resolveria: o evento de comentário traz o id da
   * publicação, não a data dela, e descobrir a data exigiria uma chamada à Graph por comentário
   * recebido — dentro do caminho que precisa responder rápido.
   *
   * O limite honesto: a lista guardada é a das publicações recentes que a Meta devolveu. Um
   * comentário numa publicação muito antiga, fora dessa lista, também é tratado como nova.
   */
  if (escopoPublicacao === "proxima" && publicacaoDoEvento) {
    if ((data.publicacoesConhecidas ?? []).includes(publicacaoDoEvento)) return false;
  }

  // Mesma ideia pro story: a automação pode valer só pros stories escolhidos. Vazio = qualquer
  // story, de qualquer dia, que é o padrão e continua sendo o comportamento de quem nunca abriu o
  // campo.
  const idsDeStory = data.storyIds?.length ? data.storyIds : data.storyId ? [data.storyId] : [];
  if (idsDeStory.length && storyDoEvento && !idsDeStory.includes(storyDoEvento)) return false;

  // Palavra configurada no gatilho: comentário ou mensagem só dispara se casar.
  const textoDoEvento = typeof evento.mensagem === "string" ? evento.mensagem : undefined;
  if (textoDoEvento !== undefined && !textoCasaComPalavras(textoDoEvento, data)) return false;

  const agora = new Date();
  if (!dentroDaJanela(fluxo, agora)) return false;

  // Se o nó logo depois do gatilho for uma condição, ela também precisa bater
  //. Best-effort, porque aqui a gente ainda não tem o contato completo (só o evento).
  const primeiraAresta = saidasDoNo(fluxo.edges, noGatilho.id)[0];
  if (primeiraAresta) {
    const proximoNo = fluxo.nodes.find((n) => n.id === primeiraAresta.target);
    if (proximoNo?.type === "condicao_grupo") {
      const condicaoData = proximoNo.data as CondicaoGrupoData;
      const contatoParcial = { nome: evento.contatoNome ?? "", etiquetas: [] as string[], ...evento };
      if (!avaliarGrupoCondicoes(condicaoData.grupo, contatoParcial)) return false;
    }
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* executarFluxo                                                             */
/* -------------------------------------------------------------------------- */


