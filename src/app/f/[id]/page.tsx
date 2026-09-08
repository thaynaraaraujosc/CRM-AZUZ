import type { Metadata } from "next";

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
export const metadata: Metadata = { title: "Formulário" };

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
