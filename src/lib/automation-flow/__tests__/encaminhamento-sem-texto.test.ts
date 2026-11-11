import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resumoNo } from "@/lib/automation-flow/resumo";
import type { FlowNode } from "@/lib/automation-flow/types";

/**
 * ENCAMINHAR UMA PUBLICAÇÃO SEM ESCREVER NADA É UM GESTO INTEIRO.
 *
 * "Quando alguém me encaminhar uma pergunta, não necessariamente ela precisa mandar nenhum texto;
 * esse gatilho tem que ativar só com o encaminhamento."
 *
 * Duas coisas tinham que mudar pra isso valer, e as duas estão travadas aqui.
 */
function noDeEncaminhamento(data: Record<string, unknown>): FlowNode {
  return {
    id: "g1",
    type: "instagram_publicacao_compartilhada",
    position: { x: 0, y: 0 },
    data,
  } as unknown as FlowNode;
}

describe("resumo do gatilho de publicação encaminhada", () => {
  it("diz que vale só sem texto quando é esse o modo", () => {
    expect(resumoNo(noDeEncaminhamento({ canal: "Instagram", modoPalavra: "sem_texto", palavras: [] }), [])).toBe(
      "Sem nenhum texto",
    );
  });

  it("sem regra de palavra, vale pra qualquer encaminhamento", () => {
    expect(resumoNo(noDeEncaminhamento({ canal: "Instagram" }), [])).toBe("Qualquer conteúdo");
  });

  it("com palavra, mostra a palavra", () => {
    expect(
      resumoNo(noDeEncaminhamento({ canal: "Instagram", palavras: ["preço"], modoPalavra: "contem" }), []),
    ).toBe('"preço"');
  });
});

/**
 * O RÓTULO QUE O CRM INVENTA NÃO É FALA DE NINGUÉM.
 *
 * Quando a mensagem é só um anexo, o webhook põe no corpo a frase do que aconteceu
 * ("Compartilhou um reel", "Respondeu ao seu story") pra a bolha não chegar em branco. Isso é pra
 * ler. Era também o que ia pra automação, e aí: encaminhamento calado NUNCA chegava vazio ao
 * motor, então o modo "sem nenhum texto" não disparava nunca; e um robô com a palavra "story"
 * disparava em toda resposta de story, casando com o texto do próprio CRM.
 *
 * Teste estático porque a rota precisa de assinatura da Meta, banco e R2 — e o que se quer travar
 * é uma linha: qual das duas variáveis segue pro motor.
 */
describe("webhook do Instagram: o que a automação recebe", () => {
  const rota = readFileSync(join(process.cwd(), "src/app/api/webhooks/instagram/route.ts"), "utf8");

  it("nunca manda pra automação o texto de exibição da bolha", () => {
    // `texto` é a variável que carrega o rótulo de anexo. `textoDaPessoa` é a que carrega o que a
    // pessoa escreveu. (A reação manda o emoji, que É a fala dela, e por isso não entra aqui.)
    expect(rota).not.toMatch(/textoRecebido:\s*texto\s*,/);
  });

  it("manda `textoDaPessoa` nos eventos de mensagem", () => {
    const envios = rota.match(/textoRecebido:\s*textoDaPessoa\b/g) ?? [];
    // O gatilho genérico de mensagem recebida e o gatilho específico do Instagram.
    expect(envios.length).toBe(2);
  });

  it("`textoDaPessoa` sai do texto da mensagem, sem rótulo de anexo", () => {
    expect(rota).toMatch(/const textoDaPessoa = mensagem\.text\?\.trim\(\) \? mensagem\.text : ""/);
  });
});
