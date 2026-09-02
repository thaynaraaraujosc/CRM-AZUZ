"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { IconNovaConta } from "@/components/icons";

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

    // Conta acabou de nascer com assinatura "pendente" (ver /api/cadastro) — o proxy bloqueia
    // tudo até o pagamento, então já manda direto pra tela de pagamento em vez de /inicio (que só
    // ia rebater de volta pra cá mesmo).
    router.push("/configuracoes?categoria=plano");
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
          <IconNovaConta width={20} height={20} />
        </span>
        <h1 className="auth-title">Crie sua conta</h1>
        <p className="auth-sub">Cadastre sua empresa e comece a usar o CRM hoje.</p>

        <div className="field">
          <label htmlFor="empresa">Nome da empresa</label>
          <input
            id="empresa"
            type="text"
            className="input"
            placeholder="Nome da empresa"
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
            placeholder="Seu nome"
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
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {erro && <p className="auth-erro">{erro}</p>}

        <button type="submit" className={`btn primary block${carregando ? " loading" : ""}`} disabled={carregando}>
          Criar conta
        </button>

        <p className="auth-rodape">
          Já possui conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
