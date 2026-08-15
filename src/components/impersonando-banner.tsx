"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Faixa fixa mostrada só enquanto a sessão atual é um "entrar como" (super-admin vendo o CRM
 * como outro usuário) — sem isso, dava pra esquecer que está impersonando e mexer em dado de
 * cliente pensando que é teste. */
export function ImpersonandoBanner() {
  const { data: sessao } = useSession();
  const router = useRouter();
  const [voltando, setVoltando] = useState(false);

  if (!sessao?.user?.impersonadoPorId) return null;

  async function voltar() {
    setVoltando(true);
    const resposta = await fetch("/api/impersonar/voltar", { method: "POST" }).then((r) => r.json());
    await signIn("impersonar", { membroId: resposta.membroId, token: resposta.token, redirect: false });
    router.push("/admin");
    router.refresh();
  }

  return (
    <div
      style={{
        background: "var(--ia)",
        color: "#fff",
        padding: "8px 17px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 12.5,
      }}
    >
      <span>
        Você está vendo o CRM como <strong>{sessao.user.name}</strong> ({sessao.user.email}).
      </span>
      <button
        type="button"
        onClick={voltar}
        disabled={voltando}
        style={{ background: "rgba(255,255,255,0.16)", border: "none", color: "#fff", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
      >
        {voltando ? "Voltando…" : "Voltar pro admin"}
      </button>
    </div>
  );
}
