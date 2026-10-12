"use client";

import Link from "next/link";

import { Topbar } from "@/components/ui";
import { useIdioma } from "@/lib/idioma-context";

/**
 * Cabeçalho da tela de convite, à parte da página.
 *
 * A página precisa continuar sendo Server Component porque exporta `metadata` — e o Next recusa
 * exportar `metadata` de um arquivo marcado com "use client". Como traduzir exige um hook, e hook
 * só existe no cliente, o pedaço que tem texto vira este componente e a página fica como estava.
 */
export function CabecalhoConvidar() {
  const { t: traduzir } = useIdioma();
  return (
    <Topbar
      title={traduzir("Convidar membro")}
      sub={traduzir("A pessoa recebe um e-mail e cria a própria senha. Vocês nunca digitam a senha de ninguém")}
      actions={
        <Link className="btn ghost" href="/equipe">
          ← {traduzir("Voltar pra equipe")}
        </Link>
      }
    />
  );
}
