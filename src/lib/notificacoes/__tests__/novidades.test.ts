import { describe, expect, it } from "vitest";

import { conversasComNovidade, fotoDasConversas, type ConversaParaAviso } from "@/lib/notificacoes/novidades";

function conversa(id: string, naoLidas: number): ConversaParaAviso {
  return { id, nome: `Contato ${id}`, canal: "WhatsApp", naoLidas };
}

describe("conversasComNovidade", () => {
  /*
   * O DEFEITO QUE ISTO PRENDE. O provider começa com a lista vazia e a foto era tirada aí: quando
   * os dados chegavam, toda conversa por ler tinha `antes = 0` e virava aviso. Abrir o CRM com
   * doze não lidas disparava doze toasts e doze apitos — de mensagens de ontem.
   */
  it("sem foto anterior, nada é novidade: abrir o CRM não é evento", () => {
    const lista = [conversa("a", 3), conversa("b", 7), conversa("c", 0)];
    expect(conversasComNovidade(null, lista)).toEqual([]);
  });

  it("avisa quando o número de não lidas sobe", () => {
    const antes = fotoDasConversas([conversa("a", 1), conversa("b", 0)]);
    const agora = [conversa("a", 2), conversa("b", 0)];
    expect(conversasComNovidade(antes, agora).map((c) => c.id)).toEqual(["a"]);
  });

  it("não avisa quando o número cai ou fica igual: ler uma conversa não é mensagem nova", () => {
    const antes = fotoDasConversas([conversa("a", 5), conversa("b", 2)]);
    const agora = [conversa("a", 0), conversa("b", 2)];
    expect(conversasComNovidade(antes, agora)).toEqual([]);
  });

  it("conversa nova COM não lidas avisa: é gente escrevendo pela primeira vez", () => {
    const antes = fotoDasConversas([conversa("a", 0)]);
    const agora = [conversa("a", 0), conversa("nova", 1)];
    expect(conversasComNovidade(antes, agora).map((c) => c.id)).toEqual(["nova"]);
  });

  it("conversa nova JÁ LIDA não avisa: é a lista crescendo, não mensagem chegando", () => {
    const antes = fotoDasConversas([conversa("a", 0)]);
    const agora = [conversa("a", 0), conversa("importada", 0)];
    expect(conversasComNovidade(antes, agora)).toEqual([]);
  });

  it("conversa que sumiu da lista não quebra a comparação", () => {
    const antes = fotoDasConversas([conversa("a", 1), conversa("apagada", 4)]);
    const agora = [conversa("a", 1)];
    expect(conversasComNovidade(antes, agora)).toEqual([]);
  });

  it("várias de uma vez: todas voltam, e quem chama decide o que fazer com o monte", () => {
    const antes = fotoDasConversas([conversa("a", 0), conversa("b", 0), conversa("c", 0)]);
    const agora = [conversa("a", 1), conversa("b", 2), conversa("c", 0)];
    expect(conversasComNovidade(antes, agora).map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("fotoDasConversas", () => {
  it("guarda o não lidas de cada id", () => {
    const foto = fotoDasConversas([conversa("a", 3), conversa("b", 0)]);
    expect(foto.get("a")).toBe(3);
    expect(foto.get("b")).toBe(0);
    expect(foto.get("c")).toBeUndefined();
  });
});
