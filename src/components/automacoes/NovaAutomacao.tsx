"use client";

import { useState } from "react";

import { IconClose } from "@/components/icons";
import { useFunis } from "@/lib/funis-context";
import {
  CATEGORIAS_GATILHO,
  QUANDO_ROTULO,
  type QuandoGatilho,
} from "@/lib/funil/gatilhos-etapa-tipos";

/**
 * "Nova automação" em passos, em vez de cair direto num canvas vazio.
 *
 * O canvas vazio pede a decisão errada primeiro: a pessoa chega sabendo QUANDO a automação deve
 * acontecer ("quando o lead cair em Follow-up") e é recebida por uma tela em branco pedindo blocos.
 * Aqui a ordem é a da cabeça dela: nome, onde, quando, e só então o que.
 *
 * O robô nasce SEM bloco de gatilho: quem dispara é a etapa. É o mesmo registro que a grade do
 * funil executa e que a biblioteca lista, criado por um caminho só.
 */

type Passo = "nome" | "onde" | "quando";

export function NovaAutomacao({
  funilSugerido,
  etapaSugerida,
  onCancelar,
  onCriado,
}: {
  /** Quando a pessoa veio de uma etapa do funil, ela já está escolhida. */
  funilSugerido?: string;
  etapaSugerida?: string;
  onCancelar: () => void;
  /** Recebe o id do robô criado, pra quem chamou abrir o editor. */
  onCriado: (fluxoId: string) => void;
}) {
  const { funis } = useFunis();

  const [passo, setPasso] = useState<Passo>("nome");
  const [nome, setNome] = useState("");
  /** `true` = robô solto, sem gatilho. Vinculado a uma etapa depois, ou chamado por outro robô. */
  const [semGatilho, setSemGatilho] = useState(false);
  const [funilId, setFunilId] = useState(funilSugerido ?? "");
  const [etapaId, setEtapaId] = useState(etapaSugerida ?? "");
  const [quando, setQuando] = useState<QuandoGatilho>("movido");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const funil = funis.find((f) => f.id === funilId);
  const etapa = funil?.colunas.find((c) => c.id === etapaId);

  /** O nome sugerido conta o que a automação faz, que é melhor do que "Nova automação". */
  const nomeFinal = nome.trim() || (etapa ? `Quando entrar em "${etapa.titulo}"` : "Novo robô");

  async function criar() {
    setSalvando(true);
    setErro(null);
    try {
      const respostaRobo = await fetch("/api/funis/gatilhos/robo-novo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeFinal }),
      });
      if (!respostaRobo.ok) throw new Error(String(respostaRobo.status));
      const robo = (await respostaRobo.json()) as { id: string };

      // O gatilho é criado DEPOIS do robô e só quando ela escolheu um: um gatilho apontando pra um
      // robô que falhou ao ser criado ficaria pendurado na etapa sem nada pra executar.
      if (!semGatilho && etapaId) {
        const respostaGatilho = await fetch("/api/funis/gatilhos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etapaId, quando, tipoAcao: "robo", fluxoId: robo.id, ativo: true }),
        });
        if (!respostaGatilho.ok) throw new Error(String(respostaGatilho.status));
      }

      onCriado(robo.id);
    } catch {
      setErro("Não deu pra criar a automação agora. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="nova-auto-fundo" role="dialog" aria-modal="true" aria-label="Nova automação">
      <div className="nova-auto">
        <div className="nova-auto-topo">
          <strong>Nova automação</strong>
          <button type="button" className="icon-btn subtle" aria-label="Fechar" onClick={onCancelar}>
            <IconClose width={13} height={13} />
          </button>
        </div>

        <ol className="nova-auto-passos">
          <li className={passo === "nome" ? "on" : ""}>1. Nome</li>
          <li className={passo === "onde" ? "on" : ""}>2. Onde</li>
          <li className={passo === "quando" ? "on" : ""}>3. Quando</li>
        </ol>

        {passo === "nome" ? (
          <>
            <div className="field">
              <label>Como você vai chamar essa automação</label>
              <input
                className="input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={etapa ? `Quando entrar em "${etapa.titulo}"` : "Primeiro atendimento"}
                autoFocus
              />
              <p className="hint mt8">
                Esse é o nome que aparece na lista e no gatilho da etapa. Dá pra trocar depois.
              </p>
            </div>
            <div className="nova-auto-fim">
              <button type="button" className="btn primary" onClick={() => setPasso("onde")}>
                Continuar
              </button>
              <button type="button" className="btn ghost" onClick={onCancelar}>
                Cancelar
              </button>
            </div>
          </>
        ) : null}

        {passo === "onde" ? (
          <>
            <div className="field">
              <label>O que dispara essa automação</label>
              <div className="nova-auto-escolhas">
                <button
                  type="button"
                  className={`nova-auto-escolha${semGatilho ? "" : " on"}`}
                  onClick={() => setSemGatilho(false)}
                >
                  <strong>Uma etapa do funil</strong>
                  <span>O lead entra na etapa e a automação começa. É o caso mais comum.</span>
                </button>
                <button
                  type="button"
                  className={`nova-auto-escolha${semGatilho ? " on" : ""}`}
                  onClick={() => setSemGatilho(true)}
                >
                  <strong>Nada por enquanto</strong>
                  <span>
                    Um robô solto, pra ligar numa etapa depois ou ser chamado por outro robô.
                  </span>
                </button>
              </div>
            </div>

            {!semGatilho ? (
              <>
                <div className="field">
                  <label>Funil</label>
                  <select
                    className="input"
                    value={funilId}
                    onChange={(e) => {
                      setFunilId(e.target.value);
                      setEtapaId("");
                    }}
                  >
                    <option value="">Escolha o funil</option>
                    {funis.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Etapa</label>
                  <select
                    className="input"
                    value={etapaId}
                    onChange={(e) => setEtapaId(e.target.value)}
                    disabled={!funil}
                  >
                    <option value="">{funil ? "Escolha a etapa" : "Escolha o funil primeiro"}</option>
                    {(funil?.colunas ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.titulo}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            <div className="nova-auto-fim">
              <button
                type="button"
                className="btn primary"
                disabled={!semGatilho && !etapaId}
                onClick={() => (semGatilho ? criar() : setPasso("quando"))}
              >
                {semGatilho ? "Criar robô" : "Continuar"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setPasso("nome")}>
                Voltar
              </button>
            </div>
          </>
        ) : null}

        {passo === "quando" ? (
          <>
            <div className="field">
              <label>Quando ela deve acontecer</label>
              <select
                className="input"
                value={quando}
                onChange={(e) => setQuando(e.target.value as QuandoGatilho)}
              >
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
              <p className="hint mt8">
                Vai valer sempre. Dias da semana, horário e condição você ajusta depois, na aba
                Automatizar funil.
              </p>
            </div>

            <div className="nova-auto-resumo">
              <strong>{nomeFinal}</strong>
              <span>
                Em <b>{funil?.nome}</b> · etapa <b>{etapa?.titulo}</b>
              </span>
              <span>{QUANDO_ROTULO[quando]}</span>
            </div>

            {erro ? <p className="hint" style={{ color: "var(--danger)" }}>{erro}</p> : null}

            <div className="nova-auto-fim">
              <button type="button" className="btn primary" onClick={criar} disabled={salvando}>
                {salvando ? "Criando…" : "Criar e montar o robô"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setPasso("onde")}>
                Voltar
              </button>
            </div>
          </>
        ) : null}

        {erro && passo !== "quando" ? (
          <p className="hint" style={{ color: "var(--danger)" }}>{erro}</p>
        ) : null}
      </div>
    </div>
  );
}
