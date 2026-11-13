import { describe, expect, it } from "vitest";

import { LIMITES_DA_LISTA, validarListaDoFlow } from "@/lib/integracoes/azuz-flow-lista-payload";

/**
 * O CONTRATO DA LISTA, provado sem servidor.
 *
 * O corpo desta rota não vem só da tela do Flow: vem pela rede, de um produto que se atualiza em
 * outro ritmo. Cada recusa aqui é uma escrita que não aconteceu no banco de um cliente — e uma
 * frase em português pra pessoa que clicou entender o que falta.
 */

const VALIDO = {
  versao: 1,
  origem: { sistema: "azuz-flow", tipo: "lista", listaId: "uuid-1", rotulo: "Flow: No show" },
  destino: { funilId: "fun_def", etapaId: "et_9", seJaTemCard: "manter" },
  leads: [
    {
      id: "lead-flow-1",
      nome: "Maria Silva",
      email: "Maria@Exemplo.com",
      whatsapp: "5562996340438",
      empresa: null,
      instagram: null,
      segmento: null,
    },
  ],
};

describe("validarListaDoFlow", () => {
  it("aceita o corpo do contrato e normaliza o e-mail", () => {
    const r = validarListaDoFlow(VALIDO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.origem).toEqual({ listaId: "uuid-1", rotulo: "Flow: No show" });
    expect(r.payload.destino).toEqual({ funilId: "fun_def", etapaId: "et_9", seJaTemCard: "manter" });
    // Minúsculo porque a busca por e-mail compara em minúsculo: gravar como veio faria a mesma
    // pessoa virar dois contatos conforme a caixa que ela digitou.
    expect(r.payload.leads[0].email).toBe("maria@exemplo.com");
  });

  it("`seJaTemCard` ausente vale \"manter\" — não mexer é o padrão seguro", () => {
    const r = validarListaDoFlow({ ...VALIDO, destino: { funilId: "f", etapaId: "e" } });
    expect(r.ok && r.payload.destino.seJaTemCard).toBe("manter");
  });

  it("recusa `seJaTemCard` que não é nem manter nem mover", () => {
    const r = validarListaDoFlow({ ...VALIDO, destino: { funilId: "f", etapaId: "e", seJaTemCard: "apagar" } });
    expect(r.ok).toBe(false);
  });

  it("exige funil E etapa: destino pela metade não é destino", () => {
    expect(validarListaDoFlow({ ...VALIDO, destino: { funilId: "f" } }).ok).toBe(false);
    expect(validarListaDoFlow({ ...VALIDO, destino: { etapaId: "e" } }).ok).toBe(false);
  });

  it("exige o rótulo: é ele que vira a etiqueta do contato", () => {
    /*
     * Sem rótulo o carimbo sairia vazio, e o envio perderia a única marca que diz de onde aquelas
     * pessoas vieram — que é justamente o que a agência usa pra montar a campanha depois.
     */
    const r = validarListaDoFlow({ ...VALIDO, origem: { listaId: "uuid-1" } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toMatch(/etiqueta/i);
  });

  it("recusa lote maior que 50, dizendo o limite", () => {
    const leads = Array.from({ length: LIMITES_DA_LISTA.leadsPorLote + 1 }, (_, i) => ({
      ...VALIDO.leads[0],
      id: `lead-${i}`,
    }));
    const r = validarListaDoFlow({ ...VALIDO, leads });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toContain("50");
  });

  it("recusa lista vazia", () => {
    expect(validarListaDoFlow({ ...VALIDO, leads: [] }).ok).toBe(false);
  });

  it("recusa lead sem WhatsApp E sem e-mail", () => {
    /*
     * Ele viraria um contato que não dá pra procurar nem falar e um card com um botão de conversa
     * que não abre nada. O Flow já filtra; esta é a segunda tranca, porque o corpo vem pela rede.
     */
    const r = validarListaDoFlow({
      ...VALIDO,
      leads: [{ ...VALIDO.leads[0], email: null, whatsapp: null }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toMatch(/WhatsApp nem e-mail/i);
  });

  it("telefone fora do formato é RECUSADO, não remendado", () => {
    /*
     * O Flow promete dígitos com 55. Um valor fora disso quer dizer que um lado mudou sem o outro
     * saber — "limpar" com um replace esconderia a divergência até o dia em que uma mensagem sair
     * pro número errado.
     */
    const comMascara = validarListaDoFlow({
      ...VALIDO,
      leads: [{ ...VALIDO.leads[0], whatsapp: "(62) 99634-0438", email: null }],
    });
    expect(comMascara.ok).toBe(false);

    const semDdi = validarListaDoFlow({
      ...VALIDO,
      leads: [{ ...VALIDO.leads[0], whatsapp: "62996340438", email: null }],
    });
    expect(semDdi.ok).toBe(false);
  });

  it("e-mail sem formato de e-mail não conta como endereço", () => {
    const r = validarListaDoFlow({
      ...VALIDO,
      leads: [{ ...VALIDO.leads[0], whatsapp: null, email: "maria" }],
    });
    expect(r.ok).toBe(false);
  });

  it("id repetido no mesmo lote é recusa, não \"vale o último\"", () => {
    // A resposta é um resultado POR id, na mesma ordem, e o Flow mostra isso pra quem clicou: com
    // dois iguais ele não teria como saber qual linha é qual.
    const r = validarListaDoFlow({
      ...VALIDO,
      leads: [VALIDO.leads[0], { ...VALIDO.leads[0], nome: "Outra" }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toMatch(/duas vezes/i);
  });

  it("lead sem nome é recusado — nome é o que casa card, conversa e mensagens", () => {
    const r = validarListaDoFlow({ ...VALIDO, leads: [{ ...VALIDO.leads[0], nome: "   " }] });
    expect(r.ok).toBe(false);
  });

  it("corpo que não é objeto é recusado antes de qualquer leitura", () => {
    expect(validarListaDoFlow(null).ok).toBe(false);
    expect(validarListaDoFlow([]).ok).toBe(false);
    expect(validarListaDoFlow("{}").ok).toBe(false);
  });
});
