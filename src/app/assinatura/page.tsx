"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";

import { PLANOS } from "@/lib/assinatura/planos";
import { motivoDoBloqueio } from "@/lib/assinatura/acesso";

type FormaPagamento = "CREDIT_CARD" | "PIX" | "BOLETO";

/**
 * A tela de pagamento. A PRIMEIRA coisa que quem cria uma conta vê, e a única que responde
 * enquanto a assinatura não estiver ativa.
 *
 * Antes, quem não tinha pago era mandado pra `/configuracoes`: a tela de Configurações inteira,
 * com conexões, equipe, expediente e armazenamento à disposição. Chamar aquilo de bloqueio era
 * otimismo; era o produto funcionando de graça. Aqui só existe uma coisa pra fazer: pagar.
 *
 * Fica fora da casca do app de propósito. A casca carrega os provedores que leem `/api`, e `/api`
 * agora responde 402 pra quem não pagou: montá-la aqui encheria a tela de erro sem necessidade.
 */
export default function AssinaturaPage() {
  const router = useRouter();
  const plano = PLANOS.completo;

  const [status, setStatus] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
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
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/assinatura")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados) => setStatus(dados?.assinatura?.status ?? null))
      .catch(() => setStatus(null))
      .finally(() => setCarregando(false));
  }, []);

  // Assinatura já ativa: não faz sentido continuar nesta tela. Acontece quando o pagamento é
  // confirmado numa aba e a pessoa volta pra esta em outra.
  useEffect(() => {
    if (status === "ativa") router.replace("/inicio");
  }, [status, router]);

  async function pagar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/assinatura", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plano: "completo",
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
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(dados?.erro ?? "Não foi possível processar o pagamento.");
        return;
      }
      // Cartão confirma na hora; PIX e boleto ficam pendentes até a Asaas avisar por webhook. Nos
      // dois casos, quem decide se libera é o servidor, não esta tela.
      const novo = dados?.assinatura?.status ?? null;
      setStatus(novo);
      if (novo === "ativa") router.replace("/inicio");
    } catch {
      setErro("Falha de conexão. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  const aguardandoCompensacao = status === "pendente" && formaPagamento !== "CREDIT_CARD" && !enviando;

  return (
    <div className="auth-page">
      <Link href="/" className="auth-brand">
        <span className="auth-mark">a</span>
        <span className="auth-brand-name">azuz crm</span>
      </Link>

      <div className="auth-card card" style={{ maxWidth: 520 }}>
        <h1 className="auth-title">Ative seu CRM</h1>
        <p className="auth-descricao">{carregando ? "Conferindo sua assinatura…" : motivoDoBloqueio(status)}</p>

        <div className="config-bloco" style={{ margin: "0 0 16px" }}>
          <p className="config-bloco-titulo">Plano {plano.nome}</p>
          <p style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>
            R$ {plano.valor}
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}> /mês</span>
          </p>
          <p className="hint">{plano.recursos.join(" · ")}</p>
        </div>

        <form onSubmit={pagar}>
          <div className="field">
            <label htmlFor="forma">Forma de pagamento</label>
            <select
              id="forma"
              className="input"
              style={{ width: "100%" }}
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
            >
              <option value="CREDIT_CARD">Cartão de crédito</option>
              <option value="PIX">PIX</option>
              <option value="BOLETO">Boleto</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="cpf">CPF ou CNPJ</label>
            <input
              id="cpf"
              className="input"
              style={{ width: "100%" }}
              placeholder="000.000.000-00"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              required
            />
          </div>

          {formaPagamento === "CREDIT_CARD" ? (
            <>
              <div className="field">
                <label htmlFor="cartao">Número do cartão</label>
                <input
                  id="cartao"
                  className="input"
                  style={{ width: "100%" }}
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000"
                  value={numeroCartao}
                  onChange={(e) => setNumeroCartao(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="nome-cartao">Nome impresso no cartão</label>
                <input
                  id="nome-cartao"
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="Ex.: ANA P FERREIRA"
                  value={nomeCartao}
                  onChange={(e) => setNomeCartao(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: "1 1 90px", minWidth: 0 }}>
                  <label htmlFor="mes">Mês</label>
                  <input id="mes" className="input" style={{ width: "100%" }} placeholder="MM" value={validadeMes} onChange={(e) => setValidadeMes(e.target.value)} required />
                </div>
                <div className="field" style={{ flex: "1 1 90px", minWidth: 0 }}>
                  <label htmlFor="ano">Ano</label>
                  <input id="ano" className="input" style={{ width: "100%" }} placeholder="AAAA" value={validadeAno} onChange={(e) => setValidadeAno(e.target.value)} required />
                </div>
                <div className="field" style={{ flex: "1 1 90px", minWidth: 0 }}>
                  <label htmlFor="cvv">CVV</label>
                  <input id="cvv" className="input" style={{ width: "100%" }} inputMode="numeric" placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value)} required />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: "1 1 120px", minWidth: 0 }}>
                  <label htmlFor="cep">CEP</label>
                  <input id="cep" className="input" style={{ width: "100%" }} placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} required />
                </div>
                <div className="field" style={{ flex: "1 1 90px", minWidth: 0 }}>
                  <label htmlFor="numero-end">Número</label>
                  <input id="numero-end" className="input" style={{ width: "100%" }} value={numeroEndereco} onChange={(e) => setNumeroEndereco(e.target.value)} required />
                </div>
                <div className="field" style={{ flex: "1 1 130px", minWidth: 0 }}>
                  <label htmlFor="tel">Telefone</label>
                  <input id="tel" className="input" style={{ width: "100%" }} value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
                </div>
              </div>
            </>
          ) : (
            <p className="hint">
              {formaPagamento === "PIX"
                ? "O QR Code do PIX é gerado depois de confirmar."
                : "O boleto é gerado depois de confirmar."}
            </p>
          )}

          {erro && <p className="auth-erro">{erro}</p>}

          {aguardandoCompensacao && (
            <p className="hint">
              Pagamento registrado. O acesso libera sozinho assim que a compensação for confirmada,
              sem você precisar fazer mais nada.
            </p>
          )}

          <button type="submit" className={`btn primary block${enviando ? " loading" : ""}`} disabled={enviando}>
            {enviando ? "Processando…" : `Pagar R$ ${plano.valor} e liberar`}
          </button>
        </form>

        <p className="auth-rodape">
          <button
            type="button"
            className="btn ghost block"
            style={{ marginTop: 12 }}
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sair
          </button>
        </p>
      </div>
    </div>
  );
}
