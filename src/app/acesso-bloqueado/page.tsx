"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { SeletorIdioma } from "@/components/seletor-idioma";
import { useIdioma } from "@/lib/idioma-context";

export default function AcessoBloqueadoPage() {
  const { t: traduzir } = useIdioma();

  return (
    <div className="auth-page">
      <SeletorIdioma />
      <Link href="/" className="auth-brand">
        <span className="auth-mark">a</span>
        <span className="auth-brand-name">azuz crm</span>
      </Link>
      <div className="auth-card card">
        <h1 className="auth-title">{traduzir("Acesso suspenso")}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5, padding: "0 0 20px" }}>
          {traduzir(
            "A assinatura do seu workspace está com o pagamento pendente ou atrasado. Fale com o administrador da sua empresa pra regularizar. Assim que a cobrança for confirmada, o acesso volta ao normal automaticamente.",
          )}
        </p>
        <button type="button" className="btn ghost block" onClick={() => signOut({ callbackUrl: "/login" })}>
          {traduzir("Sair")}
        </button>
      </div>
    </div>
  );
}
