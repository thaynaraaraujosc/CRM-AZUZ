"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { IconAutomacoes, IconClose, IconRestaurar } from "@/components/icons";
import { Ajuda, ModalConfirmacao } from "@/components/ui";
import { useFecharMenuDeLinha } from "@/lib/menu-de-linha";
import { SeletorDeHora } from "./SeletorDeHora";
import { CondicaoForm } from "@/components/automation-flow/forms/CondicaoForm";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { MigrarGatilhos } from "./MigrarGatilhos";
import { GaleriaDeModelos } from "@/components/automacoes/GaleriaDeModelos";
import type { ModeloDeRobo } from "@/lib/automacoes/modelos-de-robo";
import { CabecalhoDaEtapa } from "./CabecalhoDaEtapa";
import type { DicasDaEtapa } from "@/lib/data";
import type { GrupoCondicoes } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";
import {
  ATALHOS_DE_ATRASO,
  ehAtalho,
  intervaloEmHorasEMinutos,
  minutosDeAtraso,
  minutosDoIntervalo,
  rotuloDoAtraso,
} from "@/lib/funil/atraso-do-gatilho";
import {
  REPETICOES,
  repeticaoGravada,
  rotuloDaRepeticao,
  type Repeticao,
} from "@/lib/funil/repeticao-do-gatilho";
import { CAMPO_NASCIMENTO, rotuloDoCampoDeData } from "@/lib/funil/campo-de-data-do-gatilho";
import { lerCamposDoContato, type CampoDoContato } from "@/lib/contatos/campos-do-contato";
import {
  ACAO_ROTULO,
  CATEGORIAS_GATILHO,
  EXPLICACAO_DO_QUANDO,
  QUANDO_ROTULO,
  QUANDOS_DE_ENTRADA,
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
  /** Só pro "numa data e hora": o instante marcado, como o campo da tela produz. */
  dataHora: string;
  /** Só pro "sem resposta": quanto tempo de silêncio, e em que unidade. */
  esperaValor: number;
  esperaUnidade: string;
  /** Só nos gatilhos de ENTRADA: quantos minutos esperar antes de agir. 0 = imediatamente. */
  atrasoMinutos: number;
  /** Só pro programado por hora: "diaria" | "semanal" | "mensal" | "anual". */
  repeticao: Repeticao;
  diaDoMes: number;
  /** "MM-DD". */
  dataAnual: string;
  /** Só pro "campo de data": o id do campo, ou "nascimento". */
  campoDeData: string;
  /** Horas ANTES (negativo) ou DEPOIS (positivo) da data do campo. */
  campoOffsetHoras: number;
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
    dataHora: "",
    // Duas horas: o mesmo padrão do gatilho de tempo dos robôs. Um número já escolhido evita o
    // campo vazio que não dispara nada e parece configurado.
    esperaValor: 2,
    esperaUnidade: "horas",
    // Zero: todo gatilho nasce imediato, que é como o CRM inteiro se comportava até aqui.
    atrasoMinutos: 0,
    repeticao: "diaria",
    diaDoMes: 1,
    dataAnual: "",
    campoDeData: "",
    // Vinte e quatro horas ANTES: é o lembrete de consulta, que é pra isso que o campo serve na
    // clínica. Um número já escolhido evita o campo vazio que parece configurado e não é.
    campoOffsetHoras: -24,
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
    dataHora: g.dataHora ?? "",
    esperaValor: g.esperaValor ?? 2,
    esperaUnidade: g.esperaUnidade ?? "horas",
    atrasoMinutos: minutosDeAtraso(g.atrasoMinutos),
    repeticao: repeticaoGravada(g.repeticao),
    diaDoMes: g.diaDoMes ?? 1,
    dataAnual: g.dataAnual ?? "",
    campoDeData: g.campoDeData ?? "",
    campoOffsetHoras: g.campoOffsetHoras ?? -24,
    ativo: g.ativo,
    aplicarAosAtuais: false,
  };
}

/**
 * A linha cinza de cima do cartão: quando o gatilho dispara.
 *
 * Os de relógio mostram o NÚMERO no cartão, não só o nome: "Diariamente" e "Sem resposta" sem a
 * hora e sem o prazo são três gatilhos idênticos na grade, e abrir um por um pra saber qual é
 * qual é exatamente o que a grade existe pra evitar.
 */
function linhaDoQuando(g: GatilhoEtapaVisao, camposDeData: CampoDoContato[] = []): string {
  const base = QUANDO_ROTULO[g.quando];
  // A repetição escreve a frase inteira: "Toda segunda às 09:00", "Todo dia 5 às 08:00".
  if (g.quando === "diariamente" && g.horarioDiario) {
    return rotuloDaRepeticao({
      repeticao: g.repeticao,
      horarioDiario: g.horarioDiario,
      diasAtivos: g.diasAtivos ?? null,
      diaDoMes: g.diaDoMes ?? null,
      dataAnual: g.dataAnual ?? null,
    });
  }
  if (g.quando === "data_hora" && g.dataHora) {
    const [dia, hora] = g.dataHora.split("T");
    const [a, m, d] = dia.split("-");
    return `Em ${d}/${m}/${a} às ${(hora ?? "").slice(0, 5)}`;
  }
  if (g.quando === "sem_resposta" && g.esperaValor) {
    return `Depois de ${g.esperaValor} ${g.esperaUnidade ?? "horas"} sem resposta`;
  }
  if (g.quando === "campo_de_data" && g.campoDeData) {
    const nome =
      g.campoDeData === CAMPO_NASCIMENTO
        ? "Data de nascimento"
        : (camposDeData.find((c) => c.id === g.campoDeData)?.nome ?? "um campo de data");
    return rotuloDoCampoDeData(nome, g.campoOffsetHoras);
  }
  /*
   * A ESPERA ENTRA NA FRASE DO GATILHO DE ENTRADA.
   *
   * "Imediatamente quando movido para esta etapa" e "Depois de 5 minutos" são dois gatilhos
   * idênticos na grade se o cartão não disser o tempo — e abrir um por um pra saber qual é qual é
   * exatamente o que a grade existe pra evitar.
   */
  const atraso = minutosDeAtraso(g.atrasoMinutos);
  if (QUANDOS_DE_ENTRADA.includes(g.quando)) {
    /* A MESMA FRASE DO FORMULÁRIO, na mesma ordem: tempo e depois evento. O rótulo do evento não
       fala mais de tempo, então aqui ele é sempre precedido por um — "Imediatamente · quando
       movido para esta etapa". */
    const comMinuscula = base.charAt(0).toLowerCase() + base.slice(1);
    return `${rotuloDoAtraso(atraso)} · ${comMinuscula}`;
  }
  return base;
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
  /** Sobe a cada gatilho apagado. É o que manda o aviso de migração perguntar de novo. */
  const [versaoDosGatilhos, setVersaoDosGatilhos] = useState(0);
  const [robos, setRobos] = useState<RoboResumo[]>([]);
  /*
   * OS CAMPOS DE DATA DA FICHA, pro gatilho que se prende a um deles.
   *
   * Só os de tipo "data": um gatilho ancorado num campo de texto não teria o que calcular. O
   * `nascimento` não vem daqui — é coluna do contato, e entra na lista escrito à mão.
   *
   * Buscados uma vez ao montar o painel. Campo novo criado em Configurações aparece na próxima
   * abertura, que é o ritmo em que campo de contato muda.
   */
  /** A galeria "Criar um robô": os modelos prontos, aberta pelo "+ Criar um novo robô". */
  const [galeriaAberta, setGaleriaAberta] = useState(false);
  const [camposDeData, setCamposDeData] = useState<CampoDoContato[]>([]);
  useEffect(() => {
    let vivo = true;
    fetch("/api/contatos/campos")
      .then((r) => (r.ok ? r.json() : []))
      .then((dados) => {
        if (vivo) setCamposDeData(lerCamposDoContato(dados).filter((c) => c.tipo === "data"));
      })
      .catch(() => {
        /* Sem a lista, o seletor mostra só a data de nascimento. Melhor que travar o painel. */
      });
    return () => {
      vivo = false;
    };
  }, []);
  const [canais, setCanais] = useState<CanalConectado[]>([]);
  const [escolhendoAcao, setEscolhendoAcao] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  /* O mesmo estado, com outro nome pro `salvar` poder receber um rascunho explícito e ainda ler o
     do estado quando ninguém passar nada. */
  const rascunhoDoEstado = rascunho;
  const [salvando, setSalvando] = useState(false);
  const [criandoRobo, setCriandoRobo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Qual etapa está sendo arrastada agora. `null` fora do arraste. */
  const [etapaArrastada, setEtapaArrastada] = useState<string | null>(null);
  /** As OUTRAS etapas que este gatilho novo também cobre. Vazio = só a dele. */
  const [etapasExtras, setEtapasExtras] = useState<string[]>([]);
  /** O nome que o robô novo vai ter. `null` enquanto o campo não foi aberto. */
  const [nomeDoRoboNovo, setNomeDoRoboNovo] = useState<string | null>(null);

  /** A lista de etapas do "Vale também para" está aberta? */
  const [escolhendoEtapas, setEscolhendoEtapas] = useState(false);

  /*
   * ONDE O PAINEL ABRE: NO MEIO DA TELA, com o resto escurecido.
   *
   * Já foi uma folha fixa na direita, e depois uma caixa colada no cartão clicado. A caixa colada
   * resolvia o contexto (dava pra ver o cartão que se estava editando) e criou outro problema: o
   * formulário é alto, a grade rola por baixo dele, e metade da tela continuava disputando a
   * atenção com o que se estava preenchendo. A Thaynara pediu o terceiro jeito, e é o certo pra
   * um formulário com dez campos — ele vira a única coisa na tela enquanto está aberto.
   *
   * Clicar no fundo escuro fecha, e Esc também. Sem véu clicável, a única saída seria achar o "x".
   */
  const fecharPainel = useCallback(() => {
    setEscolhendoAcao(null);
    setRascunho(null);
    setEscolhendoEtapas(false);
  }, []);
  const painelAberto = escolhendoAcao !== null || rascunho !== null;

  useEffect(() => {
    if (!painelAberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      // Com a lista de etapas aberta, Esc fecha SÓ ela: fechar o formulário inteiro perderia tudo
      // que a pessoa preencheu por causa de um gesto que ela usou pra sair de um menu.
      if (escolhendoEtapas) {
        setEscolhendoEtapas(false);
        return;
      }
      fecharPainel();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [painelAberto, escolhendoEtapas, fecharPainel]);

  /*
   * O FUNDO NÃO ROLA ENQUANTO O FORMULÁRIO ESTÁ ABERTO.
   *
   * Sem isto, a roda do mouse sobre o véu rola a grade atrás: o formulário fica parado e o mundo
   * se mexe embaixo dele, que é a sensação de uma caixa solta em cima da página em vez de uma
   * tela própria.
   */
  useEffect(() => {
    if (!painelAberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [painelAberto]);

  // `useCallback` e não uma arrow solta: o hook depende da função, e uma nova a cada render faria
  // ele desligar e religar os ouvintes de clique em todo render enquanto a lista estivesse aberta.
  const fecharEtapas = useCallback(() => setEscolhendoEtapas(false), []);
  useFecharMenuDeLinha(escolhendoEtapas, fecharEtapas);

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

  /** As etapas que o gatilho PODE cobrir além da dele: todas as outras do funil. */
  const outrasEtapas = useMemo(
    () => colunas.filter((c) => c.id !== rascunho?.etapaId),
    [colunas, rascunho?.etapaId],
  );

  /**
   * O que a linha fechada do seletor diz.
   *
   * Com a lista fechada, esta frase é a única informação disponível: ela precisa responder
   * "quantas e quais" sem obrigar a abrir de novo. Até duas, cabem os nomes; daí pra cima só o
   * número, senão a linha vira um parágrafo.
   */
  const resumoDasEtapasExtras = useMemo(() => {
    if (!etapasExtras.length) return traduzir("Só esta etapa");
    const nomes = outrasEtapas.filter((c) => etapasExtras.includes(c.id)).map((c) => c.titulo);
    if (nomes.length <= 2) return nomes.join(", ");
    return traduzir("{n} etapas escolhidas", { n: String(nomes.length) });
  }, [etapasExtras, outrasEtapas, traduzir]);

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
    if (r.quando === "data_hora" && !r.dataHora) return "Escolha a data e a hora do gatilho.";
    if (r.quando === "sem_resposta" && !(r.esperaValor > 0)) return "Diga quanto tempo de silêncio o gatilho espera.";
    /* Repetição pela metade parece configurada e nunca dispara — e descobrir isso leva uma
       semana. A rota também cobra; aqui é pra pessoa ver antes de salvar. */
    if (r.quando === "diariamente" && r.repeticao === "semanal" && !r.diasAtivos.length) {
      return "Marque em “Ativo” os dias da semana em que o gatilho roda.";
    }
    if (r.quando === "diariamente" && r.repeticao === "mensal" && !(r.diaDoMes >= 1 && r.diaDoMes <= 31)) {
      return "Escolha o dia do mês, de 1 a 31.";
    }
    if (r.quando === "diariamente" && r.repeticao === "anual" && !/^\d{2}-\d{2}$/.test(r.dataAnual)) {
      return "Escreva o dia e o mês no formato MM-DD (12-25 é 25 de dezembro).";
    }
    if (r.quando === "campo_de_data" && !r.campoDeData) {
      return "Escolha de qual data da ficha o gatilho depende.";
    }
    return null;
  }

  /**
   * Salva o gatilho e, quando pedido, abre o fluxograma do robô em seguida.
   *
   * Salvar ANTES de navegar não é detalhe: sair da tela com o rascunho aberto perderia tudo que a
   * pessoa acabou de configurar, e ela descobriria isso só ao voltar.
   */
  /**
   * `forcado` existe por causa do React: `setRascunho` não aplica na mesma passagem, e quem acaba
   * de criar um robô precisa salvar o gatilho JÁ COM ele. Sem isso, salvar logo depois de criar
   * gravaria o gatilho com o robô anterior (ou com nenhum).
   */
  async function salvar(abrirFluxogramaDepois = false, forcado?: Rascunho) {
    const rascunho = forcado ?? rascunhoDoEstado;
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
        dataHora: rascunho.dataHora || null,
        esperaValor: rascunho.quando === "sem_resposta" ? rascunho.esperaValor : null,
        esperaUnidade: rascunho.quando === "sem_resposta" ? rascunho.esperaUnidade : null,
        atrasoMinutos: QUANDOS_DE_ENTRADA.includes(rascunho.quando) ? rascunho.atrasoMinutos : 0,
        repeticao: rascunho.quando === "diariamente" ? rascunho.repeticao : null,
        diaDoMes: rascunho.quando === "diariamente" ? rascunho.diaDoMes : null,
        dataAnual: rascunho.quando === "diariamente" ? rascunho.dataAnual : null,
        campoDeData: rascunho.quando === "campo_de_data" ? rascunho.campoDeData : null,
        campoOffsetHoras: rascunho.quando === "campo_de_data" ? rascunho.campoOffsetHoras : null,
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

  /**
   * APAGAR É UMA DECISÃO, e por isso ela é perguntada antes.
   *
   * Pedido da Thaynara em 08/11/2026, com a frase que resume o certo: "apagou, apagou, perdeu".
   * Um gatilho de etapa é o que faz um robô rodar pra todo lead que entra ali — some sem avisar
   * e ninguém descobre pela tela, só pelo cliente que parou de receber resposta.
   */
  const [aApagar, setAApagar] = useState<string | null>(null);

  async function remover(id: string) {
    setAApagar(null);
    // Some da tela na hora; se o servidor recusar, a recarga traz de volta. Esperar a ida e volta
    // pra sumir um item de lista faz a tela parecer travada.
    setGatilhos((atual) => atual.filter((g) => g.id !== id));
    await fetch(`/api/funis/gatilhos/${id}`, { method: "DELETE" }).catch(() => {});
    await recarregar();
    /*
     * O AVISO DE MIGRAÇÃO PRECISA SER PERGUNTADO DE NOVO.
     *
     * Ele lia a prévia uma vez, ao abrir a tela, e ficava com o número de lá. Depois de apagar,
     * continuava dizendo "2 automações têm o gatilho dentro do fluxo" e oferecendo trazer de
     * volta o que acabara de sair — a tela contradizendo o que a pessoa acabou de fazer.
     */
    setVersaoDosGatilhos((v) => v + 1);
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
  /** O nome que o campo de criação já vem preenchido: o da etapa, que serve na maioria das vezes. */
  function nomeSugeridoDoRobo(): string {
    const etapa = colunas.find((c) => c.id === rascunho?.etapaId)?.titulo ?? "etapa";
    return `Robô de ${etapa}`;
  }

  async function criarRobo(modelo?: ModeloDeRobo, abrirDepois = false) {
    if (!rascunho) return;
    /* Escolhendo um modelo, o nome dele é o nome do robô: "Robô de Novo lead" não diz nada e o
       nome do modelo diz tudo. Quem digitou um nome à mão continua mandando. */
    const nome = (nomeDoRoboNovo ?? "").trim() || modelo?.nome || nomeSugeridoDoRobo();
    setCriandoRobo(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/funis/gatilhos/robo-novo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, modeloId: modelo?.id }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      const robo = (await resposta.json()) as RoboResumo;
      setRobos((atual) => [...atual, robo]);
      // O robô nasceu direto no banco, por esta rota. Sem avisar o resto da tela, ele não existe
      // pro editor até a página inteira ser recarregada.
      await recarregarFluxos().catch(() => {});
      const comRobo = { ...rascunho, fluxoId: robo.id };
      setRascunho(comRobo);
      setNomeDoRoboNovo(null);
      setGaleriaAberta(false);
      setAviso(`"${robo.nome}" criado e já escolhido aqui.`);
      /*
       * ESCOLHER O MODELO ENTRA DIRETO NO ROBÔ.
       *
       * "Na hora que eu clico no bot, ele volta pra página primeiro, adiciona o bot, e depois que
       * ele entra. Eu queria que na hora que eu escolhesse o bot ele entrasse direto."
       *
       * O gatilho é salvo ANTES de navegar, com o robô já dentro: sair da tela com o rascunho
       * aberto perderia a etapa, o horário e a condição que ela acabou de configurar — e ela só
       * descobriria ao voltar. Por isso `salvar` recebe o rascunho explícito: `setRascunho` não
       * aplica na mesma passagem, e sem ele o gatilho iria pro banco sem o robô.
       */
      if (abrirDepois) await salvar(true, comRobo);
    } catch {
      setErro("Não deu pra criar o robô. Tente de novo.");
    } finally {
      setCriandoRobo(false);
    }
  }

  /** Sem dia marcado e sem faixa de hora: o gatilho vale o tempo todo. */
  const semJanela = !!rascunho && !rascunho.diasAtivos.length && !rascunho.horaInicio && !rascunho.horaFim;

  function mudarDados(patch: Partial<AcaoDados>) {
    if (!rascunho) return;
    setRascunho({ ...rascunho, acaoDados: { ...rascunho.acaoDados, ...patch } });
  }

  function abrirNovo(etapaId: string) {
    setErro(null);
    setAviso(null);
    setRascunho(null);
    setNomeDoRoboNovo(null);
    setEscolhendoEtapas(false);
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

      {/* `versao` muda a cada gatilho apagado: é o que faz o aviso perguntar de novo em vez de
          ficar com o número lido quando a tela abriu. */}
      <MigrarGatilhos versao={versaoDosGatilhos} aoMigrar={() => void recarregar()} />

      <ModalConfirmacao
        aberto={aApagar !== null}
        titulo={traduzir("Apagar este gatilho?")}
        mensagem={traduzir(
          "O robô para de rodar nesta etapa na hora. Isso não volta sozinho: pra ele rodar de novo, você adiciona o gatilho outra vez.",
        )}
        rotuloConfirmar={traduzir("Apagar")}
        perigoso
        onConfirmar={() => void remover(aApagar!)}
        onCancelar={() => setAApagar(null)}
      />

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
                            setNomeDoRoboNovo(null);
                            setEscolhendoEtapas(false);
                            setRascunho(doGatilho(gatilho));
                          }}
                        >
                          <IconAutomacoes width={15} height={15} aria-hidden="true" />
                          <span>
                            <span className="fauto-gat-quando">{linhaDoQuando(gatilho, camposDeData)}</span>
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
                            onClick={() => setAApagar(gatilho.id)}
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

        {/*
          AS DUAS CAIXAS ABREM NO MEIO DA TELA, por portal em `document.body`.
          
          Por portal e não dentro da célula: a grade tem rolagem própria, e uma caixa desenhada
          dentro dela seria cortada na borda e ainda esticaria a área de rolagem.
          
          O véu voltou — e agora ele é o ponto. Enquanto o formulário está aberto, ele é a tela:
          o resto escurece, não rola e não compete por atenção. Clicar no véu fecha, e Esc também.
        */}
        {escolhendoAcao
          ? createPortal(
              <div className="fauto-veu" onClick={fecharPainel} role="presentation">
              <div
                className="fauto-painel"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="fauto-painel-topo">
                  <strong>{traduzir("O que esta etapa faz?")}</strong>
                  <button type="button" className="fauto-mini" onClick={fecharPainel} aria-label={traduzir("Fechar")}>
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
              </div>,
              document.body,
            )
          : null}

        {rascunho
          ? createPortal(
          <div className="fauto-veu" onClick={fecharPainel} role="presentation">
          <div
            className="fauto-painel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fauto-painel-topo">
              <strong>{rascunho.id ? "Editar gatilho" : ACAO_ROTULO[rascunho.tipoAcao]}</strong>
              <button type="button" className="fauto-mini" onClick={fecharPainel} aria-label={traduzir("Fechar")}>
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
              /*
               * AS OUTRAS ETAPAS SAEM DE UMA LISTA, não de uma parede de pastilhas.
               *
               * Com catorze etapas, catorze pastilhas ligadas/desligadas ocupavam mais espaço que
               * o resto do formulário inteiro e empurravam pra baixo os campos que realmente
               * precisam ser preenchidos. Fechada, a lista é uma linha que já diz o resultado
               * ("Só esta etapa" / "Mais 3 etapas"); aberta, é a mesma escolha de antes.
               */
              <div className="field">
                <label>
                  {traduzir("Vale também para")}
                  <Ajuda
                    texto={traduzir(
                      "Sem nenhuma marcada, o gatilho vale só nesta etapa. Marcando outras, ele vira uma faixa só, atravessando as etapas escolhidas — uma coisa pra manter, em vez de uma por etapa.",
                    )}
                  />
                </label>
                <div className="fauto-escolha" data-menu-de-linha="">
                  <button
                    type="button"
                    className="input fauto-escolha-alvo"
                    aria-expanded={escolhendoEtapas}
                    onClick={() => setEscolhendoEtapas((a) => !a)}
                  >
                    <span>{resumoDasEtapasExtras}</span>
                    <span className="fauto-escolha-seta" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  {escolhendoEtapas ? (
                    <div className="fauto-escolha-lista">
                      {outrasEtapas.map((c) => {
                        const marcada = etapasExtras.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            role="checkbox"
                            aria-checked={marcada}
                            className={`fauto-escolha-item${marcada ? " on" : ""}`}
                            onClick={() =>
                              setEtapasExtras((atual) =>
                                atual.includes(c.id) ? atual.filter((x) => x !== c.id) : [...atual, c.id],
                              )
                            }
                          >
                            <span className="fauto-escolha-marca" aria-hidden="true">
                              {marcada ? "✓" : ""}
                            </span>
                            {c.titulo}
                          </button>
                        );
                      })}
                      <div className="fauto-escolha-fim">
                        <button
                          type="button"
                          className="fauto-mini"
                          onClick={() => setEtapasExtras(outrasEtapas.map((c) => c.id))}
                        >
                          {traduzir("Todas")}
                        </button>
                        <button type="button" className="fauto-mini" onClick={() => setEtapasExtras([])}>
                          {traduzir("Limpar")}
                        </button>
                        <button type="button" className="fauto-mini forte" onClick={() => setEscolhendoEtapas(false)}>
                          {traduzir("Pronto")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="field">
              <label>{traduzir("Executar")}</label>
              {/*
                UMA FRASE SÓ: O TEMPO E O EVENTO, LADO A LADO.

                "Se lá em Executar está escrito 'imediatamente quando movido para a etapa', eu não
                tenho como escolher lá embaixo — aí um está falando imediatamente e o outro está
                falando depois de 5 minutos."

                Estava certo, e era culpa do desenho: a espera tinha virado um segundo seletor
                EMBAIXO do evento, enquanto o rótulo do evento ainda afirmava "imediatamente". Duas
                respostas pra mesma pergunta, uma contradizendo a outra.

                Agora é uma linha que se lê de ponta a ponta — "Depois de 5 minutos · quando movido
                para esta etapa" — e a palavra do tempo é o primeiro seletor, que é onde ela é
                trocada. O rótulo do evento não fala mais de tempo nenhum.
              */}
              <div className="fauto-quando">
                {QUANDOS_DE_ENTRADA.includes(rascunho.quando) ? (
                  <select
                    className="input fauto-quando-tempo"
                    aria-label={traduzir("Quando tempo depois")}
                    value={ehAtalho(rascunho.atrasoMinutos) ? String(rascunho.atrasoMinutos) : "intervalo"}
                    onChange={(e) => {
                      /* "Selecione o intervalo" não é um tempo: é a escolha de digitar um. Começa
                         em uma hora pra os dois campos não abrirem zerados, que é igual a
                         imediatamente e faria a opção parecer que não fez nada. */
                      if (e.target.value === "intervalo") {
                        setRascunho({ ...rascunho, atrasoMinutos: 60 });
                        return;
                      }
                      setRascunho({ ...rascunho, atrasoMinutos: Number(e.target.value) });
                    }}
                  >
                    {ATALHOS_DE_ATRASO.map((atalho) => (
                      <option key={atalho.minutos} value={atalho.minutos}>
                        {traduzir(atalho.label)}
                      </option>
                    ))}
                    <option value="intervalo">{traduzir("Selecione o intervalo")}</option>
                  </select>
                ) : null}
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
              </div>

              {/*
                O QUE O GATILHO ESCOLHIDO PEGA, e o que ele deixa passar.

                "Às vezes o movido será que atende também às necessidades quando a pessoa entra no
                tráfego pago?" Não atende — e descobrir isso pelo silêncio da automação custa
                caro. A lista do `<select>` do navegador não aceita explicação dentro dela, então
                a frase vive aqui embaixo e troca junto com a escolha.
              */}
              {EXPLICACAO_DO_QUANDO[rascunho.quando] ? (
                <p className="hint fauto-explicacao">{traduzir(EXPLICACAO_DO_QUANDO[rascunho.quando]!)}</p>
              ) : null}

              {/*
                OS DOIS CAMPOS DO INTERVALO, logo abaixo da frase e só quando ela pede.
                
                É a última linha da lista do Kommo: escolher "Selecione o intervalo" abre h e m ali
                mesmo, sem mandar pra outra tela.
              */}
              {QUANDOS_DE_ENTRADA.includes(rascunho.quando) && !ehAtalho(rascunho.atrasoMinutos) ? (
                <div className="fauto-horas mt8">
                  <input
                    type="number"
                    min={0}
                    max={720}
                    className="input fauto-numero"
                    aria-label={traduzir("Horas de espera")}
                    value={intervaloEmHorasEMinutos(rascunho.atrasoMinutos).horas}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        atrasoMinutos: minutosDoIntervalo(
                          e.target.value,
                          intervaloEmHorasEMinutos(rascunho.atrasoMinutos).minutos,
                        ),
                      })
                    }
                  />
                  <span className="hint">h</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    className="input fauto-numero"
                    aria-label={traduzir("Minutos de espera")}
                    value={intervaloEmHorasEMinutos(rascunho.atrasoMinutos).minutos}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        atrasoMinutos: minutosDoIntervalo(
                          intervaloEmHorasEMinutos(rascunho.atrasoMinutos).horas,
                          e.target.value,
                        ),
                      })
                    }
                  />
                  <span className="hint">m</span>
                  <Ajuda
                    texto={traduzir(
                      "O lead entra na etapa e o CRM espera esse tempo antes de agir. Quem sair da etapa durante a espera não recebe nada — a etapa é a dona do gatilho. Entrar de novo reinicia a contagem.",
                    )}
                  />
                </div>
              ) : null}
              {rascunho.quando === "diariamente" ? (
                <>
                  <div className="fauto-horas mt8">
                    {/*
                      DE QUANTO EM QUANTO TEMPO. "Diariamente, uma vez por semana, uma vez por mês,
                      uma vez por ano." A hora é a mesma nas quatro; o que muda é o dia.
                    */}
                    <select
                      className="input"
                      aria-label={traduzir("Repetição")}
                      value={rascunho.repeticao}
                      onChange={(e) =>
                        setRascunho({ ...rascunho, repeticao: e.target.value as Repeticao })
                      }
                    >
                      {REPETICOES.map((r) => (
                        <option key={r.valor} value={r.valor}>
                          {traduzir(r.label)}
                        </option>
                      ))}
                    </select>
                    <SeletorDeHora
                      valor={rascunho.horarioDiario}
                      aoMudar={(v) => setRascunho({ ...rascunho, horarioDiario: v })}
                      rotuloVazio="Escolha a hora"
                      aria-label={traduzir("Hora da varredura")}
                    />
                    <Ajuda
                      texto={traduzir(
                        "Nessa hora, para cada lead que estiver nesta etapa. Serve pra cobrança e lembrete de quem está parado.",
                      )}
                    />
                  </div>

                  {/* A semanal usa os MESMOS dias da janela "Ativo" logo abaixo — é a mesma
                      pergunta, e dois lugares pra respondê-la seriam duas respostas. */}
                  {rascunho.repeticao === "semanal" ? (
                    <p className="hint mt8">
                      {rascunho.diasAtivos.length
                        ? traduzir("Roda nos dias marcados em “Ativo”, logo abaixo.")
                        : traduzir("Escolha os dias em “Ativo”, logo abaixo: sem dia marcado, o gatilho não roda.")}
                    </p>
                  ) : null}

                  {rascunho.repeticao === "mensal" ? (
                    <div className="fauto-horas mt8">
                      <span className="hint">{traduzir("Todo dia")}</span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="input fauto-numero"
                        aria-label={traduzir("Dia do mês")}
                        value={rascunho.diaDoMes}
                        onChange={(e) => setRascunho({ ...rascunho, diaDoMes: Number(e.target.value) })}
                      />
                      <Ajuda
                        texto={traduzir(
                          "Mês que não tem o dia escolhido roda no último dia dele: 31 em fevereiro é dia 28. Quem escolhe 31 quer dizer “no fim do mês”, não “só nos meses de 31 dias”.",
                        )}
                      />
                    </div>
                  ) : null}

                  {rascunho.repeticao === "anual" ? (
                    <div className="fauto-horas mt8">
                      <span className="hint">{traduzir("Todo dia e mês")}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="MM-DD"
                        maxLength={5}
                        className="input fauto-numero"
                        aria-label={traduzir("Dia e mês")}
                        value={rascunho.dataAnual}
                        onChange={(e) => setRascunho({ ...rascunho, dataAnual: e.target.value })}
                      />
                      <Ajuda texto={traduzir("No formato mês-dia: 12-25 é 25 de dezembro.")} />
                    </div>
                  ) : null}
                </>
              ) : null}

              {/*
                O GATILHO PRESO A UMA DATA DA FICHA.

                "Vou programar que ele vai ativar tal hora antes ou depois." A hora não é do
                relógio: é relativa a uma data que está na ficha de cada lead, e cada lead tem a
                sua — a consulta da Ana é quinta, a do Bruno é no mês que vem.
              */}
              {rascunho.quando === "campo_de_data" ? (
                <div className="fauto-horas mt8">
                  <input
                    type="number"
                    min={0}
                    max={8760}
                    className="input fauto-numero"
                    aria-label={traduzir("Quantas horas")}
                    value={Math.abs(rascunho.campoOffsetHoras)}
                    onChange={(e) => {
                      const horas = Math.abs(Number(e.target.value) || 0);
                      const sinal = rascunho.campoOffsetHoras < 0 ? -1 : 1;
                      setRascunho({ ...rascunho, campoOffsetHoras: horas * sinal });
                    }}
                  />
                  <select
                    className="input"
                    aria-label={traduzir("Antes ou depois")}
                    value={rascunho.campoOffsetHoras < 0 ? "antes" : "depois"}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        campoOffsetHoras:
                          Math.abs(rascunho.campoOffsetHoras) * (e.target.value === "antes" ? -1 : 1),
                      })
                    }
                  >
                    <option value="antes">{traduzir("horas antes de")}</option>
                    <option value="depois">{traduzir("horas depois de")}</option>
                  </select>
                  <select
                    className="input"
                    aria-label={traduzir("Campo de data")}
                    value={rascunho.campoDeData}
                    onChange={(e) => setRascunho({ ...rascunho, campoDeData: e.target.value })}
                  >
                    <option value="">{traduzir("selecionar campo")}</option>
                    <option value={CAMPO_NASCIMENTO}>{traduzir("Data de nascimento")}</option>
                    {camposDeData.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                  <Ajuda
                    texto={traduzir(
                      "O campo é uma data da ficha do contato, sem hora — então ela vale como meia-noite daquele dia. Lead com o campo em branco não entra. Crie campos de data em Configurações › Campos do contato.",
                    )}
                  />
                </div>
              ) : null}

              {rascunho.quando === "data_hora" ? (
                <div className="fauto-horas mt8">
                  <input
                    type="datetime-local"
                    className="input"
                    value={rascunho.dataHora}
                    onChange={(e) => setRascunho({ ...rascunho, dataHora: e.target.value })}
                    aria-label={traduzir("Data e hora do gatilho")}
                  />
                  <Ajuda
                    texto={traduzir(
                      "Uma vez só, na data e na hora marcadas, para cada lead que estiver nesta etapa naquele momento. Horário de Brasília.",
                    )}
                  />
                </div>
              ) : null}

              {rascunho.quando === "sem_resposta" ? (
                <div className="fauto-horas mt8">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="input fauto-numero"
                    value={rascunho.esperaValor}
                    onChange={(e) => setRascunho({ ...rascunho, esperaValor: Number(e.target.value) })}
                    aria-label={traduzir("Tempo sem resposta")}
                  />
                  <select
                    className="input"
                    value={rascunho.esperaUnidade}
                    onChange={(e) => setRascunho({ ...rascunho, esperaUnidade: e.target.value })}
                    aria-label={traduzir("Unidade de tempo")}
                  >
                    <option value="horas">{traduzir("horas")}</option>
                    <option value="dias">{traduzir("dias")}</option>
                  </select>
                  <Ajuda
                    texto={traduzir(
                      "Conta desde a última mensagem DO LEAD. Vale para quem está nesta etapa, dispara no máximo uma vez por dia para cada um e respeita a janela de \"Ativo\" aí embaixo.",
                    )}
                  />
                </div>
              ) : null}
            </div>

            {rascunho.tipoAcao === "robo" ? (
              <div className="field">
                <label>
                  {traduzir("Robô")}
                  <Ajuda
                    texto={traduzir(
                      "O mesmo robô pode ser executado por várias etapas. O robô novo entra na lista aqui e também na aba Automações: é o mesmo registro, não uma cópia.",
                    )}
                  />
                </label>
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
                {/*
                  O ROBÔ NOVO NASCE COM NOME, e o nome é escolhido aqui.
                  
                  Ele nascia como "Robô de <etapa>", sem pergunta. Com três robôs na mesma etapa a
                  lista virava "Robô de Novo", "Robô de Novo" e "Robô de Novo" — e a única forma
                  de saber qual era qual era abrir um por um. O nome sugerido continua sendo o da
                  etapa, porque na maioria das vezes serve; a diferença é poder trocar antes.
                */}
                {nomeDoRoboNovo === null ? (
                  /*
                    O BOTÃO ABRE A GALERIA, e não mais um campo de nome.
                    
                    "Ao clicar, abre o modal Criar um bot." O canvas em branco é uma parede: quem
                    nunca montou um robô não sabe o que dá pra fazer, e pedir um NOME antes de
                    saber o que vai ser feito é a pergunta na ordem errada. A galeria pergunta
                    primeiro o que o robô faz; "Começar do zero" continua lá pra quem já sabe.
                  */
                  <button type="button" className="fauto-add mt8" onClick={() => setGaleriaAberta(true)}>
                    <span aria-hidden="true">+</span> {traduzir("Criar um novo robô")}
                  </button>
                ) : (
                  <div className="fauto-robo-novo mt8">
                    <input
                      className="input"
                      autoFocus
                      value={nomeDoRoboNovo}
                      maxLength={80}
                      placeholder={traduzir("Nome do robô")}
                      onChange={(e) => setNomeDoRoboNovo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void criarRobo();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setNomeDoRoboNovo(null);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn primary"
                      disabled={criandoRobo || !nomeDoRoboNovo.trim()}
                      onClick={() => void criarRobo()}
                    >
                      {criandoRobo ? traduzir("Criando…") : traduzir("Criar")}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setNomeDoRoboNovo(null)}>
                      {traduzir("Cancelar")}
                    </button>
                  </div>
                )}
                {rascunho.fluxoId ? (
                  <button
                    type="button"
                    className="fauto-gerenciar mt8"
                    disabled={salvando}
                    onClick={() => void salvar(true)}
                  >
                    {traduzir("Abrir e montar este robô")} <span aria-hidden="true">→</span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {rascunho.tipoAcao === "mensagem" ? (
              <div className="field">
                <label>
                  {traduzir("Mensagem")}
                  <Ajuda texto={traduzir("Aceita as mesmas variáveis dos blocos de mensagem, como {primeiro_nome}.")} />
                </label>
                <textarea
                  className="input"
                  rows={4}
                  value={rascunho.acaoDados.mensagemTexto ?? ""}
                  onChange={(e) => mudarDados({ mensagemTexto: e.target.value })}
                  placeholder="Oi {primeiro_nome}, tudo bem?"
                />
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
              <label>
                {traduzir("Para todos os leads com")}
                <Ajuda texto={traduzir("Sem condição, vale pra todo lead que entrar nesta etapa.")} />
              </label>
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
            </div>

            {/*
              QUANDO O GATILHO FICA DE PLANTÃO.
              
              "Sempre" deixou de ser um estado invisível. Antes, valer o tempo todo era o que
              acontecia quando nada estava marcado — e "nada marcado" é igualzinho a "esqueci de
              marcar". Agora é uma opção que acende sozinha quando não há dia nem hora, e clicável
              pra voltar a ela de uma vez: é o mesmo botão que a Thaynara pediu como "restaurar".
            */}
            <div className="field">
              <label>
                {traduzir("Ativo")}
                <Ajuda
                  texto={traduzir(
                    "Fora da janela o lead entra na etapa normalmente, só não dispara o gatilho. O horário é o de Brasília.",
                  )}
                />
              </label>
              <div className="fauto-dias">
                <button
                  type="button"
                  className={`fauto-dia fauto-dia-sempre${semJanela ? " on" : ""}`}
                  aria-pressed={semJanela}
                  onClick={() => setRascunho({ ...rascunho, diasAtivos: [], horaInicio: "", horaFim: "" })}
                >
                  {traduzir("Sempre")}
                </button>
                {DIAS.map((d) => {
                  const marcado = rascunho.diasAtivos.includes(d.valor);
                  return (
                    <button
                      key={d.valor}
                      type="button"
                      className={`fauto-dia${marcado ? " on" : ""}`}
                      aria-pressed={marcado}
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
                <SeletorDeHora
                  valor={rascunho.horaInicio}
                  aoMudar={(v) => setRascunho({ ...rascunho, horaInicio: v })}
                  rotuloVazio="A partir de…"
                  aria-label={traduzir("Hora de início")}
                />
                <span>{traduzir("às")}</span>
                <SeletorDeHora
                  valor={rascunho.horaFim}
                  aoMudar={(v) => setRascunho({ ...rascunho, horaFim: v })}
                  rotuloVazio="…até"
                  aria-label={traduzir("Hora de fim")}
                />
                {/* Só aparece quando há o que desfazer: um "restaurar" permanente em cima de
                    campos vazios é um botão que não faz nada. */}
                {semJanela ? null : (
                  <button
                    type="button"
                    className="fauto-mini fauto-restaurar"
                    onClick={() => setRascunho({ ...rascunho, diasAtivos: [], horaInicio: "", horaFim: "" })}
                    title={traduzir("Voltar para sempre ativo")}
                  >
                    <IconRestaurar width={12} height={12} aria-hidden="true" />
                    {traduzir("Restaurar")}
                  </button>
                )}
              </div>
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
              <button type="button" className="btn ghost" onClick={fecharPainel}>
                {traduzir("Cancelar")}
              </button>
              <button type="button" className="btn primary" onClick={() => void salvar()} disabled={salvando}>
                {salvando ? "Salvando…" : "Pronto"}
              </button>
            </div>
          </div>
          </div>,
          document.body,
            )
          : null}

        {/*
          A GALERIA, por portal no `body` e POR CIMA do painel do gatilho.
          
          Dentro do painel ela seria cortada pelo `overflow` dele, e nasceria com 560px de largura
          — a galeria precisa de 1140 pra caber três cartões por linha.
        */}
        {galeriaAberta
          ? createPortal(
              <GaleriaDeModelos
                area="comercial"
                ocupado={criandoRobo}
                aoFechar={() => setGaleriaAberta(false)}
                /* Os dois entram direto no editor: escolher o modelo e começar do zero levam ao
                   mesmo lugar, que é o quadro do robô. */
                aoEscolher={(modelo) => void criarRobo(modelo, true)}
                aoComecarDoZero={() => void criarRobo(undefined, true)}
              />,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}
