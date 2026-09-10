"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { NovaAutomacao } from "@/components/automacoes/NovaAutomacao";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { useFunis } from "@/lib/funis-context";
import { MODELOS_COMERCIAIS } from "@/lib/automacoes/modelos-comerciais";
import { QUANDO_ROTULO } from "@/lib/funil/gatilhos-etapa-tipos";
import { IconAutomacoes, IconDoc, IconSparkle } from "@/components/icons";

/**
 * Como começar uma automação do funil.
 *
 * A mesma tela de três caminhos que o Instagram já tinha, e pela mesma razão: o canvas em branco
 * pede a decisão errada primeiro. Modelo na frente porque é um robô inteiro pronto pra ajustar,
 * "do zero" para quem já sabe o que quer, e a IA por último, desligada e escrita como o que ela é
 * hoje.
 *
 * O modelo cria DUAS coisas numa sequência que não pode inverter: o robô no banco e, depois, o
 * gatilho na etapa que aponta pra ele. Gatilho antes do robô ficaria pendurado apontando pra nada,
 * e a rota de gatilhos recusa um fluxo que ainda não existe.
 */
export default function NovaAutomacaoComercialPage() {
  const router = useRouter();
  const { recarregarFluxos } = useAutomationFlows();
  const { funis } = useFunis();

  const [caminho, setCaminho] = useState<"escolher" | "modelos" | "zero">("escolher");
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [funilId, setFunilId] = useState(funis[0]?.id ?? "");
  const [etapaId, setEtapaId] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const modelo = MODELOS_COMERCIAIS.find((m) => m.id === modeloId) ?? null;
  const funil = funis.find((f) => f.id === funilId) ?? funis[0];
  const etapas = funil?.colunas ?? [];

  async function criarDoModelo() {
    if (!modelo || !funil || !etapaId) return;
    setCriando(true);
    setErro(null);
    try {
      const { nodes, edges, configuracoes } = modelo.construir({
        funilId: funil.id,
        etapas: etapas.map((c) => ({ id: c.id, titulo: c.titulo })),
        etapaId,
      });

      const id = `fluxo-${Date.now()}`;
      const agora = new Date().toISOString();
      // Gravado com `await`, não pelo `criarFluxo` do contexto: ele grava em segundo plano, e o
      // gatilho logo abaixo precisa que o robô JÁ exista no banco pra poder apontar pra ele.
      const resposta = await fetch("/api/automacoes-fluxos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          nome: modelo.nome,
          descricao: modelo.descricao,
          area: "comercial",
          funilId: funil.id,
          etapaId,
          // Rascunho, sempre. Publicar sozinho ligaria uma automação que ninguém leu, falando com
          // cliente de verdade com texto de exemplo.
          status: "rascunho",
          ativa: false,
          nodes,
          edges,
          versaoAtual: 0,
          criadoEm: agora,
          atualizadoEm: agora,
          configuracoes,
          execucoes: 0,
          historicoVersoes: [],
        }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));

      if (modelo.quandoSugerido) {
        const gatilho = await fetch("/api/funis/gatilhos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            etapaId,
            quando: modelo.quandoSugerido,
            tipoAcao: "robo",
            fluxoId: id,
            ativo: true,
          }),
        });
        if (!gatilho.ok) throw new Error(String(gatilho.status));
      }

      await recarregarFluxos().catch(() => {});
      router.push(`/automacoes/editor/${id}`);
    } catch {
      setErro("Não deu pra criar a automação agora. Tente de novo.");
      setCriando(false);
    }
  }

  return (
    <>
      <Topbar title="Nova automação" sub="Funil comercial, pelo WhatsApp" />
      <AbasAutomacoes />

      <div className="content">
        <nav className="social-migalhas" aria-label="Onde você está">
          <button type="button" className="link" onClick={() => router.push("/automacoes")}>
            Automações
          </button>
          <span aria-hidden="true">›</span>
          <strong>Nova automação</strong>
        </nav>

        {caminho === "escolher" ? (
          <div className="social-caminhos">
            <button
              type="button"
              className="social-caminho destaque"
              onClick={() => setCaminho("modelos")}
            >
              <span className="social-caminho-selo">Mais rápido</span>
              <IconDoc width={26} height={26} aria-hidden="true" />
              <strong>Começar com um modelo AZUZ</strong>
              <span>
                Um robô inteiro já montado, com as mensagens, as esperas e as etiquetas ligadas.
                Você troca o texto e publica.
              </span>
            </button>

            <button type="button" className="social-caminho" onClick={() => setCaminho("zero")}>
              <IconAutomacoes width={26} height={26} aria-hidden="true" />
              <strong>Montar do zero</strong>
              <span>
                Você escolhe a etapa e o momento, e monta bloco a bloco num canvas em branco.
              </span>
            </button>

            <div className="social-caminho desativado" aria-disabled="true">
              <span className="social-caminho-selo em-breve">Em breve</span>
              <IconSparkle width={26} height={26} aria-hidden="true" />
              <strong>Descrever pra IA montar</strong>
              <span>
                Escrever o que você quer e receber a automação pronta. Ainda não está de pé, e por
                isso está desligado em vez de aberto e sem nada atrás.
              </span>
            </div>
          </div>
        ) : null}

        {caminho === "modelos" && !modelo ? (
          <section className="card">
            <div className="social-secao-topo">
              <h3>Escolha o modelo</h3>
              <button type="button" className="btn ghost" onClick={() => setCaminho("escolher")}>
                Voltar
              </button>
            </div>
            <p className="hint">
              Todos nascem como rascunho. Leia, troque o texto e publique quando estiver do seu
              jeito. Todos falam pelo WhatsApp.
            </p>
            <div className="social-modelos">
              {MODELOS_COMERCIAIS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="social-modelo"
                  onClick={() => {
                    setModeloId(m.id);
                    setEtapaId("");
                    setErro(null);
                  }}
                >
                  <strong>{m.nome}</strong>
                  <span>{m.descricao}</span>
                  <em>{m.ajustar}</em>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {caminho === "modelos" && modelo ? (
          <section className="card">
            <div className="social-secao-topo">
              <h3>{modelo.nome}</h3>
              <button type="button" className="btn ghost" onClick={() => setModeloId(null)}>
                Voltar
              </button>
            </div>
            <p className="hint">{modelo.descricao}</p>

            <div className="field">
              <label htmlFor="modelo-funil">Em qual funil</label>
              <select
                id="modelo-funil"
                className="input"
                value={funil?.id ?? ""}
                onChange={(e) => {
                  setFunilId(e.target.value);
                  setEtapaId("");
                }}
              >
                {funis.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="modelo-etapa">Em qual etapa ele começa</label>
              <select
                id="modelo-etapa"
                className="input"
                value={etapaId}
                onChange={(e) => setEtapaId(e.target.value)}
              >
                <option value="">Escolha a etapa</option>
                {etapas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
              {/* Sugestão, não regra: cada empresa nomeia as colunas do jeito dela, e o modelo
                  funciona em qualquer etapa. Dizer onde ele costuma viver poupa a dúvida sem
                  bloquear quem quer usar em outro lugar. */}
              <p className="hint mt8">Costuma viver em: {modelo.ondeCostumaViver}.</p>
            </div>

            <div className="nova-auto-resumo">
              <strong>{modelo.nome}</strong>
              <span>
                {modelo.quandoSugerido
                  ? QUANDO_ROTULO[modelo.quandoSugerido]
                  : "O gatilho vem dentro do fluxo, não da etapa: é uma varredura por tempo."}
              </span>
              <span>{modelo.ajustar}</span>
            </div>

            {erro ? (
              <p className="hint" style={{ color: "var(--danger)" }}>
                {erro}
              </p>
            ) : null}

            <div className="nova-auto-fim">
              <button
                type="button"
                className="btn primary"
                disabled={!etapaId || criando}
                onClick={() => void criarDoModelo()}
              >
                {criando ? "Criando…" : "Criar e abrir o robô"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setModeloId(null)}>
                Escolher outro modelo
              </button>
            </div>
          </section>
        ) : null}

        {caminho === "zero" ? (
          <NovaAutomacao
            funilSugerido={funil?.id}
            onCancelar={() => setCaminho("escolher")}
            onCriado={(fluxoId) => router.push(`/automacoes/editor/${fluxoId}`)}
          />
        ) : null}
      </div>
    </>
  );
}
