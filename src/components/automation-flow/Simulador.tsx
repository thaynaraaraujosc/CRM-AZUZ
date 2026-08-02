"use client";

import { useState } from "react";

import { executarFluxo, type ContextoExecucao, type Ligacoes } from "@/lib/automation-flow/motor";
import type { FluxoAutomacao, RegistroExecucao } from "@/lib/automation-flow/types";

const ICONE_STATUS: Record<RegistroExecucao["passos"][number]["status"], string> = {
  ok: "✅",
  condicao_falsa: "🚫",
  aguardando: "⏸️",
  erro: "❌",
  pulado: "⏭️",
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
 */
export function Simulador({ fluxo, onFechar }: { fluxo: FluxoAutomacao; onFechar: () => void }) {
  const [nome, setNome] = useState("Contato de teste");
  const [origem, setOrigem] = useState("Indicação");
  const [etiquetas, setEtiquetas] = useState("");
  const [campoNome, setCampoNome] = useState("");
  const [campoValor, setCampoValor] = useState("");
  const [resultado, setResultado] = useState<{ registro: RegistroExecucao; log: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const noGatilho = fluxo.nodes.find((n) => n.category === "gatilho");

  function rodar() {
    setErro(null);
    setResultado(null);

    if (!noGatilho) {
      setErro("Esse fluxo não tem um bloco de gatilho — nada pra simular.");
      return;
    }
    const primeiraAresta = fluxo.edges.find((e) => e.source === noGatilho.id);
    if (!primeiraAresta) {
      setErro("O gatilho desse fluxo ainda não está conectado a nada.");
      return;
    }

    const contexto: ContextoExecucao = {
      contato: {
        nome: nome.trim() || "Contato de teste",
        etiquetas: etiquetas
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
        origem: origem.trim() || undefined,
        camposPersonalizados: campoNome.trim() ? { [campoNome.trim()]: campoValor } : undefined,
      },
    };

    const log: string[] = [];
    const ligacoes: Ligacoes = {
      moverEtapa: (funilId, etapaTitulo) => log.push(`(simulado) moveria o card pra "${etapaTitulo}" no funil ${funilId}.`),
      salvarContato: (contatoNome, dados) => log.push(`(simulado) salvaria em "${contatoNome}": ${JSON.stringify(dados)}.`),
      atribuirAtendente: (contatoNome, atendente) => log.push(`(simulado) atribuiria "${atendente}" a "${contatoNome}".`),
      registrarMensagemSimulada: (info) => log.push(`(simulado) mensagem [${info.canal}]: "${info.conteudo}"`),
      registrarWebhookSimulado: (info) => log.push(`(simulado) webhook pra ${info.url}.`),
    };

    const registro = executarFluxo(fluxo, primeiraAresta.target, contexto, ligacoes);
    setResultado({ registro, log });
  }

  return (
    <div className="flow-side-overlay" role="dialog" aria-label="Testar automação" onClick={onFechar}>
      <div className="flow-side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-h">
          <h4>Testar automação</h4>
          <button type="button" className="icon-btn subtle" aria-label="Fechar simulador" onClick={onFechar}>
            ✕
          </button>
        </div>
        <div className="flow-side-body">
          <p className="hint">
            Simulação local — não envia mensagem real, não move card de verdade e não grava nada no CRM. Gatilho:{" "}
            <strong>{noGatilho ? noGatilho.titulo || noGatilho.type : "nenhum"}</strong>
          </p>

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

          <button type="button" className="btn primary block mt14" onClick={rodar}>
            Rodar simulação
          </button>

          {erro ? <p className="flow-problema erro mt14">{erro}</p> : null}

          {resultado ? (
            <div className="mt14">
              <p className="n">
                Resultado: <strong>{LABEL_SITUACAO[resultado.registro.situacao]}</strong>
                {resultado.registro.erro ? ` — ${resultado.registro.erro}` : ""}
              </p>
              <ul className="flow-sim-passos">
                {resultado.registro.passos.map((passo, i) => (
                  <li key={`${passo.nodeId}-${i}`}>
                    <span aria-hidden="true">{ICONE_STATUS[passo.status]}</span>
                    <div>
                      <p className="n">{passo.label}</p>
                      {passo.detalhe ? <p className="r">{passo.detalhe}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
              {resultado.log.length > 0 ? (
                <>
                  <p className="n mt14">Log da simulação</p>
                  <ul className="flow-sim-log">
                    {resultado.log.map((linha, i) => (
                      <li key={i}>{linha}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
