"use client";

import { useCallback, useEffect, useState } from "react";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { EscolhaDeMidia, type DadosDeEscopo, type ItemDeMidia } from "./forms/EscolhaDeMidia";
import { IconCheck, IconClose, IconExpandir } from "@/components/icons";
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
  etapaInicial = "lista",
  onEscolher,
  onFechar,
}: {
  /** Os gatilhos que o fluxo já tem, com a configuração de cada um. */
  gatilhosAtuais?: EscolhaDeGatilho[];
  /**
   * Onde a gaveta abre.
   *
   * O cartão do canvas tem duas linhas — "Gatilhos ativos" e "Palavras-chave" — e cada uma leva
   * ao seu assunto. Abrir sempre na lista obrigaria a passar pela escolha de gatilhos pra chegar
   * numa palavra, que é o caminho que a linha existe pra encurtar.
   */
  etapaInicial?: "lista" | "palavras";
  onEscolher: (escolhas: EscolhaDeGatilho[]) => void;
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
  /** `-1` é a lista de gatilhos; 0 em diante são as etapas de configuração (a 0 é a das palavras). */
  const [etapa, setEtapa] = useState(etapaInicial === "palavras" && gatilhosAtuais?.length ? 0 : -1);
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
  ];

  function alternar(tipo: FlowNodeType) {
    setMarcados((atual) =>
      atual.includes(tipo) ? atual.filter((t) => t !== tipo) : [...atual, tipo],
    );
  }

  function mudarDados(tipo: FlowNodeType, novo: Record<string, unknown>) {
    setDados((atual) => ({ ...atual, [tipo]: novo }));
  }

  function concluir() {
    onEscolher(marcados.map((tipo) => ({ tipo, data: { ...(dados[tipo] ?? {}) } })));
  }

  function avancar() {
    if (etapa + 1 < etapas.length) setEtapa(etapa + 1);
    else concluir();
  }

  function voltar() {
    if (etapa === -1) onFechar();
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
  /** Nenhuma palavra configurada: é a opção "Qualquer palavra-chave" da referência. */
  const semPalavras = palavrasAtuais.length === 0;
  const acentoConta = dados[marcados[0]]?.ignorarAcentos === false;
  const [palavraNova, setPalavraNova] = useState("");
  /** A caixa de escolha do modo está aberta? Fecha clicando fora e no Esc, como todo menu do CRM. */
  const [modoAberto, setModoAberto] = useState(false);
  const fecharModo = useCallback(() => setModoAberto(false), []);
  useFecharMenuDeLinha(modoAberto, fecharModo);

  function mudarPalavras(lista: string[]) {
    mudarEmTodos({ palavras: lista });
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

  return (
    <aside className="flow-config flow-config-social gat-gaveta" aria-label={traduzir("Gatilhos")}>
      <header className="cfg-topo">
        <h2>{etapaAtual ? traduzir(etapaAtual.titulo) : traduzir("Gatilhos")}</h2>
        <button type="button" className="cfg-fechar" aria-label={traduzir("Fechar")} onClick={onFechar}>
          <IconClose width={14} height={14} />
        </button>
      </header>

      {/* A barra de progresso só existe depois da escolha: antes dela não há quantas etapas. */}
      {etapaAtual ? (
        <div className="gat-progresso">
          <span className="gat-progresso-texto">
            {traduzir("Etapa {n} de {total}", { n: String(etapa + 1), total: String(etapas.length) })}
          </span>
          <span className="gat-progresso-trilho">
            <span
              className="gat-progresso-barra"
              style={{ width: `${((etapa + 1) / etapas.length) * 100}%` }}
            />
          </span>
        </div>
      ) : null}

      <div className="flow-config-body gat-corpo">
        {!etapaAtual ? (
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
                  <IconExpandir className={avancadoAberto ? "girado" : undefined} width={14} height={14} aria-hidden="true" />
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
          </>
        ) : (
          <div className="gat-etapa" key={etapaAtual.chave}>
            <p className="gat-pergunta">{traduzir(etapaAtual.pergunta)}</p>

            {etapaAtual.chave === "palavras" ? (
              <>
                <p className="gat-nota">
                  {traduzir("As palavras-chave valem para todos os gatilhos desta automação.")}
                </p>

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
                    <IconExpandir
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
                          mudarEmTodos({ palavras: [] });
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
                              mudarEmTodos({ modoPalavra: modo.valor });
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
                    <div className="gat-palavra-nova">
                      <input
                        className="input"
                        value={palavraNova}
                        placeholder={traduzir("Ex.: quero, preço, guia")}
                        onChange={(e) => setPalavraNova(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const nova = palavraNova.trim();
                          if (nova && !palavrasAtuais.includes(nova)) mudarPalavras([...palavrasAtuais, nova]);
                          setPalavraNova("");
                        }}
                      />
                      <button
                        type="button"
                        className="btn ghost pequeno"
                        disabled={!palavraNova.trim()}
                        onClick={() => {
                          const nova = palavraNova.trim();
                          if (nova && !palavrasAtuais.includes(nova)) mudarPalavras([...palavrasAtuais, nova]);
                          setPalavraNova("");
                        }}
                      >
                        + {traduzir("Adicionar")}
                      </button>
                    </div>

                    {/*
                      * MAIÚSCULA NUNCA CONTA, e dizer isso evita a pergunta. Informação não é
                      * opção: não há botão porque não há escolha a fazer. O acento, esse sim, é
                      * escolha, e cabe numa linha.
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
                ) : null}
              </>
            ) : etapaAtual.tipo === "comentario_instagram" ? (
              <EscolhaDeMidia
                tipo="post"
                itens={publicacoes ?? []}
                carregando={publicacoes === null && !erroDasMidias}
                erro={erroDasMidias}
                dados={{
                  ids: (dados.comentario_instagram?.publicacaoIds as string[] | undefined) ??
                    (dados.comentario_instagram?.publicacaoId
                      ? [dados.comentario_instagram.publicacaoId as string]
                      : []),
                  escopo: dados.comentario_instagram?.escopoPublicacao as DadosDeEscopo["escopo"],
                  conhecidos: dados.comentario_instagram?.publicacoesConhecidas as string[] | undefined,
                }}
                onChange={(novo) =>
                  mudarDados("comentario_instagram", {
                    ...(dados.comentario_instagram ?? {}),
                    publicacaoIds: novo.ids ?? [],
                    escopoPublicacao: novo.escopo,
                    publicacoesConhecidas: novo.conhecidos,
                    // O campo antigo some quando a escolha passa a ser a nova: deixá-lo pra trás
                    // faria o motor continuar lendo uma publicação que a tela já esqueceu.
                    publicacaoId: "",
                  })
                }
              />
            ) : etapaAtual.tipo === "instagram_story_respondido" ? (
              <EscolhaDeMidia
                tipo="story"
                itens={stories ?? []}
                carregando={stories === null && !erroDasMidias}
                erro={erroDasMidias}
                dados={{
                  ids: (dados.instagram_story_respondido?.storyIds as string[] | undefined) ??
                    (dados.instagram_story_respondido?.storyId
                      ? [dados.instagram_story_respondido.storyId as string]
                      : []),
                  escopo: dados.instagram_story_respondido?.escopoStory as DadosDeEscopo["escopo"],
                }}
                onChange={(novo) =>
                  mudarDados("instagram_story_respondido", {
                    ...(dados.instagram_story_respondido ?? {}),
                    storyIds: novo.ids ?? [],
                    escopoStory: novo.escopo,
                    storyId: "",
                  })
                }
              />
            ) : null}
          </div>
        )}
      </div>

      <footer className="cfg-rodape gat-rodape">
        <button type="button" className="btn ghost pequeno" onClick={voltar}>
          {traduzir("Voltar")}
        </button>
        <button type="button" className="cfg-salvar" disabled={marcados.length === 0} onClick={avancar}>
          {etapa + 1 < etapas.length ? traduzir("Continuar") : traduzir("Salvar")}
        </button>
      </footer>

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
