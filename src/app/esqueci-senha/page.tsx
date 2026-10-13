"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { SeletorIdioma } from "@/components/seletor-idioma";
import { useIdioma } from "@/lib/idioma-context";

export default function EsqueciSenhaPage() {
  const { t: traduzir } = useIdioma();
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
      setErro(traduzir("Não foi possível enviar o link agora. Tente de novo em instantes."));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="auth-page">
      <SeletorIdioma />
      <Link href="/" className="auth-brand">
        <span className="auth-mark">a</span>
        <span className="auth-brand-name">azuz crm</span>
      </Link>
      <div className="auth-card card">
        <h1 className="auth-title">{traduzir("Esqueci minha senha")}</h1>

        {enviado ? (
          <>
            <p className="auth-sucesso">
              {traduzir(
                "Se {email} tiver uma conta no CRM AZUZ, enviamos um link de redefinição pra esse e-mail. Confira também a caixa de spam.",
                { email },
              )}
            </p>
            <p className="auth-rodape">
              <Link href="/login">{traduzir("Voltar pro login")}</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="auth-descricao">
              {traduzir(
                "Digite o e-mail da sua conta. Vamos mandar um link pra você criar uma senha nova.",
              )}
            </p>

            <div className="field">
              <label htmlFor="email">{traduzir("E-mail")}</label>
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
              {traduzir("Enviar link de redefinição")}
            </button>

            <p className="auth-rodape">
              <Link href="/login">{traduzir("Voltar pro login")}</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
