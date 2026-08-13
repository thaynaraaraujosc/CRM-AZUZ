"use client";

import { signOut } from "next-auth/react";

export default function AcessoBloqueadoPage() {
  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-title">Acesso suspenso</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5, padding: "0 0 20px" }}>
          A assinatura do seu workspace está com o pagamento pendente ou atrasado. Fale com o
          administrador da sua empresa pra regularizar — assim que a cobrança for confirmada, o
          acesso volta ao normal automaticamente.
        </p>
        <button type="button" className="btn ghost block" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sair
        </button>
      </div>
    </div>
  );
}
