import { describe, expect, it } from "vitest";

import { classificarErroMeta } from "@/lib/integracoes/instagram-login";

/**
 * A Meta devolve mensagens técnicas em inglês, e o que fazer muda completamente conforme o motivo:
 * limite de chamadas passa sozinho, token vencido exige reconectar. Tratar tudo como "erro ao
 * enviar" deixava quem usa o CRM sem saber se devia esperar ou agir.
 */
describe("classificarErroMeta", () => {
  it("reconhece limite de chamadas", () => {
    expect(classificarErroMeta("(#4) Application request limit reached").motivo).toBe("limite_de_chamadas");
  });

  it("reconhece token expirado", () => {
    expect(classificarErroMeta("Error validating access token: Session has expired").motivo).toBe("token_expirado");
  });

  it("reconhece permissão faltando", () => {
    expect(classificarErroMeta("(#200) Requires instagram_business_manage_comments permission").motivo).toBe(
      "permissao_removida",
    );
  });

  it("reconhece a janela de 24h fechada", () => {
    expect(
      classificarErroMeta("This message is sent outside of allowed window").motivo,
    ).toBe("fora_da_janela");
  });

  it("reconhece conteúdo apagado", () => {
    expect(classificarErroMeta("Object with ID does not exist").motivo).toBe("conteudo_indisponivel");
  });

  it("devolve a mensagem original quando não reconhece", () => {
    const resultado = classificarErroMeta("Algo bem específico aconteceu");
    expect(resultado.motivo).toBe("desconhecido");
    expect(resultado.explicacao).toBe("Algo bem específico aconteceu");
  });

  it("toda classificação conhecida vem com explicação em português", () => {
    const casos = ["(#4) rate limit", "token expired", "(#200) permission", "outside window", "deleted"];
    for (const caso of casos) {
      const { explicacao } = classificarErroMeta(caso);
      expect(explicacao.length).toBeGreaterThan(10);
      expect(explicacao).not.toBe(caso);
    }
  });
});
