import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { AceitarConviteForm } from "@/components/equipe/AceitarConviteForm";
import { conviteValido } from "@/lib/equipe/convite";
import { ConviteBoasVindas, ConviteNaoEncontrado } from "@/components/equipe/TelaConvite";

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
    return <ConviteNaoEncontrado />;
  }

  const primeiroNome = membro!.nome.split(" ")[0];

  return (
    <ConviteBoasVindas primeiroNome={primeiroNome} empresa={membro!.workspace.nome} papel={membro!.papel}>
      <AceitarConviteForm id={membro!.id} email={membro!.email} token={t ?? ""} />
    </ConviteBoasVindas>
  );
}
