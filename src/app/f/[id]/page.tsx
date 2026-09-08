import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { FormularioPublico } from "@/components/formularios/FormularioPublico";

/**
 * A página que o link compartilhado abre. `/f/<id>`, opcionalmente com `?chave=` quando o
 * formulário tem senha.
 *
 * Esta rota não existia. O botão "Compartilhar" já montava o endereço `/f/<id>` e o copiava pra
 * área de transferência, mas não havia nada atendendo nesse caminho: quem recebia o link caía num
 * erro do navegador, e a dona do formulário não tinha como receber uma única resposta.
 *
 * Não exige sessão, e não pode exigir: quem responde é um lead que nunca vai ter login no CRM. As
 * defesas ficam onde já estavam, dentro das rotas de API que a tela chama: `GET
 * /api/formularios/[id]` devolve só os campos necessários pra desenhar o formulário (nunca
 * `integracoes` nem `versoes`), e o `workspaceId` de uma resposta é copiado do formulário pai, sem
 * jamais vir do cliente.
 */
/**
 * O título e a descrição que aparecem na prévia do link.
 *
 * Sem isto, quem recebia o link via o título e a descrição do LAYOUT: "Painel web do CRM AZUZ:
 * Início, WhatsApp, Funil, Tarefas…". Nada disso diz o que a pessoa vai responder, e link que não
 * se explica não é clicado. Agora mostra o nome do formulário.
 *
 * `robots: noindex` de propósito: o link é pra ser mandado pra quem a empresa escolheu, não pra
 * ser achado no Google. Um formulário indexado passa a receber resposta de qualquer um.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const formulario = await prisma.formulario
    .findUnique({ where: { id }, select: { nome: true, descricao: true } })
    .catch(() => null);

  const nome = formulario?.nome || "Formulário";
  const descricao = formulario?.descricao || "Leva menos de um minuto pra responder.";

  return {
    title: nome,
    description: descricao,
    robots: { index: false, follow: false },
    openGraph: { title: nome, description: descricao, type: "website" },
  };
}

export default async function FormularioPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chave?: string }>;
}) {
  const { id } = await params;
  const { chave } = await searchParams;
  return <FormularioPublico id={id} chave={chave ?? null} />;
}
