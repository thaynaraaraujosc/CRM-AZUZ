import Link from "next/link";
import type { Metadata } from "next";

import { ConvidarForm } from "@/components/equipe/ConvidarForm";
import { Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Convidar membro · CRM AZUZ" };

export default function ConvidarPage() {
  return (
    <>
      <Topbar
        title="Convidar membro"
        sub="A pessoa recebe um e-mail e cria a própria senha — vocês nunca digitam a senha de ninguém"
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
