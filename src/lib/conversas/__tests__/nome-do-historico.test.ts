import { describe, expect, it } from "vitest";

import { nomeDePerfilNoHistorico } from "../nome-do-historico";

/**
 * O NOME QUE FICOU NO HISTÓRICO, pra batizar as conversas que já estão lá como número.
 *
 * O batismo ao receber conserta o futuro. Pro passado, no QR Code, o nome continua nas mensagens
 * antigas: cada mensagem recebida carrega o `pushName` de quem escreveu.
 */
const recebida = (pushName: unknown, messageTimestamp: unknown) => ({
  key: { fromMe: false },
  pushName,
  messageTimestamp,
});

describe("nomeDePerfilNoHistorico", () => {
  it("acha o nome numa mensagem recebida", () => {
    expect(nomeDePerfilNoHistorico([recebida("Lucas Arantes", 1731000000)])).toBe("Lucas Arantes");
  });

  /*
   * MENSAGEM MINHA NÃO BATIZA NINGUÉM.
   *
   * No evento `fromMe` o `pushName` é o nome do DONO da conta. Sem esta guarda, o nome da própria
   * empresa seria escrito em cima de todos os leads de uma vez — e o estrago seria irreversível
   * na prática, porque o número original já teria saído do campo de nome.
   */
  it("ignora o que eu mandei", () => {
    const minha = { key: { fromMe: true }, pushName: "Azuz Digital", messageTimestamp: 1731000000 };
    expect(nomeDePerfilNoHistorico([minha])).toBeNull();
    expect(nomeDePerfilNoHistorico([minha, recebida("Francisco", 1730000000)])).toBe("Francisco");
  });

  /* O mais recente ganha: quem trocou o nome do perfil deve aparecer como se chama hoje. A ordem
     da lista varia entre versões da Evolution, então quem decide é o carimbo. */
  it("fica com o nome mais recente, não com o primeiro da lista", () => {
    const lista = [recebida("Nome velho", 1700000000), recebida("Nome novo", 1731000000)];
    expect(nomeDePerfilNoHistorico(lista)).toBe("Nome novo");
    expect(nomeDePerfilNoHistorico([...lista].reverse())).toBe("Nome novo");
  });

  it("nome que é só número não serve", () => {
    expect(nomeDePerfilNoHistorico([recebida("5511973935384", 1731000000)])).toBeNull();
  });

  it("aguenta lixo sem quebrar", () => {
    expect(nomeDePerfilNoHistorico([])).toBeNull();
    expect(nomeDePerfilNoHistorico([null, 7, "texto", {}])).toBeNull();
    expect(nomeDePerfilNoHistorico([recebida("  ", 1)])).toBeNull();
    expect(nomeDePerfilNoHistorico([recebida("A", 1)])).toBeNull();
  });

  /* Carimbo ausente ou torto não descarta o nome: ele só perde a disputa por recência. */
  it("sem carimbo, ainda serve", () => {
    expect(nomeDePerfilNoHistorico([recebida("Cassia", undefined)])).toBe("Cassia");
    expect(nomeDePerfilNoHistorico([recebida("Cassia", "1731000000")])).toBe("Cassia");
  });
});
