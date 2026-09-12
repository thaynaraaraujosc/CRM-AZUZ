import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { AceitarConviteForm } from "@/components/equipe/AceitarConviteForm";
import { conviteValido } from "@/lib/equipe/convite";

export const metadata: Metadata = { title: "Seu convite · CRM AZUZ" };

/**
 * O que a pessoa convidada vê. Busca o convite direto no banco, server-side, sem sessão nenhuma
 * (quem está aqui ainda não tem login).
 *
 * O segmento da URL é o id do Membro, que é o slug do nome e portanto adivinhável. Quem autoriza é
 * o token em `?t=`, conferido contra o hash guardado. Ver `lib/equipe/convite.ts`.
 */
export default async function ConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { token: id } = await params;
  const { t } = await searchParams;
  const membro = await prisma.membro.findUnique({
    where: { id },
    include: { workspace: { select: { nome: true } } },
  });

  if (!conviteValido(membro, t)) {
    return (
      <div className="auth-page">
        <Link href="/" className="auth-brand">
          <span className="auth-mark">a</span>
          <span className="auth-brand-name">azuz crm</span>
        </Link>
        <div className="auth-card card">
          <h1 className="auth-title">Convite não encontrado</h1>
          <p className="auth-descricao">
            Esse link de convite não existe mais, expirou ou já foi usado. Peça pra quem te
            convidou mandar um novo.
          </p>
          <p className="auth-rodape">
            <Link href="/login">Ir pro login</Link>
          </p>
        </div>
      </div>
    );
  }

  const primeiroNome = membro!.nome.split(" ")[0];

  return (
    <div className="auth-page">
      <Link href="/" className="auth-brand">
        <span className="auth-mark">a</span>
        <span className="auth-brand-name">azuz crm</span>
      </Link>
      <div className="auth-card card">
        <h1 className="auth-title">Bem-vindo, {primeiroNome}</h1>
        <p className="auth-descricao">
          Você foi convidado(a) pro CRM da <strong>{membro!.workspace.nome}</strong> como{" "}
          {membro!.papel}. Crie sua senha pra começar a usar.
        </p>
        <AceitarConviteForm id={membro!.id} email={membro!.email} token={t ?? ""} />
      </div>
    </div>
  );
}
