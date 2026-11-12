"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { createPortal } from "react-dom";

import { classeOrigem, type NegocioCard } from "@/lib/data";
import { HOJE_ISO } from "@/lib/hoje";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { useFunis } from "@/lib/funis-context";
import { useContatos } from "@/lib/contatos-context";
import { rotuloDaQualificacao } from "@/lib/contatos/qualificacao";
import { formatarTelefoneParaExibicao } from "@/lib/telefone";
import { nomeExibido } from "@/lib/conversas/exibicao";
import { chaveDeContato } from "@/lib/contatos/chave-nome";
import { useConversas } from "@/lib/conversas-context";
import { rotuloDeAtividade } from "@/lib/funis/atividade";
import {
  contatoDoCard as acharContatoDoCard,
  conversaDoCard as acharConversaDoCard,
  indicesDeContato,
  indicesDeConversa,
  nomeParaOCartao,
} from "@/lib/funis/conversa-do-card";
import {
  PREFIXO_DO_NOME,
  nomeDoFunil,
  numeroDoFunil,
  numerosDisponiveis,
  numerosDoFunilNaTela,
  sufixoSugerido,
  type NumeroParaFunil,
} from "@/lib/funis/numero-do-funil";
import { canalDoNumero } from "@/lib/conversas/numeros-conectados";
import type { PreviaDaOrigem } from "@/lib/rastreio/tag-de-origem";
import { VAZIO, ehVazio } from "@/lib/vazio";
import { useEquipe } from "@/lib/equipe-context";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import { useMotivosPerda } from "@/lib/motivos-perda";
import { IconAutomacoes } from "@/components/icons";
import { AutomacaoDoFunil } from "@/components/funil/AutomacaoDoFunil";
import { PainelConversa } from "@/components/conversas/PainelConversa";
import { IconConfiguracoes } from "@/components/icons";
import { ChipFilters, FloatingDropdown, Topbar } from "@/components/ui";
import { IconCheck, IconClose, IconErro } from "@/components/icons";
import { TransferirNegocio } from "@/components/funil/TransferirNegocio";
import { SeletorDeData } from "@/components/seletor-de-data";
import { useIdioma } from "@/lib/idioma-context";
import { LimparDemonstracao } from "@/components/configuracoes/LimparDemonstracao";

/**
 * Quantas fotos de perfil o funil vai buscar por carregamento.
 *
 * Cada uma é uma chamada à Evolution pela mesma instância que envia mensagem. Oito cobre a
 * primeira tela do quadro sem disputar com o envio; o resto entra na próxima abertura.
 */
const LIMITE_DE_FOTOS_POR_CARGA = 8;

const ORIGENS_NEGOCIO: NegocioCard["origem"][] = [
  "Instagram",
  "Meta Ads",
  "Google Ads",
  "Indicação",
];

/**
 * O TELEFONE DO CARTÃO, pela mesma régua da caixa de entrada.
 *
 * Esta função era uma cópia local, mais fraca que a de `telefone.ts`, e a diferença aparecia na
 * tela: o que ela não reconhecia virava `+` mais os dígitos crus. Era assim que `+131971611123817`
 * e `+49328018215052` apareciam embaixo do nome com toda a cara de telefone internacional — e não
 * são telefone nenhum: são LIDs, o identificador novo do WhatsApp, de 14 ou 15 dígitos.
 *
 * A compartilhada devolve `null` pro que não tem forma de telefone, e aí a linha simplesmente não
 * aparece. Número que ninguém pode discar é pior que número nenhum: ele convida a ligar.
 */
function formatarTelefoneExibicao(numero: string | null | undefined): string | null {
  return numero ? formatarTelefoneParaExibicao(numero) : null;
}

export default function FunilPage() {
  return (
    <Suspense fallback={null}>
      <FunilPageInner />
    </Suspense>
  );
}

function FunilPageInner() {
  const { t: traduzir } = useIdioma();
  const searchParams = useSearchParams();
  const {
    funis,
    setFunis,
    aplicarSemGravar,
    funilAtivoId,
    setFunilAtivoId,
    excluirFunil,
    moverNegocio,
    criarFunilPersistido,
    criarEtapaPersistida,
    salvarAparenciaDaEtapa,
    recarregar: recarregarFunis,
    erroSincronizacao,
    limparErroSincronizacao,
  } = useFunis();
  const { fluxos } = useAutomationFlows();
  const { contatos, excluirContato } = useContatos();
  const { conversas, excluirConversa, recarregar: recarregarConversas } = useConversas();

  /**
   * A conversa daquele negócio: pelo nome e, quando o nome falha, PELO TELEFONE.
   *
   * "Estou tentando procurar no meu funil a minha cliente Gabriela. Lá no WhatsApp eu achei (…) só
   * que no funil ela não aparece. É como se não houvesse nenhuma conversa." O card nasceu chamado
   * pelo telefone — a primeira mensagem não trouxe o nome de perfil — e a conversa virou "GABRIELA
   * KTM" depois. Os dois lados do CRM passaram a falar de pessoas diferentes, e o cartão abria uma
   * conversa vazia. Ver `conversa-do-card.ts`, onde a regra mora e tem teste.
   */
  const indicesDeConversas = useMemo(() => indicesDeConversa(conversas), [conversas]);
  /*
   * O CONTATO DAQUELE NEGÓCIO, por NOME e por TELEFONE.
   *
   * Era `contatos.find((c) => c.nome === card.nome)`, dentro do desenho de cada cartão. Dois
   * problemas num só: a comparação exigia a string idêntica — "+55 11 99746-1401" não casa com
   * "5511997461401", e era por isso que uns cartões tinham foto e outros não — e a varredura
   * acontecia por cartão, o que num quadro com dezenas deles é a lista inteira de contatos
   * percorrida dezenas de vezes a cada render.
   *
   * O índice por telefone veio depois, pelo caso da Gabriela: o contato já estava com o nome certo
   * e o card continuava chamado pelo número, então o cartão ficava sem foto e sem a qualificação
   * do lead — dois dados que existem, do lado de cá, e que a tela não encontrava por causa de uma
   * string. Ver `conversa-do-card.ts`.
   */
  const indicesDeContatos = useMemo(() => indicesDeContato(contatos), [contatos]);

  /** A conversa de um card, com as três tentativas de `conversa-do-card.ts`. */
  const acharConversa = (nomeDoCard: string) =>
    acharConversaDoCard({ nome: nomeDoCard }, indicesDeConversas, indicesDeContatos.porNome.get(chaveDeContato(nomeDoCard)));

  /** O contato de um card, pela mesma régua: nome e, quando ele falha, telefone. */
  const acharContato = (nomeDoCard: string, conversa?: { nome: string; contato?: string | null; ehGrupo?: boolean } | null) =>
    acharContatoDoCard({ nome: nomeDoCard }, indicesDeContatos, conversa);

  /*
   * AS FOTOS QUE FALTAM NOS CARTÕES, buscadas em segundo plano.
   *
   * "Lá no WhatsApp, alguns não estão aparecendo as fotos. E eu preciso que todas as fotos
   * apareçam." O webhook busca a foto a cada mensagem que chega, então quem continua conversando
   * tem rosto e quem parou de escrever ficou com as iniciais — a diferença é só há quanto tempo
   * aquela pessoa mandou a última mensagem, e no quadro isso parece aleatório.
   *
   * Uma por vez e no máximo {LIMITE} por carregamento: cada uma é uma chamada à Evolution, e uma
   * rajada de trinta ao abrir o funil competiria com o envio de mensagem pela mesma instância. O
   * que sobrar entra na próxima abertura; o que já foi tentado não repete nesta sessão.
   */
  const fotoTentadaRef = useRef<Set<string>>(new Set());
  const buscandoFotosRef = useRef(false);
  useEffect(() => {
    if (buscandoFotosRef.current || !conversas.length) return;
    const pendentes = conversas
      .filter((c) => !c.fotoUrl && c.canal !== "Instagram" && !fotoTentadaRef.current.has(c.nome))
      .slice(0, LIMITE_DE_FOTOS_POR_CARGA);
    if (!pendentes.length) return;

    buscandoFotosRef.current = true;
    let cancelado = false;
    (async () => {
      let achouAlguma = false;
      for (const alvo of pendentes) {
        if (cancelado) break;
        fotoTentadaRef.current.add(alvo.nome);
        const dados = await fetch("/api/conversas/foto", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversa: alvo.nome }),
        })
          .then((r) => (r.ok ? (r.json() as Promise<{ fotoUrl?: string | null }>) : null))
          .catch(() => null);
        if (dados?.fotoUrl) achouAlguma = true;
      }
      buscandoFotosRef.current = false;
      // A rota já gravou no banco; uma releitura traz tudo de uma vez, em vez de um `setState`
      // por foto com a lista inteira sendo recriada a cada volta do laço.
      if (achouAlguma && !cancelado) recarregarConversas();
    })().catch(() => {
      buscandoFotosRef.current = false;
    });

    return () => {
      cancelado = true;
    };
  }, [conversas, recarregarConversas]);
  const { membros: equipe } = useEquipe();
  const motivosPerda = useMotivosPerda();
  const [configAberto, setConfigAberto] = useState(false);
  /** Negócio sendo transferido: a janela é a mesma usada no painel do funil e nas conversas. */
  const [transferindo, setTransferindo] = useState<{ id: string; nome: string; responsavel?: string } | null>(null);
  const [configAnchorRect, setConfigAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: configPopRef, posicao: configPos } = useFloatingPosition(configAnchorRect, configAberto, 8, () => setConfigAberto(false));
  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const proximoToastId = useRef(0);

  /** Popup de resposta rápida: lê/grava na MESMA conversa que o WhatsApp usa (ver
   * src/lib/mensagens-extra-context.tsx): Funil e WhatsApp falam com o mesmo contato, então uma
   * mensagem mandada de um lugar aparece no outro. */


  /* `importarConversas` e `reordenarPorAtividade` saíram junto com os botões que as chamavam.
     As rotas (`/api/funis/importar-conversas` e `/api/funis/reordenar-por-atividade`) continuam
     de pé: o que deixou de existir é o atalho na barra, não a capacidade. Lead novo continua
     entrando no funil sozinho pelo webhook; o que se perde é o preenchimento em massa de quem
     já era contato antes, que era manutenção de uma vez só. */



  function avisarAutomacao(texto: string) {
    const id = `toast-${proximoToastId.current++}`;
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  const [novoFunilAberto, setNovoFunilAberto] = useState(false);
  /*
   * O FUNIL NOVO TEM TRÊS RESPOSTAS, e as três são dela.
   *
   * Antes havia uma só — o atendente — e o nome saía dele ("Funil - Fulano"), sem como editar.
   * "Eu posso ter a opção de editar o nome do novo funil. Vai ficar pré-definido que vai chamar
   * funil tracinho, o restante do nome é eu que escolho. O responsável também, eu escolho (…) ou
   * eu tenho a opção de não escolher ninguém. E aqui também eu tenho que escolher o número que vai
   * ficar nesse funil — e esse número não vai mudar."
   *
   * O atendente começa VAZIO de propósito: "quem entrar aqui responde" é uma escolha legítima, e
   * deixar o primeiro da equipe pré-selecionado faz o funil nascer com dono que ninguém escolheu.
   */
  const [atendenteNovoFunil, setAtendenteNovoFunil] = useState("");
  /** Só o que vem DEPOIS de "Funil - ". Ver `nomeDoFunil`. */
  const [sufixoNovoFunil, setSufixoNovoFunil] = useState("");
  /*
   * OS NÚMEROS DO FUNIL NOVO — plural desde que um funil passou a poder ter vários.
   *
   * "Às vezes o cara quer só um funil porque ele quer organizar — entrada, financeiro — e aí ele
   * quer que todos os números vejam aquele mesmo funil."
   */
  const [numerosNovoFunil, setNumerosNovoFunil] = useState<string[]>([]);
  const [criandoFunil, setCriandoFunil] = useState(false);
  const [erroNovoFunil, setErroNovoFunil] = useState<string | null>(null);

  /*
   * OS NÚMEROS DE WHATSAPP CONECTADOS. Lidos uma vez, usados em dois lugares: a etiqueta fixa do
   * quadro aberto e o seletor de número do funil novo.
   *
   * `null` é "ainda não chegou" e `[]` é "chegou e não há nenhum" — a tela diz coisas diferentes
   * nos dois casos, e tratar os dois como lista vazia faria o seletor dizer "nenhum número
   * conectado" durante o carregamento.
   */
  const [numerosDeWhats, setNumerosDeWhats] = useState<NumeroParaFunil[] | null>(null);

  /*
   * DE ONDE VEIO CADA LEAD. A mesma rota e a mesma etiqueta da caixa de entrada.
   *
   * "Preciso saber se o lead que entrou no meu chat e no meu funil veio de onde." O cartão mostrava
   * `card.origem` — o canal de chegada —, que não responde se veio de anúncio.
   */
  const [origemPorContato, setOrigemPorContato] = useState<Record<string, PreviaDaOrigem>>({});

  useEffect(() => {
    let vivo = true;
    fetch("/api/rastreio/origem-dos-leads")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: { porContato?: Record<string, PreviaDaOrigem> } | null) => {
        // Falhar aqui não pode roubar o quadro de quem veio trabalhar: sem a etiqueta, o cartão
        // continua inteiro, com o canal de chegada como antes.
        if (vivo && dados?.porContato) setOrigemPorContato(dados.porContato);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  /*
   * Busca e DEVOLVE, em vez de gravar no estado: assim o efeito grava num callback e não no corpo,
   * que é o que a regra `react-hooks/set-state-in-effect` cobra. Lista vazia em qualquer falha —
   * saber de qual número é o funil é informação útil, não indispensável, e um erro aqui não pode
   * roubar a atenção de quem veio trabalhar o quadro.
   */
  const buscarNumeros = useCallback(async (): Promise<NumeroParaFunil[]> => {
    const r = await fetch("/api/integracoes/numeros").catch(() => null);
    if (!r?.ok) return [];
    const corpo = (await r.json().catch(() => null)) as { numeros?: NumeroParaFunil[] } | null;
    return corpo?.numeros ?? [];
  }, []);

  useEffect(() => {
    let vivo = true;
    buscarNumeros().then((lista) => {
      if (vivo) setNumerosDeWhats(lista);
    });
    return () => {
      vivo = false;
    };
  }, [buscarNumeros]);

  const [novoNegocioAberto, setNovoNegocioAberto] = useState(
    () => searchParams.get("criarNegocio") === "1",
  );
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [valorNegocio, setValorNegocio] = useState("");
  const [origemNegocio, setOrigemNegocio] = useState<NegocioCard["origem"]>(
    ORIGENS_NEGOCIO[0],
  );
  const [origensFiltro, setOrigensFiltro] = useState<Set<string>>(new Set());
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [modoAutomatizar, setModoAutomatizar] = useState(false);
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [arrastando, setArrastando] = useState<{
    coluna: number;
    card: number;
  } | null>(null);
  const [novaEtapaAberta, setNovaEtapaAberta] = useState(false);
  const [nomeNovaEtapa, setNomeNovaEtapa] = useState("");
  const [colunaRenomeando, setColunaRenomeando] = useState<number | null>(null);
  const [nomeRenomeando, setNomeRenomeando] = useState("");
  const [colunaArrastando, setColunaArrastando] = useState<number | null>(null);
  const kanbanRef = useRef<HTMLDivElement | null>(null);

  // Menu "Marcar como ganho/perdido": abre por card (⋮), grava statusFechamento/motivoPerda/
  // dataFechamento de verdade no NegocioCard (persiste via o mesmo PUT /api/funis que já sincroniza
  // o resto do kanban).
  /**
   * Negócios duplicados: o mesmo contato com mais de um card.
   *
   * Aconteceu porque o CRM comparava nome com nome e qualquer diferença de espaço ou maiúscula
   * criava um card novo. O defeito está corrigido, mas o que já está no banco precisa de uma
   * decisão de gente: juntar apaga card, e apagar o errado apaga trabalho de venda.
   */
  const [duplicados, setDuplicados] = useState<{ nome: string; saem: { id: string }[] }[]>([]);
  const [juntando, setJuntando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/funis/consolidar")
      .then((r) => (r.ok ? r.json() : { plano: [] }))
      .then((d: { plano?: { nome: string; saem: { id: string }[] }[] }) => {
        if (vivo) setDuplicados(d.plano ?? []);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [funis]);

  const cardsDuplicados = duplicados.reduce((soma, g) => soma + g.saem.length, 0);

  /* A contagem de "fora de compasso" saiu junto com o botão de alinhar: ela existia só pra decidir
     se aquele botão aparecia. Com ela sai também uma chamada de rede que disparava a cada mudança
     no funil, sem nada na tela dependendo da resposta. */

  async function juntarDuplicados() {
    const lista = duplicados
      .slice(0, 8)
      .map((g) => `• ${g.nome}`)
      .join("\n");
    const resto = duplicados.length > 8 ? `\n…e mais ${duplicados.length - 8}.` : "";
    const confirmado = window.confirm(
      traduzir(
        "Juntar {n} negócio(s) repetido(s)?\n\nDe cada pessoa fica o negócio que está mais à frente no funil; os outros são apagados.\n\n{lista}",
        { n: cardsDuplicados, lista: `${lista}${resto}` },
      ),
    );
    if (!confirmado) return;
    setJuntando(true);
    try {
      const resposta = await fetch("/api/funis/consolidar", { method: "POST" });
      const dados = (await resposta.json()) as { cardsRemovidos?: number; erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? String(resposta.status));
      avisarAutomacao(`${dados.cardsRemovidos ?? 0} negócio(s) repetido(s) foram juntados.`);
      setDuplicados([]);
      await recarregarFunis();
    } catch (erro) {
      avisarAutomacao(erro instanceof Error ? erro.message : traduzir("Não deu pra juntar os negócios agora."));
    } finally {
      setJuntando(false);
    }
  }

  /** Conversa aberta em popup, sem sair do funil. Ver o clique no card. */
  const [conversaAberta, setConversaAberta] = useState<string | null>(null);
  const [desfechoMenu, setDesfechoMenu] = useState<{ coluna: number; card: number; rect: DOMRect } | null>(null);
  const [motivoEscolhido, setMotivoEscolhido] = useState("");

  const funilAtivo = funis.find((f) => f.id === funilAtivoId) ?? funis[0];

  /*
   * A ETIQUETA DO NÚMERO DO QUADRO ABERTO.
   *
   * Texto, não controle: o número é escolhido na criação e não muda ("se eu quiser mudar, eu tenho
   * que excluir esse funil e criar outro"). Funil sem número não ganha etiqueta — ele é o antigo,
   * que recebe o que não tem número próprio, e escrever isso na barra a cada abertura seria repetir
   * um aviso sobre algo que não dá pra mudar daqui.
   */
  const numeroDoQuadro = numeroDoFunil(numerosDeWhats ?? [], funilAtivo);
  const rotuloDoNumeroAtivo = numeroDoQuadro
    ? `${numeroDoQuadro.nome} · ${canalDoNumero(numeroDoQuadro.provedor)}`
    : null;

  function marcarDesfecho(coluna: number, card: number, statusFechamento: "ganho" | "perdido", motivoPerda?: string) {
    if (!funilAtivo) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c, i) => {
          if (i !== coluna) return c;
          return {
            ...c,
            cards: c.cards.map((cd, j) =>
              j !== card
                ? cd
                : { ...cd, statusFechamento, motivoPerda: motivoPerda ?? null, dataFechamento: HOJE_ISO },
            ),
          };
        });
        return { ...f, colunas };
      }),
    );
    setDesfechoMenu(null);
    setMotivoEscolhido("");
  }

  /**
   * Tira o card do funil. O contato e a conversa FICAM.
   *
   * É o caso comum: o negócio não existe (duplicado, criado por engano, lead que nunca foi lead),
   * mas a pessoa continua sendo alguém com quem já se falou. Apagar o contato junto seria perder
   * histórico de atendimento por causa de um card errado.
   */
  function excluirNegocio(coluna: number, card: number) {
    if (!funilAtivo) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c, i) =>
          i !== coluna ? c : { ...c, cards: c.cards.filter((_, j) => j !== card), total: c.cards.length - 1 },
        );
        return { ...f, colunas };
      }),
    );
    setDesfechoMenu(null);
  }

  /**
   * Apaga o lead inteiro: o card, o contato e a conversa com as mensagens.
   *
   * Irreversível, e por isso pergunta antes dizendo exatamente o que sai. Contato e conversa são
   * procurados pelo nome NORMALIZADO (`chaveDeContato`), que é como o resto do CRM casa as três
   * coisas: o mesmo lead chega escrito de formas diferentes por canais diferentes.
   */
  function excluirLeadInteiro(coluna: number, card: number, nome: string) {
    const confirmado = window.confirm(
      traduzir(
        'Apagar "{nome}" do CRM?\n\nSaem o card do funil, o contato e a conversa com todas as mensagens.\n\nIsso não tem como desfazer.',
        { nome },
      ),
    );
    if (!confirmado) return;

    const chave = chaveDeContato(nome);
    const contato = contatos.find((c) => chaveDeContato(c.nome) === chave);
    if (contato) excluirContato(contato.id);
    const conversa = conversas.find((c) => chaveDeContato(c.nome) === chave);
    if (conversa) excluirConversa(conversa.id);
    excluirNegocio(coluna, card);
  }

  function reabrirNegocio(coluna: number, card: number) {
    if (!funilAtivo) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c, i) => {
          if (i !== coluna) return c;
          return {
            ...c,
            cards: c.cards.map((cd, j) =>
              j !== card ? cd : { ...cd, statusFechamento: null, motivoPerda: null, dataFechamento: null },
            ),
          };
        });
        return { ...f, colunas };
      }),
    );
    setDesfechoMenu(null);
  }

  function passaNoFiltro(card: { origem: string; data: string }) {
    if (origensFiltro.size > 0 && !origensFiltro.has(card.origem)) {
      return false;
    }
    if (dataDe && card.data < dataDe) return false;
    if (dataAte && card.data > dataAte) return false;
    return true;
  }

  function alternarOrigemFiltro(origem: string) {
    setOrigensFiltro((prev) => {
      const next = new Set(prev);
      if (next.has(origem)) next.delete(origem);
      else next.add(origem);
      return next;
    });
  }

  const filtroAtivo = origensFiltro.size > 0 || dataDe !== "" || dataAte !== "";

  const totalVisivel =
    funilAtivo?.colunas.reduce((soma, coluna) => {
      const cards = filtroAtivo
        ? coluna.cards.filter(passaNoFiltro)
        : coluna.cards;
      return soma + (filtroAtivo ? cards.length : coluna.total);
    }, 0) ?? 0;

  /** Os números que ainda podem virar funil: conectados e sem quadro próprio. */
  const numerosLivres = numerosDisponiveis(numerosDeWhats ?? [], funis);

  /** Os números DESTE funil — é entre eles que cada etapa escolhe quem responde. */
  const numerosDesteFunil = numerosDoFunilNaTela(numerosDeWhats ?? [], funilAtivo);

  /*
   * ENCAMINHAR UM NEGÓCIO PRA OUTRA ETAPA.
   *
   * A lista de destinos é buscada na PRIMEIRA abertura e fica — ela muda quando alguém cria uma
   * etapa, não entre dois cliques. Buscar a cada abertura seria uma ida ao servidor pra desenhar o
   * mesmo menu.
   */
  const [encaminhando, setEncaminhando] = useState<{ cardId: string; rect: DOMRect } | null>(null);
  const [destinos, setDestinos] = useState<
    { id: string; titulo: string; funilId: string; funilNome: string }[] | null
  >(null);

  function abrirEncaminhar(cardId: string, rect: DOMRect) {
    setEncaminhando({ cardId, rect });
    if (destinos) return;
    fetch("/api/funis/etapas")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDestinos)
      .catch((erro) => {
        console.error("Falha ao carregar as etapas de destino:", erro);
        setDestinos([]);
      });
  }

  async function criarFunil() {
    const nome = nomeDoFunil(sufixoNovoFunil);
    if (!nome || numerosNovoFunil.length === 0 || criandoFunil) return;

    setCriandoFunil(true);
    setErroNovoFunil(null);
    const carimbo = Date.now();
    const novo = {
      id: `funil-${carimbo}`,
      nome,
      // Vazio vira `undefined`: "ninguém em especial" é uma escolha, e gravar string vazia faria
      // o filtro por responsável enxergar um atendente chamado "".
      responsavel: atendenteNovoFunil.trim() || undefined,
      /* O primeiro continua indo em `contaCanal` pro que ainda lê um número só; a lista inteira
         vai em `contaCanais`. Ver `numerosDoFunil`. */
      contaCanal: numerosNovoFunil[0],
      contaCanais: numerosNovoFunil,
      colunas: [
        { id: `novo-${carimbo}`, titulo: "Novo", total: 0, cards: [] },
        { id: `qualificado-${carimbo}`, titulo: "Qualificado", total: 0, cards: [] },
        { id: `proposta-${carimbo}`, titulo: "Proposta", total: 0, cards: [] },
        { id: `fechado-${carimbo}`, titulo: "Fechado", total: 0, cards: [] },
      ],
    };

    const { ok, erro } = await criarFunilPersistido(novo);
    if (!ok) {
      // O erro da rota é específico ("esse número já é do funil X") e precisa aparecer AQUI, no
      // formulário, não só na faixa de sincronização lá em cima: é aqui que a pessoa está olhando.
      setErroNovoFunil(erro ?? traduzir("Não foi possível criar o funil."));
      setCriandoFunil(false);
      return;
    }

    setFunilAtivoId(novo.id);
    setAtendenteNovoFunil("");
    setSufixoNovoFunil("");
    setNumerosNovoFunil([]);
    setNovoFunilAberto(false);

    /*
     * O QUADRO JÁ NASCE COM AS CONVERSAS DAQUELE NÚMERO.
     *
     * "Na hora que eu criar, que eu escolher o número, todas as conversas que tiver lá no chat do
     * WhatsApp daquele número vão vir para o funil que representa aquele número."
     *
     * Quem faz isso é a reconciliação, que desde agora manda cada conversa pro funil do número
     * dela. Chamando-a aqui, o quadro novo abre cheio em vez de abrir vazio e só ir enchendo com
     * as mensagens seguintes — que, pra quem acabou de escolher o número, pareceria que não
     * funcionou.
     *
     * Falhar aqui não desfaz o funil: ele existe e a reconciliação roda sozinha de hora em hora.
     */
    await fetch("/api/funis/importar-conversas", { method: "POST" }).catch(() => null);
    await recarregarFunis().catch(() => []);
    setCriandoFunil(false);
  }

  function criarNegocio() {
    const nome = nomeNegocio.trim();
    if (!nome || !funilAtivo) return;
    const novoCard: NegocioCard = {
      id: `negocio-${Date.now()}`,
      nome,
      valor: valorNegocio.trim() || "-",
      origem: origemNegocio,
      dias: "Hoje",
      data: HOJE_ISO,
    };
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c) => ({ ...c, cards: [...c.cards] }));
        colunas[0].cards.push(novoCard);
        colunas[0].total += 1;
        return { ...f, colunas };
      }),
    );
    setNomeNegocio("");
    setValorNegocio("");
    setOrigemNegocio(ORIGENS_NEGOCIO[0]);
    setNovoNegocioAberto(false);
  }

  function moverCard(colunaDestino: number) {
    if (!arrastando || !funilAtivo) return;
    const { coluna: colunaOrigem, card: indiceCard } = arrastando;
    setArrastando(null);
    if (colunaOrigem === colunaDestino) return;

    const cardMovido = funilAtivo.colunas[colunaOrigem]?.cards[indiceCard];
    const etapaDestino = funilAtivo.colunas[colunaDestino];

    /*
     * ARRASTAR UM CARD NÃO DEVOLVE O QUADRO INTEIRO PRO BANCO.
     *
     * A gravação já acontece em `/api/funis/mover`, logo abaixo — uma instrução, instantânea, e é
     * ela que dispara o gatilho da etapa no servidor. Só que mexer no estado com `setFunis` cru
     * acordava TAMBÉM o sync geral do contexto, que manda o funil inteiro num PUT. Com trinta e
     * dois cards numa coluna e sete etapas, essa transação estourava o prazo e trazia "o banco
     * demorou demais pra responder. Parte do funil pode não ter sido salva".
     *
     * O pior dos dois mundos: o card JÁ estava salvo, e o erro na tela dizia o contrário — e quem
     * recarregasse por causa do aviso veria o card no lugar certo, sem entender nada.
     *
     * `aplicarSemGravar` muda a tela e não agenda PUT nenhum. O que grava é a rota de mover, que
     * confere o resultado e relê o funil se o banco recusar.
     */
    aplicarSemGravar((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c) => ({ ...c, cards: [...c.cards] }));
        const [card] = colunas[colunaOrigem].cards.splice(indiceCard, 1);
        if (!card) return f;
        colunas[colunaOrigem].total = Math.max(0, colunas[colunaOrigem].total - 1);
        // No TOPO, não no fim: espelha o que o servidor grava (ver /api/funis/mover). Sem isso a
        // tela mostraria o card embaixo até o próximo carregamento, e ele saltaria de lugar sozinho.
        colunas[colunaDestino].cards.unshift(card);
        colunas[colunaDestino].total += 1;
        return { ...f, colunas };
      }),
    );

    if (cardMovido && etapaDestino) {
      // Grava na hora e CONFERE o resultado. Antes a chamada era disparada e esquecida: se o banco
      // recusasse, o card ficava na etapa nova só na tela e voltava no F5 seguinte. Sem erro em
      // lugar nenhum. Agora, se a gravação falhar, `moverNegocio` relê o funil do banco e a tela
      // volta ao que realmente está salvo.
      void moverNegocio({ cardId: cardMovido.id, etapaId: etapaDestino.id });

      // O gatilho "entrou na etapa" NÃO roda mais aqui. Ele acontece no servidor, dentro de
      // `/api/funis/mover`: assim a automação vale pra qualquer caminho que mova o card
      // (importação, webhook, outra aba) e não só pra quem estava com esta tela aberta.
    }
  }

  async function criarEtapa() {
    const titulo = nomeNovaEtapa.trim();
    if (!titulo || !funilAtivo) return;
    // Grava ANTES de aparecer na tela. Antes a etapa entrava no estado e dependia do sync geral do
    // funil pra ser salva: quando aquele sync falhava, ela sumia no F5 sem nenhum aviso.
    const { ok } = await criarEtapaPersistida(funilAtivo.id, { id: `etapa-${Date.now()}`, titulo });
    if (!ok) return;
    setNomeNovaEtapa("");
    setNovaEtapaAberta(false);
  }

  function renomearEtapa(colIndex: number) {
    const titulo = nomeRenomeando.trim();
    if (!titulo || !funilAtivo) {
      setColunaRenomeando(null);
      return;
    }
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c, i) =>
          i === colIndex ? { ...c, titulo } : c,
        );
        return { ...f, colunas };
      }),
    );
    setColunaRenomeando(null);
  }

  /** Distância da borda em que o quadro começa a rolar, e o passo de cada quadro de animação. */
  const MARGEM_ROLAGEM = 90;
  const PASSO_ROLAGEM = 18;

  function rolarQuadroNaBorda(e: React.DragEvent<HTMLDivElement>) {
    const quadro = kanbanRef.current;
    if (!quadro) return;
    const caixa = quadro.getBoundingClientRect();
    const daEsquerda = e.clientX - caixa.left;
    const daDireita = caixa.right - e.clientX;
    if (daDireita < MARGEM_ROLAGEM) quadro.scrollLeft += PASSO_ROLAGEM;
    else if (daEsquerda < MARGEM_ROLAGEM) quadro.scrollLeft -= PASSO_ROLAGEM;
  }

  function reordenarEtapa(origem: number, destino: number) {
    setColunaArrastando(null);
    if (!funilAtivo || origem === destino) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = [...f.colunas];
        const [movida] = colunas.splice(origem, 1);
        if (!movida) return f;
        colunas.splice(destino, 0, movida);
        return { ...f, colunas };
      }),
    );
  }

  function excluirEtapa(colIndex: number) {
    if (!funilAtivo) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        return { ...f, colunas: f.colunas.filter((_, i) => i !== colIndex) };
      }),
    );
    // Os gatilhos da etapa somem junto pelo BANCO: `GatilhoEtapa.etapa` tem `onDelete: Cascade`.
    // Aqui havia uma chamada a `excluirAutomacoesDaEtapa`, do contexto de automações, que mexia
    // num array de exemplo em memória e não tocava em nada real. Parecia que limpava.
  }

  return (
    <>
      {/* Gravação recusada pelo banco. Aparece porque o pior comportamento possível aqui é a tela
          mostrar uma mudança que não existe: a pessoa arrasta o lead, vê ele na etapa nova, e só
          descobre no dia seguinte que ele nunca saiu do lugar. */}
      {transferindo ? (
        <TransferirNegocio
          cardId={transferindo.id}
          nomeDoNegocio={transferindo.nome}
          responsavelAtual={transferindo.responsavel}
          aoFechar={() => setTransferindo(null)}
        />
      ) : null}

      {erroSincronizacao ? (
        <div className="funil-erro-sync" role="alert">
          <span>{erroSincronizacao}</span>
          <button type="button" onClick={limparErroSincronizacao} aria-label={traduzir("Fechar aviso")}>
            ×
          </button>
        </div>
      ) : null}
      <Topbar
        title={traduzir("Funil comercial")}
        actions={
          <>
            {/* "Alinhar com Conversas" e "Mensagens recentes no topo" saíram da barra.
                Os dois eram manutenção, não trabalho de quem vende: o alinhamento já roda pelo
                relógio sozinho, e a reordenação por atividade é preferência de visualização, não
                um comando que se aperta toda hora. Numa barra onde moram "Novo funil" e "Criar
                etapa", eles disputavam espaço com o que a pessoa realmente veio fazer. */}
            {/* A limpeza do cenário fictício, NO FUNIL e não só em Configurações.
                É aqui que se vê o problema — cards de gente que não existe — e era em
                Configurações → WhatsApp que estava o conserto. O componente se esconde sozinho
                fora da conta de demonstração, então nenhum cliente real vê este botão.

                RECARREGA A PÁGINA INTEIRA em vez de só reler os funis, e isso não é exagero: a
                gravação do funil é debouncada em 500ms (ver `funis-context`). Uma alteração feita
                pouco antes do clique deixa um `setTimeout` pendente com o estado ANTIGO, que
                dispara depois da limpeza e manda de volta o funil com os cards que acabaram de ser
                apagados. O PUT reconcilia, então eles voltam — com os mesmos ids. Recarregar mata
                o timer junto com a página. */}
            <LimparDemonstracao compacto aoLimpar={() => window.location.reload()} />
            {/* Só existe enquanto houver o que juntar, e some sozinho depois. Botão de manutenção
                permanente dentro do produto é conta que o cliente paga. */}
            {cardsDuplicados > 0 ? (
              <button
                type="button"
                className="btn terciario"
                disabled={juntando}
                title={traduzir("A mesma pessoa está em mais de um negócio. Fica o que está mais à frente no funil.")}
                onClick={() => void juntarDuplicados()}
              >
                {juntando ? "Juntando…" : `Juntar ${cardsDuplicados} repetido(s)`}
              </button>
            ) : null}
            <button
              type="button"
              className="btn ghost"
              onClick={() => setNovaEtapaAberta((v) => !v)}
            >
              {novaEtapaAberta ? traduzir("Cancelar") : traduzir("+ Criar nova etapa")}
            </button>
            {/* Ação principal da página. */}
            <button
              type="button"
              className="btn primary"
              onClick={() => setNovoFunilAberto((v) => !v)}
            >
              {novoFunilAberto ? traduzir("Cancelar") : traduzir("+ Novo funil")}
            </button>
            <button
              type="button"
              className={`btn ghost${filtroAberto || filtroAtivo ? " active" : ""}`}
              onClick={() => setFiltroAberto((v) => !v)}
            >
              {filtroAberto ? traduzir("Fechar filtro") : traduzir("+ Filtrar")}
            </button>
            {/* Troca o quadro de negócios pelo quadro de AUTOMAÇÃO: as mesmas colunas, mostrando
                o que cada etapa dispara sozinha em vez dos cards. */}
            <button
              type="button"
              className={`btn ghost${modoAutomatizar ? " active" : ""}`}
              onClick={() => setModoAutomatizar((v) => !v)}
              title={traduzir("Ver e configurar o que cada etapa dispara sozinha")}
            >
              {modoAutomatizar ? traduzir("Ver negócios") : traduzir("Automatizar")}
            </button>
            {/*
              DE QUAL NÚMERO É ESTE FUNIL — texto fixo, não seletor.
              
              Aqui havia um botão pra trocar o número do funil, e ele estava errado: "nenhum funil
              pode ter mais do que um número (…) se eu quiser mudar, eu tenho que excluir esse funil
              e criar outro". O número é escolhido na criação e não muda, porque trocá-lo num quadro
              que já tem cards mistura duas caixas de entrada e não há como desfazer depois.
              
              Continua aparecendo porque a pergunta continua valendo ("tem que ter a opção de ver
              qual que é o número do funil") — só que a resposta é uma informação, não um controle.
            */}
            {rotuloDoNumeroAtivo ? (
              <span className="hint" style={{ alignSelf: "center", whiteSpace: "nowrap" }}>
                {rotuloDoNumeroAtivo}
              </span>
            ) : null}
            {funilAtivo ? (
              <div className="dropdown-anchor">
                <button
                  type="button"
                  className="icon-btn subtle"
                  aria-label={`Configurações do funil ${funilAtivo.nome}`}
                  onClick={(e) => {
                    if (configAberto) {
                      setConfigAberto(false);
                    } else {
                      setConfigAnchorRect(e.currentTarget.getBoundingClientRect());
                      setConfigAberto(true);
                    }
                  }}
                >
                  <IconConfiguracoes width={14} height={14} />
                </button>
                {configAberto && configPos && typeof document !== "undefined"
                  ? createPortal(
                      <>
                        <div
                          onClick={() => setConfigAberto(false)}
                          style={{ position: "fixed", inset: 0, zIndex: 190 }}
                        />
                        <div
                          ref={configPopRef}
                          className="dropdown-pop"
                          style={{ position: "fixed", top: configPos.top, left: configPos.left, zIndex: 200 }}
                        >
                      <Link
                        href={`/automacoes?funil=${funilAtivo.id}`}
                        className="dropdown-item"
                        onClick={() => setConfigAberto(false)}
                      >
                        <span className="n">{traduzir("Ver automações desse funil")}</span>
                        <span className="r">
                          {traduzir("Abre o quadro de automações, uma por etapa")}
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        disabled={funis.length <= 1}
                        onClick={() => {
                          if (funis.length <= 1) return;
                          if (
                            window.confirm(
                              traduzir('Excluir o funil "{nome}"? Os negócios e as automações dele somem junto.', {
                                nome: funilAtivo.nome,
                              }),
                            )
                          ) {
                            // Etapas e gatilhos caem por cascade no banco (Funil → FunilEtapa →
                            // GatilhoEtapa), então o aviso acima é verdade. A chamada que existia
                            // aqui só limpava um array de exemplo no navegador.
                            excluirFunil(funilAtivo.id);
                          }
                          setConfigAberto(false);
                        }}
                      >
                        <span className="n">{traduzir("Excluir funil")}</span>
                        <span className="r">
                          {funis.length <= 1
                            ? "Precisa ter pelo menos um funil"
                            : traduzir("Remove esse funil e os negócios dele")}
                        </span>
                      </button>
                        </div>
                      </>,
                      document.body,
                    )
                  : null}
              </div>
            ) : null}
          </>
        }
      />

      {/* `content-funil`: o quadro ocupa a altura que sobra da janela. Ver `.content-funil` no
          globals.css — e o que faz a etapa ir ate a borda de baixo em vez de parar na altura do
          ultimo cartao. */}
      <div className="content content-funil">
        {novaEtapaAberta ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">{traduzir("Nova etapa")}</p>
                <p className="s">
                  Entra como uma coluna nova no funil {funilAtivo?.nome}
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovaEtapaAberta(false)}
              >
                {traduzir("Fechar")} <IconClose width={11} height={11} />
              </span>
            </div>
            <div className="field">
              <label>{traduzir("Nome da etapa")}</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeNovaEtapa}
                onChange={(e) => setNomeNovaEtapa(e.target.value)}
                placeholder={traduzir("Ex.: Retorno agendado")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") criarEtapa();
                }}
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={criarEtapa}
              >
                {traduzir("Criar etapa")}
              </button>
            </div>
          </section>
        ) : null}

        {novoFunilAberto ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">{traduzir("Novo funil")}</p>
                <p className="s">
                  Cada funil é de UM número de WhatsApp, escolhido agora e fixo depois: as conversas
                  daquele número entram aqui, e só elas. Pra trocar o número, é criar outro funil.
                  Já sai com o modelo pronto: Novo, Qualificado, Proposta, Fechado.
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovoFunilAberto(false)}
              >
                {traduzir("Fechar")} <IconClose width={11} height={11} />
              </span>
            </div>
            {/*
              O NÚMERO VEM PRIMEIRO, e a ordem dos campos é a ordem da decisão: é ele que define o
              funil, e é dele que sai o nome sugerido. Perguntar o nome antes faria a pessoa
              escrever e depois descobrir que o número que ela queria já tem quadro.
            */}
            <div className="field">
              <label>{traduzir("Números deste funil")}</label>
              {/*
                CAIXAS, E NÃO UMA LISTA DE ESCOLHA ÚNICA.

                O seletor de uma opção dizia, pela própria forma, que só cabia um — e cabia mesmo,
                até agora. Com vários, a lista de caixas mostra de uma vez TODOS os números livres
                e quais estão marcados, que é a pergunta que a pessoa tem na cabeça ("quais entram
                neste quadro?"). Num `<select multiple>` ela precisaria segurar Ctrl pra marcar o
                segundo, e quem não sabe disso conclui que continua cabendo um só.
              */}
              <div className="funil-numeros-lista">
                {numerosLivres.map((n) => {
                  const marcado = numerosNovoFunil.includes(n.chave);
                  return (
                    <label key={n.chave} className={`funil-numero-opcao${marcado ? " on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => {
                          setErroNovoFunil(null);
                          setNumerosNovoFunil((atuais) => {
                            const novos = marcado
                              ? atuais.filter((c) => c !== n.chave)
                              : [...atuais, n.chave];
                            /* O nome segue o PRIMEIRO número enquanto ninguém escreveu nada.
                               Depois de digitar, a escolha é dela: marcar outro número não pode
                               apagar o nome que ela deu. */
                            if (!sufixoNovoFunil.trim()) {
                              setSufixoNovoFunil(
                                sufixoSugerido(numerosLivres.find((x) => x.chave === novos[0])),
                              );
                            }
                            return novos;
                          });
                        }}
                      />
                      <span className="funil-numero-nome">{n.nome}</span>
                      <span className="funil-numero-canal">{traduzir(canalDoNumero(n.provedor))}</span>
                    </label>
                  );
                })}
              </div>
              <p className="hint" style={{ marginTop: 6 }}>
                {numerosDeWhats === null
                  ? traduzir("Carregando os números conectados…")
                  : numerosLivres.length === 0
                    ? traduzir(
                        "Todos os números conectados já têm funil. Um número alimenta um funil só — apague um funil para liberar o número dele.",
                      )
                    : traduzir(
                        "Pode marcar quantos quiser: tudo que chegar por eles cai neste mesmo quadro. Um número alimenta um funil só, então os que já têm quadro não aparecem aqui.",
                      )}
              </p>
            </div>

            <div className="field">
              <label>{traduzir("Nome do funil")}</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* O prefixo é fixo e aparece FORA do campo: dentro dele, a pessoa poderia apagá-lo
                    sem querer e o nome deixaria de seguir o padrão da lista. */}
                <strong style={{ whiteSpace: "nowrap" }}>{PREFIXO_DO_NOME}</strong>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  type="text"
                  value={sufixoNovoFunil}
                  onChange={(e) => setSufixoNovoFunil(e.target.value)}
                  placeholder={traduzir("Ex.: Meta oficial")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void criarFunil();
                  }}
                />
              </div>
            </div>

            <div className="field">
              <label>{traduzir("Atendente responsável")}</label>
              <select
                className="input"
                style={{ width: "100%", cursor: "pointer" }}
                value={atendenteNovoFunil}
                onChange={(e) => setAtendenteNovoFunil(e.target.value)}
              >
                {/* "Ou eu tenho a opção de não escolher ninguém, de simplesmente quem entrar aqui
                    responde." É a primeira opção porque é o padrão de quem atende em equipe. */}
                <option value="">{traduzir("Ninguém — quem estiver atendendo responde")}</option>
                {equipe.map((m) => (
                  <option key={m.id} value={m.nome}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            {erroNovoFunil ? (
              <p className="hint" style={{ color: "var(--erro, #c0392b)" }}>
                {erroNovoFunil}
              </p>
            ) : null}

            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                disabled={criandoFunil || numerosNovoFunil.length === 0 || !nomeDoFunil(sufixoNovoFunil)}
                onClick={() => void criarFunil()}
              >
                {criandoFunil ? traduzir("Criando e trazendo as conversas…") : traduzir("Criar funil")}
              </button>
            </div>
          </section>
        ) : null}

        {novoNegocioAberto ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">{traduzir("Criar negociação")}</p>
                <p className="s">
                  Entra na etapa &quot;{funilAtivo?.colunas[0]?.titulo}&quot; do
                  funil {funilAtivo?.nome}
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovoNegocioAberto(false)}
              >
                {traduzir("Fechar")} <IconClose width={11} height={11} />
              </span>
            </div>
            <div className="field">
              <label>{traduzir("Nome do contato")}</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeNegocio}
                onChange={(e) => setNomeNegocio(e.target.value)}
                placeholder={traduzir("Ex.: Marina Costa")}
              />
            </div>
            <div className="field">
              <label>{traduzir("Valor (opcional)")}</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={valorNegocio}
                onChange={(e) => setValorNegocio(e.target.value)}
                placeholder="Ex.: R$ 890"
              />
            </div>
            <div className="field">
              <label>{traduzir("Origem")}</label>
              <ChipFilters
                options={ORIGENS_NEGOCIO}
                initial={ORIGENS_NEGOCIO.indexOf(origemNegocio)}
                onChange={(o) => setOrigemNegocio(o as NegocioCard["origem"])}
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={criarNegocio}
              >
                {traduzir("Criar negociação")}
              </button>
            </div>
          </section>
        ) : null}

        {filtroAberto ? (
          <section className="card mb14">
            <div className="panel-h">
              <h4>{traduzir("Filtrar: qual origem e qual período")}</h4>
            </div>
            <div className="field">
              <label>{traduzir("Origem do lead: pode escolher mais de uma")}</label>
              <div className="filters-row">
                <button
                  type="button"
                  className={`fchip${origensFiltro.size === 0 ? " active" : ""}`}
                  aria-pressed={origensFiltro.size === 0}
                  onClick={() => setOrigensFiltro(new Set())}
                >
                  {traduzir("Todas as origens")}
                </button>
                {ORIGENS_NEGOCIO.map((origem) => (
                  <button
                    type="button"
                    key={origem}
                    className={`fchip${origensFiltro.has(origem) ? " active" : ""}`}
                    aria-pressed={origensFiltro.has(origem)}
                    onClick={() => alternarOrigemFiltro(origem)}
                  >
                    {origem}
                  </button>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                padding: "0 17px 14px",
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <div className="field" style={{ padding: 0, flex: "1 1 160px" }}>
                <label>De</label>
                <SeletorDeData valor={dataDe} onChange={setDataDe} />
              </div>
              <div className="field" style={{ padding: 0, flex: "1 1 160px" }}>
                <label>{traduzir("Até")}</label>
                <SeletorDeData valor={dataAte} onChange={setDataAte} />
              </div>
              {filtroAtivo ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setOrigensFiltro(new Set());
                    setDataDe("");
                    setDataAte("");
                  }}
                >
                  {traduzir("Limpar filtros")}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {modoAutomatizar && funilAtivo ? (
          <AutomacaoDoFunil
            funilId={funilAtivo.id}
            funilNome={funilAtivo.nome}
            colunas={funilAtivo.colunas.map((c) => ({ id: c.id, titulo: c.titulo, total: c.total }))}
            onFechar={() => setModoAutomatizar(false)}
          />
        ) : (
        <div
          className="kanban"
          ref={kanbanRef}
          /* O quadro rola na horizontal, e o arraste nativo do HTML não rola sozinho: a etapa (ou
             o card) que está fora da tela à direita era simplesmente inalcançável. Daí a sensação
             de que só dava pra arrastar pra esquerda. Perto de qualquer uma das bordas, o quadro
             passa a rolar enquanto o ponteiro estiver ali. */
          onDragOver={rolarQuadroNaBorda}
        >
          {funilAtivo?.colunas.map((coluna, colIndex) => {
            const cardsComIndice = coluna.cards.map((card, cardIndex) => ({
              card,
              cardIndex,
            }));
            const cardsVisiveis = filtroAtivo
              ? cardsComIndice.filter(({ card }) => passaNoFiltro(card))
              : cardsComIndice;

            // Conta os fluxos REAIS ligados a esta etapa. Antes vinha de um catálogo em memória que
            // nunca era gravado e nunca rodava. A etapa anunciava "2 automações" que não existiam.
            const automacoesEtapa = funilAtivo
              ? fluxos.filter(
                  (f) => f.funilId === funilAtivo.id && f.etapaId === coluna.id && f.status === "publicado" && !f.arquivada,
                )
              : [];

            return (
              <div
                key={coluna.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (colunaArrastando !== null) {
                    reordenarEtapa(colunaArrastando, colIndex);
                  } else {
                    moverCard(colIndex);
                  }
                }}
                style={{
                  minHeight: 60,
                  opacity: colunaArrastando === colIndex ? 0.5 : 1,
                }}
              >
                <div className="kcol-topo">
                  <div className="kcol-h">
                    <span
                      className="kcol-drag-handle"
                      draggable
                      onDragStart={(e) => {
                        setColunaArrastando(colIndex);
                        // O Safari só inicia um arraste se o `dataTransfer` receber algum dado.
                        // Sem isto o arraste até começa visualmente em alguns casos, mas o `drop`
                        // nunca chega ao destino: era por isso que reordenar etapa funcionava de
                        // um jeito e falhava de outro.
                        e.dataTransfer.setData("text/plain", String(colIndex));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setColunaArrastando(null)}
                      title={traduzir("Arraste pra reordenar a etapa")}
                    >
                      ⠿
                    </span>
                    {colunaRenomeando === colIndex ? (
                      <input
                        className="input"
                        autoFocus
                        style={{ flex: 1, marginRight: 8 }}
                        value={nomeRenomeando}
                        onChange={(e) => setNomeRenomeando(e.target.value)}
                        onBlur={() => renomearEtapa(colIndex)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renomearEtapa(colIndex);
                          if (e.key === "Escape") setColunaRenomeando(null);
                        }}
                      />
                    ) : (
                      <span
                        className="t"
                        style={{ cursor: "pointer" }}
                        title={traduzir("Clique pra renomear")}
                        onClick={() => {
                          setColunaRenomeando(colIndex);
                          setNomeRenomeando(coluna.titulo);
                        }}
                      >
                        <span className="dot" />
                        {coluna.titulo}
                      </span>
                    )}
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
                      <span className="c">
                        {filtroAtivo ? cardsVisiveis.length : coluna.total}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Excluir etapa ${coluna.titulo}`}
                        title={traduzir("Excluir etapa")}
                        style={{ cursor: "pointer", color: "var(--text-faint)" }}
                        onClick={() => excluirEtapa(colIndex)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            excluirEtapa(colIndex);
                          }
                        }}
                      >
                        <IconClose width={11} height={11} />
                      </span>
                    </span>
                  </div>
                  {/*
                    QUAL NÚMERO RESPONDE ESTA ETAPA.

                    "Dentro de cada etapa, cada quadro, eu escolher qual número que vai responder
                    aquele quadro. Por exemplo, no quadro de proposta é o closer: eu quero colocar
                    o número do closer ali, que é ele que vai responder."

                    Mora no cabeçalho da coluna, e não numa tela de configuração à parte, porque é
                    aqui que a pergunta nasce — olhando o quadro e decidindo de quem ele é. Só
                    aparece quando o funil tem MAIS DE UM número: com um só não há escolha, e um
                    seletor que não escolhe ensina a desconfiar dos que escolhem.
                  */}
                  {funilAtivo && numerosDesteFunil.length > 1 ? (
                    <select
                      className="kcol-numero"
                      value={coluna.contaCanal ?? ""}
                      aria-label={`Número que responde a etapa ${coluna.titulo}`}
                      title={traduzir(
                        "Quem responder um lead desta etapa fala por este número. Sem escolher, a resposta sai pelo número por onde a conversa veio.",
                      )}
                      onChange={(e) =>
                        void salvarAparenciaDaEtapa(funilAtivo.id, coluna.id, {
                          contaCanal: e.target.value || null,
                        })
                      }
                    >
                      <option value="">{traduzir("Responde pelo número da conversa")}</option>
                      {numerosDesteFunil.map((n) => (
                        <option key={n.chave} value={n.chave}>
                          {n.nome} · {traduzir(canalDoNumero(n.provedor))}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {funilAtivo ? (
                    <Link
                      href={`/automacoes?funil=${funilAtivo.id}&etapa=${coluna.id}${automacoesEtapa.length === 0 ? "&criar=1" : ""}`}
                      className="kcol-auto-link"
                      title={
                        automacoesEtapa.length > 0
                          ? "Ver as automações que rodam quando o lead entra nesta etapa"
                          : "Criar uma automação que roda quando o lead entrar nesta etapa"
                      }
                    >
                      <IconAutomacoes width={12} height={12} />
                      {automacoesEtapa.length > 0
                        ? `${automacoesEtapa.length} ${automacoesEtapa.length > 1 ? "automações" : "automação"}`
                        : "+ Quando entrar aqui…"}
                    </Link>
                  ) : null}
                </div>
                {/* Área de rolagem própria da etapa. Sem ela, uma etapa com 30 negócios
                    esticava a coluna e a PÁGINA inteira crescia junto: pra ver o topo da etapa
                    do lado era preciso subir a tela toda. Agora cada etapa rola por dentro e o
                    cabeçalho fica onde está. */}
                <div className="kcol-cards">
                  {cardsVisiveis.map(({ card, cardIndex }) => {
                    const conversaDoCard = acharConversa(card.nome);
                    const temMensagemNova = (conversaDoCard?.naoLidas ?? 0) > 0;
                    // "AD": lead veio de anúncio (Meta/Google Ads), não de contato direto/indicação.
                    const veioDeAnuncio = card.origem === "Meta Ads" || card.origem === "Google Ads";
                    return (
                      <button
                        type="button"
                        className="lead-card"
                        key={card.id}
                        draggable
                        onDragStart={(e) => {
                          setArrastando({ coluna: colIndex, card: cardIndex });
                          e.dataTransfer.setData("text/plain", card.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setArrastando(null)}
                        // Um clique em QUALQUER ponto do card abre a conversa, aqui mesmo.
                        //
                        // Antes era clique duplo pra ir pra tela de Conversas, e só o nome abria o
                        // popup com um clique. O card inteiro parecia clicável, quase todo ele não
                        // era, e o gesto que funcionava não estava escrito em lugar nenhum.
                        //
                        // Abre o popup, e não a outra tela, porque o dia a dia é olhar o funil,
                        // atender e voltar a arrastar: trocar de tela a cada card quebra isso.
                        // Arrastar continua intacto, porque arrastar dispara `dragstart`, não
                        // `click`.
                        // Abre pelo nome da CONVERSA quando ela existe, não pelo nome do card. Os
                        // dois são a mesma pessoa mas nem sempre a mesma string, e as mensagens
                        // estão guardadas sob o nome da conversa: abrir pelo do card mostrava o
                        // popup vazio.
                        onClick={() => setConversaAberta(conversaDoCard?.nome ?? card.nome)}
                        title={traduzir("Abrir a conversa deste lead")}
                        style={{ cursor: "grab" }}
                      >
                        {/*
                          ENCAMINHAR PRA OUTRA ETAPA, sem precisar arrastar.

                          "Vamos supor que o lead dele aceitou a proposta e quer fechar: ele pode
                          ir lá nos três pontinhos e mandar para a etapa tal. E aí ele encaminha o
                          lead dele e vai aparecer para o outro da equipe, lá no quadro dele."

                          É o escape do recorte de etapas, e sem ele o recorte vira uma cela: quem
                          só enxerga "Proposta" não enxerga "Fechado", logo não tem pra onde
                          arrastar — o lead avança até a etapa dela e para ali. A lista de destinos
                          vem de `/api/funis/etapas`, que de propósito NÃO aplica o recorte de
                          etapas (ver o comentário lá).

                          `<span role="button">` e não `<button>`: o cartão inteiro já é um botão,
                          e botão dentro de botão é HTML inválido — o navegador desmonta a árvore e
                          o clique de fora para de funcionar.
                        */}
                        <span
                          role="button"
                          tabIndex={0}
                          className="lead-encaminhar"
                          aria-label={`Encaminhar ${card.nome} para outra etapa`}
                          title={traduzir("Encaminhar para outra etapa")}
                          draggable={false}
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirEncaminhar(card.id, e.currentTarget.getBoundingClientRect());
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            e.stopPropagation();
                            abrirEncaminhar(card.id, e.currentTarget.getBoundingClientRect());
                          }}
                        >
                          ⋯
                        </span>
                        <span className="lr1">
                          {/* Sem clique próprio: o nome faz o mesmo que o resto do card, que é
                              abrir a conversa. Ter um comportamento no nome e outro dois
                              milímetros ao lado era a razão de ninguém achar a conversa. */}
                          <span className="lname lname-com-msg" draggable={false}>
            {temMensagemNova ? <span className="msg-dot" aria-label={traduzir("Mensagem nova")} /> : null}
                            {(() => {
                              /*
                               * O NOME DO CARTÃO PELA MESMA RÉGUA DA CAIXA DE ENTRADA.
                               *
                               * Quando o contato ainda se chama pelo identificador — telefone sem
                               * nome, ou um LID do WhatsApp —, o cartão mostrava os dígitos crus
                               * ("131971611123817"). `nomeExibido` formata o que é telefone e
                               * devolve os dígitos só quando não há máscara honesta a aplicar, que
                               * é exatamente o que a lista de conversas já fazia.
                               *
                               * O canal vem da CONVERSA, não de `card.origem`: origem é de onde o
                               * lead veio ("Meta Ads", "Indicação") e quem chega por anúncio do
                               * Instagram quase sempre conversa no WhatsApp. Trocar um pelo outro
                               * poria "Contato do Instagram" em cima de um telefone. Sem conversa
                               * casada, `undefined` cai no tratamento de WhatsApp, que é o que o
                               * histórico sem canal gravado sempre foi.
                               */
                              /* A foto mora na CONVERSA ou no CONTATO: o webhook grava nos dois,
                                 mas conversa antiga (de antes disso) só tem num deles. Olhar um
                                 lugar só deixava metade dos cartões sem foto. */
                              /* Card ainda chamado pelo número, com a conversa já batizada,
                                 mostra o NOME DA CONVERSA: foi ela que recebeu a mensagem com o
                                 nome de perfil. "Não aparece com o nome dela nem com as
                                 conversas" — as duas metades do mesmo problema. */
                              const nomeNoCartao = nomeExibido(
                                nomeParaOCartao(card, conversaDoCard),
                                conversaDoCard?.canal,
                              );
                              const fotoDoCard =
                                conversaDoCard?.fotoUrl ??
                                acharContato(card.nome, conversaDoCard)?.fotoUrl ??
                                null;
                              return fotoDoCard ? (
                                <>
                                  <img
                                    src={fotoDoCard}
                                    alt=""
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: "50%",
                                      marginRight: 6,
                                      objectFit: "cover",
                                      verticalAlign: "middle",
                                    }}
                                  />
                                  {nomeNoCartao}
                                </>
                              ) : (
                                nomeNoCartao
                              );
                            })()}
                            {veioDeAnuncio ? (
                              <span className="lead-card-ad-badge" title={card.origem}>
                                AD
                              </span>
                            ) : null}
                          </span>
                          <span className="lval">{ehVazio(card.valor) ? VAZIO : card.valor}</span>
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={traduzir("Marcar desfecho do negócio")}
                            title={traduzir("Marcar como ganho/perdido")}
                            className="lead-card-menu-btn"
                            draggable={false}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMotivoEscolhido("");
                              setDesfechoMenu({
                                coluna: colIndex,
                                card: cardIndex,
                                rect: e.currentTarget.getBoundingClientRect(),
                              });
                            }}
                          >
                            ⋮
                          </span>
                        </span>
                        {formatarTelefoneExibicao(conversaDoCard?.contato) ? (
                          <span className="lead-card-telefone">
                            {formatarTelefoneExibicao(conversaDoCard?.contato)}
                          </span>
                        ) : null}
                        <span className="lr2">
                          {/*
                            DE ONDE VEIO O LEAD, no cartão — a mesma etiqueta da caixa de entrada.
                            
                            "Eu preciso saber se o lead que entrou no meu chat E NO MEU FUNIL veio
                            de onde." `card.origem` é o canal por onde ele chegou ("WhatsApp",
                            "Formulário"), e isso não responde se veio de anúncio: o rastreio
                            responde, e é ele que ganha quando existe.
                          */}
                          {(() => {
                            const daOrigem = origemPorContato[chaveDeContato(card.nome)];
                            if (!daOrigem) {
                              return <span className={`tag ${classeOrigem(card.origem)}`}>{card.origem}</span>;
                            }
                            return (
                              <span
                                className={`tag ${classeOrigem(daOrigem.rotulo)}`}
                                title={
                                  daOrigem.detalhe
                                    ? `${traduzir("De onde veio este lead")}: ${daOrigem.rotulo} · ${daOrigem.detalhe}`
                                    : `${traduzir("De onde veio este lead")}: ${daOrigem.rotulo}`
                                }
                              >
                                {/* O ponto marca tráfego pago, igual na caixa de entrada. */}
                                {daOrigem.pago ? "• " : ""}
                                {traduzir(daOrigem.rotulo)}
                              </span>
                            );
                          })()}
                          {/*
                            A LEITURA DE QUEM ATENDEU, no cartão.
                            
                            Ela é dada na conversa — é lá que se sabe — e aparece AQUI porque é
                            aqui que se decide a quem ligar primeiro. Uma coluna de trinta cards
                            com três "Bom" no meio é outra coluna.
                            
                            Só mostra, não edita: o cartão inteiro já é um botão (abre a conversa),
                            e botão dentro de botão não é HTML válido nem gesto previsível. Um
                            clique leva ao lugar onde se marca.
                          */}
                          {(() => {
                            const qual = acharContato(card.nome, conversaDoCard)?.qualificacao;
                            return qual ? (
                              <span className={`lead-qual ${qual}`} title={traduzir("Qualificação do lead")}>
                                {traduzir(rotuloDaQualificacao(qual))}
                              </span>
                            ) : null;
                          })()}
                          {/* Só mostra data quando ela é REAL.
                              `card.data` é uma string gravada quando o negócio nasceu ("Hoje",
                              "Ontem") e nunca mais tocada: um card criado ontem seguia dizendo
                              "Ontem" pra sempre, e amanhã continuaria. Data errada é pior que data
                              nenhuma num lugar onde a pessoa decide a quem ligar primeiro. Quando a
                              conversa existe, a data vem da última mensagem e está sempre certa. */}
                          {/* A data vem da CONVERSA ENCONTRADA, não do nome do card: quando os
                              dois nomes divergem, procurar por `card.nome` não acha atividade
                              nenhuma e o cartão fica sem data — como se ninguém nunca tivesse
                              falado com aquela pessoa. */}
                          {conversaDoCard?.ultimaMensagemEm ? (
                            <span className="days" title={traduzir("Última mensagem deste contato")}>
                              {rotuloDeAtividade(conversaDoCard.ultimaMensagemEm)}
                            </span>
                          ) : (
                            <span className="days" title={traduzir("Ainda não há mensagem deste contato no CRM")}>{traduzir("sem conversa")}</span>
                          )}
                          {/* Diz o que o clique faz. Card clicável sem nada escrito é card que
                              ninguém clica. */}
                          <span className="lead-card-chat" aria-hidden="true">
                            chat
                          </span>
                          {card.statusFechamento === "ganho" ? (
                            <span className="stage-tag won" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><IconCheck width={11} height={11} /> {traduzir("Ganho")}</span>
                          ) : card.statusFechamento === "perdido" ? (
                            <span className="stage-tag" title={card.motivoPerda ?? undefined} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <IconErro width={11} height={11} /> {traduzir("Perdido")}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {desfechoMenu ? (
        <FloatingDropdown anchorRect={desfechoMenu.rect} onClose={() => setDesfechoMenu(null)} width={260}>
          {(() => {
            const cardAtual = funilAtivo?.colunas[desfechoMenu.coluna]?.cards[desfechoMenu.card];
            if (!cardAtual) return null;
            if (cardAtual.statusFechamento) {
              return (
                <div style={{ padding: 12 }}>
                  <p className="hint" style={{ margin: "0 0 10px" }}>
                    {cardAtual.statusFechamento === "ganho" ? "Marcado como ganho." : `Marcado como perdido${cardAtual.motivoPerda ? `: ${cardAtual.motivoPerda}` : ""}.`}
                  </p>
                  <button
                    type="button"
                    className="btn ghost block"
                    onClick={() => reabrirNegocio(desfechoMenu.coluna, desfechoMenu.card)}
                  >{traduzir("↺ Reabrir negócio")}</button>
                </div>
              );
            }
            return (
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Transferir vem primeiro: mover o lead é o que se faz todo dia; marcar ganho ou
                    perdido acontece uma vez por negócio, no fim. */}
                <button
                  type="button"
                  className="btn ghost block"
                  onClick={() => {
                    setTransferindo({ id: cardAtual.id, nome: cardAtual.nome, responsavel: cardAtual.responsavel });
                    setDesfechoMenu(null);
                  }}
                >
                  {traduzir("Transferir de funil")}
                </button>
                <button
                  type="button"
                  className="btn primary block"
                  onClick={() => marcarDesfecho(desfechoMenu.coluna, desfechoMenu.card, "ganho")}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <IconCheck width={13} height={13} /> {traduzir("Marcar como ganho")}
                </button>
                <div className="field" style={{ margin: 0 }}>
                  <label>{traduzir("Motivo da perda")}</label>
                  <select className="input" value={motivoEscolhido} onChange={(e) => setMotivoEscolhido(e.target.value)}>
                    <option value="">{traduzir("Selecione…")}</option>
                    {motivosPerda.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn danger block"
                  disabled={!motivoEscolhido}
                  onClick={() => marcarDesfecho(desfechoMenu.coluna, desfechoMenu.card, "perdido", motivoEscolhido)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <IconErro width={13} height={13} /> {traduzir("Marcar como perdido")}
                </button>

                {/* Apagar fica por último e separado por uma linha: é o que não tem volta, e
                    aparecer colado em "Marcar como ganho" convidaria ao clique errado. */}
                <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "2px 0 0" }} />
                <button
                  type="button"
                  className="btn ghost block"
                  onClick={() => excluirNegocio(desfechoMenu.coluna, desfechoMenu.card)}
                  title={traduzir("Tira o card do funil. O contato e a conversa continuam no CRM.")}
                >
                  {traduzir("Excluir negócio")}
                </button>
                <button
                  type="button"
                  className="btn danger block"
                  onClick={() => excluirLeadInteiro(desfechoMenu.coluna, desfechoMenu.card, cardAtual.nome)}
                  title={traduzir("Apaga o card, o contato e a conversa com as mensagens.")}
                >
                  {traduzir("Excluir contato e conversa")}
                </button>
              </div>
            );
          })()}
        </FloatingDropdown>
      ) : null}

      {toasts.length > 0 ? (
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div className="toast" key={toast.id}>
              <IconAutomacoes width={14} height={14} />
              {toast.texto}
            </div>
          ))}
        </div>
      ) : null}

      {conversaAberta ? (
        <PainelConversa
          contatoNome={conversaAberta}
          canal={acharConversa(conversaAberta)?.canal}
          initials={
            acharConversa(conversaAberta)?.initials ??
            conversaAberta
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("")
          }
          etapaAtual={
            funilAtivo?.colunas.find((coluna) =>
              coluna.cards.some((card) => chaveDeContato(card.nome) === chaveDeContato(conversaAberta)),
            )?.titulo
          }
          fotoUrl={
            acharConversa(conversaAberta)?.fotoUrl ??
            contatos.find((c) => chaveDeContato(c.nome) === chaveDeContato(conversaAberta))?.fotoUrl
          }
          aoFechar={() => setConversaAberta(null)}
        />
      ) : null}

      {/* O MENU DE ENCAMINHAR. No `body`, por portal: dentro da coluna ele seria cortado pelo
          `overflow` do quadro, que é onde os cards de baixo moram. */}
      <FloatingDropdown
        anchorRect={encaminhando?.rect ?? null}
        onClose={() => setEncaminhando(null)}
        width={260}
        align="right"
      >
        <div className="encaminhar-menu">
          <p className="encaminhar-h">{traduzir("Encaminhar para a etapa")}</p>
          {destinos === null ? (
            <p className="hint">{traduzir("Carregando as etapas…")}</p>
          ) : destinos.length === 0 ? (
            <p className="hint">{traduzir("Nenhuma outra etapa disponível.")}</p>
          ) : (
            destinos.map((etapa) => (
              <button
                type="button"
                key={etapa.id}
                className="dropdown-item encaminhar-item"
                onClick={() => {
                  const cardId = encaminhando?.cardId;
                  setEncaminhando(null);
                  if (cardId) void moverNegocio({ cardId, etapaId: etapa.id });
                }}
              >
                <span className="n">{etapa.titulo}</span>
                {/* O nome do funil junto: numa conta com três quadros, "Proposta" aparece três
                    vezes, e mandar pro quadro errado é silencioso. */}
                <span className="s">{etapa.funilNome}</span>
              </button>
            ))
          )}
        </div>
      </FloatingDropdown>
    </>
  );
}
