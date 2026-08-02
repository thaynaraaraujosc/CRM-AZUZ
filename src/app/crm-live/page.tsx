"use client";

import { useEffect, useState } from "react";

import { crmLive, motivosPerda } from "@/lib/data";

const CORES_DONUT = ["#2e6bff", "#8a3ffc", "#0f9d63", "#c9660a"];

function formatarReais(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export default function CrmLivePage() {
  const [tela, setTela] = useState<"finalizadas" | "andamento">("finalizadas");
  const [vendasPeriodo, setVendasPeriodo] = useState(
    crmLive.finalizadas.vendasPeriodo,
  );
  const [vendasValor, setVendasValor] = useState(crmLive.finalizadas.vendasValor);
  const [vendaSimulada, setVendaSimulada] = useState(false);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setTela((atual) => (atual === "finalizadas" ? "andamento" : "finalizadas"));
    }, 9000);
    return () => clearInterval(intervalo);
  }, []);

  function simularVenda() {
    setVendasPeriodo((v) => v + 1);
    setVendasValor((v) => v + 3800);
    setVendaSimulada(true);
    setTela("finalizadas");
    setTimeout(() => setVendaSimulada(false), 4000);
  }

  const top3Motivos = motivosPerda.slice(0, 3);
  const limites = top3Motivos.reduce<number[]>((acc, m) => {
    const anterior = acc.length > 0 ? acc[acc.length - 1] : 0;
    return [...acc, anterior + m.percentual];
  }, []);
  const fatias = top3Motivos.map((m, i) => {
    const inicio = i > 0 ? limites[i - 1] : 0;
    return `${CORES_DONUT[i]} ${inicio}% ${limites[i]}%`;
  });

  return (
    <div className="crm-live">
      {vendaSimulada ? (
        <div className="crm-live-flash">🎉 Nova venda registrada agora!</div>
      ) : null}

      <header className="crm-live-header">
        <div className="crm-live-tabs">
          <button
            type="button"
            className={`crm-live-tab${tela === "finalizadas" ? " active" : ""}`}
            onClick={() => setTela("finalizadas")}
          >
            Finalizadas
          </button>
          <button
            type="button"
            className={`crm-live-tab${tela === "andamento" ? " active" : ""}`}
            onClick={() => setTela("andamento")}
          >
            Em andamento
          </button>
        </div>
        <div className="crm-live-filtros">
          <span>Funil de vendas: Funil principal</span>
          <span>Período: Este mês</span>
          <span>Responsável: Toda a empresa</span>
        </div>
      </header>

      {tela === "finalizadas" ? (
        <div className="crm-live-body">
          <div className="crm-live-vencedores">
            <div className="crm-live-vencedor-card">
              <span className="crm-live-trofeu">🏆</span>
              <p className="crm-live-vencedor-titulo">Quem mais criou oportunidades</p>
              <p className="crm-live-vencedor-nome">
                {crmLive.vencedores.maisOportunidades.nome}
              </p>
              <p className="crm-live-vencedor-valor">
                {crmLive.vencedores.maisOportunidades.valor}
              </p>
            </div>
            <div className="crm-live-vencedor-card">
              <span className="crm-live-trofeu">🏆</span>
              <p className="crm-live-vencedor-titulo">Quem mais vendeu (un)</p>
              <p className="crm-live-vencedor-nome">
                {crmLive.vencedores.maisVendasUnidade.nome}
              </p>
              <p className="crm-live-vencedor-valor">
                {crmLive.vencedores.maisVendasUnidade.valor}
              </p>
            </div>
            <div className="crm-live-vencedor-card">
              <span className="crm-live-trofeu">🏆</span>
              <p className="crm-live-vencedor-titulo">Quem mais vendeu (R$)</p>
              <p className="crm-live-vencedor-nome">
                {crmLive.vencedores.maisVendasValor.nome}
              </p>
              <p className="crm-live-vencedor-valor">
                {crmLive.vencedores.maisVendasValor.valor}
              </p>
            </div>
          </div>

          <div className="crm-live-kpis">
            <div className="crm-live-kpi">
              <p className="crm-live-kpi-l">Oportunidades novas</p>
              <p className="crm-live-kpi-n">{crmLive.finalizadas.oportunidadesNovas}</p>
              <p className="crm-live-kpi-sub">
                Período anterior: {crmLive.finalizadas.oportunidadesNovasAnterior}
              </p>
            </div>
            <div className="crm-live-kpi crm-live-kpi-destaque">
              <p className="crm-live-kpi-l">Vendas no período (un)</p>
              <p className="crm-live-kpi-n">{vendasPeriodo}</p>
              <p className="crm-live-kpi-sub">
                Período anterior: {crmLive.finalizadas.vendasPeriodoAnterior}
              </p>
            </div>
            <div className="crm-live-kpi crm-live-kpi-destaque">
              <p className="crm-live-kpi-l">Vendas no período (R$)</p>
              <p className="crm-live-kpi-n">{formatarReais(vendasValor)}</p>
              <p className="crm-live-kpi-sub">
                Período anterior: {formatarReais(crmLive.finalizadas.vendasValorAnterior)}
              </p>
            </div>
            <div className="crm-live-kpi">
              <p className="crm-live-kpi-l">Conversão do período</p>
              <p className="crm-live-kpi-n">{crmLive.finalizadas.conversao}</p>
              <p className="crm-live-kpi-sub">Criadas no período / vendas no período</p>
            </div>
            <div className="crm-live-kpi">
              <p className="crm-live-kpi-l">Oportunidades perdidas</p>
              <p className="crm-live-kpi-n">{crmLive.finalizadas.perdidas}</p>
              <p className="crm-live-kpi-sub">
                Período anterior: {crmLive.finalizadas.perdidasAnterior}
              </p>
            </div>
          </div>

          <div className="crm-live-motivos">
            <p className="crm-live-motivos-titulo">Top 3 motivos de perda</p>
            <div className="crm-live-motivos-body">
              <div
                className="crm-live-donut"
                style={{ background: `conic-gradient(${fatias.join(", ")})` }}
              />
              <div className="crm-live-motivos-legenda">
                {top3Motivos.map((m, i) => (
                  <div className="crm-live-motivo-item" key={m.motivo}>
                    <span
                      className="crm-live-motivo-dot"
                      style={{ background: CORES_DONUT[i] }}
                    />
                    <span>
                      {m.motivo} · {m.percentual}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="crm-live-body">
          <div className="crm-live-andamento-topo">
            <div className="crm-live-kpi">
              <p className="crm-live-kpi-l">Oportunidades em andamento</p>
              <p className="crm-live-kpi-n crm-live-kpi-gigante">
                {crmLive.andamento.oportunidadesEmAndamento}
              </p>
            </div>
            <div className="crm-live-kpi">
              <p className="crm-live-kpi-l">Valores em andamento</p>
              <p className="crm-live-kpi-n">{crmLive.andamento.valoresEmAndamento}</p>
              <p className="crm-live-kpi-sub">Faturamento potencial da operação</p>
            </div>
            <div className="crm-live-feed">
              <p className="crm-live-feed-titulo">Feed de tarefas</p>
              {crmLive.feedTarefas.map((t, i) => (
                <div className="crm-live-feed-item" key={i}>
                  <span className="crm-live-feed-texto">
                    <b>{t.titulo}</b> · {t.pessoa}
                  </span>
                  <span className="crm-live-feed-quando">{t.quando}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="crm-live-etapas">
            {crmLive.andamento.etapas.map((e) => (
              <div className="crm-live-etapa" key={e.nome}>
                <p className="crm-live-etapa-n">{e.quantidade}</p>
                <p className="crm-live-etapa-nome">{e.nome}</p>
                <p className="crm-live-etapa-valor">{e.valor}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="crm-live-simular"
        onClick={simularVenda}
        title="Simular uma venda nova (só pra ver ao vivo)"
      >
        + Simular venda
      </button>

      <div className="crm-live-dots">
        <span className={tela === "finalizadas" ? "active" : ""} />
        <span className={tela === "andamento" ? "active" : ""} />
      </div>
    </div>
  );
}
