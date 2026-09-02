"use client";

import { useRef, useState } from "react";

import { executarFluxo, type ContextoExecucao, type Ligacoes } from "@/lib/automation-flow/motor";
import type {
  AguardarData,
  FluxoAutomacao,
  MensagemBotoesData,
  PassoExecucao,
  RegistroExecucao,
} from "@/lib/automation-flow/types";
import { IconBloqueado, IconCheck, IconClose, IconErro, IconFrasco, IconPause, IconPular } from "@/components/icons";

/** Situação de cada passo simulado. Eram emojis — família tipográfica diferente da interface e
 * cor fixa que não acompanha o tema. */
const ICONE_STATUS: Record<PassoExecucao["status"], typeof IconCheck> = {
  ok: IconCheck,
  condicao_falsa: IconBloqueado,
  aguardando: IconPause,
  erro: IconErro,
  pulado: IconPular,
};

const LABEL_SITUACAO: Record<RegistroExecucao["situacao"], string> = {
  aguardando: "Aguardando",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  pausada: "Pausada",
  cancelada: "Cancelada",
  erro: "Erro",
};

/**
 * Painel "Testar" — roda o fluxo de verdade (`executarFluxo`) mas com
 * `Ligacoes` totalmente simuladas: nenhuma delas toca `useFunis`/`useContatos`
 * de verdade, só empilha uma linha de log. Ver spec seção 14 — sem enviar
 * mensagens reais nem mexer em dado real do CRM.
 *
 * Como `executarFluxo` para de vez em quando esperando algo (uma resposta de
 * botão/lista, ou uma espera que não é "curta o suficiente" pra seguir
 * direto — ver `motor.ts`), o simulador implementa retomada manual: cada
 * "continuação" é uma nova chamada de `executarFluxo` a partir do nó de
 * destino escolhido, com os passos novos anexados ao rastro (trace) que já
 * vinha crescendo — nunca reinicia do zero.
 */
export function Simulador({ fluxo, onFechar }: { fluxo: FluxoAutomacao; onFechar: () => void }) {
  const [nome, setNome] = useState("Contato de teste");
  const [origem, setOrigem] = useState("Indicação");
  const [etiquetas, setEtiquetas] = useState("");
  const [campoNome, setCampoNome] = useState("");
  const [campoValor, setCampoValor] = useState("");

  const [passos, setPassos] = useState<PassoExecucao[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [situacao, setSituacao] = useState<RegistroExecucao["situacao"] | null>(null);
  const [erroFinal, setErroFinal] = useState<string | undefined>(undefined);
  const [erroSetup, setErroSetup] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);

  const contatoRef = useRef<ContextoExecucao["contato"] | null>(null);

  const noGatilho = fluxo.nodes.find((n) => n.category === "gatilho");

  function criarLigacoes(): Ligacoes {
    return {
      moverEtapa: (funilId, etapaTitulo) => setLog((l) => [...l, `(simulado) moveria o card pra "${etapaTitulo}" no funil ${funilId}.`]),
      salvarContato: (contatoNome, dados) => {
        setLog((l) => [...l, `(simulado) salvaria em "${contatoNome}": ${JSON.stringify(dados)}.`]);
        if (contatoRef.current && dados && typeof dados === "object") {
          const d = dados as Record<string, unknown>;
          if (Array.isArray(d.etiquetas)) contatoRef.current.etiquetas = d.etiquetas as string[];
          Object.entries(d).forEach(([chave, valor]) => {
            if (chave === "etiquetas" || !contatoRef.current) return;
            if (typeof valor === "string") {
              contatoRef.current.camposPersonalizados = { ...contatoRef.current.camposPersonalizados, [chave]: valor };
            }
          });
        }
      },
      atribuirAtendente: (contatoNome, atendente) => {
        setLog((l) => [...l, `(simulado) atribuiria "${atendente}" a "${contatoNome}".`]);
        if (contatoRef.current) contatoRef.current.responsavel = atendente;
      },
      registrarMensagemSimulada: (info) => setLog((l) => [...l, `(simulado) mensagem [${info.canal}]: "${info.conteudo}"`]),
      registrarWebhookSimulado: (info) => setLog((l) => [...l, `(simulado) webhook pra ${info.url}.`]),
    };
  }

  function contextoAtual(): ContextoExecucao {
    return { contato: contatoRef.current! };
  }

  function aplicarRegistro(registro: RegistroExecucao) {
    setPassos((p) => [...p, ...registro.passos]);
    setSituacao(registro.situacao);
    setErroFinal(registro.erro);
  }

  function iniciar() {
    setErroSetup(null);
    if (!noGatilho) {
      setErroSetup("Esse fluxo não tem um bloco de gatilho — nada pra simular.");
      return;
    }
    const primeiraAresta = fluxo.edges.find((e) => e.source === noGatilho.id);
    if (!primeiraAresta) {
      setErroSetup("O gatilho desse fluxo ainda não está conectado a nada.");
      return;
    }

    contatoRef.current = {
      nome: nome.trim() || "Contato de teste",
      etiquetas: etiquetas.split(",").map((e) => e.trim()).filter(Boolean),
      origem: origem.trim() || undefined,
      camposPersonalizados: campoNome.trim() ? { [campoNome.trim()]: campoValor } : undefined,
    };
    setPassos([]);
    setLog([]);
    setSituacao(null);
    setErroFinal(undefined);
    setRodando(true);

    const registro = executarFluxo(fluxo, primeiraAresta.target, contextoAtual(), criarLigacoes());
    aplicarRegistro(registro);
  }

  /** Continua a execução a partir da aresta de saída do nó que parou, escolhendo o handle certo. */
  function continuarDoNoParado(handle: string | undefined) {
    if (!contatoRef.current || passos.length === 0) return;
    const ultimoPasso = passos[passos.length - 1];
    const saidas = fluxo.edges.filter((e) => e.source === ultimoPasso.nodeId);
    const proxima = handle !== undefined ? saidas.find((e) => e.sourceHandle === handle) : saidas[0];
    if (!proxima) {
      setLog((l) => [...l, `(simulador) não há caminho de saída "${handle ?? "padrão"}" configurado nesse bloco.`]);
      return;
    }
    const registro = executarFluxo(fluxo, proxima.target, contextoAtual(), criarLigacoes());
    aplicarRegistro(registro);
  }

  function escolherResposta(opcaoId: string) {
    if (contatoRef.current) contatoRef.current.ultimaRespostaEm = new Date().toISOString();
    continuarDoNoParado(opcaoId);
  }

  function avancarTempo(comoTimeout: boolean) {
    continuarDoNoParado(comoTimeout ? "timeout" : undefined);
  }

  function avancarTempoComOk() {
    continuarDoNoParado("ok");
  }

  function reiniciar() {
    setPassos([]);
    setLog([]);
    setSituacao(null);
    setErroFinal(undefined);
    setErroSetup(null);
    setRodando(false);
    contatoRef.current = null;
  }

  const ultimoPasso = passos.length > 0 ? passos[passos.length - 1] : null;
  const noParado = ultimoPasso && situacao === "aguardando" ? fluxo.nodes.find((n) => n.id === ultimoPasso.nodeId) : undefined;
  const aguardandoBotoes = noParado && (noParado.type === "mensagem_botoes" || noParado.type === "mensagem_lista");
  const aguardandoEspera = noParado && noParado.type === "aguardar";
  const esperaData = aguardandoEspera ? (noParado!.data as AguardarData) : undefined;
  const opcoesBotoes = aguardandoBotoes ? (noParado!.data as MensagemBotoesData).opcoes ?? [] : [];

  return (
    <div className="flow-side-overlay" role="dialog" aria-label="Testar automação" onClick={onFechar}>
      <div className="flow-side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-h">
          <h4>Testar automação</h4>
          <button type="button" className="icon-btn subtle" aria-label="Fechar simulador" onClick={onFechar}>
            <IconClose width={13} height={13} />
          </button>
        </div>
        <div className="flow-side-body">
          <p className="flow-sim-banner">
            <IconFrasco width={13} height={13} aria-hidden="true" /> Modo de teste — nenhuma ação real será executada.
          </p>
          <p className="hint">
            Simulação local — não envia mensagem real, não move card de verdade e não grava nada no CRM. Gatilho:{" "}
            <strong>{noGatilho ? noGatilho.titulo || noGatilho.type : "nenhum"}</strong>
          </p>

          {!rodando ? (
            <>
              <div className="flow-form">
                <div className="field">
                  <label>Nome do contato (fictício)</label>
                  <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="field">
                  <label>Origem</label>
                  <input className="input" value={origem} onChange={(e) => setOrigem(e.target.value)} />
                </div>
                <div className="field">
                  <label>Etiquetas (separadas por vírgula)</label>
                  <input className="input" value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} />
                </div>
                <div className="field">
                  <label>Campo personalizado (opcional)</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input className="input" style={{ flex: 1 }} placeholder="nome do campo" value={campoNome} onChange={(e) => setCampoNome(e.target.value)} />
                    <input className="input" style={{ flex: 1 }} placeholder="valor" value={campoValor} onChange={(e) => setCampoValor(e.target.value)} />
                  </div>
                </div>
              </div>

              <button type="button" className="btn primary block mt14" onClick={iniciar}>
                Rodar simulação
              </button>

              {erroSetup ? <p className="flow-problema erro mt14">{erroSetup}</p> : null}
            </>
          ) : (
            <div className="mt14">
              <p className="n">
                Resultado: <strong>{situacao ? LABEL_SITUACAO[situacao] : "—"}</strong>
                {erroFinal ? ` — ${erroFinal}` : ""}
              </p>

              <ul className="flow-sim-passos">
                {passos.map((passo, i) => (
                  <li key={`${passo.nodeId}-${i}`}>
                    <span aria-hidden="true" style={{ display: "inline-flex" }}>
                      {(() => {
                        const IconeStatus = ICONE_STATUS[passo.status];
                        return <IconeStatus width={13} height={13} />;
                      })()}
                    </span>
                    <div>
                      <p className="n">{passo.label}</p>
                      {passo.detalhe ? <p className="r">{passo.detalhe}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>

              {aguardandoBotoes ? (
                <div className="flow-sim-continuar">
                  <p className="n">Qual resposta o contato dá?</p>
                  <div className="flow-sim-opcoes">
                    {opcoesBotoes.map((op) => (
                      <button key={op.id} type="button" className="btn ghost" onClick={() => escolherResposta(op.id)}>
                        {op.rotulo || "Opção sem nome"}
                      </button>
                    ))}
                    <button type="button" className="btn ghost" onClick={() => escolherResposta("outra_resposta")}>
                      Outra resposta
                    </button>
                    <button type="button" className="btn ghost" onClick={() => escolherResposta("nao_respondeu")}>
                      Não respondeu
                    </button>
                  </div>
                </div>
              ) : null}

              {aguardandoEspera ? (
                <div className="flow-sim-continuar">
                  <p className="n">Fluxo pausado em uma espera ({esperaData?.modo}).</p>
                  <div className="flow-sim-opcoes">
                    <button type="button" className="btn ghost" onClick={() => (esperaData?.tempoMaximo ? avancarTempoComOk() : avancarTempo(false))}>
                      ⏭ Avançar o tempo
                    </button>
                    {esperaData?.tempoMaximo ? (
                      <button type="button" className="btn ghost" onClick={() => avancarTempo(true)}>
                        Simular tempo esgotado
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {log.length > 0 ? (
                <>
                  <p className="n mt14">Log da simulação</p>
                  <ul className="flow-sim-log">
                    {log.map((linha, i) => (
                      <li key={i}>{linha}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              <button type="button" className="btn ghost block mt14" onClick={reiniciar}>
                Reiniciar teste
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
