import { describe, expect, it } from "vitest";

import { nomeLivreParaConversa } from "@/lib/conversas/nome-por-numero";

/**
 * Nome de conversa é CHAVE, não rótulo: `Conversa` tem única `[workspaceId, nome]` e
 * `MensagemExtra.contato` guarda o nome. Devolver um nome ocupado não deixa duas conversas
 * "parecidas" — faz a gravação estourar e a conversa não nascer.
 */
describe("nomeLivreParaConversa", () => {
  it("usa o nome limpo quando ninguém o ocupa", () => {
    expect(nomeLivreParaConversa("Cássia", "5562999990000", [])).toBe("Cássia");
    expect(nomeLivreParaConversa("Cássia", "5562999990000", ["Lucas", "Ana"])).toBe("Cássia");
  });

  it("acrescenta o telefone quando o nome é de outro número", () => {
    expect(nomeLivreParaConversa("Cássia", "5562999990000", ["Cássia"])).toBe(
      "Cássia (+55 (62) 99999-0000)",
    );
  });

  it("não se engana com a caixa das letras", () => {
    // MySQL compara nome sem distinguir maiúscula: devolver "Cássia" com "cássia" ocupado faria a
    // chave única recusar a gravação.
    expect(nomeLivreParaConversa("Cássia", "5562999990000", ["cássia"])).toBe(
      "Cássia (+55 (62) 99999-0000)",
    );
  });

  it("não se engana com espaço sobrando", () => {
    expect(nomeLivreParaConversa("Cássia ", "5562999990000", ["Cássia"])).toBe(
      "Cássia (+55 (62) 99999-0000)",
    );
  });

  it("conta quando o nome com telefone também está ocupado", () => {
    expect(
      nomeLivreParaConversa("Cássia", "5562999990000", ["Cássia", "Cássia (+55 (62) 99999-0000)"]),
    ).toBe("Cássia (+55 (62) 99999-0000) 2");
  });

  it("número que não tem forma de telefone entra como dígitos, sem máscara inventada", () => {
    // LID do WhatsApp: catorze ou quinze dígitos que não são número de ninguém. `telefone.ts`
    // devolve `null` de propósito pra ele, e aqui os dígitos crus são mais honestos que um "+55".
    const nome = nomeLivreParaConversa("Cássia", "131971611123817", ["Cássia"]);
    expect(nome).toBe("Cássia (131971611123817)");
  });

  it("sem nome nenhum, o número vira o nome", () => {
    expect(nomeLivreParaConversa("   ", "5562999990000", [])).toBe("+55 (62) 99999-0000");
  });

  it("nunca devolve um nome que já está em uso", () => {
    const usados = ["Cássia", "Cássia (+55 (62) 99999-0000)"];
    for (let n = 2; n <= 50; n += 1) usados.push(`Cássia (+55 (62) 99999-0000) ${n}`);
    const nome = nomeLivreParaConversa("Cássia", "5562999990000", usados);
    expect(usados).not.toContain(nome);
  });
});
