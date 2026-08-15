import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { AceitarConviteForm } from "@/components/equipe/AceitarConviteForm";

export const metadata: Metadata = { title: "Seu convite · CRM AZUZ" };

/**
 * O que a pessoa convidada vê — busca o convite real (`Membro.convitePendente`) direto no banco,
 * server-side, sem sessão nenhuma (quem está aqui ainda não tem login). `token` é o id do Membro
 * pendente, o mesmo usado no link mandado por e-mail em `POST /api/equipe`.
 */
export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const membro = await prisma.membro.findUnique({
    where: { id: token },
    include: { workspace: { select: { nome: true } } },
  });

  if (!membro || !membro.convitePendente) {
    return (
      <div className="auth-page">
        <Link href="/" className="auth-brand">
          <span className="auth-mark">a</span>
          <span className="auth-brand-name">azuz crm</span>
        </Link>
        <div className="auth-card card">
          <h1 className="auth-title">Convite não encontrado</h1>
          <p className="auth-descricao">
            Esse link de convite não existe mais ou já foi usado. Peça pra quem te convidou mandar
            um novo.
          </p>
          <p className="auth-rodape">
            <Link href="/login">Ir pro login</Link>
          </p>
        </div>
      </div>
    );
  }

  const primeiroNome = membro.nome.split(" ")[0];

  return (
    <div className="auth-page">
      <Link href="/" className="auth-brand">
        <span className="auth-mark">a</span>
        <span className="auth-brand-name">azuz crm</span>
      </Link>
      <div className="auth-card card">
        <h1 className="auth-title">Bem-vindo, {primeiroNome}</h1>
        <p className="auth-descricao">
          Você foi convidado(a) pro CRM da <strong>{membro.workspace.nome}</strong> como{" "}
          {membro.papel}. Crie sua senha pra começar a usar.
        </p>
        <AceitarConviteForm id={membro.id} email={membro.email} />
      </div>
    </div>
  );
}
