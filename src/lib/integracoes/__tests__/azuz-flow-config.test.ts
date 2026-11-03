import { describe, expect, it } from "vitest";

import { CONFIG_PADRAO, confirmacaoDoFormulario, lerConfigDoFlow } from "../azuz-flow-config";

/**
 * Isto lê um JSON que veio do banco, e o que veio do banco pode ter qualquer forma: linha escrita
 * por uma versão anterior, valor digitado errado por uma rota, conteúdo corrompido.
 *
 * O que está em jogo não é a opção: é a ENTREGA DO LEAD. Esta leitura acontece no meio dela, e um
 * `throw` aqui transformaria uma preferência de tela num lead perdido — com o Flow recebendo 500 e
 * repetindo a entrega.
 */
describe("lendo a configuração guardada", () => {
  it("valor válido passa", () => {
    expect(lerConfigDoFlow({ canal: "qrcode" })).toMatchObject({ canal: "qrcode" });
  });

  it("nada guardado vira o padrão", () => {
    expect(lerConfigDoFlow(undefined)).toEqual(CONFIG_PADRAO);
    expect(lerConfigDoFlow(null)).toEqual(CONFIG_PADRAO);
  });

  it("a confirmação nasce DESLIGADA", () => {
    /*
     * Ligada por padrão significaria toda empresa que nunca abriu essa tela começando a mandar
     * mensagem sozinha, pra quem nunca escreveu, por um número que pode ser bloqueado por
     * denúncia. Não é timidez: é que ninguém escolheu isso.
     */
    expect(CONFIG_PADRAO.confirmacao.ativa).toBe(false);
    expect(lerConfigDoFlow({}).confirmacao.ativa).toBe(false);
  });

  it("só o booleano verdadeiro liga", () => {
    // "truthy" aqui é ligar por acidente — e ligar por acidente é mandar mensagem pra gente de
    // verdade.
    for (const quase of ["true", 1, "sim", {}]) {
      expect(lerConfigDoFlow({ confirmacao: { ativa: quase } }).confirmacao.ativa).toBe(false);
    }
    expect(lerConfigDoFlow({ confirmacao: { ativa: true } }).confirmacao.ativa).toBe(true);
  });

  it("texto apagado volta pro padrão, em vez de virar mensagem em branco", () => {
    for (const vazio of ["", "   ", 42, null]) {
      expect(lerConfigDoFlow({ confirmacao: { texto: vazio } }).confirmacao.texto).toBe(
        CONFIG_PADRAO.confirmacao.texto,
      );
    }
  });

  it("o padrão é 'só oficial': exatamente o que o CRM fazia antes desta opção existir", () => {
    /*
     * O padrão vale pra toda empresa que nunca abriu essa tela. `automatico` passaria a mandar lead
     * pelo QR em contas onde ninguém pediu — e o envio pelo QR ainda não tem ritmo, janela de
     * horário nem teto diário.
     *
     * E tem o efeito indireto: o que segura uma automação antiga de "formulário preenchido" é a
     * AUSÊNCIA de conversa. Dar conversa por padrão faria disparar mensagens que hoje falham em
     * silêncio, pelo número que pode ser banido.
     */
    expect(CONFIG_PADRAO.canal).toBe("oficial");
  });

  it("lixo não derruba a entrega do lead: volta pro padrão", () => {
    for (const lixo of ["", 42, [], { canal: "telepatia" }, { canal: null }, { outra: "coisa" }]) {
      expect(lerConfigDoFlow(lixo)).toEqual(CONFIG_PADRAO);
    }
    // Inclusive quando `confirmacao` veio com forma errada.
    expect(lerConfigDoFlow({ confirmacao: "ligada" })).toEqual(CONFIG_PADRAO);
  });
});

describe("confirmação por formulário", () => {
  /*
   * A DECISÃO QUE IMPEDE UM APAGÃO SILENCIOSO. A agência que já tem a confirmação ligada, com um
   * texto escrito há meses, continua exatamente como está — para todos os formulários — até
   * escolher mudar um deles. Se a geral deixasse de valer no dia em que a configuração por
   * formulário nasceu, a confirmação pararia de sair sem erro em lugar nenhum.
   */
  it("segue a configuração geral quando o formulário não foi configurado à parte", () => {
    const config = lerConfigDoFlow({ confirmacao: { ativa: true, texto: "Geral" } });
    expect(confirmacaoDoFormulario(config, "f1")).toEqual({ ativa: true, texto: "Geral", doFormulario: false });
    expect(confirmacaoDoFormulario(config, null)).toEqual({ ativa: true, texto: "Geral", doFormulario: false });
  });

  it("o formulário configurado à parte manda", () => {
    const config = lerConfigDoFlow({
      confirmacao: { ativa: true, texto: "Geral" },
      porFormulario: { f1: { confirmacao: { ativa: false, texto: "Só deste" } } },
    });
    expect(confirmacaoDoFormulario(config, "f1")).toEqual({ ativa: false, texto: "Só deste", doFormulario: true });
    // E o vizinho não é afetado.
    expect(confirmacaoDoFormulario(config, "f2").texto).toBe("Geral");
  });

  it("ligar por acidente não acontece: só o booleano verdadeiro liga", () => {
    const config = lerConfigDoFlow({ porFormulario: { f1: { confirmacao: { ativa: "sim", texto: "x" } } } });
    expect(confirmacaoDoFormulario(config, "f1").ativa).toBe(false);
  });

  it("texto apagado no campo volta pro padrão, em vez de mandar mensagem em branco", () => {
    const config = lerConfigDoFlow({ porFormulario: { f1: { confirmacao: { ativa: true, texto: "   " } } } });
    expect(confirmacaoDoFormulario(config, "f1").texto).toBe(CONFIG_PADRAO.confirmacao.texto);
  });

  it("descarta entrada sem forma de configuração, em vez de estourar", () => {
    const config = lerConfigDoFlow({ porFormulario: { "": { confirmacao: {} }, f1: "nada", f2: null } });
    expect(config.porFormulario).toEqual({});
  });

  it("não quebra quando o guardado não é objeto", () => {
    expect(lerConfigDoFlow({ porFormulario: "nada" }).porFormulario).toEqual({});
    expect(lerConfigDoFlow({}).porFormulario).toEqual({});
  });
});
