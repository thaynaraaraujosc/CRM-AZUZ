"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AceitarConviteForm({ id, email }: { id: string; email: string }) {
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
      const resposta = await fetch(`/api/convite/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(dados?.erro ?? "Não foi possível aceitar o convite.");
        return;
      }
      setSucesso(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setErro("Não foi possível aceitar o convite agora. Tente de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  if (sucesso) {
    return <p className="auth-sucesso">Conta ativada! Levando você pro login…</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" className="input" type="email" defaultValue={email} readOnly />
      </div>

      <div className="field">
        <label htmlFor="senha">Crie sua senha</label>
        <input
          id="senha"
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={8}
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor="senha2">Confirme sua senha</label>
        <input
          id="senha2"
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a senha"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          required
          minLength={8}
        />
      </div>

      {erro && <p className="auth-erro">{erro}</p>}

      <button type="submit" className={`btn primary block${carregando ? " loading" : ""}`} disabled={carregando}>
        Criar senha e entrar
      </button>
    </form>
  );
}
