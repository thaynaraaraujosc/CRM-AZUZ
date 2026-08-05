"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CadastroPage() {
  const router = useRouter();
  const [empresa, setEmpresa] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const resposta = await fetch("/api/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresa, nome, email, senha }),
    });

    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
      setErro(corpo?.erro ?? "Não foi possível criar a conta.");
      setCarregando(false);
      return;
    }

    const resultado = await signIn("credentials", { email, senha, redirect: false });

    setCarregando(false);

    if (resultado?.error) {
      router.push("/login");
      return;
    }

    router.push("/inicio");
    router.refresh();
  }

  return (
    <div className="auth-page">
      <form className="auth-card card" onSubmit={handleSubmit}>
        <h1 className="auth-title">Cadastre sua empresa</h1>

        <div className="field">
          <label htmlFor="empresa">Nome da empresa</label>
          <input
            id="empresa"
            type="text"
            className="input"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="nome">Seu nome</label>
          <input
            id="nome"
            type="text"
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>

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
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {erro && <p className="auth-erro">{erro}</p>}

        <button type="submit" className={`btn primary block${carregando ? " loading" : ""}`} disabled={carregando}>
          Criar conta
        </button>

        <p className="auth-rodape">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
