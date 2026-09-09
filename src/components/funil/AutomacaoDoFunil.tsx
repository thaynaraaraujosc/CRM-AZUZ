"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { IconAutomacoes, IconClose } from "@/components/icons";
import { CondicaoForm } from "@/components/automation-flow/forms/CondicaoForm";
import type { GrupoCondicoes } from "@/lib/automation-flow/types";
import {
  ACAO_ROTULO,
  QUANDO_ROTULO,
  type AcaoDados,
  type GatilhoEtapaVisao,
  type QuandoGatilho,
  type TipoAcaoGatilho,
} from "@/lib/funil/gatilhos-etapa-tipos";

/**
 * A camada de automação DO FUNIL. Cada etapa mostra o que dispara sozinha, na mesma largura das
 * colunas do quadro.
 *
 * O ganho é enxergar: antes, saber quais etapas fazem algo sozinhas exigia abrir automação por
 * automação, porque o gatilho morava dentro do fluxo. Aqui a etapa é a dona, o fluxo é só o robô,
 * e o mesmo robô pode ser executado por várias etapas. Uma etapa também pode fazer coisas simples
 * (trocar o responsável, marcar uma tarefa) sem robô nenhum no meio.
 */

type ColunaResumo = { id: string; titulo: string };
type RoboResumo = { id: string; nome: string; status?: string };

const DIAS = [
  { valor: 1, label: "Seg" },
  { valor: 2, label: "Ter" },
  { valor: 3, label: "Qua" },
  { valor: 4, label: "Qui" },
  { valor: 5, label: "Sex" },
  { valor: 6, label: "Sáb" },
  { valor: 7, label: "Dom" },
];

const QUANDOS: QuandoGatilho[] = ["movido", "criado", "movido_ou_criado", "responsavel_alterado", "diariamente"];

/** As ações que a etapa pode disparar, na ordem em que aparecem no seletor. */
const ACOES: { tipo: TipoAcaoGatilho; descricao: string }[] = [
  { tipo: "robo", descricao: "Executa uma automação inteira, com mensagens, esperas e condições." },
  { tipo: "mensagem", descricao: "Manda um texto pelo canal da conversa do lead." },
  { tipo: "responsavel", descricao: "Passa o lead pra outra pessoa do time." },
  { tipo: "etapa", descricao: "Move o lead pra outra etapa assim que entrar nesta." },
  { tipo: "etiquetas", descricao: "Acrescenta ou tira etiquetas do contato." },
  { tipo: "tarefa", descricao: "Cria uma tarefa no quadro, com prazo." },
  { tipo: "webhook", descricao: "Avisa um sistema de fora que o lead chegou aqui." },
];

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
  /** Não é campo do gatilho: é o "rodar agora nos leads que já estão aqui" do Kommo. */
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

/** A linha de baixo do cartão: "Seg, Ter de 10:00 às 19:00", ou nada quando vale sempre. */
function resumoDaJanela(g: GatilhoEtapaVisao): string | null {
  const dias = g.diasAtivos ?? [];
  const temHora = g.horaInicio && g.horaFim;
  if (!dias.length && !temHora) return null;
  const nomes = dias.length ? DIAS.filter((d) => dias.includes(d.valor)).map((d) => d.label).join(", ") : "Todo dia";
  return temHora ? `${nomes} de ${g.horaInicio} às ${g.horaFim}` : nomes;
}

/** O que o cartão escreve em negrito. É a ação, não o tipo dela. */
function descricaoDaAcao(g: GatilhoEtapaVisao, colunas: ColunaResumo[]): string {
  const dados = g.acaoDados ?? {};
  switch (g.tipoAcao ?? "robo") {
    case "robo":
      return `Executar robô: ${g.fluxoNome ?? "robô apagado"}`;
    case "responsavel":
      return `Alterar responsável: ${dados.responsavel || "ninguém escolhido"}`;
    case "etapa": {
      const destino = colunas.find((c) => c.id === dados.etapaDestinoId);
      return `Mudar etapa: ${destino?.titulo ?? "etapa apagada"}`;
    }
    case "etiquetas": {
      const mais = dados.etiquetasAdicionar ?? [];
      const menos = dados.etiquetasRemover ?? [];
      const partes = [mais.length ? `+${mais.join(", ")}` : "", menos.length ? `-${menos.join(", ")}` : ""];
      return `Editar etiquetas: ${partes.filter(Boolean).join("  ") || "nada escolhido"}`;
    }
    case "tarefa":
      return `Criar tarefa: ${dados.tarefaTitulo || "sem título"}`;
    case "webhook":
      return `Webhook: ${dados.webhookUrl || "sem endereço"}`;
    case "mensagem":
      return `Enviar: ${(dados.mensagemTexto || "sem texto").slice(0, 60)}`;
    default:
      return ACAO_ROTULO[g.tipoAcao ?? "robo"];
  }
}

/** Lista separada por vírgula vira array, e vice-versa. É como as etiquetas são digitadas. */
const paraLista = (texto: string) => texto.split(",").map((t) => t.trim()).filter(Boolean);

export function AutomacaoDoFunil({ funilId, colunas }: { funilId: string; colunas: ColunaResumo[] }) {
  const [gatilhos, setGatilhos] = useState<GatilhoEtapaVisao[]>([]);
  const [robos, setRobos] = useState<RoboResumo[]>([]);
  const [escolhendoAcao, setEscolhendoAcao] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
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

  async function salvar() {
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
      setRascunho(null);
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

  async function alternarAtivo(g: GatilhoEtapaVisao) {
    setGatilhos((atual) => atual.map((x) => (x.id === g.id ? { ...x, ativo: !x.ativo } : x)));
    await fetch(`/api/funis/gatilhos/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !g.ativo }),
    }).catch(() => {});
    await recarregar();
  }

  function mudarDados(patch: Partial<AcaoDados>) {
    if (!rascunho) return;
    setRascunho({ ...rascunho, acaoDados: { ...rascunho.acaoDados, ...patch } });
  }

  return (
    <div className="funil-auto">
      <div className="funil-auto-grade">
        {colunas.map((coluna) => {
          const daEtapa = porEtapa.get(coluna.id) ?? [];
          return (
            <div key={coluna.id} className="funil-auto-col">
              <div className="funil-auto-col-topo">{coluna.titulo}</div>

              {daEtapa.map((g) => {
                const janela = resumoDaJanela(g);
                const temCondicao = (g.condicao?.regras?.length ?? 0) > 0 || (g.condicao?.subgrupos?.length ?? 0) > 0;
                return (
                  <div key={g.id} className={`funil-auto-cartao${g.ativo ? "" : " desligado"}`}>
                    <button
                      type="button"
                      className="funil-auto-cartao-corpo"
                      onClick={() => {
                        setErro(null);
                        setAviso(null);
                        setEscolhendoAcao(null);
                        setRascunho(doGatilho(g));
                      }}
                    >
                      <span className="funil-auto-quando">
                        <IconAutomacoes width={12} height={12} aria-hidden="true" />
                        {QUANDO_ROTULO[g.quando]}
                        {g.quando === "diariamente" && g.horarioDiario ? ` às ${g.horarioDiario}` : ""}
                      </span>
                      <span className="funil-auto-robo">{descricaoDaAcao(g, colunas)}</span>
                      {temCondicao ? <span className="funil-auto-janela">Só pros leads que batem na condição</span> : null}
                      {janela ? <span className="funil-auto-janela">{janela}</span> : null}
                    </button>
                    <div className="funil-auto-cartao-acoes">
                      <button
                        type="button"
                        className="funil-auto-mini"
                        onClick={() => alternarAtivo(g)}
                        title={g.ativo ? "Desligar este gatilho" : "Ligar este gatilho"}
                      >
                        {g.ativo ? "Ligado" : "Desligado"}
                      </button>
                      <button
                        type="button"
                        className="funil-auto-mini"
                        onClick={() => remover(g.id)}
                        title="Remover este gatilho"
                      >
                        <IconClose width={10} height={10} />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                className="funil-auto-add"
                onClick={() => {
                  setErro(null);
                  setAviso(null);
                  setRascunho(null);
                  setEscolhendoAcao(coluna.id);
                }}
              >
                <span aria-hidden="true">+</span> Adicionar gatilho
              </button>
            </div>
          );
        })}
      </div>

      {/* Escolher O QUE a etapa faz vem antes de configurar: é a pergunta que muda todo o resto
          do painel, e misturá-la com os campos deixava a tela cheia de campos inúteis. */}
      {escolhendoAcao ? (
        <div className="funil-auto-painel">
          <div className="funil-auto-painel-topo">
            <strong>O que esta etapa faz?</strong>
            <button type="button" className="funil-auto-mini" onClick={() => setEscolhendoAcao(null)}>
              <IconClose width={11} height={11} />
            </button>
          </div>
          <div className="funil-auto-acoes">
            {ACOES.map((a) => (
              <button
                key={a.tipo}
                type="button"
                className="funil-auto-acao"
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
        <div className="funil-auto-painel">
          <div className="funil-auto-painel-topo">
            <strong>{rascunho.id ? "Editar gatilho" : ACAO_ROTULO[rascunho.tipoAcao]}</strong>
            <button type="button" className="funil-auto-mini" onClick={() => setRascunho(null)}>
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
              {QUANDOS.map((q) => (
                <option key={q} value={q}>
                  {QUANDO_ROTULO[q]}
                </option>
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
                  Todo dia nessa hora, para cada lead que estiver nesta etapa. Serve pra cobrança e
                  lembrete de quem está parado.
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
              <p className="hint mt8">
                O mesmo robô pode ser executado por várias etapas.{" "}
                <Link href="/automacoes?criar=1">Criar um novo robô</Link>
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
                  A etapa de destino é a mesma da entrada. Isso faz o lead entrar de novo aqui, sem
                  fim.
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
                  className="funil-auto-mini"
                  onClick={() => setRascunho({ ...rascunho, condicao: null })}
                >
                  Tirar a condição
                </button>
              </>
            ) : (
              <button
                type="button"
                className="funil-auto-add"
                onClick={() => setRascunho({ ...rascunho, condicao: grupoVazio() })}
              >
                <span aria-hidden="true">+</span> Adicionar uma condição
              </button>
            )}
            <p className="hint mt8">Sem condição, vale pra todo lead que entrar nesta etapa.</p>
          </div>

          <div className="field">
            <label>Ativo</label>
            <div className="funil-auto-dias">
              {DIAS.map((d) => {
                const marcado = rascunho.diasAtivos.includes(d.valor);
                return (
                  <button
                    key={d.valor}
                    type="button"
                    className={`funil-auto-dia${marcado ? " on" : ""}`}
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
            <div className="funil-auto-horas">
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

          <label className="funil-auto-caixa">
            <input
              type="checkbox"
              checked={rascunho.aplicarAosAtuais}
              onChange={(e) => setRascunho({ ...rascunho, aplicarAosAtuais: e.target.checked })}
            />
            <span>Aplicar o gatilho aos leads que já estão nesta etapa</span>
          </label>

          {erro ? <p className="hint" style={{ color: "var(--danger)" }}>{erro}</p> : null}
          {aviso ? <p className="hint">{aviso}</p> : null}

          <div className="funil-auto-painel-fim">
            <button type="button" className="btn" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Pronto"}
            </button>
            <button type="button" className="btn ghost" onClick={() => setRascunho(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
