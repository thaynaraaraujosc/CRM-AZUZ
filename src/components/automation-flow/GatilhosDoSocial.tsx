"use client";

import { useCallback, useEffect, useState } from "react";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import {
  gatilhoTemAlcance,
  gravarAlcance,
  lerAlcance,
  opcoesDeAlcance,
  resumoDoAlcance,
  type EscopoDeAlcance,
} from "@/lib/automation-flow/alcance-do-gatilho";
import { EscolhaDeMidia, type ItemDeMidia } from "./forms/EscolhaDeMidia";
import { IconChave, IconCheck, IconClose, IconSetaBaixo } from "@/components/icons";
import type { FlowNodeType } from "@/lib/automation-flow/types";
import { useFecharMenuDeLinha } from "@/lib/menu-de-linha";
import { useIdioma } from "@/lib/idioma-context";

/**
 * A GAVETA DE GATILHOS DO SOCIAL SELLER: escolher vários, e configurar um por vez.
 *
 * VÁRIOS GATILHOS NA MESMA AUTOMAÇÃO. Antes era um só, e as linhas eram `radio` por isso: o motor
 * guardava um bloco de gatilho por fluxo. Quem queria responder a comentário E a resposta de story
 * montava a mesma automação duas vezes, com os mesmos passos copiados — e na segunda vez esquecia
 * de corrigir junto. O motor passou a aceitar vários blocos (ver `gatilhos-do-fluxo.ts`), e aqui
 * as linhas viraram caixas de marcar.
 *
 * DEPOIS DA ESCOLHA, UMA ETAPA POR PERGUNTA. Marcar "comentário" e "resposta de story" deixa duas
 * perguntas em aberto — em quais publicações, em quais stories — e cada gatilho tem as suas. Numa
 * tela só, isso seria uma pilha de formulários condicionais; em etapas, cada pergunta aparece
 * sozinha, com a barra dizendo quanto falta. As palavras-chave vêm primeiro porque valem pra
 * todos.
 *
 * O número de etapas é a conta do que foi marcado, não um número fixo: com um gatilho que não
 * filtra nada, a gaveta fecha logo depois das palavras.
 */

/** Os cinco que a referência mostra primeiro, nesta ordem. O resto vai pra "Opções avançadas". */
const PRINCIPAIS: FlowNodeType[] = [
  "comentario_instagram",
  "instagram_story_respondido",
  "instagram_direct_recebido",
  "instagram_comentario_live",
  "instagram_mencao_story",
];

/**
 * A explicação de cada gatilho em uma frase: o que a pessoa faz e o que a automação faz em
 * seguida. É o conteúdo do "Como funciona cada gatilho?".
 */
const COMO_FUNCIONA: Partial<Record<FlowNodeType, string>> = {
  comentario_instagram: "Comentam no seu post ou Reels → a automação chama a pessoa no Direct.",
  instagram_story_respondido: "Respondem a um story seu → a automação continua a conversa no Direct.",
  instagram_direct_recebido: "Te mandam mensagem no Direct → a automação responde na hora.",
  instagram_mencao_story: "Marcam você em um story → a automação responde no Direct.",
  instagram_comentario_live:
    "Comentam durante a sua live → a automação chama a pessoa no Direct, e a conversa continua depois que a live acaba.",
  instagram_midia_recebida: "Mandam foto, vídeo ou áudio no Direct → a automação responde na hora.",
  instagram_publicacao_compartilhada: "Encaminham uma publicação pra você no Direct → a automação responde.",
  instagram_reacao_recebida: "Reagem com emoji a uma mensagem sua → a automação segue dali.",
  instagram_resposta_comentario: "Respondem a um comentário na sua publicação → a automação entra na conversa.",
};

/**
 * Quais gatilhos têm uma pergunta de alcance ("em quais publicações?", "em quais stories?").
 *
 * Só estes ganham etapa própria. Um gatilho de Direct recebido não escolhe nada: criar uma etapa
 * pra ele seria uma tela em branco com um botão "Continuar".
 */
const ALCANCE: Partial<Record<FlowNodeType, { titulo: string; pergunta: string }>> = {
  comentario_instagram: {
    // As palavras são as da referência, e isso importa mais do que parece: a tela anterior chama
    // o gatilho de "Comentário no Feed ou Reels" e a pergunta falava em "publicações". Duas
    // palavras pra mesma coisa, em telas seguidas, fazem a pessoa procurar a diferença.
    titulo: "Comentário em Posts ou Reels",
    pergunta: "Em quais Posts ou Reels a automação deve funcionar?",
  },
  instagram_story_respondido: {
    titulo: "Resposta nos stories",
    pergunta: "Em quais stories a automação deve funcionar?",
  },
};

export type EscolhaDeGatilho = { tipo: FlowNodeType; data: Record<string, unknown> };

/**
 * A PERGUNTA DA ÚLTIMA ETAPA, pelo gatilho que manda.
 *
 * "Responda quem comentar no seu feed" e "Responda quem responder seu story" são pessoas em
 * momentos diferentes, e a frase que se escreve pra uma não serve pra outra. Com vários gatilhos
 * marcados, vale o primeiro da lista — que é a ordem em que eles aparecem na tela anterior.
 */
function perguntaDaResposta(marcados: FlowNodeType[]): string {
  const porGatilho: Partial<Record<FlowNodeType, string>> = {
    comentario_instagram: "Responda quem comentar no seu feed",
    instagram_comentario_live: "Responda quem comentar na sua live",
    instagram_story_respondido: "Responda quem responder seu story",
    instagram_mencao_story: "Responda quem mencionar você num story",
    instagram_direct_recebido: "Responda quem mandar mensagem no Direct",
  };
  for (const tipo of marcados) {
    const frase = porGatilho[tipo];
    if (frase) return frase;
  }
  return "O que o robô responde";
}

type ModoDePalavra = "qualquer" | "exata" | "contem" | "comeco";

/**
 * COMO A PALAVRA TEM QUE APARECER NA MENSAGEM.
 *
 * A gaveta só deixava escrever as palavras, e a comparação ficava no padrão sem ninguém saber
 * qual era. Com isso, "quero" disparava em "não quero" — e quem montou o robô só descobria pelo
 * lead que recebeu a mensagem errada.
 *
 * SÃO AS QUATRO DA REFERÊNCIA, com as palavras dela. A primeira versão disto mostrou quatro
 * cartões empilhados com um exemplo cada; a segunda reduziu pra duas opções. "Pronto, eu quero
 * exatamente como está aí": uma caixa fechada, quatro linhas, o texto da referência.
 *
 * A PRIMEIRA NÃO É UM MODO DE COMPARAÇÃO, é a ausência dela. "Qualquer palavra-chave" quer dizer
 * que nenhuma palavra filtra nada — qualquer comentário, resposta ou mensagem dispara. No motor
 * isso é a lista de palavras VAZIA, que é como ele sempre tratou o campo em branco; por isso
 * escolher essa opção limpa as palavras e esconde o campo de digitar, em vez de guardar um modo
 * que não existe.
 */
const MODOS_DE_PALAVRA: { valor: ModoDePalavra; label: string }[] = [
  { valor: "exata", label: "Palavra ou frase exata" },
  { valor: "contem", label: "A mensagem contém a palavra" },
  { valor: "comeco", label: "A palavra aparece no começo" },
];

/** O rótulo da opção "sem filtro nenhum". Não é um `modoPalavra`: é a lista de palavras vazia. */
const SEM_PALAVRA = "Qualquer palavra-chave";

/**
 * O modo gravado, como a caixa o escreve.
 *
 * `qualquer` (palavra inteira) é o padrão dos blocos e não está entre as quatro da referência: a
 * diferença dele pro `contem` aparece só em caso como "quero" dentro de "querosene". Ele aparece
 * como "A mensagem contém a palavra", que é a opção vizinha, e continua valendo como está gravado
 * até alguém escolher outra coisa — escolher grava o modo exato da opção escolhida.
 */
function modoNaTela(modo: ModoDePalavra): ModoDePalavra {
  return modo === "exata" || modo === "comeco" ? modo : "contem";
}

export function GatilhosDoSocial({
  gatilhosAtuais,
  respostasIniciais,
  etapaInicial = "lista",
  onEscolher,
  onFechar,
}: {
  /** Os gatilhos que o fluxo já tem, com a configuração de cada um. */
  gatilhosAtuais?: EscolhaDeGatilho[];
  /**
   * O QUE O FLUXO JÁ RESPONDE, GATILHO POR GATILHO.
   *
   * Era uma lista só, a do primeiro passo, porque os gatilhos todos desembocavam nele. Agora cada
   * um tem o seu caminho, e a gaveta reabre com o texto de cada um na linha dele — em vez de
   * mostrar a resposta do comentário embaixo do story.
   */
  respostasIniciais?: Partial<Record<FlowNodeType, string[]>>;
  /**
   * Onde a gaveta abre.
   *
   * O cartão do canvas tem duas linhas — "Gatilhos ativos" e "Palavras-chave" — e cada uma leva
   * ao seu assunto. Abrir sempre na lista obrigaria a passar pela escolha de gatilhos pra chegar
   * numa palavra, que é o caminho que a linha existe pra encurtar.
   */
  etapaInicial?: "lista" | "palavras" | "painel" | "adicionar";
  /**
   * As escolhas e, quando a última etapa foi preenchida, o que responder — UMA RESPOSTA POR
   * GATILHO.
   *
   * "A resposta não tem como ir para todos os lugares": quem comentou no feed e quem respondeu um
   * story estão em momentos diferentes. Gatilho ausente do objeto quer dizer "não mexa na resposta
   * dele" — é o que o botão "Pular" manda, e é o que protege quem já montou o fluxo à mão de ter a
   * mensagem trocada por ter passado pela gaveta.
   */
  onEscolher: (
    escolhas: EscolhaDeGatilho[],
    respostas: Partial<Record<FlowNodeType, string[]>>,
  ) => void;
  onFechar: () => void;
}) {
  const { t: traduzir } = useIdioma();
  const [marcados, setMarcados] = useState<FlowNodeType[]>(
    () => gatilhosAtuais?.map((g) => g.tipo) ?? [],
  );
  const [dados, setDados] = useState<Partial<Record<FlowNodeType, Record<string, unknown>>>>(() => {
    const inicial: Partial<Record<FlowNodeType, Record<string, unknown>>> = {};
    gatilhosAtuais?.forEach((g) => {
      inicial[g.tipo] = { ...g.data };
    });
    return inicial;
  });
  /*
   * ONDE A GAVETA ESTÁ: `-2` é o PAINEL, `-1` é a lista de gatilhos, 0 em diante são as etapas.
   *
   * O painel e as etapas respondem a perguntas diferentes. As etapas são pra MONTAR — uma
   * pergunta por vez, com barra de progresso, até o robô existir. O painel é pra MEXER no que já
   * existe: mostra o que está escolhido e deixa trocar sem passar por nada que já foi respondido.
   * "Quando eu clico lá, não aparece nada. Preciso que me mostre o que foi que eu selecionei,
   * porque tem que dar a opção de eu fazer alterações."
   */
  const [etapa, setEtapa] = useState(() => {
    if ((etapaInicial === "painel" || etapaInicial === "adicionar") && gatilhosAtuais?.length) return -2;
    if (etapaInicial === "palavras" && gatilhosAtuais?.length) return 0;
    return -1;
  });
  /*
   * O modal de acrescentar gatilho.
   *
   * Ele já nasce aberto quando quem chamou foi o botão "Adicionar gatilho +" do cartão: o botão
   * diz o que faz, e abrir só o painel — com o mesmo botão de novo lá dentro — faz o primeiro
   * clique parecer que não fez nada.
   */
  const [adicionarAberto, setAdicionarAberto] = useState(etapaInicial === "adicionar");
  /** Gatilhos marcados DENTRO do modal, ainda não acrescentados. */
  const [paraAdicionar, setParaAdicionar] = useState<FlowNodeType[]>([]);
  /** De qual gatilho o menu "⋯" está aberto, no painel. */
  const [menuDoGatilho, setMenuDoGatilho] = useState<FlowNodeType | null>(null);
  const fecharMenuDoGatilho = useCallback(() => setMenuDoGatilho(null), []);
  useFecharMenuDeLinha(menuDoGatilho !== null, fecharMenuDoGatilho);
  const [avancadoAberto, setAvancadoAberto] = useState(false);
  /*
   * AS MÍDIAS DA CONTA, buscadas UMA VEZ pela gaveta.
   *
   * Antes cada formulário de gatilho buscava a sua: marcar comentário e resposta de story fazia
   * duas chamadas à Meta ao abrir a gaveta, e trocar de etapa ida e volta refazia as duas. Aqui,
   * uma vez, e as etapas leem da mesma lista.
   *
   * `null` é "ainda não chegou"; `[]` é "chegou e está vazio" — a tela diz coisas diferentes nos
   * dois casos.
   */
  const [publicacoes, setPublicacoes] = useState<ItemDeMidia[] | null>(null);
  const [stories, setStories] = useState<ItemDeMidia[] | null>(null);
  const [erroDasMidias, setErroDasMidias] = useState<string | null>(null);
  const [explicacaoAberta, setExplicacaoAberta] = useState(false);

  const doInstagram = BLOCOS_DISPONIVEIS.filter((b) => b.categoria === "gatilho" && b.grupo === "instagram");
  const principais = PRINCIPAIS.map((t) => doInstagram.find((b) => b.tipo === t)).filter(
    (b): b is (typeof doInstagram)[number] => Boolean(b),
  );
  const avancados = doInstagram.filter((b) => !PRINCIPAIS.includes(b.tipo));

  /*
   * AS ETAPAS SÃO CALCULADAS DO QUE FOI MARCADO.
   *
   * A primeira é sempre as palavras-chave, porque elas valem pra todos os gatilhos. Depois vem
   * uma etapa por gatilho que tenha uma pergunta de alcance, na ordem em que foram marcados.
   */
  const etapas: { chave: string; tipo?: FlowNodeType; titulo: string; pergunta: string }[] = [
    {
      chave: "palavras",
      titulo: "Palavras-chave",
      pergunta: "Quais palavras ou frases ativam a automação?",
    },
    ...marcados
      .filter((t) => ALCANCE[t])
      .map((t) => ({ chave: t, tipo: t, titulo: ALCANCE[t]!.titulo, pergunta: ALCANCE[t]!.pergunta })),
    /*
     * A ÚLTIMA ETAPA É A RESPOSTA, e ela é a razão de tudo o que veio antes.
     *
     * As três primeiras dizem QUANDO o robô acorda; esta diz O QUE ele fala. Sem ela a gaveta
     * terminava com um gatilho ligado a nada, e a pessoa tinha que descobrir sozinha que faltava
     * arrastar um bloco de mensagem no canvas — que é exatamente o passo em que alguém desiste.
     *
     * A pergunta muda com o gatilho principal: "quem comentar no seu feed" é outra pessoa que
     * "quem responder seu story", e escrever a resposta certa depende de saber pra quem é.
     */
    {
      chave: "resposta",
      titulo: "Resposta automática",
      /* Com mais de um gatilho a pergunta não é "o que responder" e sim "o que responder em cada
         um": a tela abaixo tem um campo por gatilho, e a pergunta tem que preparar pra isso. */
      pergunta:
        marcados.length > 1
          ? "O que o robô responde em cada gatilho?"
          : perguntaDaResposta(marcados),
    },
  ];

  function alternar(tipo: FlowNodeType) {
    setMarcados((atual) =>
      atual.includes(tipo) ? atual.filter((t) => t !== tipo) : [...atual, tipo],
    );
  }

  function mudarDados(tipo: FlowNodeType, novo: Record<string, unknown>) {
    setDados((atual) => ({ ...atual, [tipo]: novo }));
  }

  /**
   * FECHA A GAVETA devolvendo os gatilhos e, dependendo de onde o clique veio, as respostas.
   *
   * `todas` é o fim da montagem: tudo o que foi escrito vale. `nenhuma` é o "Pular". `tocadas` é o
   * painel, onde só o gatilho que foi aberto e escrito volta — o resto fica como está no canvas.
   */
  function concluir(resposta: "todas" | "nenhuma" | "tocadas" = "todas") {
    const limpas: Partial<Record<FlowNodeType, string[]>> = {};
    if (resposta !== "nenhuma") {
      for (const tipo of marcados) {
        if (resposta === "tocadas" && !tocadas.includes(tipo)) continue;
        const lista = (respostas[tipo] ?? []).map((r) => r.trim()).filter(Boolean);
        if (lista.length) limpas[tipo] = lista;
      }
    }
    onEscolher(
      marcados.map((tipo) => ({ tipo, data: { ...(dados[tipo] ?? {}) } })),
      limpas,
    );
  }

  /**
   * A ESCOLHA DE ALCANCE DE UM GATILHO, DESENHADA UMA VEZ.
   *
   * Aparece em dois lugares: na etapa da montagem ("Em quais Posts ou Reels a automação deve
   * funcionar?") e, agora, dentro do cartão do gatilho no painel, atrás do "Trocar". Eram dois
   * trechos de JSX quase iguais, cada um mapeando à mão os nomes de campo daquele gatilho
   * (`publicacaoIds` de um lado, `storyIds` do outro) — e foi assim que a gravação do escopo do
   * story passou a existir numa cópia e ser ignorada na avaliação. A leitura e a escrita moram em
   * `alcance-do-gatilho.ts`, que tem teste; aqui ficou só o desenho.
   */
  function escolhaDeAlcance(tipo: FlowNodeType, somenteGrade = false) {
    if (!gatilhoTemAlcance(tipo)) return null;
    const ehPost = tipo === "comentario_instagram";
    const atual = lerAlcance(tipo, dados[tipo]);
    return (
      <EscolhaDeMidia
        somenteGrade={somenteGrade}
        tipo={ehPost ? "post" : "story"}
        itens={(ehPost ? publicacoes : stories) ?? []}
        carregando={(ehPost ? publicacoes : stories) === null && !erroDasMidias}
        erro={erroDasMidias}
        dados={{ ids: atual?.ids ?? [], escopo: atual?.escopo, conhecidos: atual?.conhecidos }}
        onChange={(novo) =>
          mudarDados(tipo, {
            ...(dados[tipo] ?? {}),
            ...gravarAlcance(tipo, { escopo: novo.escopo, ids: novo.ids, conhecidos: novo.conhecidos }),
          })
        }
      />
    );
  }

  /** Os campos de um gatilho, com um em branco quando ele ainda não tem resposta nenhuma. */
  function respostasDe(tipo: FlowNodeType): string[] {
    const lista = respostas[tipo];
    return lista?.length ? lista : [""];
  }

  function mudarResposta(tipo: FlowNodeType, lista: string[]) {
    setRespostas((atual) => ({ ...atual, [tipo]: lista }));
    setTocadas((atual) => (atual.includes(tipo) ? atual : [...atual, tipo]));
  }

  /*
   * OS CAMPOS DE RESPOSTA DE UM GATILHO, DESENHADOS UMA VEZ.
   *
   * Aparecem em dois lugares: na última etapa de quem está montando, um grupo por gatilho, e
   * dentro do cartão do gatilho no painel, atrás da setinha. "Poderia ter uma setinha para baixo,
   * que eu já criasse a automação" — é o mesmo campo nos dois, e duas cópias do JSX é como se
   * chega, meses depois, numa tela que tem "Adicionar outra resposta" e na outra não.
   */
  function camposDeResposta(tipo: FlowNodeType, autoFoco: boolean) {
    const lista = respostasDe(tipo);
    return (
      <div className="gat-respostas">
        {lista.map((texto, i) => (
          <div className="gat-resposta" key={i}>
            <input
              className="input"
              value={texto}
              autoFocus={autoFoco && i === 0}
              placeholder={traduzir(i === 0 ? "Escreva a resposta" : "Escreva outra resposta")}
              onChange={(e) =>
                mudarResposta(
                  tipo,
                  lista.map((r, j) => (j === i ? e.target.value : r)),
                )
              }
            />
            {texto || lista.length > 1 ? (
              <button
                type="button"
                className="gat-resposta-tirar"
                aria-label={traduzir("Apagar esta resposta")}
                onClick={() =>
                  // Nunca fica sem nenhum campo: com um só, apagar limpa em vez de sumir.
                  mudarResposta(tipo, lista.length === 1 ? [""] : lista.filter((_, j) => j !== i))
                }
              >
                <IconClose width={12} height={12} />
              </button>
            ) : null}
          </div>
        ))}

        <button
          type="button"
          className="gat-mais-resposta"
          onClick={() => mudarResposta(tipo, [...lista, ""])}
        >
          <span aria-hidden="true">+</span> {traduzir("Adicionar outra resposta")}
        </button>

        {/*
          VÁRIAS RESPOSTAS NÃO SÃO VÁRIAS MENSAGENS: o robô manda UMA, sorteada. Sem essa frase,
          "adicionar outra resposta" lê como "mandar mais uma mensagem", e quem escrevesse três
          acharia que o lead ia receber as três.
        */}
        {lista.filter((r) => r.trim()).length > 1 ? (
          <p className="gat-nota">
            {traduzir(
              "O robô manda uma delas, sorteada a cada vez. Repetir a mesma frase embaixo do mesmo post é o que o Instagram lê como spam.",
            )}
          </p>
        ) : null}
      </div>
    );
  }

  function avancar() {
    if (etapa + 1 < etapas.length) setEtapa(etapa + 1);
    else concluir();
  }

  function voltar() {
    // Do painel não se "volta": ele é a primeira tela de quem veio do cartão, e o que existe ali
    // é fechar.
    if (etapa <= -1) onFechar();
    else setEtapa(etapa - 1);
  }

  /*
   * AS PALAVRAS VALEM PRA TODOS OS GATILHOS, e por isso são editadas uma vez só.
   *
   * Guardadas no primeiro gatilho marcado e copiadas pros demais na hora de concluir: cada bloco
   * precisa da sua cópia porque quem avalia o evento é o bloco, não o fluxo.
   */
  const palavrasAtuais = (dados[marcados[0]]?.palavras as string[] | undefined) ?? [];
  const modoGravado = (dados[marcados[0]]?.modoPalavra as ModoDePalavra | undefined) ?? "qualquer";
  const modoAtual = modoNaTela(modoGravado);
  /*
   * "QUALQUER PALAVRA-CHAVE" É UMA ESCOLHA GRAVADA, não a ausência de palavras.
   *
   * A primeira versão disto deduzia a opção da lista: sem palavra, "Qualquer palavra-chave". O
   * efeito foi um beco sem saída — escolher "Palavra ou frase exata" não mudava nada na tela,
   * porque a lista continuava vazia, e o campo de digitar ficava escondido justamente porque
   * ainda não havia palavra. Não dava pra sair de "qualquer" de jeito nenhum.
   *
   * Agora a escolha mora em `filtrarPorPalavra`. Fluxo antigo, que não tem o campo, continua lido
   * pela lista: com palavra gravada, filtra; sem palavra, qualquer mensagem serve — que é o que
   * ele sempre fez.
   */
  const filtrar = dados[marcados[0]]?.filtrarPorPalavra;
  const semPalavras = typeof filtrar === "boolean" ? !filtrar : palavrasAtuais.length === 0;
  const acentoConta = dados[marcados[0]]?.ignorarAcentos === false;
  const [palavraNova, setPalavraNova] = useState("");
  /*
   * AS RESPOSTAS da última etapa. Uma por campo, e a primeira é a principal.
   *
   * Várias porque a automação de comentário responde EM PÚBLICO e responde muito: a mesma frase
   * repetida vinte vezes embaixo do mesmo post é o que o Instagram lê como spam. O motor sorteia
   * uma a cada envio (ver `escolherVariacao`).
   */
  const [respostas, setRespostas] = useState<Partial<Record<FlowNodeType, string[]>>>(() => ({
    ...(respostasIniciais ?? {}),
  }));
  /*
   * QUEM FOI MEXIDO AQUI DENTRO.
   *
   * Salvar do painel não pode reescrever a resposta de um gatilho que ninguém abriu: a pessoa veio
   * trocar uma palavra-chave e sairia com a mensagem do canvas sobrescrita pelo que a gaveta
   * tinha lido. Só o gatilho cujos campos foram tocados viaja de volta.
   */
  const [tocadas, setTocadas] = useState<FlowNodeType[]>([]);
  /** De qual gatilho a resposta está aberta, no painel. Uma por vez: são campos de digitar. */
  const [respostaAberta, setRespostaAberta] = useState<FlowNodeType | null>(null);
  /** A caixa de escolha do modo está aberta? Fecha clicando fora e no Esc, como todo menu do CRM. */
  const [modoAberto, setModoAberto] = useState(false);
  const fecharModo = useCallback(() => setModoAberto(false), []);
  useFecharMenuDeLinha(modoAberto, fecharModo);

  function mudarPalavras(lista: string[]) {
    mudarEmTodos({ palavras: lista });
  }

  /** Guarda o que está no campo. Repetida não entra: duas iguais não mudam nada e confundem. */
  function guardarPalavra() {
    const nova = palavraNova.trim();
    if (nova && !palavrasAtuais.some((p) => p.toLowerCase() === nova.toLowerCase())) {
      mudarPalavras([...palavrasAtuais, nova]);
    }
    setPalavraNova("");
  }

  /** O que vale pras palavras vale pra todos os gatilhos marcados: eles dividem a mesma regra. */
  function mudarEmTodos(campos: Record<string, unknown>) {
    setDados((atual) => {
      const copia = { ...atual };
      marcados.forEach((t) => {
        copia[t] = { ...(copia[t] ?? {}), ...campos };
      });
      return copia;
    });
  }

  /*
   * A LINHA É SÓ O NOME DO GATILHO.
   *
   * A descrição estava dentro de cada caixa, e com ela cada opção ocupava três linhas de texto:
   * oito gatilhos viravam uma rolagem, e a lista — que é uma ESCOLHA, feita de relance — passava a
   * exigir leitura. A explicação não sumiu: ela está inteira no "Como funciona cada gatilho?", que
   * é onde se vai quando a dúvida aparece, e não antes dela.
   */
  function Linha({ bloco }: { bloco: (typeof doInstagram)[number] }) {
    const escolhido = marcados.includes(bloco.tipo);
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={escolhido}
        className={`gat-item${escolhido ? " on" : ""}`}
        title={bloco.descricao ? traduzir(bloco.descricao) : undefined}
        onClick={() => alternar(bloco.tipo)}
      >
        <span className="gat-marca gat-marca-caixa" aria-hidden="true" />
        <span className="gat-textos">
          <strong>{traduzir(bloco.label)}</strong>
        </span>
      </button>
    );
  }

  /*
   * A BUSCA ACONTECE NA PRIMEIRA ETAPA DE ALCANCE, não ao abrir a gaveta.
   *
   * Quem marca só "mensagem recebida" nunca vê publicação nem story: buscar as duas listas na
   * abertura seria duas chamadas à Meta por automação criada, pra uma tela que não vai aparecer.
   * O `limite=100` existe pro "Meu próximo post": ele guarda os ids que já existem, e quanto mais
   * completa essa foto, menor a chance de um post antigo ser confundido com um novo.
   */
  const precisaDeMidias = marcados.some((t) => ALCANCE[t]);
  useEffect(() => {
    if (!precisaDeMidias || publicacoes !== null || stories !== null) return;
    let cancelado = false;
    Promise.all([
      fetch("/api/integracoes/instagram/publicacoes?limite=100")
        .then(async (r) => {
          const corpo = (await r.json()) as { publicacoes?: ItemDeMidia[]; erro?: string };
          if (!r.ok) throw new Error(corpo.erro ?? "Falha ao buscar publicações.");
          return corpo.publicacoes ?? [];
        }),
      fetch("/api/integracoes/instagram/stories")
        .then(async (r) => {
          const corpo = (await r.json()) as { stories?: ItemDeMidia[]; erro?: string };
          if (!r.ok) throw new Error(corpo.erro ?? "Falha ao buscar os stories.");
          return corpo.stories ?? [];
        }),
    ])
      .then(([pubs, sts]) => {
        if (cancelado) return;
        setPublicacoes(pubs);
        setStories(sts);
      })
      .catch((erro: Error) => {
        if (cancelado) return;
        setErroDasMidias(erro.message);
        setPublicacoes([]);
        setStories([]);
      });
    return () => {
      cancelado = true;
    };
  }, [precisaDeMidias, publicacoes, stories]);

  const etapaAtual = etapa >= 0 ? etapas[etapa] : null;
  /** O painel do que já está escolhido, aberto pelo cartão do canvas. */
  const ehPainel = etapa === -2;

  /*
   * A PALAVRA-CHAVE, DESENHADA UMA VEZ.
   *
   * A mesma caixa aparece em dois lugares — na etapa 1 de quem está montando, e no painel de
   * quem veio mexer. Duas cópias do mesmo JSX é como se chega numa tela em que a opção existe e
   * na outra não, meses depois, sem ninguém perceber.
   */
  const blocoDaPalavra = (
    <>
    {/*
      * COMO COMPARAR VEM ANTES DE O QUÊ COMPARAR.
      *
      * A escolha é a REGRA; as palavras são o conteúdo dela. É também o que decide se
      * existe conteúdo: em "Qualquer palavra-chave" não há palavra pra digitar, e o
      * campo some em vez de ficar ali pedindo algo que não vale.
      */}
    <div className="gat-escolha" data-menu-de-linha="">
      <button
        type="button"
        className={`gat-escolha-botao${modoAberto ? " aberto" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={modoAberto}
        onClick={() => setModoAberto((v) => !v)}
      >
        <span className="gat-escolha-valor">
          <span className="gat-escolha-rotulo">{traduzir("Selecionado")}</span>
          <strong>
            {semPalavras
              ? traduzir(SEM_PALAVRA)
              : traduzir(MODOS_DE_PALAVRA.find((m) => m.valor === modoAtual)?.label ?? "")}
          </strong>
        </span>
        <IconSetaBaixo
          className={modoAberto ? "girado" : undefined}
          width={14}
          height={14}
          aria-hidden="true"
        />
      </button>

      {modoAberto ? (
        <div
          className="gat-escolha-lista"
          role="listbox"
          aria-label={traduzir("Como a palavra tem que aparecer")}
        >
          <button
            type="button"
            role="option"
            aria-selected={semPalavras}
            className={`gat-escolha-opcao${semPalavras ? " on" : ""}`}
            onClick={() => {
              // Sem filtro: as palavras saem, porque é a lista vazia que o motor lê
              // como "qualquer mensagem serve".
              mudarEmTodos({ palavras: [], filtrarPorPalavra: false });
              setPalavraNova("");
              setModoAberto(false);
            }}
          >
            <span className="gat-escolha-marca" aria-hidden="true">
              {semPalavras ? <IconCheck width={13} height={13} /> : null}
            </span>
            <span className="gat-escolha-texto">
              <strong>{traduzir(SEM_PALAVRA)}</strong>
            </span>
          </button>
          {MODOS_DE_PALAVRA.map((modo) => {
            const escolhida = !semPalavras && modoAtual === modo.valor;
            return (
              <button
                key={modo.valor}
                type="button"
                role="option"
                aria-selected={escolhida}
                className={`gat-escolha-opcao${escolhida ? " on" : ""}`}
                onClick={() => {
                  mudarEmTodos({ modoPalavra: modo.valor, filtrarPorPalavra: true });
                  setModoAberto(false);
                }}
              >
                <span className="gat-escolha-marca" aria-hidden="true">
                  {escolhida ? <IconCheck width={13} height={13} /> : null}
                </span>
                <span className="gat-escolha-texto">
                  <strong>{traduzir(modo.label)}</strong>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>

    {/* Sem filtro não há o que digitar: o campo de palavras só existe nas outras três. */}
    {!semPalavras ? (
      <>
        <p className="gat-subtitulo">{traduzir("Adicionar palavras-chave")}</p>

        <div className="gat-palavra-nova">
          <input
            className="input"
            value={palavraNova}
            placeholder={traduzir("Adicionar texto")}
            onChange={(e) => setPalavraNova(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              guardarPalavra();
            }}
          />
          <button
            type="button"
            className="gat-palavra-ok"
            aria-label={traduzir("Adicionar esta palavra")}
            disabled={!palavraNova.trim()}
            onClick={guardarPalavra}
          >
            <IconCheck width={15} height={15} />
          </button>
        </div>

        {palavrasAtuais.length === 0 ? (
          /*
            AINDA SEM NENHUMA PALAVRA: a tela diz o que falta, em vez de ficar em
            branco. É o desenho da referência — o ícone, e a frase que explica o que
            acontece quando uma das palavras for usada.
          */
          <div className="gat-vazio">
            <span className="gat-vazio-icone" aria-hidden="true">
              <IconChave width={18} height={18} />
            </span>
            <p>
              {traduzir(
                "Adicione palavras-chave para ativar a automação quando uma delas for usada.",
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="gat-palavras">
              {palavrasAtuais.map((p) => (
                <span key={p} className="gat-palavra">
                  {p}
                  <button
                    type="button"
                    aria-label={traduzir("Tirar a palavra {p}", { p })}
                    onClick={() => mudarPalavras(palavrasAtuais.filter((x) => x !== p))}
                  >
                    <IconClose width={10} height={10} />
                  </button>
                </span>
              ))}
            </div>

            {/*
              * MAIÚSCULA NUNCA CONTA, e dizer isso evita a pergunta. Informação não é
              * opção: não há botão porque não há escolha a fazer. O acento, esse sim,
              * é escolha, e cabe numa linha.
              *
              * Os dois só aparecem DEPOIS da primeira palavra: antes dela não há do
              * que falar, e a referência mostra a tela limpa nesse momento.
              */}
            <label className="gat-acento">
              <input
                type="checkbox"
                checked={!acentoConta}
                onChange={() => mudarEmTodos({ ignorarAcentos: acentoConta })}
              />
              <span>
                {traduzir("Acento não importa")}
                <em>{traduzir("“começo” e “comeco” valem como a mesma palavra.")}</em>
              </span>
            </label>
            <p className="gat-nota">
              {traduzir(
                "Maiúscula e minúscula nunca importam: “ASOS”, “Asos” e “asos” disparam igual.",
              )}
            </p>
          </>
        )}
      </>
    ) : null}
    </>
  );

  return (
    <aside className="flow-config flow-config-social gat-gaveta" aria-label={traduzir("Gatilhos")}>
      <header className="cfg-topo">
        <h2>{etapaAtual && !ehPainel ? traduzir(etapaAtual.titulo) : traduzir("Gatilhos")}</h2>
        <button type="button" className="cfg-fechar" aria-label={traduzir("Fechar")} onClick={onFechar}>
          <IconClose width={14} height={14} />
        </button>
      </header>

      {/* A barra de progresso só existe depois da escolha: antes dela não há quantas etapas. */}
      {etapaAtual && !ehPainel ? (
        <div className="gat-progresso">
          <span className="gat-progresso-texto">
            {traduzir("Etapa {n} de {total}", { n: String(etapa + 1), total: String(etapas.length) })}
          </span>
          {/* "Pular" só na etapa da resposta: é a única opcional — o resto define QUANDO o robô
              acorda, e pular isso deixaria um gatilho sem regra nenhuma. */}
          {etapaAtual?.chave === "resposta" ? (
            <button type="button" className="gat-pular" onClick={() => concluir("nenhuma")}>
              {traduzir("Pular")}
            </button>
          ) : null}
          <span className="gat-progresso-trilho">
            <span
              className="gat-progresso-barra"
              style={{ width: `${((etapa + 1) / etapas.length) * 100}%` }}
            />
          </span>
        </div>
      ) : null}

      <div className="flow-config-body gat-corpo">
        {ehPainel ? (
          /*
            O PAINEL DO QUE JÁ ESTÁ ESCOLHIDO.
            
            Dois blocos, como na referência: os gatilhos de cima, cada um num cartão com o seu
            "⋯", e a palavra-chave embaixo, com a mesma caixa de escolha das etapas. Entre os
            dois, o botão de acrescentar — que é a ação que faltava, e a razão de a pessoa ter
            clicado aqui.
          */
          <div className="pg-painel">
            <p className="pg-secao">{traduzir("Gatilhos")}</p>

            <div className="pg-lista">
              {marcados.map((tipo) => {
                const bloco = doInstagram.find((b) => b.tipo === tipo);
                const abertoAqui = respostaAberta === tipo;
                return (
                  <div
                    className={`pg-cartao${abertoAqui ? " aberto" : ""}`}
                    key={tipo}
                    data-menu-de-linha=""
                  >
                    <div className="pg-cartao-linha">
                      <span className="pg-textos">
                        <strong>{traduzir(bloco?.label ?? tipo)}</strong>
                        {bloco?.descricao ? <span>{traduzir(bloco.descricao)}</span> : null}
                        {/* Fechado, o cartão já diz onde aquele gatilho vale: é a pergunta de quem
                            abre a lista de gatilhos ativos pra conferir o que montou. Aberto, a
                            mesma informação aparece embaixo, com o botão de trocar — repetir as
                            duas ao mesmo tempo seria dizer a mesma coisa duas vezes. */}
                        {!abertoAqui && gatilhoTemAlcance(tipo) ? (
                          <span className="pg-alcance-resumo">
                            {traduzir("Onde vale")}: <b>{traduzir(resumoDoAlcance(tipo, dados[tipo]) ?? "")}</b>
                          </span>
                        ) : null}
                      </span>
                      {/*
                        A SETINHA ABRE A RESPOSTA DESTE GATILHO, aqui mesmo.
                      
                        "Ao invés de eu ter que montar todo esse gatilho, aqui nessa parte lateral
                        poderia ter uma setinha para baixo, que eu já criasse a automação." É o
                        caminho curto: escrever a resposta de um gatilho sem passar pelas etapas nem
                        arrastar bloco no quadro.
                      */}
                      <button
                        type="button"
                        className="pg-seta"
                        aria-label={traduzir("Onde este gatilho vale")}
                        aria-expanded={abertoAqui}
                        onClick={() => setRespostaAberta((atual) => (atual === tipo ? null : tipo))}
                      >
                        <IconSetaBaixo
                          className={abertoAqui ? "girado" : undefined}
                          width={14}
                          height={14}
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        className="pg-mais"
                        aria-label={traduzir("Opções deste gatilho")}
                        aria-expanded={menuDoGatilho === tipo}
                        onClick={() => setMenuDoGatilho((atual) => (atual === tipo ? null : tipo))}
                      >
                        ⋯
                      </button>
                      {menuDoGatilho === tipo ? (
                        <div className="pg-menu" role="menu">
                          {ALCANCE[tipo] ? (
                            /* Abre a troca AQUI DENTRO, e não numa etapa à parte: o painel agora
                               mostra e edita o alcance no próprio cartão, e mandar pra outra tela
                               seria um segundo caminho pro mesmo lugar — o tipo de coisa que faz
                               duas telas divergirem com o tempo. */
                            <button
                              type="button"
                              onClick={() => {
                                setMenuDoGatilho(null);
                                setRespostaAberta(tipo);
                              }}
                            >
                              {traduzir(ALCANCE[tipo]!.pergunta)}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="perigo"
                            onClick={() => {
                              setMenuDoGatilho(null);
                              alternar(tipo);
                            }}
                          >
                            {traduzir("Tirar este gatilho")}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {abertoAqui ? (
                      <div className="pg-resposta">
                        {/*
                          ONDE ESTE GATILHO VALE — a escolha que estava gravada e invisível.
                          
                          "Seria interessante se eu pudesse ver COMO que foi que eu escolhi.
                          Resposta nos stories: se eu escolhi que é em todos os stories, se não é —
                          e aí a opção de mudar."
                          
                          Dava pra escolher (numa etapa da montagem, ou pelo "⋯" daqui) e não dava
                          pra LER: o cartão mostrava o nome do gatilho e a resposta automática, e
                          mais nada. Quem montou na semana passada não tinha como saber se o robô
                          valia pro feed inteiro ou pra um post só sem reabrir a etapa e olhar o
                          que estava marcado.
                          
                          Agora a linha diz o estado em palavras — "Qualquer publicação", "3 posts
                          escolhidos", "Só na próxima publicação" — e o "Trocar" abre a mesma grade
                          de miniaturas da montagem, aqui dentro. Sem ir pra outra tela: trocar o
                          alcance e escrever a resposta são a mesma visita.
                        */}
                        {gatilhoTemAlcance(tipo) ? (
                          (() => {
                            const atual = lerAlcance(tipo, dados[tipo]);
                            return (
                              <div className="pg-alcance">
                                <label className="pg-alcance-rotulo" htmlFor={`alcance-${tipo}`}>
                                  {traduzir("Onde vale")}
                                </label>
                                {/*
                                  UM SELETOR, e não um texto com "Trocar" do lado.
                                  
                                  "Ali tem que ser um botão de seleção: quando eu clico em cima, vai
                                  aparecer as opções, embaixo eu vou selecionar." Era texto mais um
                                  link que abria três cartões de rádio com a grade dentro de um
                                  deles — dois jeitos de responder a mesma pergunta, um dentro do
                                  outro. Agora a pergunta é uma, a resposta é uma, e a grade só
                                  aparece quando ela é necessária.
                                */}
                                <select
                                  id={`alcance-${tipo}`}
                                  className="input"
                                  value={atual?.escopo ?? "qualquer"}
                                  onChange={(e) => {
                                    const escopo = e.target.value as EscopoDeAlcance;
                                    mudarDados(tipo, {
                                      ...(dados[tipo] ?? {}),
                                      ...gravarAlcance(tipo, {
                                        escopo,
                                        /* Trocar pra "qualquer" LIMPA os escolhidos: deixá-los
                                           gravados fazia o motor continuar filtrando por eles,
                                           enquanto a tela dizia que valia pra todos. */
                                        ids: escopo === "especifico" ? (atual?.ids ?? []) : [],
                                        /* "Só na próxima" guarda a foto do que existe HOJE: o que
                                           já está publicado não é o próximo. */
                                        ...(escopo === "proxima"
                                          ? { conhecidos: (publicacoes ?? []).map((m) => m.id) }
                                          : {}),
                                      }),
                                    });
                                  }}
                                >
                                  {opcoesDeAlcance(tipo).map((o) => (
                                    <option key={o.valor} value={o.valor}>
                                      {traduzir(o.label)}
                                    </option>
                                  ))}
                                </select>
                                {atual?.escopo === "especifico" ? (
                                  <div className="pg-alcance-escolha">{escolhaDeAlcance(tipo, true)}</div>
                                ) : null}
                              </div>
                            );
                          })()
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {!marcados.length ? (
                <p className="hint">{traduzir("Nenhum gatilho escolhido ainda.")}</p>
              ) : null}
            </div>

            <button
              type="button"
              className="pg-adicionar"
              onClick={() => {
                setParaAdicionar([]);
                setAdicionarAberto(true);
              }}
            >
              {traduzir("Adicionar gatilho")} <span aria-hidden="true">+</span>
            </button>

            <p className="pg-secao pg-secao-palavra">{traduzir("Palavra-chave")}</p>
            {blocoDaPalavra}
          </div>
        ) : !etapaAtual ? (
          <>
            <p className="gat-pergunta">{traduzir("O que inicia essa automação?")}</p>
            <button type="button" className="gat-ajuda" onClick={() => setExplicacaoAberta(true)}>
              <span aria-hidden="true">?</span> {traduzir("Como funciona cada gatilho?")}
            </button>

            <div className="gat-lista" role="group" aria-label={traduzir("O que inicia essa automação?")}>
              {principais.map((b) => (
                <Linha key={b.tipo} bloco={b} />
              ))}
            </div>

            {avancados.length ? (
              <>
                <button
                  type="button"
                  className="gat-avancado"
                  aria-expanded={avancadoAberto}
                  onClick={() => setAvancadoAberto((v) => !v)}
                >
                  {traduzir("Opções avançadas")}
                  <IconSetaBaixo className={avancadoAberto ? "girado" : undefined} width={14} height={14} aria-hidden="true" />
                </button>
                {avancadoAberto ? (
                  <div className="gat-lista" role="group" aria-label={traduzir("Opções avançadas")}>
                    {avancados.map((b) => (
                      <Linha key={b.tipo} bloco={b} />
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            {/*
              O GATILHO QUE NÃO EXISTE, dito com o motivo e com o caminho que funciona.
              
              Ele chegou a existir, por pedido, e saiu por pedido também: "agora que eu vi que se a
              pessoa começar a me seguir, ela não recebe mensagem automática — tira esse gatilho da
              lista então". Estava certo tirar: ele só percebia o Seguir no primeiro contato da
              pessoa depois disso, e prometia pela presença na lista o que a frase embaixo negava.
              
              A AUSÊNCIA FICA EXPLICADA, porque a pergunta volta. São DOIS muros, e é o segundo que
              decide: a Meta não avisa quem passou a seguir (não há webhook nem lista de
              seguidores), e a API não deixa INICIAR conversa — Direct frio pra quem nunca escreveu
              é recusado. Saber quem seguiu não resolveria nada.
              
              Por isso o texto termina no caminho que existe, e que o CRM agora cumpre inteiro:
              chamada pra comentar, comentário, resposta privada, Direct aberto.
            */}
            <p className="gat-ausente">
              <strong>{traduzir("Procurando \u201ccomeçou a me seguir\u201d?")}</strong>
              {traduzir(
                "O Instagram não avisa quem passou a te seguir, e a API não deixa começar conversa com quem nunca te escreveu — nem a Meta oferece isso nas ferramentas dela. O caminho que funciona é pedir um comentário: \u201ccomenta AZUZ que eu te mando\u201d. Aí o CRM responde no Direct, e a conversa abre.",
              )}
            </p>
          </>
        ) : (
          <div className="gat-etapa" key={etapaAtual.chave}>
            <p className="gat-pergunta">{traduzir(etapaAtual.pergunta)}</p>

            {etapaAtual.chave === "palavras" ? (
              <>
                <p className="gat-nota">
                  {traduzir("As palavras-chave valem para todos os gatilhos desta automação.")}
                </p>

                {blocoDaPalavra}
              </>
            ) : etapaAtual.tipo === "comentario_instagram" ? (
              escolhaDeAlcance("comentario_instagram")
            ) : etapaAtual.chave === "resposta" ? (
              /*
                UMA RESPOSTA POR GATILHO.
                
                Era um campo só, e o robô mandava o mesmo texto pra quem comentou no feed e pra
                quem respondeu um story. "Essa resposta, ela não tem como ir para todos os
                lugares." Cada gatilho tem o seu grupo, na ordem em que foram marcados, e o
                primeiro passo de cada caminho nasce com o texto do grupo dele.
              */
              <div className="gat-resposta-grupos">
                {marcados.length > 1 ? (
                  <p className="gat-nota">
                    {traduzir(
                      "Cada gatilho tem a sua resposta: quem comentou no feed e quem respondeu um story estão em momentos diferentes.",
                    )}
                  </p>
                ) : null}

                {marcados.map((tipo, i) => (
                  <div className="gat-resposta-grupo" key={tipo}>
                    {marcados.length > 1 ? (
                      <p className="gat-resposta-titulo">{traduzir(perguntaDaResposta([tipo]))}</p>
                    ) : null}
                    {camposDeResposta(tipo, i === 0)}
                  </div>
                ))}
              </div>
            ) : etapaAtual.tipo === "instagram_story_respondido" ? (
              escolhaDeAlcance("instagram_story_respondido")
            ) : null}
          </div>
        )}
      </div>

      <footer className="cfg-rodape gat-rodape">
        <button type="button" className="btn ghost pequeno" onClick={voltar}>
          {traduzir(ehPainel ? "Fechar" : "Voltar")}
        </button>
        <button
          type="button"
          className="cfg-salvar"
          disabled={marcados.length === 0}
          /* Do painel, salvar leva só a resposta do gatilho que foi aberto na setinha: quem veio
             trocar uma palavra-chave não veio reescrever a mensagem, e sobrescrever as outras
             apagaria o que foi montado no canvas. */
          onClick={() => (ehPainel ? concluir("tocadas") : avancar())}
        >
          {!ehPainel && etapa + 1 < etapas.length ? traduzir("Continuar") : traduzir("Salvar")}
        </button>
      </footer>

      {/*
        ACRESCENTAR GATILHO, pelo painel.
        
        Só os que AINDA NÃO ESTÃO no robô: repetir na lista os que já foram escolhidos obrigaria
        a pessoa a comparar duas listas pra saber o que falta. O botão conta quantos vão entrar,
        como na referência — é o que diz que marcar não é o mesmo que acrescentar.
      */}
      {adicionarAberto ? (
        <div className="modal-overlay" onClick={() => setAdicionarAberto(false)}>
          <div
            className="gat-modal gat-modal-escolher"
            role="dialog"
            aria-label={traduzir("O que inicia essa automação?")}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="tpl-topo">
              <h3>{traduzir("O que inicia essa automação?")}</h3>
              <button
                type="button"
                className="tpl-fechar"
                aria-label={traduzir("Fechar")}
                onClick={() => setAdicionarAberto(false)}
              >
                <IconClose width={14} height={14} />
              </button>
            </header>

            <div className="gat-modal-corpo">
              <button type="button" className="gat-ajuda" onClick={() => setExplicacaoAberta(true)}>
                <span aria-hidden="true">?</span> {traduzir("Como funciona cada gatilho?")}
              </button>

              <div className="gat-lista" role="group">
                {principais
                  .filter((b) => !marcados.includes(b.tipo))
                  .map((b) => (
                    <button
                      key={b.tipo}
                      type="button"
                      role="checkbox"
                      aria-checked={paraAdicionar.includes(b.tipo)}
                      className={`gat-item${paraAdicionar.includes(b.tipo) ? " on" : ""}`}
                      title={b.descricao ? traduzir(b.descricao) : undefined}
                      onClick={() =>
                        setParaAdicionar((atual) =>
                          atual.includes(b.tipo) ? atual.filter((t) => t !== b.tipo) : [...atual, b.tipo],
                        )
                      }
                    >
                      <span className="gat-marca gat-marca-caixa" aria-hidden="true" />
                      <span className="gat-textos">
                        <strong>{traduzir(b.label)}</strong>
                      </span>
                    </button>
                  ))}
                {principais.every((b) => marcados.includes(b.tipo)) ? (
                  <p className="hint">{traduzir("Todos os gatilhos principais já estão nesta automação.")}</p>
                ) : null}
              </div>

              {avancados.filter((b) => !marcados.includes(b.tipo)).length ? (
                <>
                  <button
                    type="button"
                    className="gat-avancado"
                    aria-expanded={avancadoAberto}
                    onClick={() => setAvancadoAberto((v) => !v)}
                  >
                    {traduzir("Opções avançadas")}
                    <IconSetaBaixo
                      className={avancadoAberto ? "girado" : undefined}
                      width={14}
                      height={14}
                      aria-hidden="true"
                    />
                  </button>
                  {avancadoAberto ? (
                    <div className="gat-lista" role="group">
                      {avancados
                        .filter((b) => !marcados.includes(b.tipo))
                        .map((b) => (
                          <button
                            key={b.tipo}
                            type="button"
                            role="checkbox"
                            aria-checked={paraAdicionar.includes(b.tipo)}
                            className={`gat-item${paraAdicionar.includes(b.tipo) ? " on" : ""}`}
                            onClick={() =>
                              setParaAdicionar((atual) =>
                                atual.includes(b.tipo)
                                  ? atual.filter((t) => t !== b.tipo)
                                  : [...atual, b.tipo],
                              )
                            }
                          >
                            <span className="gat-marca gat-marca-caixa" aria-hidden="true" />
                            <span className="gat-textos">
                              <strong>{traduzir(b.label)}</strong>
                            </span>
                          </button>
                        ))}
                    </div>
                  ) : null}
                </>
              ) : null}

              <button
                type="button"
                className="cfg-salvar gat-modal-confirmar"
                disabled={!paraAdicionar.length}
                onClick={() => {
                  setMarcados((atual) => [...atual, ...paraAdicionar.filter((t) => !atual.includes(t))]);
                  setParaAdicionar([]);
                  setAdicionarAberto(false);
                }}
              >
                {traduzir("Adicionar gatilho")} ({paraAdicionar.length})
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {explicacaoAberta ? (
        <div className="modal-overlay" onClick={() => setExplicacaoAberta(false)}>
          <div className="gat-modal" role="dialog" aria-label={traduzir("Como funciona cada gatilho?")} onClick={(e) => e.stopPropagation()}>
            <header className="tpl-topo">
              <h3>{traduzir("Como funciona cada gatilho?")}</h3>
              <button type="button" className="tpl-fechar" aria-label={traduzir("Fechar")} onClick={() => setExplicacaoAberta(false)}>
                <IconClose width={14} height={14} />
              </button>
            </header>
            <div className="gat-modal-corpo">
              {doInstagram.map((b) => (
                <div key={b.tipo} className="gat-modal-item">
                  <strong>{traduzir(b.label)}</strong>
                  <span>{traduzir(COMO_FUNCIONA[b.tipo] ?? b.descricao ?? "")}</span>
                </div>
              ))}
              <p className="gat-modal-fim">
                {traduzir("Em todos os casos, depois disso a conversa segue os passos da sua automação.")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
