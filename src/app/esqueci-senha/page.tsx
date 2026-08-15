"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const resposta = await fetch("/api/auth/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!resposta.ok) throw new Error();
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar o link agora. Tente de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-title">Esqueci minha senha</h1>

        {enviado ? (
          <>
            <p className="auth-sucesso">
              Se <strong>{email}</strong> tiver uma conta no CRM AZUZ, enviamos um link de
              redefinição pra esse e-mail. Confira também a caixa de spam.
            </p>
            <p className="auth-rodape">
              <Link href="/login">Voltar pro login</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="auth-descricao">
              Digite o e-mail da sua conta — vamos mandar um link pra você criar uma senha nova.
            </p>

            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {erro && <p className="auth-erro">{erro}</p>}

            <button type="submit" className={`btn primary block${carregando ? " loading" : ""}`} disabled={carregando}>
              Enviar link de redefinição
            </button>

            <p className="auth-rodape">
              <Link href="/login">Voltar pro login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
