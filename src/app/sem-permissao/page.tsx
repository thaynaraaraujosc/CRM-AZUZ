"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

import { SeletorIdioma } from "@/components/seletor-idioma";
import { useIdioma } from "@/lib/idioma-context";

/**
 * Quem entrou, mas não tem permissão pra abrir nada.
 *
 * Esta tela existe por causa de um laço: antes, quem era barrado numa rota era mandado pra
 * `/conversas` — que é justamente uma das rotas que se pode restringir. Sem permissão nela, o
 * navegador ia e voltava até desistir com "redireções em excesso", e a pessoa via uma tela de
 * erro do navegador, sem nenhuma pista do que tinha acontecido.
 *
 * Aqui ela lê o que é, e sabe a quem pedir.
 */
export default function SemPermissaoPage() {
  const { t: traduzir } = useIdioma();

  return (
    <div className="auth-page">
      <SeletorIdioma />
      <Link href="/" className="auth-brand">
        <span className="auth-mark">a</span>
        <span className="auth-brand-name">azuz crm</span>
      </Link>
      <div className="auth-card card">
        <h1 className="auth-title">{traduzir("Sua conta ainda não tem acesso a nada")}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5, padding: "0 0 20px" }}>
          {traduzir(
            "Você entrou, mas nenhuma parte do CRM está liberada pro seu usuário. Peça pra quem administra a conta da sua empresa marcar o que você pode ver em Configurações → Usuários.",
          )}
        </p>
        <button type="button" className="btn ghost block" onClick={() => signOut({ callbackUrl: "/login" })}>
          {traduzir("Sair")}
        </button>
      </div>
    </div>
  );
}
