import { describe, expect, it } from "vitest";

import { CONFIG_PADRAO } from "../azuz-flow-config";
import { montarRespostaDoFlow } from "../azuz-flow-resposta";

/**
 * O defeito que este arquivo existe pra impedir não foi de lógica: foi de FORMA.
 *
 * O GET devolvia a configuração mais o estado do canal; o PUT devolvia só a configuração. A tela
 * guarda o que a rota devolve, então salvar qualquer opção trocava o objeto por um pela metade — e
 * o render seguinte morria em `canal.disjuntor.pausadoEm`. Quem tentava salvar via a tela inteira
 * de Configurações virar "Algo deu errado por aqui".
 *
 * Daí a regra provada aqui: a rota tem UMA representação do recurso, e ela carrega tudo que a tela
 * lê. Não existe "meia resposta".
 */

const DISJUNTOR = { falhasSeguidas: 0, pausadoEm: null, ultimoMotivo: null };

/** Tudo que a tela do AZUZ Flow lê do corpo. Um campo a menos aqui é uma tela quebrada. */
const CAMPOS_QUE_A_TELA_LE = [
  "canal",
  "confirmacao",
  "opcoes",
  "conexoes",
  "conexaoEfetiva",
  "aviso",
  "disjuntor",
] as const;

describe("a forma do recurso", () => {
  it("carrega todo campo que a tela lê", () => {
    const corpo = montarRespostaDoFlow({
      config: CONFIG_PADRAO,
      conexoes: { oficial: null, qrcode: "5562988887777" },
      disjuntor: DISJUNTOR,
    });

    for (const campo of CAMPOS_QUE_A_TELA_LE) {
      expect(corpo, `faltou "${campo}" no corpo da rota`).toHaveProperty(campo);
    }
  });

  it("é a mesma forma venha de onde vier", () => {
    // GET e PUT chamam a mesma função. Este teste é o que impede alguém de montar o corpo à mão
    // de novo num dos dois lados.
    const depoisDeLer = montarRespostaDoFlow({
      config: CONFIG_PADRAO,
      conexoes: { oficial: "111", qrcode: null },
      disjuntor: DISJUNTOR,
    });
    const depoisDeSalvar = montarRespostaDoFlow({
      config: { ...CONFIG_PADRAO, confirmacao: { ...CONFIG_PADRAO.confirmacao, ativa: true } },
      conexoes: { oficial: "111", qrcode: null },
      disjuntor: DISJUNTOR,
    });

    expect(Object.keys(depoisDeSalvar).sort()).toEqual(Object.keys(depoisDeLer).sort());
  });
});

describe("o estado, não só a opção guardada", () => {
  it('"só oficial" com o oficial desconectado vira aviso e nenhuma conexão efetiva', () => {
    const corpo = montarRespostaDoFlow({
      config: { ...CONFIG_PADRAO, canal: "oficial" },
      conexoes: { oficial: null, qrcode: "5562988887777" },
      disjuntor: DISJUNTOR,
    });

    expect(corpo.conexaoEfetiva).toBeNull();
    expect(corpo.aviso).toBeTruthy();
    // O QR existe, e a tela precisa saber disso pra oferecer a troca.
    expect(corpo.conexoes).toEqual({ oficial: false, qrcode: true });
  });

  it("as conexões viram booleano: a tela não precisa do número de ninguém", () => {
    const corpo = montarRespostaDoFlow({
      config: CONFIG_PADRAO,
      conexoes: { oficial: "111222333", qrcode: "5562988887777" },
      disjuntor: DISJUNTOR,
    });

    expect(corpo.conexoes).toEqual({ oficial: true, qrcode: true });
    expect(JSON.stringify(corpo)).not.toContain("5562988887777");
  });

  it("o disjuntor pausado chega inteiro, com o motivo", () => {
    const corpo = montarRespostaDoFlow({
      config: CONFIG_PADRAO,
      conexoes: { oficial: null, qrcode: "5562988887777" },
      disjuntor: { falhasSeguidas: 5, pausadoEm: "2026-10-21T12:00:00.000Z", ultimoMotivo: "a conexão caiu" },
    });

    expect(corpo.disjuntor.pausadoEm).toBe("2026-10-21T12:00:00.000Z");
    expect(corpo.disjuntor.ultimoMotivo).toBe("a conexão caiu");
  });
});
