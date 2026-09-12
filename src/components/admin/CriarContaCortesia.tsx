"use client";

import { useState, type FormEvent } from "react";

type Criada = { workspaceId: string; linkConvite: string; emailEnviado: boolean; motivoEmail?: string };

/**
 * Cria uma conta de cortesia: empresa nova, a pessoa como administradora dela, assinatura já ativa.
 *
 * Existe porque o caminho normal tem um degrau que não faz sentido numa conta de teste, de sócio ou
 * de demonstração: quem se cadastra sozinho nasce com assinatura pendente e cai na tela de
 * bloqueio, esperando alguém liberar depois. Aqui ela nasce liberada.
 *
 * A senha não é escolhida aqui, de propósito. Sai um link de convite e quem cria a senha é a
 * própria pessoa: nem o super-admin precisa ver ou inventar a senha de outro.
 */
export function CriarContaCortesia({ aoCriar }: { aoCriar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<Criada | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const resposta = await fetch("/api/admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa, nome, email }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(dados?.erro ?? "Não foi possível criar a conta.");
        return;
      }
      setCriada(dados as Criada);
      setEmpresa("");
      setNome("");
      setEmail("");
      aoCriar();
    } catch {
      setErro("Não foi possível criar a conta agora. Tente de novo em instantes.");
    } finally {
      setSalvando(false);
    }
  }

  if (criada) {
    return (
      <div className="config-bloco" style={{ margin: "0 17px 17px" }}>
        <p className="config-bloco-titulo">Conta criada e já liberada</p>
        <p className="hint">
          A empresa <strong>{criada.workspaceId}</strong> foi criada com a assinatura ativa, sem
          cobrança nenhuma por trás. Mande o link abaixo pra pessoa criar a senha dela. Ele vale 7
          dias e só funciona uma vez.
        </p>
        <div className="filters-row" style={{ marginTop: 10 }}>
          <input className="input" style={{ flex: 1, fontFamily: "monospace" }} readOnly value={criada.linkConvite} />
          <button type="button" className="btn ghost" onClick={() => navigator.clipboard.writeText(criada.linkConvite)}>
            Copiar link
          </button>
        </div>
        {!criada.emailEnviado ? (
          <p className="hint">
            O e-mail não saiu ({criada.motivoEmail ?? "motivo não informado"}). Use o link acima, que
            funciona do mesmo jeito.
          </p>
        ) : (
          <p className="hint">O e-mail com o convite também foi enviado.</p>
        )}
        <div className="config-acoes">
          <button type="button" className="btn ghost" onClick={() => setCriada(null)}>
            Criar outra
          </button>
        </div>
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className="config-acoes" style={{ margin: "0 17px 17px" }}>
        <button type="button" className="btn primary" onClick={() => setAberto(true)}>
          Criar conta de cortesia
        </button>
      </div>
    );
  }

  return (
    <form className="config-bloco" style={{ margin: "0 17px 17px" }} onSubmit={enviar}>
      <p className="config-bloco-titulo">Nova conta de cortesia</p>
      <p className="hint">
        Cria uma empresa nova com essa pessoa como administradora e a assinatura já ativa. Não gera
        cobrança: nenhuma fatura, boleto ou cartão é criado. Pra encerrar depois, é só mudar o
        status da assinatura pra cancelada no detalhe da empresa.
      </p>

      <div className="field">
        <label htmlFor="cortesia-empresa">Nome da empresa</label>
        <input
          id="cortesia-empresa"
          className="input"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          placeholder="Clínica do Lucas"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="cortesia-nome">Nome da pessoa</label>
        <input
          id="cortesia-nome"
          className="input"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Lucas Arantes"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="cortesia-email">E-mail</label>
        <input
          id="cortesia-email"
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@empresa.com.br"
          required
        />
      </div>

      {erro && <p className="auth-erro">{erro}</p>}

      <div className="config-acoes">
        <button type="submit" className={`btn primary${salvando ? " loading" : ""}`} disabled={salvando}>
          Criar e liberar
        </button>
        <button type="button" className="btn ghost" onClick={() => setAberto(false)} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
