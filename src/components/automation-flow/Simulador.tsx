"use client";

import { useState } from "react";

import type { EstadoSimulacao } from "@/lib/automacoes/simular";
import type { AguardarData, FluxoAutomacao } from "@/lib/automation-flow/types";
import { IconBloqueado, IconCheck, IconClose, IconErro, IconFrasco, IconPause, IconPular } from "@/components/icons";

/** Situação de cada passo. Eram emojis — família tipográfica diferente da interface e cor fixa que
 * não acompanha o tema. */
const ICONE_STATUS: Record<string, typeof IconCheck> = {
  ok: IconCheck,
  condicao_falsa: IconBloqueado,
  aguardando: IconPause,
  erro: IconErro,
  pulado: IconPular,
};

const LABEL_SITUACAO: Record<string, string> = {
  em_andamento: "Em andamento",
  aguardando_tempo: "Esperando o tempo passar",
  aguardando_evento: "Esperando a resposta",
  concluida: "Concluída",
  cancelada: "Cancelada",
  erro: "Erro",
};

/**
 * Painel "Testar" — roda o MOTOR DE VERDADE em modo seco.
 *
 * Antes, este painel tinha a própria lógica de percorrer o fluxo. Isso quer dizer que ele podia
 * dizer "vai funcionar" sobre algo que na prática não funcionava — o pior defeito possível num
 * simulador, porque a pessoa confia nele justamente pra não errar com cliente de verdade.
 *
 * Agora ele chama o servidor, que roda o mesmo motor das automações reais com duas trocas: as
 * ações não enviam nada nem gravam nada, e o estado da execução fica na memória, não no banco. As
 * decisões — condição, caminho do botão, espera — são exatamente as mesmas.
 */
export function Simulador({ fluxo, onFechar }: { fluxo: FluxoAutomacao; onFechar: () => void }) {
  const [nome, setNome] = useState("Contato de teste");
  const [origem, setOrigem] = useState("Indicação");
  const [etiquetas, setEtiquetas] = useState("");
  const [campoNome, setCampoNome] = useState("");
  const [campoValor, setCampoValor] = useState("");

  const [estado, setEstado] = useState<EstadoSimulacao | null>(null);
  const [erroSetup, setErroSetup] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const noGatilho = fluxo.nodes.find((n) => n.category === "gatilho");

  async function chamar(corpo: Record<string, unknown>) {
    setOcupado(true);
    setErroSetup(null);
    try {
      const resposta = await fetch(`/api/automacoes-fluxos/${fluxo.id}/simular`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErroSetup(dados?.erro ?? "Não foi possível rodar a simulação.");
        return;
      }
      setEstado(dados as EstadoSimulacao);
    } catch {
      setErroSetup("Não foi possível falar com o servidor pra rodar a simulação.");
    } finally {
      setOcupado(false);
    }
  }

  function iniciar() {
    // O fluxo é lido no servidor a partir do rascunho salvo. Se o editor tem alteração ainda não
    // salva, o teste roda o que está gravado — dizer isso é melhor do que testar outra coisa.
    void chamar({
      contato: {
        nome: nome.trim() || "Contato de teste",
        etiquetas: etiquetas.split(",").map((e) => e.trim()).filter(Boolean),
        origem: origem.trim() || undefined,
        camposPersonalizados: campoNome.trim() ? { [campoNome.trim()]: campoValor } : undefined,
      },
    });
  }

  function responder(resposta: string) {
    if (estado) void chamar({ estado, resposta });
  }

  function seguirPor(saida?: string) {
    if (estado) void chamar({ estado, saida });
  }

  function reiniciar() {
    setEstado(null);
    setErroSetup(null);
  }

  const esperando = estado?.esperando ?? null;
  const noParado = esperando ? fluxo.nodes.find((n) => n.id === esperando.noId) : undefined;
  const aguardandoOpcoes = esperando && (esperando.tipo === "mensagem_botoes" || esperando.tipo === "mensagem_lista");
  const aguardandoEspera = esperando && esperando.tipo === "aguardar";
  const esperaData = aguardandoEspera && noParado ? (noParado.data as AguardarData) : undefined;

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
            Roda o mesmo motor das automações de verdade, só que sem enviar mensagem, sem mexer no
            contato e sem gravar nada. Testa o fluxo <strong>como está salvo</strong> — alteração
            ainda não salva no editor não entra. Gatilho:{" "}
            <strong>{noGatilho ? noGatilho.titulo || noGatilho.type : "nenhum"}</strong>
          </p>

          {!estado ? (
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

              <button type="button" className="btn primary block mt14" onClick={iniciar} disabled={ocupado}>
                {ocupado ? "Rodando…" : "Rodar simulação"}
              </button>

              {erroSetup ? <p className="flow-problema erro mt14">{erroSetup}</p> : null}
            </>
          ) : (
            <div className="mt14">
              <p className="n">
                Resultado: <strong>{LABEL_SITUACAO[estado.situacao] ?? estado.situacao}</strong>
                {estado.erro ? ` — ${estado.erro}` : ""}
              </p>

              <ul className="flow-sim-passos">
                {estado.passos.map((passo, i) => {
                  const IconeStatus = ICONE_STATUS[passo.resultado] ?? IconCheck;
                  return (
                    <li key={`${passo.noId}-${i}`}>
                      <span aria-hidden="true" style={{ display: "inline-flex" }}>
                        <IconeStatus width={13} height={13} />
                      </span>
                      <div>
                        <p className="n">{passo.titulo || passo.noTipo}</p>
                        {passo.detalhe ? <p className="r">{passo.detalhe}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {aguardandoOpcoes ? (
                <div className="flow-sim-continuar">
                  <p className="n">Qual resposta o contato dá?</p>
                  <div className="flow-sim-opcoes">
                    {(esperando?.opcoes ?? []).map((op) => (
                      <button key={op.id} type="button" className="btn ghost" disabled={ocupado} onClick={() => responder(op.rotulo)}>
                        {op.rotulo || "Opção sem nome"}
                      </button>
                    ))}
                    {/* Manda um texto que de propósito não bate com opção nenhuma: é assim que dá
                        pra ver o que acontece quando a pessoa responde qualquer outra coisa. */}
                    <button type="button" className="btn ghost" disabled={ocupado} onClick={() => responder("(qualquer outra coisa)")}>
                      Outra resposta
                    </button>
                  </div>
                </div>
              ) : null}

              {aguardandoEspera ? (
                <div className="flow-sim-continuar">
                  <p className="n">Fluxo parado numa espera ({esperaData?.modo ?? "tempo"}).</p>
                  <div className="flow-sim-opcoes">
                    <button type="button" className="btn ghost" disabled={ocupado} onClick={() => seguirPor(undefined)}>
                      ⏭ Avançar o tempo
                    </button>
                    {esperaData?.tempoMaximo ? (
                      <button type="button" className="btn ghost" disabled={ocupado} onClick={() => seguirPor("timeout")}>
                        Simular tempo esgotado
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {estado.intencoes.length > 0 ? (
                <>
                  <p className="n mt14">O que teria acontecido de verdade</p>
                  <ul className="flow-sim-log">
                    {estado.intencoes.map((linha, i) => (
                      <li key={i}>{linha}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              {erroSetup ? <p className="flow-problema erro mt14">{erroSetup}</p> : null}

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
