"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Ações de "resolver o acesso de alguém" que qualquer tela do painel de admin que lista membros
 * pode usar — resetar senha (mostra a senha nova uma vez só, ver rota) e "entrar como" (vira a
 * sessão desse membro, sem senha nenhuma). Compartilhado entre o detalhe de workspace e a lista de
 * usuários pra não duplicar a lógica nos dois lugares.
 */
export function useAcoesMembro() {
  const router = useRouter();
  const [senhaGerada, setSenhaGerada] = useState<{ membroId: string; senha: string } | null>(null);
  const [carregandoId, setCarregandoId] = useState<string | null>(null);

  async function resetarSenha(membroId: string) {
    setCarregandoId(membroId);
    try {
      const resposta = await fetch(`/api/admin/membros/${membroId}/resetar-senha`, { method: "POST" }).then((r) => r.json());
      if (resposta.senha) setSenhaGerada({ membroId, senha: resposta.senha });
    } finally {
      setCarregandoId(null);
    }
  }

  async function entrarComo(membroId: string) {
    setCarregandoId(membroId);
    try {
      const resposta = await fetch(`/api/admin/membros/${membroId}/impersonar`, { method: "POST" }).then((r) => r.json());
      await signIn("impersonar", { membroId: resposta.membroId, token: resposta.token, redirect: false });
      router.push("/inicio");
      router.refresh();
    } finally {
      setCarregandoId(null);
    }
  }

  return { senhaGerada, setSenhaGerada, carregandoId, resetarSenha, entrarComo };
}
