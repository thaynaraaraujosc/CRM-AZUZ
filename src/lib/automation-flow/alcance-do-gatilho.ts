import type { FlowNodeType } from "./types";

/**
 * ONDE AQUELE GATILHO VALE: em quais publicações, em quais stories.
 *
 * "Quando eu clico nos gatilhos ativos, seria interessante se eu pudesse ver COMO que foi que eu
 * escolhi. Resposta nos stories: se eu escolhi que é em todos os stories, se não é — e aí a opção
 * de mudar."
 *
 * O alcance estava gravado e invisível. Dava pra escolher (numa etapa da montagem, ou pelo "⋯" do
 * painel), e depois não dava pra LER: o painel mostrava o nome do gatilho e a resposta automática,
 * e mais nada. Quem montou na semana passada não tinha como saber se aquele robô valia pro feed
 * inteiro ou pra um post só, a não ser abrindo a etapa e olhando o que estava marcado.
 *
 * ESTE ARQUIVO É A LEITURA E A ESCRITA DESSE DADO, num lugar só. Por que ele precisa existir: cada
 * gatilho guarda o alcance com NOMES DE CAMPO DIFERENTES — publicação usa
 * `publicacaoIds`/`escopoPublicacao`/`publicacoesConhecidas`, story usa `storyIds`/`escopoStory` —
 * e cada um ainda carrega o campo antigo de um item só (`publicacaoId`, `storyId`) que fluxo
 * publicado continua usando. Isso estava escrito à mão em cada tela que tocava no assunto, com uma
 * diferença em cada cópia: foi assim que `escopoStory` passou a ser GRAVADO pela tela e IGNORADO
 * pela avaliação — escolher "Qualquer story" continuava filtrando pelos stories antigos.
 *
 * Aqui é puro de propósito: não lê Instagram, não conhece React. Recebe o que está gravado e
 * devolve o que isso quer dizer.
 */

/** Onde a automação vale. `qualquer` é o padrão; `proxima` só existe pra publicação. */
export type EscopoDeAlcance = "especifico" | "qualquer" | "proxima";

export type AlcanceDoGatilho = {
  escopo: EscopoDeAlcance;
  /** Os ids escolhidos. Só decidem alguma coisa quando o escopo é `especifico`. */
  ids: string[];
  /** Os ids que existiam quando "Meu próximo post" foi escolhido. Só na publicação. */
  conhecidos: string[];
};

/** Os nomes de campo que aquele gatilho usa pra guardar o alcance. */
type Chaves = {
  ids: string;
  /** O campo antigo, de um item só. Fluxo publicado com ele não é migrado: continua valendo. */
  idAntigo: string;
  escopo: string;
  conhecidos?: string;
  /** "Meu próximo post" existe? Story não tem: story some em 24 horas. */
  temProxima: boolean;
  /** Como a tela chama a coisa, no singular e no plural. */
  singular: string;
  plural: string;
};

const CHAVES: Partial<Record<FlowNodeType, Chaves>> = {
  comentario_instagram: {
    ids: "publicacaoIds",
    idAntigo: "publicacaoId",
    escopo: "escopoPublicacao",
    conhecidos: "publicacoesConhecidas",
    temProxima: true,
    singular: "publicação",
    plural: "publicações",
  },
  instagram_story_respondido: {
    ids: "storyIds",
    idAntigo: "storyId",
    escopo: "escopoStory",
    temProxima: false,
    singular: "story",
    plural: "stories",
  },
};

/** Este gatilho tem uma pergunta de alcance? Direct recebido, por exemplo, não tem. */
export function gatilhoTemAlcance(tipo: FlowNodeType | undefined): boolean {
  return !!tipo && !!CHAVES[tipo];
}

function listaDeTexto(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string" && !!v) : [];
}

/**
 * O QUE ESTÁ GRAVADO, normalizado.
 *
 * O escopo ausente não é "qualquer" por decreto: ele é `especifico` QUANDO HÁ IDS escolhidos. É o
 * que mantém um fluxo publicado antes de o escopo existir funcionando igualzinho — ele tem ids e
 * não tem escopo, e sempre valeu só pras publicações daquela lista.
 */
export function lerAlcance(tipo: FlowNodeType | undefined, data: unknown): AlcanceDoGatilho | null {
  const chaves = tipo ? CHAVES[tipo] : undefined;
  if (!chaves) return null;
  const d = (data ?? {}) as Record<string, unknown>;

  const dosVarios = listaDeTexto(d[chaves.ids]);
  const antigo = typeof d[chaves.idAntigo] === "string" ? (d[chaves.idAntigo] as string) : "";
  const ids = dosVarios.length ? dosVarios : antigo ? [antigo] : [];

  const bruto = d[chaves.escopo];
  const escopo: EscopoDeAlcance =
    bruto === "especifico" || bruto === "qualquer" || (bruto === "proxima" && chaves.temProxima)
      ? bruto
      : ids.length
        ? "especifico"
        : "qualquer";

  return {
    escopo,
    ids,
    conhecidos: chaves.conhecidos ? listaDeTexto(d[chaves.conhecidos]) : [],
  };
}

/**
 * O QUE GRAVAR quando a pessoa troca a escolha.
 *
 * Devolve o bloco de campos daquele gatilho, pra quem chama mesclar no `data`. O campo antigo é
 * ZERADO de propósito: deixá-lo pra trás faria a avaliação continuar lendo uma publicação que a
 * tela já esqueceu — o dado velho ganharia do novo em silêncio.
 */
export function gravarAlcance(
  tipo: FlowNodeType | undefined,
  alcance: { escopo?: EscopoDeAlcance; ids?: string[]; conhecidos?: string[] },
): Record<string, unknown> {
  const chaves = tipo ? CHAVES[tipo] : undefined;
  if (!chaves) return {};
  const patch: Record<string, unknown> = {
    [chaves.ids]: alcance.ids ?? [],
    [chaves.escopo]: alcance.escopo,
    [chaves.idAntigo]: "",
  };
  if (chaves.conhecidos && alcance.conhecidos) patch[chaves.conhecidos] = alcance.conhecidos;
  return patch;
}

/**
 * A ESCOLHA EM UMA LINHA, pra ler sem abrir nada.
 *
 * É o texto que o painel mostra embaixo do nome do gatilho. Diz o estado, não o caminho pra
 * mudá-lo: "Qualquer publicação", "3 publicações escolhidas", "Meu próximo post".
 *
 * O caso de "especifico sem nenhum id escolhido" merece frase própria. Ele é um estado possível
 * (a pessoa marcou "Post específico" e fechou sem escolher) e é o mais perigoso dos três, porque a
 * automação roda pra TUDO enquanto parece restrita.
 */
export function resumoDoAlcance(tipo: FlowNodeType | undefined, data: unknown): string | null {
  const chaves = tipo ? CHAVES[tipo] : undefined;
  const alcance = lerAlcance(tipo, data);
  if (!chaves || !alcance) return null;

  if (alcance.escopo === "proxima") return "Só na próxima publicação";
  if (alcance.escopo === "qualquer") {
    return chaves.temProxima ? "Qualquer publicação" : "Qualquer story";
  }
  if (!alcance.ids.length) {
    return chaves.temProxima
      ? "Nenhuma publicação escolhida ainda — vale pra todas"
      : "Nenhum story escolhido ainda — vale pra todos";
  }
  const n = alcance.ids.length;
  const coisa = n === 1 ? chaves.singular : chaves.plural;
  const escolhidas = chaves.temProxima ? (n === 1 ? "escolhida" : "escolhidas") : n === 1 ? "escolhido" : "escolhidos";
  return `${n} ${coisa} ${escolhidas}`;
}

/**
 * AS OPÇÕES DE ALCANCE DAQUELE GATILHO, pro seletor da linha "Onde vale".
 *
 * "Ali tem que ser um botão de seleção: quando eu clico em cima, vai aparecer as opções, embaixo
 * eu vou selecionar." Antes a linha era texto com um "Trocar" ao lado, e o "Trocar" abria três
 * cartões de rádio com a grade de miniaturas dentro de um deles — dois jeitos de responder a mesma
 * pergunta, um dentro do outro.
 *
 * "Meu próximo post" não aparece pro story de propósito: story some em 24 horas, e "o próximo"
 * seria uma promessa que o dado não cumpre.
 */
export function opcoesDeAlcance(
  tipo: FlowNodeType | undefined,
): { valor: EscopoDeAlcance; label: string }[] {
  const chaves = tipo ? CHAVES[tipo] : undefined;
  if (!chaves) return [];
  if (chaves.temProxima) {
    return [
      { valor: "qualquer", label: "Qualquer publicação" },
      { valor: "especifico", label: "Publicação específica" },
      { valor: "proxima", label: "Só na próxima publicação" },
    ];
  }
  return [
    { valor: "qualquer", label: "Qualquer story" },
    { valor: "especifico", label: "Story específico" },
  ];
}
