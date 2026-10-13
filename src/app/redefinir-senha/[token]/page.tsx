"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeletorIdioma } from "@/components/seletor-idioma";
import { useIdioma } from "@/lib/idioma-context";

export default function RedefinirSenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { t: traduzir } = useIdioma();
  const { token } = use(params);
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro(traduzir("A senha precisa ter pelo menos 8 caracteres."));
      return;
    }
    if (senha !== confirmarSenha) {
      setErro(traduzir("As senhas não coincidem."));
      return;
    }

    setCarregando(true);
    try {
      const resposta = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, novaSenha: senha }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(dados?.erro ?? traduzir("Não foi possível redefinir a senha."));
        return;
      }
      setSucesso(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setErro(traduzir("Não foi possível redefinir a senha agora. Tente de novo em instantes."));
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
        <h1 className="auth-title">{traduzir("Criar nova senha")}</h1>

        {sucesso ? (
          <p className="auth-sucesso">{traduzir("Senha redefinida! Levando você pro login…")}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="senha">{traduzir("Nova senha")}</label>
              <input
                id="senha"
                type="password"
                className="input"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="confirmarSenha">{traduzir("Confirmar nova senha")}</label>
              <input
                id="confirmarSenha"
                type="password"
                className="input"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {erro && <p className="auth-erro">{erro}</p>}

            <button type="submit" className={`btn primary block${carregando ? " loading" : ""}`} disabled={carregando}>
              {traduzir("Redefinir senha")}
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
