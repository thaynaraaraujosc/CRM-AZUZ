"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { CabecalhoCategoria } from "./CabecalhoCategoria";

type SessaoReal = { id: string; dispositivo: string; ip: string | null; criadoEm: string; atual: boolean };

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Segurança — só senha (redefinição por e-mail, sem 2FA/política de senha/expiração/bloqueio por
 * tentativa, que nunca chegaram a ser aplicados de verdade) e sessões ativas reais (`SessaoAtiva`,
 * criada no login em `src/lib/auth.ts` — dispositivo/navegador parseados do User-Agent real). */
export function SegurancaSecao() {
  const { data: sessao } = useSession();
  const emailAtual = sessao?.user?.email ?? "";

  const [enviandoReset, setEnviandoReset] = useState(false);
  const [resetEnviado, setResetEnviado] = useState(false);

  const [trocandoEmail, setTrocandoEmail] = useState(false);
  const [novoEmail, setNovoEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [emailAlterado, setEmailAlterado] = useState(false);

  const [sessoes, setSessoes] = useState<SessaoReal[] | null>(null);

  useEffect(() => {
    fetch("/api/seguranca/sessoes")
      .then((r) => r.json())
      .then((dados: SessaoReal[]) => setSessoes(dados))
      .catch((erro) => console.error("Falha ao carregar sessões ativas:", erro));
  }, []);

  function pedirRedefinicaoSenha() {
    if (!emailAtual) return;
    setEnviandoReset(true);
    fetch("/api/auth/esqueci-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAtual }),
    })
      .then(() => setResetEnviado(true))
      .catch((erro) => console.error("Falha ao pedir redefinição de senha:", erro))
      .finally(() => setEnviandoReset(false));
  }

  function salvarNovoEmail() {
    setErroEmail(null);
    setSalvandoEmail(true);
    fetch("/api/auth/alterar-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senhaAtual, novoEmail }),
    })
      .then(async (r) => {
        const dados = await r.json();
        if (!r.ok) throw new Error(dados?.erro || "Não foi possível alterar o e-mail.");
        setEmailAlterado(true);
        setTrocandoEmail(false);
        setSenhaAtual("");
        setNovoEmail("");
      })
      .catch((erro: Error) => setErroEmail(erro.message))
      .finally(() => setSalvandoEmail(false));
  }

  function encerrarSessao(id: string) {
    setSessoes((prev) => prev?.filter((s) => s.id !== id) ?? prev);
    fetch(`/api/seguranca/sessoes/${id}`, { method: "DELETE" }).catch((erro) =>
      console.error("Falha ao encerrar sessão:", erro),
    );
  }

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Segurança" descricao="Senha, e-mail de acesso e sessões ativas." />

      <div className="config-bloco">
        <p className="config-bloco-titulo">Senha</p>
        <div className="toggle-row" style={{ padding: "6px 0" }}>
          <span className="tl">
            Redefinir por e-mail — enviamos um link pra <strong>{emailAtual || "seu e-mail cadastrado"}</strong>, sem precisar digitar a senha atual.
          </span>
          <button type="button" className="btn ghost" onClick={pedirRedefinicaoSenha} disabled={enviandoReset || resetEnviado}>
            {resetEnviado ? "Link enviado" : enviandoReset ? "Enviando…" : "Redefinir senha"}
          </button>
        </div>
        {resetEnviado ? <p className="hint">Confira a caixa de entrada de {emailAtual} (e o spam).</p> : null}
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">E-mail de acesso</p>
        {!trocandoEmail ? (
          <div className="toggle-row" style={{ padding: "6px 0" }}>
            <span className="tl">{emailAtual}</span>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setTrocandoEmail(true);
                setEmailAlterado(false);
                setErroEmail(null);
              }}
            >
              Alterar e-mail
            </button>
          </div>
        ) : (
          <div className="config-grid-2">
            <div className="field">
              <label>Senha atual</label>
              <input className="input" type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} placeholder="Confirme sua senha" />
            </div>
            <div className="field">
              <label>Novo e-mail</label>
              <input className="input" type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} placeholder="novo@email.com" />
            </div>
            {erroEmail ? <p style={{ gridColumn: "1 / -1", color: "var(--danger)", fontSize: 12.5 }}>{erroEmail}</p> : null}
            <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
              <button type="button" className="btn primary" onClick={salvarNovoEmail} disabled={salvandoEmail || !senhaAtual || !novoEmail}>
                {salvandoEmail ? "Salvando…" : "Confirmar troca"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setTrocandoEmail(false)} disabled={salvandoEmail}>
                Cancelar
              </button>
            </div>
          </div>
        )}
        {emailAlterado ? <p className="hint">E-mail alterado. Use o novo e-mail (com a mesma senha) da próxima vez que entrar.</p> : null}
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Sessões ativas</p>
        {sessoes === null ? (
          <p className="hint">Carregando…</p>
        ) : (
          <div className="config-lista-linhas">
            {sessoes.map((s) => (
              <div className="config-linha-clicavel" key={s.id} style={{ cursor: "default" }}>
                <div>
                  <p className="n">
                    {s.dispositivo} {s.atual ? <span className="pill on">Esta sessão</span> : null}
                  </p>
                  <p className="r">
                    {s.ip ? `${s.ip} · ` : ""}conectado desde {formatarData(s.criadoEm)}
                  </p>
                </div>
                {!s.atual ? (
                  <button type="button" className="btn danger" onClick={() => encerrarSessao(s.id)}>
                    Encerrar sessão
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
