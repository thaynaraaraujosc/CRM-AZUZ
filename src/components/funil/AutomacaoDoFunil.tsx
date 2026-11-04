"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { IconAutomacoes, IconClose } from "@/components/icons";
import { CondicaoForm } from "@/components/automation-flow/forms/CondicaoForm";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { MigrarGatilhos } from "./MigrarGatilhos";
import { CabecalhoDaEtapa } from "./CabecalhoDaEtapa";
import type { DicasDaEtapa } from "@/lib/data";
import type { GrupoCondicoes } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";
import {
  ACAO_ROTULO,
  CATEGORIAS_GATILHO,
  QUANDO_ROTULO,
  type AcaoDados,
  type GatilhoEtapaVisao,
  type QuandoGatilho,
  type TipoAcaoGatilho,
} from "@/lib/funil/gatilhos-etapa-tipos";

/**
 * A camada de automação DO FUNIL, desenhada como uma GRADE.
 *
 * As etapas são as colunas, e cada gatilho ocupa uma célula da coluna da sua etapa. As linhas
 * atravessam o quadro inteiro, e é isso que faz a leitura funcionar: dá pra correr o olho por
 * uma linha e ver o que cada etapa faz naquele momento, e por uma coluna e ver tudo que uma
 * etapa dispara. Uma lista solta por coluna não dá nenhuma das duas leituras.
 *
 * Célula vazia continua desenhada. É o espaço onde falta automação, e some se a grade
 * "encolher" pra caber só o que existe.
 */

type ColunaResumo = {
  id: string;
  titulo: string;
  total?: number;
  /** A cor escolhida pra etapa. Ausente = a automática, pela posição. */
  cor?: string;
  /** O que fazer quando um lead chega nesta etapa, em três profundidades. */
  dicas?: DicasDaEtapa;
};
type RoboResumo = { id: string; nome: string; status?: string; area?: string };
type CanalConectado = { canal: string; label: string; conectado: boolean; detalhe?: string | null };

/**
 * As fontes de lead que ESTA grade atende: as duas conexões de WhatsApp, e só.
 *
 * Instagram não entra porque tem aba própria, com gatilhos que só existem lá (comentário, story,
 * menção) — deixá-lo aqui faria a pessoa montar um fluxo de Instagram nesta grade e depois ter que
 * refazer. E-mail não entra porque o disparo por e-mail vive em Disparo em massa, não como fonte
 * de lead de uma etapa do funil.
 */
const FONTES_DO_FUNIL = new Set(["whatsapp_oficial", "whatsapp_nao_oficial"]);

const DIAS = [
  { valor: 1, label: "Seg" },
  { valor: 2, label: "Ter" },
  { valor: 3, label: "Qua" },
  { valor: 4, label: "Qui" },
  { valor: 5, label: "Sex" },
  { valor: 6, label: "Sáb"},
  { valor: 7, label: "Dom" },
];

const ACOES: { tipo: TipoAcaoGatilho; descricao: string }[] = [
  { tipo: "robo", descricao: "Executa uma automação inteira, com mensagens, esperas e condições."},
  { tipo: "mensagem", descricao: "Manda um texto pelo canal da conversa do lead."},
  { tipo: "responsavel", descricao: "Passa o lead pra outra pessoa do time."},
  { tipo: "etapa", descricao: "Move o lead pra outra etapa assim que entrar nesta."},
  { tipo: "etiquetas", descricao: "Acrescenta ou tira etiquetas do contato." },
  { tipo: "webhook", descricao: "Avisa um sistema de fora que o lead chegou aqui." },
];

/**
 * A barra colorida em cima de cada etapa. A etapa não guarda cor no banco, então a cor vem da
 * POSIÇÃO e é sempre a mesma pra mesma etapa: serve pra separar as colunas de relance, não pra
 * significar alguma coisa.
 */
const CORES_ETAPA = ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#06b6d4", "#a855f7", "#f97316"];

/** Grupo novo com id próprio: o editor de condições usa o id pra saber qual subgrupo mexer. */
const grupoVazio = (): GrupoCondicoes => ({
  id: `cond-${Date.now()}`,
  tipo: "E",
  regras: [],
  subgrupos: [],
});

type Rascunho = {
  id?: string;
  etapaId: string;
  quando: QuandoGatilho;
  tipoAcao: TipoAcaoGatilho;
  fluxoId: string;
  acaoDados: AcaoDados;
  condicao: GrupoCondicoes | null;
  diasAtivos: number[];
  horaInicio: string;
  horaFim: string;
  horarioDiario: string;
  ativo: boolean;
  /** Não é campo do gatilho: é o "rodar agora nos leads que já estão aqui". */
  aplicarAosAtuais: boolean;
};

function rascunhoNovo(etapaId: string, tipoAcao: TipoAcaoGatilho): Rascunho {
  return {
    etapaId,
    quando: "movido",
    tipoAcao,
    fluxoId: "",
    acaoDados: {},
    condicao: null,
    diasAtivos: [],
    horaInicio: "",
    horaFim: "",
    horarioDiario: "",
    ativo: true,
    aplicarAosAtuais: false,
  };
}

function doGatilho(g: GatilhoEtapaVisao): Rascunho {
  return {
    id: g.id,
    etapaId: g.etapaId,
    quando: g.quando,
    tipoAcao: g.tipoAcao ?? "robo",
    fluxoId: g.fluxoId ?? "",
    acaoDados: g.acaoDados ?? {},
    condicao: g.condicao ?? null,
    diasAtivos: g.diasAtivos ?? [],
    horaInicio: g.horaInicio ?? "",
    horaFim: g.horaFim ?? "",
    horarioDiario: g.horarioDiario ?? "",
    ativo: g.ativo,
    aplicarAosAtuais: false,
  };
}

/** A linha cinza de cima do cartão: quando o gatilho dispara. */
function linhaDoQuando(g: GatilhoEtapaVisao): string {
  const base = QUANDO_ROTULO[g.quando];
  return g.quando === "diariamente" && g.horarioDiario ? `Diariamente às ${g.horarioDiario}` : base;
}

/** A linha em negrito: o que ela faz. */
function linhaDaAcao(g: GatilhoEtapaVisao, colunas: ColunaResumo[]): string {
  const dados = g.acaoDados ?? {};
  switch (g.tipoAcao ?? "robo") {
    case "robo":
      return `Executar robô: ${g.fluxoNome ?? "robô apagado"}`;
    case "responsavel":
      return `Alterar responsável do lead: ${dados.responsavel || "ninguém escolhido"}`;
    case "etapa": {
      const destino = colunas.find((c) => c.id === dados.etapaDestinoId);
      return `Mudar a etapa do lead: ${destino?.titulo ?? "etapa apagada"}`;
    }
    case "etiquetas": {
      const mais = dados.etiquetasAdicionar ?? [];
      const menos = dados.etiquetasRemover ?? [];
      const partes = [mais.length ? `+${mais.join(", ")}` : "", menos.length ? `−${menos.join(", ")}` : ""];
      return `Editar etiquetas: ${partes.filter(Boolean).join("  ") || "nada escolhido"}`;
    }
    case "webhook":
      return `Enviar um webhook: ${dados.webhookUrl || "sem endereço"}`;
    case "mensagem":
      return `Enviar mensagem: ${(dados.mensagemTexto || "sem texto").slice(0, 70)}`;
    default:
      return ACAO_ROTULO[g.tipoAcao ?? "robo"];
  }
}

const paraLista = (texto: string) => texto.split(",").map((t) => t.trim()).filter(Boolean);

/** A largura de uma etapa na grade, medida no Kommo. Ver `docs/referencia-kommo-funil.md`. */
const LARGURA_COLUNA = 305;

/**
 * Uma fileira da grade, com as faixas já juntadas.
 *
 * Devolve uma entrada por CÉLULA DESENHADA (não por coluna): quando um gatilho de grupo ocupa
 * colunas vizinhas, sai uma entrada só, com `largura` maior que 1, e as colunas cobertas não
 * aparecem de novo. É o que transforma catorze linhas iguais no banco num retângulo só na tela.
 */
function expandirLinha(
  colunas: ColunaResumo[],
  porEtapa: Map<string, GatilhoEtapaVisao[]>,
  linha: number,
): { coluna: ColunaResumo; gatilho?: GatilhoEtapaVisao; largura: number }[] {
  const saida: { coluna: ColunaResumo; gatilho?: GatilhoEtapaVisao; largura: number }[] = [];
  let i = 0;
  while (i < colunas.length) {
    const coluna = colunas[i];
    const gatilho = porEtapa.get(coluna.id)?.[linha];
    let largura = 1;
    if (gatilho?.grupoId) {
      // Anda pra direita enquanto a coluna vizinha tiver, na MESMA fileira, uma irmã do grupo.
      while (i + largura < colunas.length) {
        const vizinho = porEtapa.get(colunas[i + largura].id)?.[linha];
        if (vizinho?.grupoId !== gatilho.grupoId) break;
        largura += 1;
      }
    }
    saida.push({ coluna, gatilho, largura });
    i += largura;
  }
  return saida;
}

export function AutomacaoDoFunil({
  funilId,
  funilNome,
  colunas,
  onFechar,
  semMoldura = false,
  aoInserirEtapa,
  aoReordenarEtapas,
  aoMudarAparencia,
}: {
  funilId: string;
  funilNome?: string;
  colunas: ColunaResumo[];
  onFechar?: () => void;
  /**
   * A GRADE SOZINHA, sem o nome do funil em cima nem a coluna de fontes ao lado.
   *
   * É como a tela de Automações a usa: lá as duas coisas já estão na barra do topo, e repeti-las
   * aqui gastaria uma faixa e 260px de largura pra dizer de novo o que está escrito logo acima.
   * No funil (onde este componente abre dentro da tela do quadro) não há barra nenhuma, então a
   * moldura continua — é ela que diz de que funil se está falando.
   */
  semMoldura?: boolean;
  /** Cria uma etapa na posição dada. Sem isto, os "+" da divisa não aparecem. */
  aoInserirEtapa?: (posicao: number) => void;
  /** Grava a ordem nova das etapas. Sem isto, a alça de arraste não aparece. */
  aoReordenarEtapas?: (ids: string[]) => void;
  /** Grava cor e dicas de uma etapa. */
  aoMudarAparencia?: (etapaId: string, mudanca: { cor?: string | null; dicas?: DicasDaEtapa }) => void;
}) {
  const { t: traduzir } = useIdioma();
  const router = useRouter();
  const { recarregarFluxos } = useAutomationFlows();
  const [gatilhos, setGatilhos] = useState<GatilhoEtapaVisao[]>([]);
  const [robos, setRobos] = useState<RoboResumo[]>([]);
  const [canais, setCanais] = useState<CanalConectado[]>([]);
  const [escolhendoAcao, setEscolhendoAcao] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [criandoRobo, setCriandoRobo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Qual etapa está sendo arrastada agora. `null` fora do arraste. */
  const [etapaArrastada, setEtapaArrastada] = useState<string | null>(null);
  /** As OUTRAS etapas que este gatilho novo também cobre. Vazio = só a dele. */
  const [etapasExtras, setEtapasExtras] = useState<string[]>([]);

  /**
   * Solta a etapa arrastada na posição `destino`.
   *
   * Tira e recoloca na mesma lista, e manda a ordem INTEIRA pro servidor: mandar só "esta foi pra
   * terceira posição" deixaria o resto da numeração pro servidor adivinhar, e duas etapas na
   * mesma posição aparecem em ordem imprevisível.
   */
  function soltarEtapaEm(destino: number) {
    if (!etapaArrastada || !aoReordenarEtapas) return;
    const origem = colunas.findIndex((c) => c.id === etapaArrastada);
    setEtapaArrastada(null);
    if (origem < 0 || origem === destino) return;
    const ids = colunas.map((c) => c.id);
    const [movida] = ids.splice(origem, 1);
    ids.splice(destino, 0, movida);
    aoReordenarEtapas(ids);
  }

  const recarregar = useCallback(async () => {
    const resposta = await fetch(`/api/funis/gatilhos?funilId=${encodeURIComponent(funilId)}`);
    if (!resposta.ok) return;
    setGatilhos((await resposta.json()) as GatilhoEtapaVisao[]);
  }, [funilId]);

  // Em `.then`, não em `await` dentro do efeito: o efeito precisa devolver a função de limpeza na
  // hora, e a resposta de um funil antigo não pode chegar depois da troca e sobrescrever a lista.
  useEffect(() => {
    let vivo = true;
    fetch(`/api/funis/gatilhos?funilId=${encodeURIComponent(funilId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: GatilhoEtapaVisao[]) => {
        if (vivo) setGatilhos(lista);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [funilId]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/automacoes-fluxos")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: RoboResumo[]) => {
        // O funil é comercial por definição, e um robô do Instagram escolhido aqui não roda: o
        // motor recusa por área. Ele aparecia na lista mesmo assim, e escolher uma opção que nunca
        // acontece é pior do que não ter a opção. Robô sem área é anterior à separação das duas e
        // conta como comercial, igual ao resto do sistema.
        const comerciais = lista.filter((f) => (f.area ?? "comercial") !== "social");
        if (vivo) setRobos(comerciais.map((f) => ({ id: f.id, nome: f.nome, status: f.status })));
      })
      .catch(() => {});
    fetch("/api/canais")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: CanalConectado[]) => {
        if (vivo) setCanais(Array.isArray(lista) ? lista.filter((c) => c.conectado && FONTES_DO_FUNIL.has(c.canal)) : []);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const porEtapa = useMemo(() => {
    const mapa = new Map<string, GatilhoEtapaVisao[]>();
    gatilhos.forEach((g) => {
      if (!mapa.has(g.etapaId)) mapa.set(g.etapaId, []);
      mapa.get(g.etapaId)!.push(g);
    });
    return mapa;
  }, [gatilhos]);

  /**
   * Quantas linhas a grade tem.
   *
   * A etapa com mais gatilhos, mais três linhas de folga, com um mínimo de 6. A folga é o que faz
   * "posso acrescentar mais um" continuar verdadeiro depois de a coluna encher: sem ela, a última
   * linha ficava ocupada e não sobrava célula pra clicar.
   */
  const linhas = useMemo(() => {
    const maior = colunas.reduce((max, c) => Math.max(max, porEtapa.get(c.id)?.length ?? 0), 0);
    return Math.max(maior + 3, 6);
  }, [colunas, porEtapa]);

  function faltaAlgo(r: Rascunho): string | null {
    const d = r.acaoDados;
    if (r.tipoAcao === "robo" && !r.fluxoId) return "Escolha o robô que esta etapa vai executar.";
    if (r.tipoAcao === "responsavel" && !d.responsavel?.trim()) return "Escolha o novo responsável.";
    if (r.tipoAcao === "etapa" && !d.etapaDestinoId) return "Escolha a etapa de destino.";
    if (r.tipoAcao === "etiquetas" && !d.etiquetasAdicionar?.length && !d.etiquetasRemover?.length) {
      return "Diga ao menos uma etiqueta pra acrescentar ou tirar.";
    }
    if (r.tipoAcao === "webhook" && !d.webhookUrl?.trim()) return "Informe o endereço do webhook.";
    if (r.tipoAcao === "mensagem" && !d.mensagemTexto?.trim()) return "Escreva a mensagem.";
    if (r.quando === "diariamente" && !r.horarioDiario) return "Escolha a hora da varredura diária.";
    return null;
  }

  /**
   * Salva o gatilho e, quando pedido, abre o fluxograma do robô em seguida.
   *
   * Salvar ANTES de navegar não é detalhe: sair da tela com o rascunho aberto perderia tudo que a
   * pessoa acabou de configurar, e ela descobriria isso só ao voltar.
   */
  async function salvar(abrirFluxogramaDepois = false) {
    if (!rascunho) return;
    const falta = faltaAlgo(rascunho);
    if (falta) {
      setErro(falta);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const corpo = {
        etapaId: rascunho.etapaId,
        // A etapa do rascunho sempre entra: as "extras" somam a ela, não a substituem.
        ...(etapasExtras.length ? { etapasIds: [rascunho.etapaId, ...etapasExtras] } : {}),
        quando: rascunho.quando,
        tipoAcao: rascunho.tipoAcao,
        fluxoId: rascunho.tipoAcao === "robo" ? rascunho.fluxoId : null,
        acaoDados: rascunho.acaoDados,
        condicao: rascunho.condicao,
        diasAtivos: rascunho.diasAtivos,
        horaInicio: rascunho.horaInicio || null,
        horaFim: rascunho.horaFim || null,
        horarioDiario: rascunho.horarioDiario || null,
        ativo: rascunho.ativo,
      };
      const resposta = rascunho.id
        ? await fetch(`/api/funis/gatilhos/${rascunho.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo),
          })
        : await fetch("/api/funis/gatilhos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo),
          });
      if (!resposta.ok) throw new Error(String(resposta.status));
      const salvo = (await resposta.json()) as GatilhoEtapaVisao;

      // "Aplicar aos leads que já estão nesta etapa" roda DEPOIS de salvar, e só quando ela pediu:
      // é a única coisa aqui que mexe em lead de verdade na hora do clique.
      if (rascunho.aplicarAosAtuais) {
        const r = await fetch(`/api/funis/gatilhos/${salvo.id}/aplicar`, { method: "POST" });
        const dados = (await r.json().catch(() => ({}))) as { alcancados?: number };
        setAviso(
          r.ok
            ? `Aplicado a ${dados.alcancados ?? 0} lead(s) que já estavam nesta etapa.`
            : "O gatilho foi salvo, mas não deu pra aplicar aos leads que já estão aqui.",
        );
      }

      await recarregar();
      const fluxoParaAbrir = rascunho.tipoAcao === "robo" ? rascunho.fluxoId : "";
      const etapaDoGatilho = rascunho.etapaId;
      setRascunho(null);
      if (abrirFluxogramaDepois && fluxoParaAbrir) {
        // O robô passa a saber de qual funil e de qual etapa ele é. Sem isso, abrir o fluxograma
        // levava a um canvas que perguntava de novo "como esta automação deve começar?": a
        // pergunta já tinha sido respondida aqui, na etapa, e responder duas vezes é o caminho
        // curto pra o gatilho disparar duas vezes.
        // PATCH, não PUT: a rota `/api/automacoes-fluxos/[id]` só expõe PATCH e DELETE. Com PUT
        // ela respondia 405 e o `.catch` engolia o erro em silêncio, então o robô nunca aprendia
        // de qual funil/etapa ele é e o editor voltava a perguntar "como esta automação deve
        // começar?": exatamente o caminho curto pro gatilho duplicado descrito acima.
        await avisarFluxoDaEtapa(fluxoParaAbrir, etapaDoGatilho);
        router.push(`/automacoes/editor/${fluxoParaAbrir}`);
      }
    } catch {
      setErro("Não deu pra salvar o gatilho. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    // Some da tela na hora; se o servidor recusar, a recarga traz de volta. Esperar a ida e volta
    // pra sumir um item de lista faz a tela parecer travada.
    setGatilhos((atual) => atual.filter((g) => g.id !== id));
    await fetch(`/api/funis/gatilhos/${id}`, { method: "DELETE" }).catch(() => {});
    await recarregar();
  }

  /**
   * Diz ao robô de qual funil e de qual etapa ele é, antes de abrir o fluxograma.
   *
   * Se a gravação falhar, o editor abre perguntando de novo qual é o gatilho, e responder duas
   * vezes é como um mesmo lead dispara duas vezes. Então a falha vira aviso na tela em vez de
   * sumir num `catch` vazio.
   */
  async function avisarFluxoDaEtapa(fluxoId: string, etapaId: string) {
    try {
      const resposta = await fetch(`/api/automacoes-fluxos/${fluxoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funilId, etapaId }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
    } catch {
      setErro("O robô abriu, mas não guardou de qual etapa ele é. Confira o gatilho lá dentro.");
    }
  }

  /**
   * Abre o fluxograma do robô de um gatilho já salvo, direto da grade.
   *
   * Grava antes de qual funil e de qual etapa aquele robô é. É o que faz o canvas abrir sabendo
   * quando ele começa, em vez de perguntar de novo uma coisa que já foi respondida aqui.
   */
  async function abrirFluxograma(fluxoId: string, etapaId: string) {
    await avisarFluxoDaEtapa(fluxoId, etapaId);
    router.push(`/automacoes/editor/${fluxoId}`);
  }

  async function alternarAtivo(g: GatilhoEtapaVisao) {
    setGatilhos((atual) => atual.map((x) => (x.id === g.id ? { ...x, ativo: !x.ativo } : x)));
    await fetch(`/api/funis/gatilhos/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !g.ativo }),
    }).catch(() => {});
    await recarregar();
  }

  /**
   * Cria um robô vazio e já o deixa escolhido no gatilho.
   *
   * Não abre o editor na hora de propósito: o gatilho ainda não foi salvo, e sair da tela agora
   * perderia o que ela acabou de configurar. Salva o gatilho primeiro, depois ela abre o robô
   * pela lista, que é onde ele passa a estar.
   */
  async function criarRobo() {
    if (!rascunho) return;
    setCriandoRobo(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/funis/gatilhos/robo-novo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: `Robô de ${colunas.find((c) => c.id === rascunho.etapaId)?.titulo ?? "etapa"}` }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      const robo = (await resposta.json()) as RoboResumo;
      setRobos((atual) => [...atual, robo]);
      // O robô nasceu direto no banco, por esta rota. Sem avisar o resto da tela, ele não existe
      // pro editor até a página inteira ser recarregada.
      await recarregarFluxos().catch(() => {});
      setRascunho({ ...rascunho, fluxoId: robo.id });
      setAviso(`"${robo.nome}" criado. Salve o gatilho e depois monte o robô na aba Automações.`);
    } catch {
      setErro("Não deu pra criar o robô. Tente de novo.");
    } finally {
      setCriandoRobo(false);
    }
  }

  function mudarDados(patch: Partial<AcaoDados>) {
    if (!rascunho) return;
    setRascunho({ ...rascunho, acaoDados: { ...rascunho.acaoDados, ...patch } });
  }

  function abrirNovo(etapaId: string) {
    setErro(null);
    setAviso(null);
    setRascunho(null);
    setEscolhendoAcao(etapaId);
  }

  return (
    <div className={`fauto${semMoldura ? " fauto-nua" : ""}`}>
      {!semMoldura ? (
        <div className="fauto-topo">
          <strong>{funilNome ?? "Automação do funil"}</strong>
          {onFechar ? (
            <button type="button" className="btn ghost" onClick={onFechar}>
              {traduzir("Voltar")}
            </button>
          ) : null}
        </div>
      ) : null}

      <MigrarGatilhos aoMigrar={() => void recarregar()} />

      <div className="fauto-corpo">
        {!semMoldura ? (
        <aside className="fauto-lado">
          <h4>{traduzir("Fontes de lead")}</h4>
          {canais.length ? (
            canais.map((c) => (
              <div key={c.canal} className="fauto-fonte">
                <strong>{traduzir(c.label)}</strong>
                <span>{c.detalhe || "Conectado"}</span>
              </div>
            ))
          ) : (
            <p className="hint">{traduzir("Nenhum canal conectado ainda.")}</p>
          )}
          {/* `/integracoes` nunca existiu como rota: o link caía no vazio. As conexões moram em
              Configurações, e o parâmetro abre direto na categoria certa em vez de largar a pessoa
              na primeira aba pra procurar. */}
          <Link href="/configuracoes?categoria=integracoes" className="fauto-lado-link">
            + Adicionar fonte
          </Link>
        </aside>
        ) : null}

        <div className="fauto-grade">
          {/*
            COLUNA DE LARGURA FIXA, não `1fr`.
            
            Com `minmax(240px, 1fr)` a largura da coluna dependia de QUANTAS etapas o funil tem:
            um funil de três etapas dava colunas gordas de 400px, um de catorze dava 240px. O
            mesmo cartão de gatilho mudava de forma de um funil pro outro, e a quebra de linha do
            nome do robô mudava junto. 305px é a medida do Kommo (ver
            `docs/referencia-kommo-funil.md`), e a grade rola na horizontal quando não cabe — que
            é o que ela já fazia a partir de seis etapas, só que sem avisar.
          */}
          <div className="fauto-cab" style={{ gridTemplateColumns: `repeat(${colunas.length}, ${LARGURA_COLUNA}px)` }}>
            {colunas.map((coluna, i) => (
              <div key={coluna.id} className="fauto-cab-envoltorio">
                {/*
                  O "+" NA DIVISA, que cria a etapa ALI.
                  
                  Antes a única forma de ter uma etapa nova era o botão do quadro de negócios, que
                  põe sempre no fim — e aí arrastar pro lugar certo. Mas o funil é uma esteira:
                  "Follow up" entre "Novo" e "Qualificado" não é a mesma coisa que "Follow up"
                  depois de "Fechado". Na divisa, o lugar É o clique.
                */}
                {aoInserirEtapa ? (
                  <button
                    type="button"
                    className="fauto-cab-inserir"
                    title={traduzir("Criar uma etapa aqui")}
                    aria-label={traduzir("Criar uma etapa antes de {etapa}", { etapa: coluna.titulo })}
                    onClick={() => aoInserirEtapa(i)}
                  >
                    +
                  </button>
                ) : null}

                <CabecalhoDaEtapa
                  titulo={coluna.titulo}
                  cor={coluna.cor}
                  corAutomatica={CORES_ETAPA[i % CORES_ETAPA.length]}
                  dicas={coluna.dicas}
                  totalDeGatilhos={porEtapa.get(coluna.id)?.length ?? 0}
                  arrastando={etapaArrastada === coluna.id}
                  podeEditar={Boolean(aoReordenarEtapas)}
                  aoComecarArraste={() => setEtapaArrastada(coluna.id)}
                  aoTerminarArraste={() => setEtapaArrastada(null)}
                  aoSoltarAqui={() => soltarEtapaEm(i)}
                  aoTrocarCor={(cor) => aoMudarAparencia?.(coluna.id, { cor })}
                  aoSalvarDicas={(dicas) => aoMudarAparencia?.(coluna.id, { dicas })}
                />

                {aoInserirEtapa && i === colunas.length - 1 ? (
                  <button
                    type="button"
                    className="fauto-cab-inserir fauto-cab-inserir-fim"
                    title={traduzir("Criar uma etapa aqui")}
                    aria-label={traduzir("Criar uma etapa no fim do funil")}
                    onClick={() => aoInserirEtapa(colunas.length)}
                  >
                    +
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div
            className="fauto-linhas"
            style={{ gridTemplateColumns: `repeat(${colunas.length}, ${LARGURA_COLUNA}px)` }}
          >
            {Array.from({ length: linhas }).map((_, linha) =>
              /*
                A FAIXA QUE ATRAVESSA ETAPAS é desenhada aqui, e não no banco.
                
                No banco cada etapa tem a sua linha; o que as irmãs compartilham é o `grupoId`.
                Esta varredura olha a fileira da esquerda pra direita e, quando acha um grupo que
                segue por colunas vizinhas, desenha UMA célula com `grid-column: span N` e pula as
                que ela cobriu. Com as colunas reordenadas de um jeito que parta o grupo ao meio,
                cada pedaço vira sua própria faixa — o que é honesto: o retângulo passa a mostrar
                exatamente as etapas contíguas que ele cobre.
              */
              expandirLinha(colunas, porEtapa, linha).map(({ coluna, gatilho, largura }) => {
                return (
                  <div
                    key={`${coluna.id}-${linha}`}
                    className={`fauto-cel${largura > 1 ? " fauto-cel-faixa" : ""}`}
                    style={largura > 1 ? { gridColumn: `span ${largura}` } : undefined}
                  >
                    {gatilho ? (
                      <div className={`fauto-gat${gatilho.ativo ? "" : " desligado"}`}>
                        {/* Quando a etapa tem mais de um gatilho, eles rodam NA ORDEM da coluna,
                            um esperando o outro terminar. Sem o número, a ordem existia no
                            servidor e não existia na tela: quem punha "enviar mensagem" e "executar
                            robô" na mesma etapa não tinha como saber qual vinha primeiro. */}
                        {(porEtapa.get(coluna.id)?.length ?? 0) > 1 ? (
                          <span className="fauto-gat-ordem" title={traduzir("Ordem em que este gatilho roda nesta etapa")}>
                            {linha + 1}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="fauto-gat-corpo"
                          onClick={() => {
                            setErro(null);
                            setAviso(null);
                            setEscolhendoAcao(null);
                            setEtapasExtras([]);
                            setRascunho(doGatilho(gatilho));
                          }}
                        >
                          <IconAutomacoes width={15} height={15} aria-hidden="true" />
                          <span>
                            <span className="fauto-gat-quando">{linhaDoQuando(gatilho)}</span>
                            <span className="fauto-gat-acao">{linhaDaAcao(gatilho, colunas)}</span>
                          </span>
                        </button>
                        <div className="fauto-gat-acoes">
                          {gatilho.tipoAcao === "robo" && gatilho.fluxoId ? (
                            // O caminho mais curto entre "esta etapa faz alguma coisa" e "quero ver
                            // o que ela faz". Sem ele, achar o fluxograma exigia sair da grade,
                            // abrir outra tela e procurar o robô pelo nome.
                            <button
                              type="button"
                              className="fauto-mini"
                              onClick={() => void abrirFluxograma(gatilho.fluxoId!, gatilho.etapaId)}
                              title={traduzir("Abrir o fluxograma deste robô")}
                            >
                              {traduzir("Gerenciar")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="fauto-mini"
                            onClick={() => alternarAtivo(gatilho)}
                            title={gatilho.ativo ? "Desligar este gatilho" : "Ligar este gatilho"}
                          >
                            {gatilho.ativo ? "Ligado" : "Desligado"}
                          </button>
                          <button
                            type="button"
                            className="fauto-mini"
                            onClick={() => remover(gatilho.id)}
                            title={traduzir("Remover este gatilho")}
                          >
                            <IconClose width={10} height={10} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Toda célula vazia aceita um gatilho, então toda célula vazia tem o botão.
                      // O que muda é a VISIBILIDADE: a primeira vazia da coluna fica sempre à
                      // vista, porque é ela que convida quem chegou numa etapa sem automação; as
                      // de baixo só aparecem sob o mouse. Um "+" repetido em quinze células o
                      // tempo todo vira ruído; um "+" que não existe em lugar nenhum faz parecer
                      // que só cabe um gatilho por etapa.
                      <button
                        type="button"
                        className={`fauto-add${
                          (porEtapa.get(coluna.id)?.length ?? 0) === linha ? "" : " ao-passar"
                        }`}
                        onClick={() => abrirNovo(coluna.id)}
                      >
                        <span aria-hidden="true">+</span> {traduzir("Adicionar gatilho")}
                      </button>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {escolhendoAcao ? (
          <>
          {/*
            O VÉU ATRÁS DO PAINEL.
            
            O painel é uma folha fixa na direita, e sem véu ele ficava disputando a tela com a
            grade: numa janela estreita sobrava uma faixa de colunas ao lado, e dava a impressão
            de que a informação do painel continuava ali — a Thaynara chegou a arrastar a grade
            pro lado procurando o resto. O véu diz que, enquanto isso está aberto, é isso que
            importa. E clicar nele fecha, que é o gesto que todo mundo tenta primeiro.
          */}
          <div className="fauto-veu" role="presentation" onClick={() => setEscolhendoAcao(null)} />
          <div className="fauto-painel">
            <div className="fauto-painel-topo">
              <strong>{traduzir("O que esta etapa faz?")}</strong>
              <button type="button" className="fauto-mini" onClick={() => setEscolhendoAcao(null)}>
                <IconClose width={11} height={11} />
              </button>
            </div>
            <div className="fauto-acoes">
              {ACOES.map((a) => (
                <button
                  key={a.tipo}
                  type="button"
                  className="fauto-acao"
                  onClick={() => {
                    setEtapasExtras([]);
                    setRascunho(rascunhoNovo(escolhendoAcao, a.tipo));
                    setEscolhendoAcao(null);
                  }}
                >
                  <strong>{ACAO_ROTULO[a.tipo]}</strong>
                  <span>{traduzir(a.descricao)}</span>
                </button>
              ))}
            </div>
          </div>
          </>
        ) : null}

        {rascunho ? (
          <>
          <div className="fauto-veu" role="presentation" onClick={() => setRascunho(null)} />
          <div className="fauto-painel">
            <div className="fauto-painel-topo">
              <strong>{rascunho.id ? "Editar gatilho" : ACAO_ROTULO[rascunho.tipoAcao]}</strong>
              <button type="button" className="fauto-mini" onClick={() => setRascunho(null)}>
                <IconClose width={11} height={11} />
              </button>
            </div>

            <div className="field">
              <label>{traduzir("Etapa")}</label>
              <select
                className="input"
                value={rascunho.etapaId}
                onChange={(e) => setRascunho({ ...rascunho, etapaId: e.target.value })}
              >
                {colunas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </div>

            {/*
              O MESMO GATILHO EM MAIS DE UMA ETAPA.
              
              "Diariamente às 12h" costuma valer pro funil inteiro, e montar catorze gatilhos
              iguais é catorze coisas pra manter — e pra esquecer de corrigir junto. Marcando
              outras etapas, o CRM grava uma linha em cada uma (é assim que o motor acha gatilho:
              pela etapa) e a grade desenha as irmãs como uma faixa só.
              
              Só na CRIAÇÃO: transformar um gatilho que já existe numa faixa significaria criar
              linhas novas com o histórico de execução da antiga pendurado numa delas só, e isso
              não tem resposta certa. Pra estender, apaga e cria de novo.
            */}
            {!rascunho.id && colunas.length > 1 ? (
              <div className="field">
                <label>{traduzir("Vale também para")}</label>
                <div className="fauto-etapas-extra">
                  {colunas
                    .filter((c) => c.id !== rascunho.etapaId)
                    .map((c) => {
                      const marcada = etapasExtras.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="checkbox"
                          aria-checked={marcada}
                          className={`fauto-etapa-chip${marcada ? " on" : ""}`}
                          onClick={() =>
                            setEtapasExtras((atual) =>
                              atual.includes(c.id) ? atual.filter((x) => x !== c.id) : [...atual, c.id],
                            )
                          }
                        >
                          {c.titulo}
                        </button>
                      );
                    })}
                </div>
                <span className="hint">
                  {etapasExtras.length
                    ? traduzir("Vira uma faixa só, atravessando {n} etapas.", {
                        n: String(etapasExtras.length + 1),
                      })
                    : traduzir("Deixe em branco para valer só nesta etapa.")}
                </span>
              </div>
            ) : null}

            <div className="field">
              <label>{traduzir("Executar")}</label>
              <select
                className="input"
                value={rascunho.quando}
                onChange={(e) => setRascunho({ ...rascunho, quando: e.target.value as QuandoGatilho })}
              >
                {/* Agrupado por categoria, como no Kommo: a lista corrida não deixa ver que
                    "movido para esta etapa" e "quando um formulário for enviado" são coisas de
                    naturezas diferentes. */}
                {CATEGORIAS_GATILHO.map((categoria) => (
                  <optgroup key={traduzir(categoria.titulo)} label={traduzir(categoria.titulo)}>
                    {categoria.quandos.map((q) => (
                      <option key={q} value={q}>
                        {QUANDO_ROTULO[q]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {rascunho.quando === "diariamente" ? (
                <>
                  <input
                    type="time"
                    className="input mt8"
                    value={rascunho.horarioDiario}
                    onChange={(e) => setRascunho({ ...rascunho, horarioDiario: e.target.value })}
                  />
                  <p className="hint mt8">{traduzir("Todo dia nessa hora, para cada lead que estiver nesta etapa. Serve pra cobrança e lembrete de quem está parado.")}</p>
                </>
              ) : null}
            </div>

            {rascunho.tipoAcao === "robo" ? (
              <div className="field">
                <label>{traduzir("Robô")}</label>
                <select
                  className="input"
                  value={rascunho.fluxoId}
                  onChange={(e) => setRascunho({ ...rascunho, fluxoId: e.target.value })}
                >
                  <option value="">{traduzir("Nenhum robô selecionado")}</option>
                  {robos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                      {r.status === "publicado" ? "" : " (rascunho)"}
                    </option>
                  ))}
                </select>
                <button type="button" className="fauto-add mt8" onClick={criarRobo} disabled={criandoRobo}>
                  <span aria-hidden="true">+</span> {criandoRobo ? "Criando…" : traduzir("Criar um novo robô")}
                </button>
                {rascunho.fluxoId ? (
                  <button
                    type="button"
                    className="btn primary mt8"
                    disabled={salvando}
                    onClick={() => void salvar(true)}
                  >
                    {traduzir("Gerenciar")}
                  </button>
                ) : null}
                <p className="hint mt8">{traduzir("O mesmo robô pode ser executado por várias etapas. O robô novo entra na lista aqui e também na aba Automações: é o mesmo registro, não uma cópia.")}</p>
              </div>
            ) : null}

            {rascunho.tipoAcao === "mensagem" ? (
              <div className="field">
                <label>{traduzir("Mensagem")}</label>
                <textarea
                  className="input"
                  rows={4}
                  value={rascunho.acaoDados.mensagemTexto ?? ""}
                  onChange={(e) => mudarDados({ mensagemTexto: e.target.value })}
                  placeholder="Oi {primeiro_nome}, tudo bem?"
                />
                <p className="hint mt8">{traduzir("Aceita as mesmas variáveis dos blocos de mensagem.")}</p>
              </div>
            ) : null}

            {rascunho.tipoAcao === "responsavel" ? (
              <div className="field">
                <label>{traduzir("Novo responsável")}</label>
                <input
                  className="input"
                  value={rascunho.acaoDados.responsavel ?? ""}
                  onChange={(e) => mudarDados({ responsavel: e.target.value })}
                  placeholder={traduzir("Nome de quem assume")}
                />
              </div>
            ) : null}

            {rascunho.tipoAcao === "etapa" ? (
              <div className="field">
                <label>{traduzir("Mover para")}</label>
                <select
                  className="input"
                  value={rascunho.acaoDados.etapaDestinoId ?? ""}
                  onChange={(e) => mudarDados({ etapaDestinoId: e.target.value })}
                >
                  <option value="">{traduzir("Escolha a etapa")}</option>
                  {colunas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo}
                    </option>
                  ))}
                </select>
                {rascunho.acaoDados.etapaDestinoId === rascunho.etapaId ? (
                  <p className="hint mt8" style={{ color: "var(--danger)" }}>{traduzir("A etapa de destino é a mesma da entrada. Isso faz o lead entrar de novo aqui, sem fim.")}</p>
                ) : null}
              </div>
            ) : null}

            {rascunho.tipoAcao === "etiquetas" ? (
              <>
                <div className="field">
                  <label>{traduzir("Acrescentar etiquetas")}</label>
                  <input
                    className="input"
                    value={(rascunho.acaoDados.etiquetasAdicionar ?? []).join(", ")}
                    onChange={(e) => mudarDados({ etiquetasAdicionar: paraLista(e.target.value) })}
                    placeholder={traduzir("Separe por vírgula")}
                  />
                </div>
                <div className="field">
                  <label>{traduzir("Tirar etiquetas")}</label>
                  <input
                    className="input"
                    value={(rascunho.acaoDados.etiquetasRemover ?? []).join(", ")}
                    onChange={(e) => mudarDados({ etiquetasRemover: paraLista(e.target.value) })}
                    placeholder={traduzir("Separe por vírgula")}
                  />
                </div>
              </>
            ) : null}

            {rascunho.tipoAcao === "webhook" ? (
              <div className="field">
                <label>{traduzir("Endereço")}</label>
                <input
                  className="input"
                  value={rascunho.acaoDados.webhookUrl ?? ""}
                  onChange={(e) => mudarDados({ webhookUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            ) : null}

            <div className="field">
              <label>{traduzir("Para todos os leads com")}</label>
              {rascunho.condicao ? (
                <>
                  <CondicaoForm
                    grupo={rascunho.condicao}
                    onChange={(grupo) => setRascunho({ ...rascunho, condicao: grupo })}
                  />
                  <button
                    type="button"
                    className="fauto-mini"
                    onClick={() => setRascunho({ ...rascunho, condicao: null })}
                  >
                    {traduzir("Tirar a condição")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="fauto-add"
                  onClick={() => setRascunho({ ...rascunho, condicao: grupoVazio() })}
                >
                  <span aria-hidden="true">+</span> {traduzir("Adicionar uma condição")}
                </button>
              )}
              <p className="hint mt8">{traduzir("Sem condição, vale pra todo lead que entrar nesta etapa.")}</p>
            </div>

            <div className="field">
              <label>{traduzir("Ativo")}</label>
              <div className="fauto-dias">
                {DIAS.map((d) => {
                  const marcado = rascunho.diasAtivos.includes(d.valor);
                  return (
                    <button
                      key={d.valor}
                      type="button"
                      className={`fauto-dia${marcado ? " on" : ""}`}
                      onClick={() =>
                        setRascunho({
                          ...rascunho,
                          diasAtivos: marcado
                            ? rascunho.diasAtivos.filter((x) => x !== d.valor)
                            : [...rascunho.diasAtivos, d.valor],
                        })
                      }
                    >
                      {traduzir(d.label)}
                    </button>
                  );
                })}
              </div>
              <div className="fauto-horas">
                <input
                  type="time"
                  className="input"
                  value={rascunho.horaInicio}
                  onChange={(e) => setRascunho({ ...rascunho, horaInicio: e.target.value })}
                />
                <span>às</span>
                <input
                  type="time"
                  className="input"
                  value={rascunho.horaFim}
                  onChange={(e) => setRascunho({ ...rascunho, horaFim: e.target.value })}
                />
              </div>
              <p className="hint mt8">{traduzir("Sem dia e sem horário, o gatilho vale sempre. Fora da janela o lead entra na etapa normalmente, só não dispara.")}</p>
            </div>

            <label className="fauto-caixa">
              <input
                type="checkbox"
                checked={rascunho.aplicarAosAtuais}
                onChange={(e) => setRascunho({ ...rascunho, aplicarAosAtuais: e.target.checked })}
              />
              <span>{traduzir("Aplicar o gatilho aos leads que já estão nesta etapa")}</span>
            </label>

            {erro ? <p className="hint" style={{ color: "var(--danger)" }}>{erro}</p> : null}
            {aviso ? <p className="hint">{aviso}</p> : null}

            <div className="fauto-painel-fim">
              <button type="button" className="btn primary" onClick={() => void salvar()} disabled={salvando}>
                {salvando ? "Salvando…" : "Pronto"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setRascunho(null)}>
                {traduzir("Cancelar")}
              </button>
            </div>
          </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
