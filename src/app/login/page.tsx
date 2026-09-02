"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { IconEntrar } from "@/components/icons";

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
      // O NextAuth devolve o mesmo erro quando a senha está errada e quando `authorize` não
      // conseguiu nem consultar o banco. Sem essa checagem, uma queda do banco aparecia aqui como
      // "senha incorreta" — a pessoa tentava de novo, trocava a senha, e nada funcionava, porque
      // a senha nunca foi o problema.
      const bancoOk = await fetch("/api/saude/banco")
        .then((r) => r.ok)
        .catch(() => false);
      setErro(
        bancoOk
          ? "E-mail ou senha incorretos."
          : "O servidor não está conseguindo acessar o banco de dados agora — não é a sua senha. Tente de novo em alguns minutos.",
      );
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
      <Link href="/" className="auth-brand">
        <span className="auth-mark">a</span>
        <span className="auth-brand-name">azuz crm</span>
      </Link>
      <form className="auth-card card" onSubmit={handleSubmit}>
        <span className="auth-selo" aria-hidden="true">
          <IconEntrar width={20} height={20} />
        </span>
        <h1 className="auth-title">Acesse sua conta</h1>
        <p className="auth-sub">Entre para continuar de onde parou no seu CRM.</p>

        {/* O rótulo continua no HTML, escondido por CSS — o campo precisa dele pra leitor de tela,
            mesmo com o placeholder dizendo a mesma coisa visualmente. */}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="E-mail"
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
            placeholder="Senha"
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
          Não possui conta? <Link href="/cadastro">Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
