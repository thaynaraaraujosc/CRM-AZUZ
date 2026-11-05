import { describe, expect, it } from "vitest";

import { motivoParaNaoIniciarConversa } from "../enviar-pelo-canal";

const CERTO = { canaisPermitidos: undefined, numero: "(63) 98494-1500", consentimento: true };

describe("começar conversa com quem nunca escreveu", () => {
  it("com número e consentimento, pode", () => {
    expect(motivoParaNaoIniciarConversa(CERTO)).toBeNull();
  });

  it("sem número no cadastro, não há pra onde mandar", () => {
    expect(motivoParaNaoIniciarConversa({ ...CERTO, numero: null })).toMatch(/não tem número/);
    expect(motivoParaNaoIniciarConversa({ ...CERTO, numero: "   " })).toMatch(/não tem número/);
  });

  it("número incompleto não vira envio", () => {
    // Oito dígitos é telefone antigo sem DDD: mandar assim erraria de pessoa.
    expect(motivoParaNaoIniciarConversa({ ...CERTO, numero: "98494150" })).toMatch(/incompleto/);
  });

  it("quem recusou WhatsApp não recebe por este caminho", () => {
    /*
     * A TRAVA QUE MAIS IMPORTA.
     *
     * Quem escreveu primeiro consentiu na prática; quem nunca escreveu, não — e é justamente
     * deste caminho que sai a mensagem pra quem nunca escreveu. É a mesma regra do disparo em
     * massa, pelo mesmo motivo.
     */
    expect(motivoParaNaoIniciarConversa({ ...CERTO, consentimento: false })).toBeTruthy();
  });

  it("consentimento ainda não respondido não bloqueia", () => {
    // `null` é "ninguém perguntou", e não "a pessoa disse não". Tratar como recusa calaria o robô
    // pra toda a base antiga, que foi cadastrada antes de o campo existir.
    expect(motivoParaNaoIniciarConversa({ ...CERTO, consentimento: null })).toBeNull();
  });

  it("com o bloco marcado só pra Instagram, não começa conversa nenhuma", () => {
    // A Meta não deixa escrever no Direct pra quem nunca mandou mensagem, e não existe modelo
    // aprovado pra isso. Dizer o motivo é melhor do que falhar com o erro cru da Meta.
    expect(motivoParaNaoIniciarConversa({ ...CERTO, canaisPermitidos: ["instagram"] })).toMatch(/WhatsApp/);
  });

  it("com WhatsApp entre os canais marcados, segue", () => {
    expect(motivoParaNaoIniciarConversa({ ...CERTO, canaisPermitidos: ["whatsapp", "instagram"] })).toBeNull();
  });

  it("sem nenhum canal marcado, vale qualquer um: é o padrão do bloco", () => {
    expect(motivoParaNaoIniciarConversa({ ...CERTO, canaisPermitidos: [] })).toBeNull();
  });
});
