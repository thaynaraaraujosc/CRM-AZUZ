"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const resultado = await signIn("credentials", {
      email,
      senha,
      redirect: false,
    });

    setCarregando(false);

    if (resultado?.error) {
      setErro("E-mail ou senha incorretos.");
      return;
    }

    // callbackUrl (deep link, ex.: proxy mandou pra cá a partir de /admin/workspaces sem sessão)
    // tem prioridade; sem ela, super-admin cai direto no painel de admin, todo o resto vai pro
    // painel normal do workspace.
    const callbackUrl = searchParams.get("callbackUrl");
    if (callbackUrl) {
      router.push(callbackUrl);
    } else {
      const sessao = await fetch("/api/auth/session").then((r) => r.json());
      router.push(sessao?.user?.superAdmin ? "/admin" : "/inicio");
    }
    router.refresh();
  }

  return (
    <div className="auth-page">
      <form className="auth-card card" onSubmit={handleSubmit}>
        <h1 className="auth-title">Entrar no CRM AZUZ</h1>

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
          />
        </div>

        <div className="field">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            className="input"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <p className="auth-rodape" style={{ margin: "0 0 12px", textAlign: "right" }}>
          <Link href="/esqueci-senha">Esqueci minha senha</Link>
        </p>

        {erro && <p className="auth-erro">{erro}</p>}

        <button type="submit" className={`btn primary block${carregando ? " loading" : ""}`} disabled={carregando}>
          Entrar
        </button>

        <p className="auth-rodape">
          Ainda não tem conta? <Link href="/cadastro">Cadastre sua empresa</Link>
        </p>
      </form>
    </div>
  );
}
