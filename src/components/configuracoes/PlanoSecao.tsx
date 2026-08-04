"use client";

import { useState } from "react";

import { planoAtual } from "@/lib/data";
import { useEquipe } from "@/lib/equipe-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

const PLANOS_COMPARACAO = [
  { nome: "Essencial", valor: "R$ 99", recursos: ["1 funil", "WhatsApp", "Até 3 usuários"] },
  { nome: "Completo", valor: "R$ 249", recursos: ["Funis ilimitados", "WhatsApp/Instagram/TikTok", "Automações", "Azuz IA", "Até 10 usuários"], atual: true },
  { nome: "Escala", valor: "R$ 449", recursos: ["Tudo do Completo", "Usuários ilimitados", "Prioridade no suporte", "Auditoria avançada"] },
];

const HISTORICO_MOCK = [
  { data: "01/07/2026", valor: "R$ 249,00", status: "Pago" },
  { data: "01/06/2026", valor: "R$ 249,00", status: "Pago" },
  { data: "01/05/2026", valor: "R$ 249,00", status: "Pago" },
];

/** Plano e cobrança (item 40) — migra a lógica de cartão/cancelamento que já existia na tela antiga
 * de Configurações (preservada), acrescenta comparação de planos e histórico de cobrança mockados. */
export function PlanoSecao() {
  const { membros: equipe } = useEquipe();
  const [numeroCartao, setNumeroCartao] = useState("");
  const [nomeCartao, setNomeCartao] = useState("");
  const [validadeCartao, setValidadeCartao] = useState("");
  const [cvvCartao, setCvvCartao] = useState("");
  const [cartaoSalvo, setCartaoSalvo] = useState(false);
  const [editandoCartao, setEditandoCartao] = useState(false);
  const [planoCancelado, setPlanoCancelado] = useState(false);

  const ultimosDigitos = numeroCartao.replace(/\D/g, "").slice(-4);

  function cancelarPlano() {
    if (window.confirm("Cancelar o plano? Você deixa de ser cobrado, mas perde acesso a partir do fim do período já pago.")) {
      setPlanoCancelado(true);
    }
  }

  function excluirCartao() {
    if (window.confirm("Excluir esse cartão? Você vai precisar cadastrar outro pra continuar sendo cobrado.")) {
      setNumeroCartao("");
      setNomeCartao("");
      setValidadeCartao("");
      setCvvCartao("");
      setCartaoSalvo(false);
      setEditandoCartao(false);
    }
  }

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Plano e cobrança" descricao="Seu plano atual, uso e forma de pagamento." />

      <div className="plano-card">
        <div>
          <p className="plano-nome">
            {planoAtual.nome}
            {planoCancelado ? <span className="plano-cancelado-pill">Cancelado</span> : null}
          </p>
          <p className="plano-desc">{planoCancelado ? "Sem novas cobranças — acesso até o fim do período já pago." : planoAtual.descricao}</p>
        </div>
        <p className="plano-valor">
          {planoAtual.valor}
          <span>/{planoAtual.periodo.replace("por ", "")}</span>
        </p>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Uso</p>
        <div className="config-grid-2">
          <div className="field">
            <label>Usuários</label>
            <p className="r">{equipe.length} de 10 incluídos</p>
          </div>
          <div className="field">
            <label>Recursos</label>
            <p className="r">Funis, WhatsApp/Instagram/TikTok, Automações, Azuz IA, Relatórios</p>
          </div>
          <div className="field">
            <label>Próxima cobrança</label>
            <p className="r">01/08/2026 · {planoAtual.valor}</p>
          </div>
          <div className="field">
            <label>Ciclo</label>
            <p className="r">Mensal</p>
          </div>
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Comparar planos</p>
        <div className="config-canais-grid">
          {PLANOS_COMPARACAO.map((p) => (
            <div className="config-canal-card" key={p.nome}>
              <div className="config-canal-card-h">
                <span className="n">{p.nome}</span>
                {p.atual ? <span className="pill on">Atual</span> : null}
              </div>
              <p className="plano-valor" style={{ fontSize: 20 }}>
                {p.valor}
                <span style={{ fontSize: 11 }}>/mês</span>
              </p>
              <ul style={{ margin: "6px 0 10px", paddingLeft: 18, fontSize: 11.5, color: "var(--text-muted)" }}>
                {p.recursos.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {!p.atual ? (
                <button type="button" className="btn ghost">
                  Alterar plano
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="panel-h divided">
        <h4>Forma de pagamento</h4>
      </div>
      {cartaoSalvo && !editandoCartao ? (
        <>
          <div className="cartao-salvo-card">
            <div>
              <p className="cartao-salvo-numero">•••• •••• •••• {ultimosDigitos || "0000"}</p>
              <p className="cartao-salvo-detalhe">
                {nomeCartao || "Nome não informado"} · validade {validadeCartao || "—"}
              </p>
            </div>
          </div>
          <div className="section-foot">
            <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setEditandoCartao(true)}>
              Trocar cartão
            </button>
            <button type="button" className="btn danger" style={{ flex: 1 }} onClick={excluirCartao}>
              Excluir cartão
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label>Número do cartão</label>
            <input className="input" style={{ width: "100%" }} inputMode="numeric" placeholder="0000 0000 0000 0000" value={numeroCartao} onChange={(e) => setNumeroCartao(e.target.value)} />
          </div>
          <div className="field">
            <label>Nome impresso no cartão</label>
            <input className="input" style={{ width: "100%" }} placeholder="Ex.: ANA P FERREIRA" value={nomeCartao} onChange={(e) => setNomeCartao(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 14, padding: "0 17px 14px" }}>
            <div className="field" style={{ padding: 0, flex: 1 }}>
              <label>Validade</label>
              <input className="input" style={{ width: "100%" }} placeholder="MM/AA" value={validadeCartao} onChange={(e) => setValidadeCartao(e.target.value)} />
            </div>
            <div className="field" style={{ padding: 0, flex: 1 }}>
              <label>CVV</label>
              <input className="input" style={{ width: "100%" }} inputMode="numeric" placeholder="123" value={cvvCartao} onChange={(e) => setCvvCartao(e.target.value)} />
            </div>
          </div>
          <div className="section-foot">
            {cartaoSalvo ? (
              <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setEditandoCartao(false)}>
                Cancelar
              </button>
            ) : null}
            <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => { setCartaoSalvo(true); setEditandoCartao(false); }}>
              Salvar forma de pagamento
            </button>
          </div>
        </>
      )}

      <div className="config-bloco">
        <p className="config-bloco-titulo">Histórico e notas fiscais</p>
        <div className="config-tabela-scroll">
          <table className="config-tabela-notif">
            <thead>
              <tr>
                <th>Data</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Nota fiscal</th>
              </tr>
            </thead>
            <tbody>
              {HISTORICO_MOCK.map((h) => (
                <tr key={h.data}>
                  <td>{h.data}</td>
                  <td>{h.valor}</td>
                  <td>{h.status}</td>
                  <td>
                    <button type="button" className="btn ghost">
                      Baixar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-foot" style={{ paddingTop: 0 }}>
        {planoCancelado ? (
          <button type="button" className="btn ghost block" onClick={() => setPlanoCancelado(false)}>
            Reativar assinatura
          </button>
        ) : (
          <button type="button" className="btn danger block" onClick={cancelarPlano}>
            Cancelar assinatura
          </button>
        )}
      </div>
    </div>
  );
}
