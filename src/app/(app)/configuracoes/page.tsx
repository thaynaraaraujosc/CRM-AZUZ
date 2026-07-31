"use client";

import { useState, type ReactNode } from "react";

import { apiKey, integracoes, planoAtual, webhooks } from "@/lib/data";
import {
  IconCalendar,
  IconInstagram,
  IconWhatsApp,
} from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Topbar } from "@/components/ui";

const logos: Record<string, ReactNode> = {
  wa: <IconWhatsApp width={20} height={20} />,
  ig: <IconInstagram width={20} height={20} />,
  cal: <IconCalendar width={19} height={19} style={{ color: "var(--blue)" }} />,
};

type Secao = "tela" | "planos" | "integracoes";

const MENU_CONFIG: { id: Secao; label: string }[] = [
  { id: "tela", label: "Tela" },
  { id: "planos", label: "Planos e pagamentos" },
  { id: "integracoes", label: "Conexões, integrações e aplicativos" },
];

export default function ConfiguracoesPage() {
  const [secaoAtiva, setSecaoAtiva] = useState<Secao | null>(null);
  const [numeroCartao, setNumeroCartao] = useState("");
  const [nomeCartao, setNomeCartao] = useState("");
  const [validadeCartao, setValidadeCartao] = useState("");
  const [cvvCartao, setCvvCartao] = useState("");
  const [cartaoSalvo, setCartaoSalvo] = useState(false);
  const [planoCancelado, setPlanoCancelado] = useState(false);

  function salvarCartao() {
    setCartaoSalvo(true);
  }

  function cancelarPlano() {
    if (
      window.confirm(
        "Cancelar o plano? Você deixa de ser cobrado, mas perde acesso a partir do fim do período já pago.",
      )
    ) {
      setPlanoCancelado(true);
    }
  }

  return (
    <>
      <Topbar
        title="Configurações"
        sub="Escolha ao lado o que você quer ver ou ajustar"
      />

      <div className="content">
        <div className="settings-layout">
          <div className="settings-menu">
            {MENU_CONFIG.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`settings-menu-btn${
                  secaoAtiva === item.id ? " active" : ""
                }`}
                aria-pressed={secaoAtiva === item.id}
                onClick={() =>
                  setSecaoAtiva((atual) => (atual === item.id ? null : item.id))
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <div>
            {secaoAtiva === null ? (
              <div className="card" style={{ padding: 26, textAlign: "center" }}>
                <p className="hint">
                  Escolha uma opção ao lado pra ver os detalhes.
                </p>
              </div>
            ) : null}

            {secaoAtiva === "tela" ? (
              <div className="card" style={{ padding: 20 }}>
                <div
                  className="panel-h"
                  style={{ padding: 0, marginBottom: 14, border: 0 }}
                >
                  <h4>Tela clara ou escura</h4>
                </div>
                <p className="hint mb14">
                  Escolha como o CRM aparece pra você — fica salvo só nesse
                  navegador.
                </p>
                <ThemeToggle />
              </div>
            ) : null}

            {secaoAtiva === "planos" ? (
              <section className="open-conv">
                <div className="open-conv-h">
                  <div>
                    <p className="n">Planos e pagamentos</p>
                    <p className="s">Seu plano atual e a forma de cobrança</p>
                  </div>
                </div>

                <div className="plano-card">
                  <div>
                    <p className="plano-nome">
                      {planoAtual.nome}
                      {planoCancelado ? (
                        <span className="plano-cancelado-pill">Cancelado</span>
                      ) : null}
                    </p>
                    <p className="plano-desc">
                      {planoCancelado
                        ? "Sem novas cobranças — você continua com acesso até o fim do período já pago."
                        : planoAtual.descricao}
                    </p>
                  </div>
                  <p className="plano-valor">
                    {planoAtual.valor}
                    <span>/{planoAtual.periodo.replace("por ", "")}</span>
                  </p>
                </div>

                <div className="section-foot" style={{ paddingTop: 0 }}>
                  {planoCancelado ? (
                    <button
                      type="button"
                      className="btn ghost block"
                      onClick={() => setPlanoCancelado(false)}
                    >
                      Reativar assinatura
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost block"
                      style={{ color: "#d64545" }}
                      onClick={cancelarPlano}
                    >
                      Cancelar assinatura
                    </button>
                  )}
                </div>

                <div className="panel-h divided">
                  <h4>Forma de pagamento</h4>
                </div>
                <p className="hint" style={{ padding: "0 17px" }}>
                  Por enquanto só aceitamos cartão de crédito.
                </p>

                <div className="field">
                  <label>Número do cartão</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    inputMode="numeric"
                    placeholder="0000 0000 0000 0000"
                    value={numeroCartao}
                    onChange={(e) => setNumeroCartao(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Nome impresso no cartão</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    placeholder="Ex.: ANA P FERREIRA"
                    value={nomeCartao}
                    onChange={(e) => setNomeCartao(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", gap: 14, padding: "0 17px 14px" }}>
                  <div className="field" style={{ padding: 0, flex: 1 }}>
                    <label>Validade</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      type="text"
                      placeholder="MM/AA"
                      value={validadeCartao}
                      onChange={(e) => setValidadeCartao(e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ padding: 0, flex: 1 }}>
                    <label>CVV</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      type="text"
                      inputMode="numeric"
                      placeholder="123"
                      value={cvvCartao}
                      onChange={(e) => setCvvCartao(e.target.value)}
                    />
                  </div>
                </div>

                <div className="section-foot">
                  <button
                    type="button"
                    className="btn primary block"
                    onClick={salvarCartao}
                  >
                    Salvar forma de pagamento
                  </button>
                </div>
                {cartaoSalvo ? (
                  <p
                    className="hint"
                    style={{ padding: "0 17px 14px", color: "var(--blue)" }}
                  >
                    Cartão salvo — cobranças de {planoAtual.valor}{" "}
                    {planoAtual.periodo}.
                  </p>
                ) : null}
              </section>
            ) : null}

            {secaoAtiva === "integracoes" ? (
              <>
                {integracoes.map((grupo) => (
                  <div className="int-group" key={grupo.grupo}>
                    <p className="int-group-h">{grupo.grupo}</p>
                    <div className="card">
                      {grupo.itens.map((item) => (
                        <div className="int-row" key={item.titulo}>
                          <div
                            className="int-logo"
                            style={"cor" in item ? { color: item.cor } : undefined}
                          >
                            {logos[item.logo] ?? item.logo}
                          </div>
                          <div className="int-body">
                            <p className="int-title">{item.titulo}</p>
                            <p className="int-sub">{item.sub}</p>
                          </div>
                          <span
                            className={`int-status ${
                              item.status === "Conectado" ? "connected" : "off"
                            }`}
                          >
                            {item.status}
                          </span>
                          <button
                            type="button"
                            className={`btn ${
                              item.acao === "Conectar" ? "primary" : "ghost"
                            }`}
                          >
                            {item.acao}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="int-group">
                  <p className="int-group-h">
                    API e webhooks — pra conectar qualquer outro sistema seu
                  </p>
                  <div className="card">
                    <div className="key-row">
                      <div className="key-box">{apiKey}</div>
                      <button type="button" className="btn ghost">
                        Copiar
                      </button>
                      <button type="button" className="btn ghost">
                        Gerar nova chave
                      </button>
                    </div>
                    {webhooks.map((hook) => (
                      <div className="int-row" key={hook.titulo}>
                        <div className="int-body">
                          <p className="int-title">{hook.titulo}</p>
                          <p className="int-sub">{hook.sub}</p>
                        </div>
                        <span
                          className={`int-status ${
                            hook.status === "Ativo" ? "connected" : "off"
                          }`}
                        >
                          {hook.status}
                        </span>
                        {hook.acao ? (
                          <button type="button" className="btn ghost">
                            {hook.acao}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
