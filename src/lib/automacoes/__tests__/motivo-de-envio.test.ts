import { describe, expect, it } from "vitest";

import { semCaminhoAteOContato } from "../motivo-de-envio";

/**
 * DUAS FAMÍLIAS DE FALHA, TRATADAS AO CONTRÁRIO UMA DA OUTRA.
 *
 * Falta de caminho (sem conversa, janela fechada) é o estado normal de quem acabou de comentar e
 * nunca mandou mensagem — e pra ela existe a resposta privada ao comentário. Qualquer outra falha
 * (token vencido, conta fora) precisa chegar a quem conserta, e tentar por outro caminho seria
 * mascará-la.
 */
describe("semCaminhoAteOContato", () => {
  it("conversa sem destinatário é falta de caminho", () => {
    expect(semCaminhoAteOContato("conversa sem destinatário")).toBe(true);
  });

  it("a janela de 24 horas fechada é falta de caminho", () => {
    expect(
      semCaminhoAteOContato(
        "a janela de 24 horas do Instagram fechou. Só dá pra escrever até 24 horas depois da última mensagem da pessoa, e no Direct não existe modelo aprovado pra retomar.",
      ),
    ).toBe(true);
  });

  /* Estes não são falta de caminho: insistir por outro caminho esconderia o problema de quem pode
     resolvê-lo. */
  it("conta desconectada e erros do provedor não são", () => {
    expect(semCaminhoAteOContato("Instagram não conectado")).toBe(false);
    expect(semCaminhoAteOContato("mensagem vazia")).toBe(false);
    expect(semCaminhoAteOContato("conversa de grupo")).toBe(false);
    expect(semCaminhoAteOContato("Error validating access token")).toBe(false);
  });

  it("sem motivo, não é", () => {
    expect(semCaminhoAteOContato(undefined)).toBe(false);
    expect(semCaminhoAteOContato("")).toBe(false);
  });
});
