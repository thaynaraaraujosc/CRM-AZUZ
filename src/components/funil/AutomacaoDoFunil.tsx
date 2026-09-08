"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconAutomacoes, IconClose } from "@/components/icons";
import { QUANDO_ROTULO, type GatilhoEtapaVisao, type QuandoGatilho } from "@/lib/funil/gatilhos-etapa-tipos";

/**
 * A camada de automação DO FUNIL. Cada etapa mostra os gatilhos que tem e o robô que cada um
 * executa, na mesma largura das colunas do quadro.
 *
 * O ganho é enxergar: antes, saber quais etapas fazem algo sozinhas exigia abrir automação por
 * automação, porque o gatilho morava dentro do fluxo. Aqui a etapa é a dona, o fluxo é só o robô,
 * e o mesmo robô pode ser executado por várias etapas.
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

const QUANDOS: QuandoGatilho[] = ["movido", "criado", "movido_ou_criado", "responsavel_alterado"];

/** O rascunho que o painel edita. Vira gatilho de verdade só quando ela clica em Pronto. */
type Rascunho = {
  id?: string;
  etapaId: string;
  quando: QuandoGatilho;
  fluxoId: string;
  diasAtivos: number[];
  horaInicio: string;
  horaFim: string;
  ativo: boolean;
};

function rascunhoNovo(etapaId: string): Rascunho {
  return { etapaId, quando: "movido", fluxoId: "", diasAtivos: [], horaInicio: "", horaFim: "", ativo: true };
}

function doGatilho(g: GatilhoEtapaVisao): Rascunho {
  return {
    id: g.id,
    etapaId: g.etapaId,
    quando: g.quando,
    fluxoId: g.fluxoId,
    diasAtivos: g.diasAtivos ?? [],
    horaInicio: g.horaInicio ?? "",
    horaFim: g.horaFim ?? "",
    ativo: g.ativo,
  };
}

/** "sempre", ou "Seg, Ter, Qua de 10:00 às 19:00". O que a faixa mostra embaixo do robô. */
function resumoDaJanela(g: GatilhoEtapaVisao): string | null {
  const dias = g.diasAtivos ?? [];
  const temHora = g.horaInicio && g.horaFim;
  if (!dias.length && !temHora) return null;
  const nomes = dias.length ? DIAS.filter((d) => dias.includes(d.valor)).map((d) => d.label).join(", ") : "Todo dia";
  return temHora ? `${nomes} de ${g.horaInicio} às ${g.horaFim}` : nomes;
}

export function AutomacaoDoFunil({ funilId, colunas }: { funilId: string; colunas: ColunaResumo[] }) {
  const [gatilhos, setGatilhos] = useState<GatilhoEtapaVisao[]>([]);
  const [robos, setRobos] = useState<RoboResumo[]>([]);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const resposta = await fetch(`/api/funis/gatilhos?funilId=${encodeURIComponent(funilId)}`);
    if (!resposta.ok) return;
    setGatilhos((await resposta.json()) as GatilhoEtapaVisao[]);
  }, [funilId]);

  // As duas listas em `.then`, não em `await` dentro do efeito: o efeito precisa devolver a
  // função de limpeza na hora, e um `await` antes do `setState` faria a resposta de um funil
  // antigo chegar depois da troca e sobrescrever a lista certa.
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

  async function salvar() {
    if (!rascunho) return;
    if (!rascunho.fluxoId) {
      setErro("Escolha o robô que esta etapa vai executar.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const corpo = {
        etapaId: rascunho.etapaId,
        quando: rascunho.quando,
        fluxoId: rascunho.fluxoId,
        diasAtivos: rascunho.diasAtivos,
        horaInicio: rascunho.horaInicio || null,
        horaFim: rascunho.horaFim || null,
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
                return (
                  <div key={g.id} className={`funil-auto-cartao${g.ativo ? "" : " desligado"}`}>
                    <button
                      type="button"
                      className="funil-auto-cartao-corpo"
                      onClick={() => {
                        setErro(null);
                        setRascunho(doGatilho(g));
                      }}
                    >
                      <span className="funil-auto-quando">
                        <IconAutomacoes width={12} height={12} aria-hidden="true" />
                        {QUANDO_ROTULO[g.quando]}
                      </span>
                      <span className="funil-auto-robo">
                        Executar robô: {g.fluxoNome ?? "robô apagado"}
                      </span>
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
                  setRascunho(rascunhoNovo(coluna.id));
                }}
              >
                <span aria-hidden="true">+</span> Adicionar gatilho
              </button>
            </div>
          );
        })}
      </div>

      {rascunho ? (
        <div className="funil-auto-painel">
          <div className="funil-auto-painel-topo">
            <strong>{rascunho.id ? "Editar gatilho" : "Novo gatilho"}</strong>
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
          </div>

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
              O robô é uma automação da aba Automações. A mesma pode ser executada por várias
              etapas.
            </p>
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
              normalmente, só não dispara o robô.
            </p>
          </div>

          {erro ? <p className="hint" style={{ color: "var(--danger)" }}>{erro}</p> : null}

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
