"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RedefinirSenhaPage({ params }: { params: Promise<{ token: string }> }) {
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
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
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
        setErro(dados?.erro ?? "Não foi possível redefinir a senha.");
        return;
      }
      setSucesso(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setErro("Não foi possível redefinir a senha agora. Tente de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-title">Criar nova senha</h1>

        {sucesso ? (
          <p className="auth-sucesso">Senha redefinida! Levando você pro login…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="senha">Nova senha</label>
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
              <label htmlFor="confirmarSenha">Confirmar nova senha</label>
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
              Redefinir senha
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
