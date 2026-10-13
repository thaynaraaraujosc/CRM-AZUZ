"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { SeletorIdioma } from "@/components/seletor-idioma";
import { useIdioma } from "@/lib/idioma-context";

/**
 * As duas telas que a pessoa convidada pode ver, como Client Components.
 *
 * A página continua sendo Server Component porque busca o convite no banco e exporta `metadata` —
 * e o Next recusa `metadata` num arquivo marcado com "use client". Só que texto em tela precisa
 * passar pelo dicionário, e o dicionário é um hook. Daí a separação: a página resolve o convite, e
 * o que aparece mora aqui.
 */
function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <SeletorIdioma />
      <Link href="/" className="auth-brand">
        <span className="auth-mark">a</span>
        <span className="auth-brand-name">azuz crm</span>
      </Link>
      <div className="auth-card card">{children}</div>
    </div>
  );
}

export function ConviteNaoEncontrado() {
  const { t: traduzir } = useIdioma();

  return (
    <Moldura>
      <h1 className="auth-title">{traduzir("Convite não encontrado")}</h1>
      <p className="auth-descricao">
        {traduzir(
          "Esse link de convite não existe mais, expirou ou já foi usado. Peça pra quem te convidou mandar um novo.",
        )}
      </p>
      <p className="auth-rodape">
        <Link href="/login">{traduzir("Ir pro login")}</Link>
      </p>
    </Moldura>
  );
}

/**
 * `empresa` e `papel` NÃO são traduzidos: são o nome da empresa e o nome do papel, escritos por
 * quem convidou. Traduzir isso trocaria o dado da pessoa por outra palavra.
 */
export function ConviteBoasVindas({
  primeiroNome,
  empresa,
  papel,
  children,
}: {
  primeiroNome: string;
  empresa: string;
  papel: string;
  children: ReactNode;
}) {
  const { t: traduzir } = useIdioma();

  return (
    <Moldura>
      <h1 className="auth-title">{traduzir("Bem-vindo, {nome}", { nome: primeiroNome })}</h1>
      <p className="auth-descricao">
        {traduzir("Você foi convidado(a) pro CRM da")} <strong>{empresa}</strong>{" "}
        {traduzir("como {papel}. Crie sua senha pra começar a usar.", { papel })}
      </p>
      {children}
    </Moldura>
  );
}
