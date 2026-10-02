import type { Metadata } from "next";
import Script from "next/script";

import { prisma } from "@/lib/prisma";
import { FormularioPublico } from "@/components/formularios/FormularioPublico";
import { idDaTagGoogle, rastreamentoDoFormulario } from "@/lib/formularios/rastreamento";

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

  /*
   * O PIXEL E A TAG SÃO LIDOS AQUI, NO SERVIDOR.
   *
   * `GET /api/formularios/[id]` não devolve `integracoes` de propósito — ali estão o funil, a etapa
   * e o responsável padrão, que são configuração interna da empresa e não têm por que chegar ao
   * navegador de um lead. Lendo do banco nesta página e passando só os dois identificadores de
   * campanha, o pixel funciona sem abrir o resto.
   *
   * Só em formulário PUBLICADO: um rascunho sendo testado não pode gerar evento de lead e sujar a
   * audiência da campanha.
   */
  const linha = await prisma.formulario
    .findUnique({ where: { id }, select: { status: true, integracoes: true } })
    .catch(() => null);
  const rastreamento =
    linha?.status === "publicado" ? rastreamentoDoFormulario(linha.integracoes) : { pixelMeta: null, tagGoogle: null };

  return (
    <>
      {rastreamento.pixelMeta ? (
        <Script id="pixel-meta" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${rastreamento.pixelMeta}');fbq('track','PageView');`}
        </Script>
      ) : null}
      {rastreamento.tagGoogle ? (
        <>
          <Script
            id="gtag-src"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${idDaTagGoogle(rastreamento.tagGoogle)}`}
          />
          <Script id="tag-google" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${idDaTagGoogle(rastreamento.tagGoogle)}');`}
          </Script>
        </>
      ) : null}
      <FormularioPublico id={id} chave={chave ?? null} rastreamento={rastreamento} />
    </>
  );
}
