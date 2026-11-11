"use client";

import type { PreviaDaOrigem } from "@/lib/rastreio/tag-de-origem";
import { useIdioma } from "@/lib/idioma-context";

/**
 * DE ONDE ESTA PESSOA VEIO — a barra do cabeçalho da conversa.
 *
 * "Tem como aparecer na barra superior o criativo em miniatura, o nome do criativo pelo qual essa
 * pessoa veio? Ela viu o criativo e mandou mensagem direta, aí aparece aqui o criativo que ela
 * veio. Se ela veio pelo formulário, aparece 'veio através do formulário tal'. Se ela veio pelo
 * Instagram, clicou lá no link da bio."
 *
 * O DADO JÁ ESTAVA NO BANCO. Quando alguém clica num anúncio de Click-to-WhatsApp, a Meta manda
 * junto da primeira mensagem um bloco `referral` com o título do anúncio, o texto, a imagem, a
 * miniatura e o link de origem. O CRM guarda esse bloco inteiro desde que o rastreio existe e
 * nunca o leu de volta — não é preciso chamar a API da Meta nem configurar nada.
 *
 * UMA LINHA, NÃO UM PAINEL. Ela mora no cabeçalho, acima da primeira mensagem, e é a resposta de
 * uma pergunta que se faz UMA vez ao abrir a conversa: "quem é essa pessoa e de onde ela veio?".
 * Um painel com campanha, conjunto, anúncio e criativo responderia a mesma pergunta ocupando o
 * espaço de quatro mensagens, todo dia, pra ser lido uma vez.
 *
 * SEM RASTREIO, NÃO HÁ BARRA. Escrever "origem: direta" afirmaria que a pessoa chegou sozinha,
 * quando a verdade é que o CRM não sabe de onde ela veio — e as duas coisas levam a decisões
 * opostas sobre onde investir.
 */
export function OrigemDoLeadBarra({ previa }: { previa: PreviaDaOrigem | null | undefined }) {
  const { t: traduzir } = useIdioma();
  if (!previa) return null;

  const corpo = (
    <>
      {previa.miniatura ? (
        /* O criativo. `alt` vazio de propósito: o título está escrito ao lado, em texto, e um
           leitor de tela que lesse os dois diria a mesma coisa duas vezes. */
        // eslint-disable-next-line @next/next/no-img-element
        <img className="origem-barra-foto" src={previa.miniatura} alt="" loading="lazy" />
      ) : null}
      <span className="origem-barra-texto">
        <strong>
          {/* O ponto marca tráfego pago, igual na lista de conversas e no cartão do funil. */}
          {previa.pago ? "• " : ""}
          {traduzir(previa.rotulo)}
          {previa.titulo ? <span className="origem-barra-titulo">{previa.titulo}</span> : null}
        </strong>
        {previa.detalhe ? <span className="origem-barra-detalhe">{previa.detalhe}</span> : null}
      </span>
    </>
  );

  /*
   * COM LINK, A BARRA INTEIRA É O LINK. `source_url` é pra onde o anúncio levava — abrir a peça é
   * o gesto seguinte natural de quem está lendo de onde a pessoa veio.
   *
   * `noreferrer` junto do `noopener`: sem ele o site de destino recebe o endereço do CRM no
   * cabeçalho de referência, e esse endereço carrega o id da conta.
   */
  return previa.link ? (
    <a
      className="origem-barra origem-barra-link"
      href={previa.link}
      target="_blank"
      rel="noopener noreferrer"
      title={traduzir("Abrir a publicação de onde esta pessoa veio")}
    >
      {corpo}
    </a>
  ) : (
    <div className="origem-barra">{corpo}</div>
  );
}
