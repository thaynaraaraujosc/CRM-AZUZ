import { describe, expect, it } from "vitest";

import { BLOCOS_DISPONIVEIS, GRUPOS_BIBLIOTECA } from "@/lib/automation-flow/blocos";
import {
  CAPACIDADES,
  GRUPOS_DA_AREA,
  grupoValeNaArea,
  blocoValeNoCanal,
  canaisDisponiveis,
  blocoValeNaArea,
  canaisDaArea,
  canalDaConexao,
  esperaCabeNaJanela,
  formatosDePergunta,
  ressalvaDoBloco,
} from "../capacidades";

/**
 * Estes testes existem por causa de uma regra de produto, não de aritmética: o CRM não pode
 * oferecer um recurso que o canal não tem. Um `botoes: 3` colocado sem querer no Instagram não
 * quebra build nenhum e não falha em tela nenhuma. Só aparece quando o cliente monta o fluxo, o
 * lead recebe uma mensagem sem botão e ninguém entende por que a automação travou.
 */
describe("nada de botão falso", () => {
  it("não oferece botão nem lista onde o provedor não garante", () => {
    // QR Code: o WhatsApp derruba botão vindo de conexão não oficial, e a mensagem chegaria vazia.
    expect(CAPACIDADES.whatsapp_qrcode.botoes).toBe(0);
    expect(CAPACIDADES.whatsapp_qrcode.lista).toBe(0);
    // Instagram tem opção clicável (resposta rápida), mas não tem lista interativa.
    expect(CAPACIDADES.instagram.lista).toBe(0);
  });

  it("chama a opção clicável pelo nome que o canal usa", () => {
    // Prometer "botão" no Direct e entregar resposta rápida é o mesmo defeito do botão falso, só
    // que mais sutil: a pessoa espera a bolha e recebe uma sugestão que some depois de usada.
    expect(CAPACIDADES.whatsapp_oficial.nomeDoBotao).toBe("botões de resposta");
    expect(CAPACIDADES.instagram.nomeDoBotao).toBe("respostas rápidas");
  });

  it("esconde o bloco de botões nos canais sem botão", () => {
    expect(blocoValeNoCanal("mensagem_botoes", "whatsapp_oficial")).toBe(true);
    expect(blocoValeNoCanal("mensagem_botoes", "instagram")).toBe(true);
    expect(blocoValeNoCanal("mensagem_botoes", "whatsapp_qrcode")).toBe(false);
  });

  it("esconde a lista interativa fora do WhatsApp oficial", () => {
    expect(blocoValeNoCanal("mensagem_lista", "whatsapp_oficial")).toBe(true);
    expect(blocoValeNoCanal("mensagem_lista", "instagram")).toBe(false);
    expect(blocoValeNoCanal("mensagem_lista", "whatsapp_qrcode")).toBe(false);
  });

  it("deixa passar o bloco que não depende de canal", () => {
    // Mover de etapa não tem nada com o canal. Ausência na tabela significa "vale em qualquer um".
    expect(blocoValeNoCanal("alterar_etapa", "instagram")).toBe(true);
    expect(blocoValeNoCanal("criar_tarefa", "email")).toBe(true);
  });

  it("mantém o menu numerado como o formato que funciona em todo lugar", () => {
    expect(formatosDePergunta("instagram")[0]).toBe("menu_numerado");
    expect(formatosDePergunta("whatsapp_qrcode")).not.toContain("botoes");
    expect(formatosDePergunta("whatsapp_oficial")).toContain("botoes");
    expect(formatosDePergunta("instagram")).not.toContain("lista_interativa");
  });
});

describe("TikTok declarado e indisponível", () => {
  it("fica fora da lista de conexões oferecidas", () => {
    expect(CAPACIDADES.tiktok.disponivel).toBe(false);
    expect(canaisDisponiveis().map((c) => c.id)).not.toContain("tiktok");
  });

  it("diz por que não está lá, em vez de sumir sem explicação", () => {
    expect(CAPACIDADES.tiktok.motivoIndisponivel).toBeTruthy();
  });

  it("recusa qualquer bloco enquanto não houver integração", () => {
    expect(blocoValeNoCanal("mensagem_texto", "tiktok")).toBe(false);
  });
});

describe("janela de envio", () => {
  it("avisa quando a espera passa das 24 horas do Instagram", () => {
    expect(esperaCabeNaJanela("instagram", 120).cabe).toBe(true);
    const longa = esperaCabeNaJanela("instagram", 3 * 24 * 60);
    expect(longa.cabe).toBe(false);
    if (!longa.cabe) expect(longa.aviso).toContain("24 horas");
  });

  it("sugere modelo aprovado só onde ele existe", () => {
    const oficial = esperaCabeNaJanela("whatsapp_oficial", 3 * 24 * 60);
    expect(oficial.cabe).toBe(false);
    if (!oficial.cabe) expect(oficial.aviso).toContain("modelo aprovado");

    const direct = esperaCabeNaJanela("instagram", 3 * 24 * 60);
    if (!direct.cabe) expect(direct.aviso).not.toContain("modelo aprovado");
  });

  it("não inventa janela no QR Code", () => {
    expect(esperaCabeNaJanela("whatsapp_qrcode", 30 * 24 * 60).cabe).toBe(true);
  });
});

describe("canal da conexão gravada", () => {
  it("traduz o que o webhook grava", () => {
    expect(canalDaConexao("meta_instagram:17841400000")).toBe("instagram");
    expect(canalDaConexao("whatsapp_nao_oficial:5511999999999")).toBe("whatsapp_qrcode");
    expect(canalDaConexao("whatsapp_baileys:5511999999999")).toBe("whatsapp_qrcode");
    expect(canalDaConexao("meta_whatsapp:123")).toBe("whatsapp_oficial");
    expect(canalDaConexao(null)).toBeNull();
  });
});

describe("cada gatilho só na área onde ele acontece", () => {
  it("mantém os gatilhos próprios do Instagram fora do robô comercial", () => {
    // Story, menção e publicação compartilhada não existem no WhatsApp. Oferecê-los num robô de
    // funil seria o mesmo defeito do botão falso, na ponta do gatilho: a pessoa monta o fluxo e
    // fica esperando um evento que nunca vai chegar naquele canal.
    for (const tipo of [
      "instagram_story_respondido",
      "instagram_mencao_story",
      "instagram_publicacao_compartilhada",
      "instagram_midia_recebida",
      "instagram_reacao_recebida",
      "instagram_resposta_comentario",
      "comentario_instagram",
    ] as const) {
      expect(blocoValeNaArea(tipo, "comercial")).toBe(false);
      expect(blocoValeNaArea(tipo, "social")).toBe(true);
    }
  });

  it("mantém modelo aprovado e e-mail fora do robô social", () => {
    expect(blocoValeNaArea("mensagem_modelo_whatsapp", "comercial")).toBe(true);
    expect(blocoValeNaArea("mensagem_modelo_whatsapp", "social")).toBe(false);
    expect(blocoValeNaArea("mensagem_email", "comercial")).toBe(true);
    expect(blocoValeNaArea("mensagem_email", "social")).toBe(false);
  });

  it("não deixa nenhum bloco de Instagram no construtor do funil", () => {
    // A varredura completa, e não uma lista escrita à mão: bloco novo do grupo Instagram que
    // esqueça de declarar o recurso que exige aparece aqui, e não na tela do cliente.
    const doInstagram = BLOCOS_DISPONIVEIS.filter((b) => b.grupo === "instagram");
    expect(doInstagram.length).toBeGreaterThan(0);
    expect(doInstagram.filter((b) => blocoValeNaArea(b.tipo, "comercial"))).toEqual([]);
  });

  it("deixa as ações de CRM nas duas áreas", () => {
    // É o ponto de ter um motor só: um robô de comentário do Instagram move o lead no funil, cria
    // tarefa e troca o responsável igual ao robô comercial.
    for (const tipo of ["alterar_etapa", "criar_tarefa", "adicionar_etiqueta", "encaminhar_humano"] as const) {
      expect(blocoValeNaArea(tipo, "comercial")).toBe(true);
      expect(blocoValeNaArea(tipo, "social")).toBe(true);
    }
  });

  it("avisa quando o bloco só vale em parte das conexões da área", () => {
    // Botão existe no oficial e não existe no QR Code. Esconder tiraria o recurso de quem tem;
    // mostrar calado enganaria quem não tem. A saída é mostrar com a ressalva.
    expect(ressalvaDoBloco("mensagem_botoes", "comercial")).toContain("WhatsApp oficial");
    expect(ressalvaDoBloco("mensagem_texto", "comercial")).toBeNull();
  });

  it("na área social só o Instagram entra enquanto o TikTok não existir", () => {
    expect(canaisDaArea("social").map((c) => c.id)).toEqual(["instagram"]);
    expect(canaisDaArea("comercial").map((c) => c.id)).toContain("whatsapp_oficial");
  });
});

describe("o que cada área mostra na biblioteca", () => {
  it("no social, o Instagram vem primeiro", () => {
    // É por ele que toda automação daquela área começa. No meio da lista, entre "WhatsApp" e
    // "Ações do CRM", procurar o começo do robô vira uma caçada.
    expect(GRUPOS_DA_AREA.social[0]).toBe("instagram");
  });

  it("o social não oferece os gatilhos genéricos nem os grupos de WhatsApp", () => {
    // "Lead criado" funcionaria tecnicamente num robô social, mas não é assim que se pensa uma
    // automação de Instagram: lá o começo é sempre um evento pontual da rede. As duas famílias na
    // mesma tela fazem alguém montar um robô de funil achando que montou um de Instagram.
    for (const grupo of ["gatilhos", "whatsapp", "whatsapp_oficial"]) {
      expect(grupoValeNaArea(grupo, "social")).toBe(false);
    }
  });

  it("o comercial não oferece o grupo do Instagram", () => {
    expect(grupoValeNaArea("instagram", "comercial")).toBe(false);
  });

  it("as ações do CRM continuam nas duas", () => {
    for (const grupo of ["crm", "mensagens", "aguardar", "decisoes", "encerramento"]) {
      expect(grupoValeNaArea(grupo, "comercial")).toBe(true);
      expect(grupoValeNaArea(grupo, "social")).toBe(true);
    }
  });

  it("todo grupo listado por área existe de verdade na biblioteca", () => {
    // Um id escrito errado aqui apagaria o grupo inteiro da tela em silêncio.
    const existentes = new Set(GRUPOS_BIBLIOTECA.map((g) => g.id));
    for (const area of ["comercial", "social"] as const) {
      for (const grupo of GRUPOS_DA_AREA[area]) expect(existentes.has(grupo as never)).toBe(true);
    }
  });
});
