import { describe, expect, it } from "vitest";
import {
  API_PERMISSAO,
  API_REGRA_FINA,
  API_SEMPRE_LIBERADA,
  ROTA_PERMISSAO,
  permissaoDoEndereco,
  permissaoFina,
} from "@/lib/permissao-da-rota";
import { TODAS_PERMISSOES_IDS } from "@/lib/configuracoes/permissoes";

/**
 * A TRANCA, E POR QUE ELA PRECISA DE TESTE.
 *
 * "Fiz um acesso pra um funcionário, coloquei que ele não podia ficar com os dois WhatsApp, e ele
 * me mandou o print: tá com acesso do WhatsApp, do Insta, de coisas que eu tinha tirado."
 *
 * O bloqueio por permissão pulava `/api` — a tela era barrada e os dados não. Estes testes
 * existem pra que ninguém volte a abrir essa porta sem perceber: um `/api` novo que esqueça de
 * entrar no mapa continua liberado, e isso é uma decisão que tem que ser consciente.
 */
describe("permissaoDoEndereco", () => {
  it("exige a permissão do módulo nas telas", () => {
    expect(permissaoDoEndereco("/instagram")).toBe("insta_visualizar");
    expect(permissaoDoEndereco("/conversas")).toBe("wa_visualizar");
    expect(permissaoDoEndereco("/funil/qualquer-coisa")).toBe("funil_visualizar");
  });

  it("exige a MESMA permissão na API do módulo — era aqui que passava tudo", () => {
    expect(permissaoDoEndereco("/api/instagram")).toBe("insta_visualizar");
    expect(permissaoDoEndereco("/api/instagram/conversas")).toBe("insta_visualizar");
    expect(permissaoDoEndereco("/api/conversas")).toBe("wa_visualizar");
    expect(permissaoDoEndereco("/api/mensagens-extra?contato=x")).toBe("wa_visualizar");
  });

  it("casa pelo prefixo MAIS LONGO, não pelo primeiro que aparecer", () => {
    // Sem isso, qual regra vale depende da ordem em que o objeto foi escrito.
    expect(permissaoDoEndereco("/api/integracoes/numeros")).toBe("config_visualizar");
  });

  it("deixa passar o que toda pessoa logada precisa", () => {
    for (const livre of API_SEMPRE_LIBERADA) {
      expect(permissaoDoEndereco(livre), livre).toBeNull();
      expect(permissaoDoEndereco(`${livre}/algo`), livre).toBeNull();
    }
  });

  it("não confunde um prefixo com um endereço que só começa igual", () => {
    // `/api/contatos-publicos` não é `/api/contatos`: casar por texto solto pegaria os dois.
    expect(permissaoDoEndereco("/api/contatos")).toBe("contatos_visualizar");
    expect(permissaoDoEndereco("/api/contatos-publicos")).toBeNull();
  });

  it("endereço fora do mapa fica livre, e isso é deliberado", () => {
    // Bloquear por padrão quebraria o CRM a cada rota nova; o teste acima é que obriga a pensar.
    expect(permissaoDoEndereco("/api/alguma-coisa-nova")).toBeNull();
  });

  it("toda permissão citada existe de verdade nos dois mapas", () => {
    const todas = new Set([...Object.values(ROTA_PERMISSAO), ...Object.values(API_PERMISSAO)]);
    for (const p of todas) {
      expect(p, p).toMatch(/_visualizar$/);
    }
  });

  it("todo módulo com tela restringível tem a API dele restringida também", () => {
    // É a regra que fecha o buraco: tela barrada com API aberta não protege nada.
    const naTela = new Set(Object.values(ROTA_PERMISSAO));
    const naApi = new Set(Object.values(API_PERMISSAO));
    for (const permissao of naTela) {
      expect(naApi.has(permissao), `${permissao} não tem nenhuma API protegida`).toBe(true);
    }
  });
});

/**
 * AS PERMISSÕES FINAS. "Faz as permissões finas."
 *
 * Até aqui valia só "vê o módulo" ou "não vê" — quem via o WhatsApp conseguia, pela API, enviar
 * mensagem e apagar conversa. As caixinhas de Responder e Excluir eram gravadas e nenhuma rota as
 * consultava.
 */
describe("permissaoFina", () => {
  it("ler não pede nada além do módulo", () => {
    expect(permissaoFina("/api/conversas/enviar", "GET")).toBeNull();
    expect(permissaoFina("/api/contatos", "GET")).toBeNull();
  });

  it("enviar mensagem pede Responder, nos dois canais do WhatsApp", () => {
    expect(permissaoFina("/api/conversas/enviar", "POST")).toBe("wa_responder");
    expect(permissaoFina("/api/integracoes/whatsapp-nao-oficial/enviar", "POST")).toBe("wa_responder");
    expect(permissaoFina("/api/integracoes/meta/whatsapp/enviar", "POST")).toBe("wa_responder");
  });

  it("o endereço mais específico ganha do mais geral", () => {
    // Sem isso, enviar mensagem passaria a exigir permissão de INTEGRAÇÃO, porque
    // `/api/integracoes/meta/whatsapp/enviar` começa com `/api/integracoes`.
    expect(permissaoFina("/api/integracoes/meta/whatsapp/enviar", "POST")).toBe("wa_responder");
    expect(permissaoFina("/api/integracoes/meta/desconectar", "POST")).toBe("config_integracoes");
  });

  it("`[id]` casa com um trecho qualquer, e não confunde com a coleção", () => {
    // Apagar um contato não pode pedir a permissão de CRIAR contato.
    expect(permissaoFina("/api/contatos", "POST")).toBe("contatos_criar");
    expect(permissaoFina("/api/contatos/abc123", "DELETE")).toBe("contatos_excluir");
    expect(permissaoFina("/api/contatos/abc123", "PATCH")).toBe("contatos_editar");
    expect(permissaoFina("/api/contatos/abc123", "POST")).toBeNull();
  });

  it("equipe separa convidar, editar e remover", () => {
    expect(permissaoFina("/api/equipe", "POST")).toBe("equipe_convidar");
    expect(permissaoFina("/api/equipe/x1", "PATCH")).toBe("equipe_editar");
    expect(permissaoFina("/api/equipe/x1", "DELETE")).toBe("equipe_remover");
  });

  it("endereço sem regra própria devolve null, e aí vale só a do módulo", () => {
    // `/api/funis` PUT grava o quadro inteiro (etapa, ordem e cartão juntos): restringir no chute
    // quebraria a conta de quem tem a permissão certa.
    expect(permissaoFina("/api/funis", "PUT")).toBeNull();
    expect(permissaoFina("/api/funis/mover", "POST")).toBe("funil_mover_negocios");
  });

  it("toda permissão fina citada existe no catálogo de permissões", () => {
    const todas = new Set(Object.values(API_REGRA_FINA).flatMap((r) => Object.values(r)));
    for (const p of todas) {
      expect(TODAS_PERMISSOES_IDS, p).toContain(p);
    }
  });
});
