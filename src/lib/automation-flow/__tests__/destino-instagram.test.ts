import { describe, expect, it } from "vitest";

import {
  blocoEscolheDestinoNoInstagram,
  destinoDoBloco,
  DESTINOS_INSTAGRAM,
  rotuloDoCanalComDestino,
} from "@/components/automation-flow/forms/canais";
import { validarFluxo } from "../validacao";
import type { FluxoAutomacao } from "../types";

/**
 * ONDE O ROBÔ ESCREVE: Direct ou embaixo do comentário.
 *
 * "Lá em canal está escrito Instagram Direct, mas às vezes vai ser comentário." O cartão afirmava
 * Direct em cima de qualquer mensagem, e o bloco de texto só sabia mandar Direct. Agora é escolha —
 * e escolha tem três lados pra testar: o padrão (fluxo antigo não pode mudar de comportamento), o
 * limite (mídia e botão não existem em comentário) e o aviso (resposta pública sem gatilho de
 * comentário é um passo que nunca acontece).
 */

function fluxo(nodes: unknown[]): FluxoAutomacao {
  return {
    id: "f1",
    nome: "Robô",
    area: "social",
    status: "publicado",
    ativa: true,
    nodes,
    edges: [],
    versaoAtual: 1,
    configuracoes: {},
  } as unknown as FluxoAutomacao;
}

const gatilhoDeComentario = {
  id: "g1",
  type: "comentario_instagram",
  category: "gatilho",
  position: { x: 0, y: 0 },
  data: {},
};

const gatilhoDeDirect = {
  id: "g1",
  type: "instagram_direct_recebido",
  category: "gatilho",
  position: { x: 0, y: 0 },
  data: {},
};

function mensagemPublica(id = "m1") {
  return {
    id,
    type: "mensagem_texto",
    category: "mensagem",
    titulo: "Resposta pública",
    position: { x: 1, y: 0 },
    data: { canal: "instagram", texto: "Mandei no seu Direct!", destino: "comentario" },
  };
}

describe("o destino gravado no bloco", () => {
  /* O PADRÃO É DIRECT, e isto é compatibilidade: todo fluxo publicado antes desta escolha existir
     tem `destino` ausente, e tem que continuar mandando Direct exatamente como mandava. */
  it("ausente quer dizer Direct", () => {
    expect(destinoDoBloco(undefined)).toBe("direct");
    expect(destinoDoBloco({})).toBe("direct");
    expect(destinoDoBloco({ canal: "instagram", texto: "Oi" })).toBe("direct");
  });

  it("lê comentário quando está gravado", () => {
    expect(destinoDoBloco({ destino: "comentario" })).toBe("comentario");
  });

  /* Valor estranho (fluxo mexido à mão, versão antiga de outro formato) cai no padrão em vez de
     virar um terceiro estado que nenhuma tela sabe desenhar. */
  it("valor desconhecido cai no Direct", () => {
    expect(destinoDoBloco({ destino: "story" })).toBe("direct");
    expect(destinoDoBloco({ destino: 7 })).toBe("direct");
  });
});

describe("o rótulo da linha do canal", () => {
  it("diz o canal e onde ele escreve", () => {
    expect(rotuloDoCanalComDestino("Instagram", "direct")).toBe("Instagram (Direct)");
    expect(rotuloDoCanalComDestino("Instagram", "comentario")).toBe("Instagram (comentário)");
  });

  it("os dois destinos têm rótulo e explicação", () => {
    expect(DESTINOS_INSTAGRAM).toHaveLength(2);
    DESTINOS_INSTAGRAM.forEach((d) => {
      expect(d.label.trim()).not.toBe("");
      expect(d.descricao.trim()).not.toBe("");
      expect(d.curto.trim()).not.toBe("");
    });
  });
});

describe("quem pode escolher o destino", () => {
  /*
   * SÓ O TEXTO PURO.
   *
   * A API de comentários da Meta leva texto e nada mais. Oferecer "comentário" num bloco de imagem
   * ou de botões seria o botão falso que `capacidades.ts` existe pra impedir: a pessoa montaria o
   * fluxo em volta de um passo que a Meta recusa na hora do envio.
   */
  it("o bloco de texto escolhe", () => {
    expect(blocoEscolheDestinoNoInstagram("mensagem_texto")).toBe(true);
  });

  it("mídia e botão não escolhem", () => {
    expect(blocoEscolheDestinoNoInstagram("mensagem_imagem")).toBe(false);
    expect(blocoEscolheDestinoNoInstagram("mensagem_video")).toBe(false);
    expect(blocoEscolheDestinoNoInstagram("mensagem_audio")).toBe(false);
    expect(blocoEscolheDestinoNoInstagram("mensagem_documento")).toBe(false);
    expect(blocoEscolheDestinoNoInstagram("mensagem_botoes")).toBe(false);
    expect(blocoEscolheDestinoNoInstagram("mensagem_lista")).toBe(false);
  });
});

describe("resposta pública sem gatilho de comentário", () => {
  const AVISO = "responde EM PÚBLICO";

  it("avisa quando o fluxo só começa por Direct", () => {
    const problemas = validarFluxo(fluxo([gatilhoDeDirect, mensagemPublica()]));
    const aviso = problemas.find((p) => p.mensagem.includes(AVISO));
    expect(aviso).toBeTruthy();
    expect(aviso?.severidade).toBe("aviso");
    expect(aviso?.nodeId).toBe("m1");
  });

  it("não avisa quando o gatilho é de comentário", () => {
    const problemas = validarFluxo(fluxo([gatilhoDeComentario, mensagemPublica()]));
    expect(problemas.some((p) => p.mensagem.includes(AVISO))).toBe(false);
  });

  /* Comentário de live também é comentário: tem id de comentário pra pendurar a resposta. */
  it("comentário de live conta como gatilho de comentário", () => {
    const live = { ...gatilhoDeComentario, type: "instagram_comentario_live" };
    const problemas = validarFluxo(fluxo([live, mensagemPublica()]));
    expect(problemas.some((p) => p.mensagem.includes(AVISO))).toBe(false);
  });

  /*
   * DOIS GATILHOS É ESCOLHA LEGÍTIMA.
   *
   * Um fluxo pode acordar por comentário E por Direct. A resposta pública funciona pra metade das
   * execuções e é ignorada na outra, o que pode ser exatamente o desenho pretendido — por isso o
   * aviso some assim que existe um gatilho de comentário, e nunca é erro.
   */
  it("com gatilho de comentário e de Direct juntos, não avisa", () => {
    const problemas = validarFluxo(
      fluxo([gatilhoDeComentario, { ...gatilhoDeDirect, id: "g2" }, mensagemPublica()]),
    );
    expect(problemas.some((p) => p.mensagem.includes(AVISO))).toBe(false);
  });

  it("bloco em Direct nunca gera o aviso", () => {
    const direto = { ...mensagemPublica(), data: { canal: "instagram", texto: "Oi" } };
    const problemas = validarFluxo(fluxo([gatilhoDeDirect, direto]));
    expect(problemas.some((p) => p.mensagem.includes(AVISO))).toBe(false);
  });
});
