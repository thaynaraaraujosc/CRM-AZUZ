import { describe, expect, it } from "vitest";

import { envLimpo } from "../env-limpo";

/**
 * A REGRESSÃO QUE ESTES TESTES PRENDEM: horas de investigação por um caractere invisível.
 *
 * Em 12/10/2026 a conexão com a API oficial do WhatsApp falhava com "Falha ao iniciar sessão". Foram
 * verificados, um a um: versão do diálogo, modo do app, domínios autorizados, configuração de
 * login, permissões e cookies de terceiros. Tudo correto. A causa era uma TABULAÇÃO colada no
 * início de `NEXT_PUBLIC_META_CONFIG_ID` — e ela era invisível tanto na tela do CRM (tabulação em
 * HTML é espaço em branco) quanto no painel onde a variável foi colada.
 */
describe("envLimpo", () => {
  it("tira a tabulação colada no começo — o caso real", () => {
    expect(envLimpo("\t1615645803299788")).toBe("1615645803299788");
  });

  it("tira espaço, quebra de linha e retorno de carro das duas pontas", () => {
    expect(envLimpo("  valor  ")).toBe("valor");
    expect(envLimpo("valor\n")).toBe("valor");
    expect(envLimpo("\r\nvalor\r\n")).toBe("valor");
  });

  it("não mexe no que já está limpo", () => {
    expect(envLimpo("1615645803299788")).toBe("1615645803299788");
  });

  // String vazia e variável ausente são a mesma coisa pra quem consome. Deixar `""` passar faria
  // um `if (!valor)` e um `?? padrão` discordarem sobre o mesmo valor.
  it("valor que só tinha espaço vira ausente, não string vazia", () => {
    expect(envLimpo("   ")).toBeUndefined();
    expect(envLimpo("\t\n")).toBeUndefined();
    expect(envLimpo("")).toBeUndefined();
  });

  it("variável ausente continua ausente", () => {
    expect(envLimpo(undefined)).toBeUndefined();
  });

  // Espaço NO MEIO é parte do valor: só as pontas são sujeira de colagem.
  it("não mexe em espaço no meio do valor", () => {
    expect(envLimpo("  um valor com espaço  ")).toBe("um valor com espaço");
  });
});
