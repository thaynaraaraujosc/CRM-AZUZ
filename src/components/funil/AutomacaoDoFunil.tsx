"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { IconAutomacoes, IconClose } from "@/components/icons";
import { CondicaoForm } from "@/components/automation-flow/forms/CondicaoForm";
import { MigrarGatilhos } from "./MigrarGatilhos";
import type { GrupoCondicoes } from "@/lib/automation-flow/types";
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

type ColunaResumo = { id: string; titulo: string; total?: number };
type RoboResumo = { id: string; nome: string; status?: string };
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
  { valor: 6, label: "Sáb" },
  { valor: 7, label: "Dom" },
];

const ACOES: { tipo: TipoAcaoGatilho; descricao: string }[] = [
  { tipo: "robo", descricao: "Executa uma automação inteira, com mensagens, esperas e condições." },
  { tipo: "mensagem", descricao: "Manda um texto pelo canal da conversa do lead." },
  { tipo: "responsavel", descricao: "Passa o lead pra outra pessoa do time." },
  { tipo: "etapa", descricao: "Move o lead pra outra etapa assim que entrar nesta." },
  { tipo: "etiquetas", descricao: "Acrescenta ou tira etiquetas do contato." },
  { tipo: "tarefa", descricao: "Cria uma tarefa no quadro, com prazo." },
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
    case "tarefa":
      return `Adicionar uma tarefa: ${dados.tarefaTitulo || "sem título"}`;
    case "webhook":
      return `Enviar um webhook: ${dados.webhookUrl || "sem endereço"}`;
    case "mensagem":
      return `Enviar mensagem: ${(dados.mensagemTexto || "sem texto").slice(0, 70)}`;
    default:
      return ACAO_ROTULO[g.tipoAcao ?? "robo"];
  }
}

const paraLista = (texto: string) => texto.split(",").map((t) => t.trim()).filter(Boolean);

export function AutomacaoDoFunil({
  funilId,
  funilNome,
  colunas,
  onFechar,
}: {
  funilId: string;
  funilNome?: string;
  colunas: ColunaResumo[];
  onFechar?: () => void;
}) {
  const router = useRouter();
  const [gatilhos, setGatilhos] = useState<GatilhoEtapaVisao[]>([]);
  const [robos, setRobos] = useState<RoboResumo[]>([]);
  const [canais, setCanais] = useState<CanalConectado[]>([]);
  const [escolhendoAcao, setEscolhendoAcao] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [criandoRobo, setCriandoRobo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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
        if (vivo) setRobos(lista.map((f) => ({ id: f.id, nome: f.nome, status: f.status })));
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
   * Quantas linhas a grade tem. É a etapa com mais gatilhos, com um mínimo de 6 pra a grade não
   * ficar espremida num funil que ainda não tem quase nada configurado.
   */
  const linhas = useMemo(() => {
    const maior = colunas.reduce((max, c) => Math.max(max, porEtapa.get(c.id)?.length ?? 0), 0);
    return Math.max(maior, 6);
  }, [colunas, porEtapa]);

  function faltaAlgo(r: Rascunho): string | null {
    const d = r.acaoDados;
    if (r.tipoAcao === "robo" && !r.fluxoId) return "Escolha o robô que esta etapa vai executar.";
    if (r.tipoAcao === "responsavel" && !d.responsavel?.trim()) return "Escolha o novo responsável.";
    if (r.tipoAcao === "etapa" && !d.etapaDestinoId) return "Escolha a etapa de destino.";
    if (r.tipoAcao === "etiquetas" && !d.etiquetasAdicionar?.length && !d.etiquetasRemover?.length) {
      return "Diga ao menos uma etiqueta pra acrescentar ou tirar.";
    }
    if (r.tipoAcao === "tarefa" && !d.tarefaTitulo?.trim()) return "Escreva o título da tarefa.";
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
        await fetch(`/api/automacoes-fluxos/${fluxoParaAbrir}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ funilId, etapaId: etapaDoGatilho }),
        }).catch(() => {});
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
   * Abre o fluxograma do robô de um gatilho já salvo, direto da grade.
   *
   * Grava antes de qual funil e de qual etapa aquele robô é. É o que faz o canvas abrir sabendo
   * quando ele começa, em vez de perguntar de novo uma coisa que já foi respondida aqui.
   */
  async function abrirFluxograma(fluxoId: string, etapaId: string) {
    await fetch(`/api/automacoes-fluxos/${fluxoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funilId, etapaId }),
    }).catch(() => {});
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
    <div className="fauto">
      <div className="fauto-topo">
        <strong>{funilNome ?? "Automação do funil"}</strong>
        {onFechar ? (
          <button type="button" className="btn ghost" onClick={onFechar}>
            Voltar
          </button>
        ) : null}
      </div>

      <MigrarGatilhos aoMigrar={() => void recarregar()} />

      <div className="fauto-corpo">
        <aside className="fauto-lado">
          <h4>Fontes de lead</h4>
          {canais.length ? (
            canais.map((c) => (
              <div key={c.canal} className="fauto-fonte">
                <strong>{c.label}</strong>
                <span>{c.detalhe || "Conectado"}</span>
              </div>
            ))
          ) : (
            <p className="hint">Nenhum canal conectado ainda.</p>
          )}
          <Link href="/integracoes" className="fauto-lado-link">
            + Adicionar fonte
          </Link>
        </aside>

        <div className="fauto-grade">
          <div className="fauto-cab" style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(240px, 1fr))` }}>
            {colunas.map((coluna, i) => (
              <div key={coluna.id} className="fauto-cab-cel">
                <span className="fauto-cab-nome">{coluna.titulo}</span>
                <span className="fauto-cab-barra" style={{ background: CORES_ETAPA[i % CORES_ETAPA.length] }} />
                <span className="fauto-cab-sub">
                  {(porEtapa.get(coluna.id)?.length ?? 0) > 0
                    ? `${porEtapa.get(coluna.id)!.length} gatilho${porEtapa.get(coluna.id)!.length > 1 ? "s" : ""}`
                    : "Sem automação"}
                </span>
              </div>
            ))}
          </div>

          <div
            className="fauto-linhas"
            style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(240px, 1fr))` }}
          >
            {Array.from({ length: linhas }).map((_, linha) =>
              colunas.map((coluna) => {
                const gatilho = porEtapa.get(coluna.id)?.[linha];
                return (
                  <div key={`${coluna.id}-${linha}`} className="fauto-cel">
                    {gatilho ? (
                      <div className={`fauto-gat${gatilho.ativo ? "" : " desligado"}`}>
                        <button
                          type="button"
                          className="fauto-gat-corpo"
                          onClick={() => {
                            setErro(null);
                            setAviso(null);
                            setEscolhendoAcao(null);
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
                              title="Abrir o fluxograma deste robô"
                            >
                              Gerenciar
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
                            title="Remover este gatilho"
                          >
                            <IconClose width={10} height={10} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      // A primeira célula vazia da coluna é a que convida a criar. As de baixo
                      // ficam vazias mesmo: um "+" repetido em toda célula vira ruído.
                      (porEtapa.get(coluna.id)?.length ?? 0) === linha && (
                        <button type="button" className="fauto-add" onClick={() => abrirNovo(coluna.id)}>
                          <span aria-hidden="true">+</span> Adicionar gatilho
                        </button>
                      )
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {escolhendoAcao ? (
          <div className="fauto-painel">
            <div className="fauto-painel-topo">
              <strong>O que esta etapa faz?</strong>
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
                    setRascunho(rascunhoNovo(escolhendoAcao, a.tipo));
                    setEscolhendoAcao(null);
                  }}
                >
                  <strong>{ACAO_ROTULO[a.tipo]}</strong>
                  <span>{a.descricao}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {rascunho ? (
          <div className="fauto-painel">
            <div className="fauto-painel-topo">
              <strong>{rascunho.id ? "Editar gatilho" : ACAO_ROTULO[rascunho.tipoAcao]}</strong>
              <button type="button" className="fauto-mini" onClick={() => setRascunho(null)}>
                <IconClose width={11} height={11} />
              </button>
            </div>

            <div className="field">
              <label>Etapa</label>
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

            <div className="field">
              <label>Executar</label>
              <select
                className="input"
                value={rascunho.quando}
                onChange={(e) => setRascunho({ ...rascunho, quando: e.target.value as QuandoGatilho })}
              >
                {/* Agrupado por categoria, como no Kommo: a lista corrida não deixa ver que
                    "movido para esta etapa" e "quando uma tarefa for concluída" são coisas de
                    naturezas diferentes. */}
                {CATEGORIAS_GATILHO.map((categoria) => (
                  <optgroup key={categoria.titulo} label={categoria.titulo}>
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
                  <p className="hint mt8">
                    Todo dia nessa hora, para cada lead que estiver nesta etapa. Serve pra cobrança
                    e lembrete de quem está parado.
                  </p>
                </>
              ) : null}
            </div>

            {rascunho.tipoAcao === "robo" ? (
              <div className="field">
                <label>Robô</label>
                <select
                  className="input"
                  value={rascunho.fluxoId}
                  onChange={(e) => setRascunho({ ...rascunho, fluxoId: e.target.value })}
                >
                  <option value="">Nenhum robô selecionado</option>
                  {robos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                      {r.status === "publicado" ? "" : " (rascunho)"}
                    </option>
                  ))}
                </select>
                <button type="button" className="fauto-add mt8" onClick={criarRobo} disabled={criandoRobo}>
                  <span aria-hidden="true">+</span> {criandoRobo ? "Criando…" : "Criar um novo robô"}
                </button>
                {rascunho.fluxoId ? (
                  <button
                    type="button"
                    className="btn primary mt8"
                    disabled={salvando}
                    onClick={() => void salvar(true)}
                  >
                    Gerenciar
                  </button>
                ) : null}
                <p className="hint mt8">
                  O mesmo robô pode ser executado por várias etapas. O robô novo entra na lista
                  aqui e também na aba Automações: é o mesmo registro, não uma cópia.
                </p>
              </div>
            ) : null}

            {rascunho.tipoAcao === "mensagem" ? (
              <div className="field">
                <label>Mensagem</label>
                <textarea
                  className="input"
                  rows={4}
                  value={rascunho.acaoDados.mensagemTexto ?? ""}
                  onChange={(e) => mudarDados({ mensagemTexto: e.target.value })}
                  placeholder="Oi {primeiro_nome}, tudo bem?"
                />
                <p className="hint mt8">Aceita as mesmas variáveis dos blocos de mensagem.</p>
              </div>
            ) : null}

            {rascunho.tipoAcao === "responsavel" ? (
              <div className="field">
                <label>Novo responsável</label>
                <input
                  className="input"
                  value={rascunho.acaoDados.responsavel ?? ""}
                  onChange={(e) => mudarDados({ responsavel: e.target.value })}
                  placeholder="Nome de quem assume"
                />
              </div>
            ) : null}

            {rascunho.tipoAcao === "etapa" ? (
              <div className="field">
                <label>Mover para</label>
                <select
                  className="input"
                  value={rascunho.acaoDados.etapaDestinoId ?? ""}
                  onChange={(e) => mudarDados({ etapaDestinoId: e.target.value })}
                >
                  <option value="">Escolha a etapa</option>
                  {colunas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo}
                    </option>
                  ))}
                </select>
                {rascunho.acaoDados.etapaDestinoId === rascunho.etapaId ? (
                  <p className="hint mt8" style={{ color: "var(--danger)" }}>
                    A etapa de destino é a mesma da entrada. Isso faz o lead entrar de novo aqui,
                    sem fim.
                  </p>
                ) : null}
              </div>
            ) : null}

            {rascunho.tipoAcao === "etiquetas" ? (
              <>
                <div className="field">
                  <label>Acrescentar etiquetas</label>
                  <input
                    className="input"
                    value={(rascunho.acaoDados.etiquetasAdicionar ?? []).join(", ")}
                    onChange={(e) => mudarDados({ etiquetasAdicionar: paraLista(e.target.value) })}
                    placeholder="Separe por vírgula"
                  />
                </div>
                <div className="field">
                  <label>Tirar etiquetas</label>
                  <input
                    className="input"
                    value={(rascunho.acaoDados.etiquetasRemover ?? []).join(", ")}
                    onChange={(e) => mudarDados({ etiquetasRemover: paraLista(e.target.value) })}
                    placeholder="Separe por vírgula"
                  />
                </div>
              </>
            ) : null}

            {rascunho.tipoAcao === "tarefa" ? (
              <>
                <div className="field">
                  <label>Título da tarefa</label>
                  <input
                    className="input"
                    value={rascunho.acaoDados.tarefaTitulo ?? ""}
                    onChange={(e) => mudarDados({ tarefaTitulo: e.target.value })}
                    placeholder="Ligar para o lead"
                  />
                </div>
                <div className="field">
                  <label>Responsável pela tarefa</label>
                  <input
                    className="input"
                    value={rascunho.acaoDados.tarefaResponsavel ?? ""}
                    onChange={(e) => mudarDados({ tarefaResponsavel: e.target.value })}
                    placeholder="Deixe vazio pra usar o responsável do lead"
                  />
                </div>
                <div className="field">
                  <label>Prazo (dias)</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={rascunho.acaoDados.tarefaPrazoDias ?? 0}
                    onChange={(e) => mudarDados({ tarefaPrazoDias: Number(e.target.value) })}
                  />
                  <p className="hint mt8">0 = para hoje.</p>
                </div>
              </>
            ) : null}

            {rascunho.tipoAcao === "webhook" ? (
              <div className="field">
                <label>Endereço</label>
                <input
                  className="input"
                  value={rascunho.acaoDados.webhookUrl ?? ""}
                  onChange={(e) => mudarDados({ webhookUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            ) : null}

            <div className="field">
              <label>Para todos os leads com</label>
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
                    Tirar a condição
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="fauto-add"
                  onClick={() => setRascunho({ ...rascunho, condicao: grupoVazio() })}
                >
                  <span aria-hidden="true">+</span> Adicionar uma condição
                </button>
              )}
              <p className="hint mt8">Sem condição, vale pra todo lead que entrar nesta etapa.</p>
            </div>

            <div className="field">
              <label>Ativo</label>
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
                      {d.label}
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
              <p className="hint mt8">
                Sem dia e sem horário, o gatilho vale sempre. Fora da janela o lead entra na etapa
                normalmente, só não dispara.
              </p>
            </div>

            <label className="fauto-caixa">
              <input
                type="checkbox"
                checked={rascunho.aplicarAosAtuais}
                onChange={(e) => setRascunho({ ...rascunho, aplicarAosAtuais: e.target.checked })}
              />
              <span>Aplicar o gatilho aos leads que já estão nesta etapa</span>
            </label>

            {erro ? <p className="hint" style={{ color: "var(--danger)" }}>{erro}</p> : null}
            {aviso ? <p className="hint">{aviso}</p> : null}

            <div className="fauto-painel-fim">
              <button type="button" className="btn primary" onClick={() => void salvar()} disabled={salvando}>
                {salvando ? "Salvando…" : "Pronto"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setRascunho(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
