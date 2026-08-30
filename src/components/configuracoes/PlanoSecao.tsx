"use client";

import { useEffect, useState } from "react";

import { useEquipe } from "@/lib/equipe-context";
import { PLANOS, type PlanoId } from "@/lib/assinatura/planos";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

type Assinatura = {
  plano: string;
  status: "pendente" | "ativa" | "atrasada" | "cancelada";
  valor: string; // Decimal do Prisma serializa como string em JSON
  formaPagamento: string | null;
  proximoVencimento: string | null;
};

type Cobranca = {
  id: string;
  value: number;
  status: string;
  dueDate: string;
  paymentDate: string | null;
  invoiceUrl: string;
};

type FormaPagamento = "CREDIT_CARD" | "PIX" | "BOLETO";

type Armazenamento = {
  configurado: boolean;
  usadoBytes: number;
  limiteBytes: number;
  percentual: number;
};

const NOME_STATUS: Record<string, string> = {
  pendente: "Pagamento pendente",
  ativa: "Ativo",
  atrasada: "Pagamento atrasado",
  cancelada: "Cancelado",
};

const NOME_STATUS_COBRANCA: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  RECEIVED: "Pago",
  CONFIRMED: "Pago",
  RECEIVED_IN_CASH: "Pago",
  OVERDUE: "Vencido",
  REFUNDED: "Estornado",
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Tamanho em unidade legível — ninguém entende "3.221.225.472 bytes". */
function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Plano e cobrança — assinatura real do CRM via Asaas (não mais mockada). `GET /api/assinatura`
 * traz o estado salvo + histórico de cobranças ao vivo; assinar/trocar de plano e cancelar chamam
 * as rotas que falam com a Asaas de verdade (sandbox por padrão, ver ASAAS_ENV). */
export function PlanoSecao() {
  const { membros: equipe } = useEquipe();

  const [carregando, setCarregando] = useState(true);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [armazenamento, setArmazenamento] = useState<Armazenamento | null>(null);

  const [planoEmEdicao, setPlanoEmEdicao] = useState<PlanoId | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("CREDIT_CARD");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [numeroCartao, setNumeroCartao] = useState("");
  const [nomeCartao, setNomeCartao] = useState("");
  const [validadeMes, setValidadeMes] = useState("");
  const [validadeAno, setValidadeAno] = useState("");
  const [cvv, setCvv] = useState("");
  const [cep, setCep] = useState("");
  const [numeroEndereco, setNumeroEndereco] = useState("");
  const [telefone, setTelefone] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  async function recarregarAposAcao() {
    setCarregando(true);
    try {
      const resposta = await fetch("/api/assinatura");
      const dados = await resposta.json();
      setAssinatura(dados.assinatura);
      setCobrancas(dados.cobrancas ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    fetch("/api/assinatura")
      .then((r) => r.json())
      .then((dados) => {
        setAssinatura(dados.assinatura);
        setCobrancas(dados.cobrancas ?? []);
      })
      .catch((erro) => console.error("Falha ao carregar assinatura:", erro))
      .finally(() => setCarregando(false));

    // Busca separada da assinatura de propósito: se o armazenamento falhar, o bloco some e o resto
    // da tela de cobrança continua funcionando.
    fetch("/api/armazenamento")
      .then((r) => r.json())
      .then(setArmazenamento)
      .catch((erro) => console.error("Falha ao carregar armazenamento:", erro));
  }, []);

  async function assinarPlano(e: React.FormEvent) {
    e.preventDefault();
    if (!planoEmEdicao) return;
    setEnviando(true);
    setErroEnvio(null);

    try {
      const resposta = await fetch("/api/assinatura", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plano: planoEmEdicao,
          formaPagamento,
          cpfCnpj,
          cartao:
            formaPagamento === "CREDIT_CARD"
              ? {
                  numero: numeroCartao.replace(/\s/g, ""),
                  nomeImpresso: nomeCartao,
                  validadeMes,
                  validadeAno,
                  cvv,
                  titular: { cep: cep.replace(/\D/g, ""), numeroEndereco, telefone: telefone.replace(/\D/g, "") },
                }
              : undefined,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErroEnvio(dados.erro ?? "Não foi possível processar o pagamento.");
        return;
      }
      setPlanoEmEdicao(null);
      await recarregarAposAcao();
    } catch {
      setErroEnvio("Falha de conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function cancelarPlano() {
    if (!window.confirm("Cancelar o plano? Você deixa de ser cobrado, mas perde acesso a partir do fim do período já pago.")) return;
    const resposta = await fetch("/api/assinatura/cancelar", { method: "POST" });
    if (resposta.ok) await recarregarAposAcao();
  }

  if (carregando) {
    return (
      <div className="config-secao">
        <CabecalhoCategoria titulo="Plano e cobrança" descricao="Seu plano atual, uso e forma de pagamento." />
        <p className="config-bloco-titulo">Carregando…</p>
      </div>
    );
  }

  const planoAtualId = (assinatura?.plano as PlanoId | undefined) ?? null;
  const infoPlanoAtual = planoAtualId ? PLANOS[planoAtualId] : null;

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Plano e cobrança" descricao="Seu plano atual, uso e forma de pagamento." />

      <div className="plano-card">
        <div>
          <p className="plano-nome">
            {infoPlanoAtual?.nome ?? "Sem plano ativo"}
            {assinatura ? <span className="plano-cancelado-pill">{NOME_STATUS[assinatura.status]}</span> : null}
          </p>
          <p className="plano-desc">
            {assinatura?.status === "cancelada"
              ? "Sem novas cobranças — acesso até o fim do período já pago."
              : assinatura?.status === "atrasada"
                ? "Última cobrança não foi paga — regularize pra manter o acesso."
                : "Cobrança mensal via Asaas."}
          </p>
        </div>
        {infoPlanoAtual ? (
          <p className="plano-valor">
            {formatarMoeda(infoPlanoAtual.valor)}
            <span>/mês</span>
          </p>
        ) : null}
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
            <p className="r">
              Funis, WhatsApp/Instagram/TikTok, Automações, Azuz IA{" "}
              <span className="nav-badge-em-breve" style={{ marginLeft: 0 }}>Em breve</span>, Relatórios
            </p>
          </div>
          <div className="field">
            <label>Próxima cobrança</label>
            <p className="r">
              {formatarData(assinatura?.proximoVencimento ?? null)}
              {infoPlanoAtual ? ` · ${formatarMoeda(infoPlanoAtual.valor)}` : ""}
            </p>
          </div>
          <div className="field">
            <label>Ciclo</label>
            <p className="r">Mensal</p>
          </div>
        </div>

        {armazenamento?.configurado ? (
          <div className="field" style={{ marginTop: 16 }}>
            <label>Armazenamento de arquivos</label>
            <div className="armazenamento-barra">
              <div
                className={`armazenamento-barra-preenchida${armazenamento.percentual >= 80 ? " cheia" : ""}`}
                style={{ width: `${Math.max(armazenamento.percentual, 1)}%` }}
              />
            </div>
            <p className="r">
              {formatarTamanho(armazenamento.usadoBytes)} de {formatarTamanho(armazenamento.limiteBytes)} usados
              {armazenamento.percentual >= 80 ? (
                <span className="armazenamento-aviso">
                  {" "}
                  · Perto do limite. Ao encher, novos anexos param de ser salvos — as mensagens de texto continuam
                  normalmente.
                </span>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Plano</p>
        <div className="config-canais-grid">
          <div className="config-canal-card">
            <div className="config-canal-card-h">
              <span className="n">{PLANOS.completo.nome}</span>
              {assinatura?.status === "ativa" ? <span className="pill on">Atual</span> : null}
            </div>
            <p className="plano-valor" style={{ fontSize: 20 }}>
              {formatarMoeda(PLANOS.completo.valor)}
              <span style={{ fontSize: 11 }}>/mês</span>
            </p>
            <ul style={{ margin: "6px 0 10px", paddingLeft: 18, fontSize: 11.5, color: "var(--text-muted)" }}>
              {PLANOS.completo.recursos.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <button type="button" className="btn ghost" onClick={() => { setPlanoEmEdicao("completo"); setErroEnvio(null); }}>
              {assinatura?.status === "ativa" ? "Atualizar forma de pagamento" : "Assinar agora"}
            </button>
          </div>
        </div>
      </div>

      {planoEmEdicao ? (
        <form onSubmit={assinarPlano}>
          <div className="panel-h divided">
            <h4>Pagamento — plano {PLANOS[planoEmEdicao].nome}</h4>
          </div>

          <div className="field">
            <label>Forma de pagamento</label>
            <select className="input" style={{ width: "100%" }} value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}>
              <option value="CREDIT_CARD">Cartão de crédito</option>
              <option value="PIX">PIX</option>
              <option value="BOLETO">Boleto</option>
            </select>
          </div>

          <div className="field">
            <label>CPF/CNPJ do responsável pela cobrança</label>
            <input className="input" style={{ width: "100%" }} placeholder="000.000.000-00" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} required />
          </div>

          {formaPagamento === "CREDIT_CARD" ? (
            <>
              <div className="field">
                <label>Número do cartão</label>
                <input className="input" style={{ width: "100%" }} inputMode="numeric" placeholder="0000 0000 0000 0000" value={numeroCartao} onChange={(e) => setNumeroCartao(e.target.value)} required />
              </div>
              <div className="field">
                <label>Nome impresso no cartão</label>
                <input className="input" style={{ width: "100%" }} placeholder="Ex.: ANA P FERREIRA" value={nomeCartao} onChange={(e) => setNomeCartao(e.target.value)} required />
              </div>
              <div style={{ display: "flex", gap: 14, padding: "0 17px 14px" }}>
                <div className="field" style={{ padding: 0, flex: 1 }}>
                  <label>Mês</label>
                  <input className="input" style={{ width: "100%" }} placeholder="MM" value={validadeMes} onChange={(e) => setValidadeMes(e.target.value)} required />
                </div>
                <div className="field" style={{ padding: 0, flex: 1 }}>
                  <label>Ano</label>
                  <input className="input" style={{ width: "100%" }} placeholder="AAAA" value={validadeAno} onChange={(e) => setValidadeAno(e.target.value)} required />
                </div>
                <div className="field" style={{ padding: 0, flex: 1 }}>
                  <label>CVV</label>
                  <input className="input" style={{ width: "100%" }} inputMode="numeric" placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value)} required />
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, padding: "0 17px 14px" }}>
                <div className="field" style={{ padding: 0, flex: 1 }}>
                  <label>CEP</label>
                  <input className="input" style={{ width: "100%" }} placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} required />
                </div>
                <div className="field" style={{ padding: 0, flex: 1 }}>
                  <label>Número do endereço</label>
                  <input className="input" style={{ width: "100%" }} value={numeroEndereco} onChange={(e) => setNumeroEndereco(e.target.value)} required />
                </div>
                <div className="field" style={{ padding: 0, flex: 1 }}>
                  <label>Telefone</label>
                  <input className="input" style={{ width: "100%" }} value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
                </div>
              </div>
            </>
          ) : (
            <p className="config-bloco-titulo" style={{ padding: "0 17px 14px" }}>
              {formaPagamento === "PIX" ? "O QR Code do PIX é gerado após confirmar." : "O boleto é gerado após confirmar."}
            </p>
          )}

          {erroEnvio ? <p style={{ color: "var(--danger)", padding: "0 17px 14px", fontSize: 12.5 }}>{erroEnvio}</p> : null}

          <div className="section-foot">
            <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setPlanoEmEdicao(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" style={{ flex: 1 }} disabled={enviando}>
              {enviando ? "Processando…" : "Confirmar pagamento"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="config-bloco">
        <p className="config-bloco-titulo">Histórico</p>
        <div className="config-tabela-scroll">
          <table className="config-tabela-notif">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Fatura</th>
              </tr>
            </thead>
            <tbody>
              {cobrancas.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: "var(--text-muted)" }}>Nenhuma cobrança ainda.</td>
                </tr>
              ) : (
                cobrancas.map((c) => (
                  <tr key={c.id}>
                    <td>{formatarData(c.dueDate)}</td>
                    <td>{formatarMoeda(c.value)}</td>
                    <td>{NOME_STATUS_COBRANCA[c.status] ?? c.status}</td>
                    <td>
                      <a className="btn ghost" href={c.invoiceUrl} target="_blank" rel="noreferrer">
                        Ver fatura
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {assinatura && assinatura.status !== "cancelada" ? (
        <div className="section-foot" style={{ paddingTop: 0 }}>
          <button type="button" className="btn danger block" onClick={cancelarPlano}>
            Cancelar assinatura
          </button>
        </div>
      ) : null}
    </div>
  );
}
