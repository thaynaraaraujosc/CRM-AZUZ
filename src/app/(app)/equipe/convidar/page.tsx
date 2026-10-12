"use client";

import Link from "next/link";
import type { Metadata } from "next";

import { ConvidarForm } from "@/components/equipe/ConvidarForm";
import { Topbar } from "@/components/ui";
import { useIdioma } from "@/lib/idioma-context";

export const metadata: Metadata = { title: "Convidar membro · CRM AZUZ" };

export default function ConvidarPage() {
  const { t: traduzir } = useIdioma();
  return (
    <>
      <Topbar
        title={traduzir("Convidar membro")}
        sub="A pessoa recebe um e-mail e cria a própria senha. Vocês nunca digitam a senha de ninguém"
        actions={
          <Link className="btn ghost" href="/equipe">
            ← Voltar pra equipe
          </Link>
        }
      />

      <div className="content">
        <ConvidarForm />
      </div>
    </>
  );
}
