/**
 * O CORPO DO "ENVIAR COLUNA AO CRM", conferido antes de qualquer escrita.
 *
 * A agência clica num "⋯" de uma coluna do quadro de Leads do Flow ("No show", por exemplo),
 * escolhe funil e etapa no CRM, e o Flow manda a coluna em lotes. Daqui pra frente é o CRM que
 * conversa com essas pessoas — a automação mora NA ETAPA de destino.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É UMA ROTA NOVA, E NÃO UM CAMPO A MAIS NA `/leads`.
 *
 * O validador da `/leads` ignora campo que não conhece. Um CRM sem esta atualização receberia a
 * lista inteira, jogaria todo mundo no primeiro funil e dispararia `formulario_preenchido` pra
 * gente que não preencheu formulário nenhum — e ninguém ficaria sabendo. Com rota separada, o CRM
 * desatualizado responde 404, o Flow lê isso como "ainda não dá" e nenhum lead sai do lugar.
 *
 * Por isso também: enquanto esta rota não estiver inteira, ela não pode responder 200 vazio nem
 * redirecionar. Um 200 mentiria dizendo que entregou.
 *
 * Puro, sem banco: é o contrato, e contrato se prova sem servidor.
 */

export const LIMITES_DA_LISTA = {
  /** O Flow manda lotes de até 50. Acima disso a chamada não cabe nos 25 segundos de orçamento. */
  leadsPorLote: 50,
  corpoBytes: 100 * 1024,
  nome: 120,
  email: 190,
  rotulo: 60,
  id: 100,
} as const;

/** O que fazer com quem JÁ tem card neste funil. A escolha é de quem clicou. */
export type SeJaTemCard = "manter" | "mover";

export type LeadDaLista = {
  /** O id do lead NO FLOW. A resposta volta por ele, nunca pelo nome. */
  id: string;
  nome: string;
  email: string | null;
  /** Só dígitos, com o 55 na frente. O Flow normaliza antes de mandar. */
  whatsapp: string | null;
  empresa: string | null;
  instagram: string | null;
  segmento: string | null;
};

export type PayloadDaLista = {
  origem: { listaId: string; rotulo: string };
  destino: { funilId: string; etapaId: string; seJaTemCard: SeJaTemCard };
  leads: LeadDaLista[];
};

export type ResultadoDaValidacaoDaLista =
  | { ok: true; payload: PayloadDaLista }
  | { ok: false; erro: string };

function limpar(valor: unknown, maximo: number): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo ? limpo.slice(0, maximo) : null;
}

/**
 * O WhatsApp, só se vier como o contrato promete: dígitos com o 55 na frente.
 *
 * Recusar aqui é melhor que "limpar" com um `replace`. O Flow já normaliza, e um valor fora do
 * formato quer dizer que alguma coisa mudou de um lado sem o outro saber — remendar em silêncio
 * esconderia a divergência até o dia em que uma mensagem sair pro número errado.
 */
function telefone(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  if (!limpo) return null;
  return /^55\d{10,11}$/.test(limpo) ? limpo : null;
}

function email(valor: unknown): string | null {
  const limpo = limpar(valor, LIMITES_DA_LISTA.email);
  if (!limpo) return null;
  // Conferência de forma, não de existência: arroba com texto dos dois lados e um ponto depois.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo) ? limpo.toLowerCase() : null;
}

export function validarListaDoFlow(bruto: unknown): ResultadoDaValidacaoDaLista {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
    return { ok: false, erro: "O corpo da requisição precisa ser um objeto JSON." };
  }
  const corpo = bruto as Record<string, unknown>;

  const origem = (corpo.origem ?? {}) as Record<string, unknown>;
  const destino = (corpo.destino ?? {}) as Record<string, unknown>;

  const listaId = limpar(origem.listaId, LIMITES_DA_LISTA.id);
  if (!listaId) return { ok: false, erro: "Falta `origem.listaId`, que identifica a coluna enviada." };

  /*
   * O RÓTULO É OBRIGATÓRIO porque ele vira ETIQUETA no contato ("Flow: No show"), e é por ela que
   * a agência monta a campanha depois. Sem rótulo, o carimbo sairia vazio e o envio inteiro
   * perderia a única marca que diz de onde aquelas pessoas vieram.
   */
  const rotulo = limpar(origem.rotulo, LIMITES_DA_LISTA.rotulo);
  if (!rotulo) return { ok: false, erro: "Falta `origem.rotulo`, que vira a etiqueta dos contatos." };

  const funilId = limpar(destino.funilId, LIMITES_DA_LISTA.id);
  const etapaId = limpar(destino.etapaId, LIMITES_DA_LISTA.id);
  if (!funilId || !etapaId) {
    return { ok: false, erro: "Escolha o funil e a etapa de destino (`destino.funilId` e `destino.etapaId`)." };
  }

  const seJaTemCardBruto = destino.seJaTemCard ?? "manter";
  if (seJaTemCardBruto !== "manter" && seJaTemCardBruto !== "mover") {
    return { ok: false, erro: "`destino.seJaTemCard` só aceita \"manter\" ou \"mover\"." };
  }

  if (!Array.isArray(corpo.leads) || corpo.leads.length === 0) {
    return { ok: false, erro: "Mande pelo menos um lead em `leads`." };
  }
  if (corpo.leads.length > LIMITES_DA_LISTA.leadsPorLote) {
    return {
      ok: false,
      erro: `Até ${LIMITES_DA_LISTA.leadsPorLote} leads por chamada. Divida em lotes menores.`,
    };
  }

  const leads: LeadDaLista[] = [];
  const idsVistos = new Set<string>();
  for (const [i, cru] of corpo.leads.entries()) {
    if (!cru || typeof cru !== "object" || Array.isArray(cru)) {
      return { ok: false, erro: `O lead na posição ${i + 1} não é um objeto.` };
    }
    const l = cru as Record<string, unknown>;

    const id = limpar(l.id, LIMITES_DA_LISTA.id);
    if (!id) return { ok: false, erro: `O lead na posição ${i + 1} está sem \`id\`.` };
    /*
     * ID REPETIDO NO MESMO LOTE É RECUSA, não "vale o último".
     *
     * A resposta é um resultado POR id, na mesma ordem. Com dois iguais, o Flow não teria como
     * saber qual linha é qual — e ele mostra esse resultado pra pessoa que clicou.
     */
    if (idsVistos.has(id)) return { ok: false, erro: `O lead \`${id}\` veio duas vezes no mesmo lote.` };
    idsVistos.add(id);

    const nome = limpar(l.nome, LIMITES_DA_LISTA.nome);
    if (!nome) return { ok: false, erro: `O lead \`${id}\` está sem nome.` };

    const wa = telefone(l.whatsapp);
    const mail = email(l.email);
    /*
     * SEM ENDEREÇO NENHUM, O LEAD NÃO ENTRA. Ele viraria um contato que não dá pra procurar nem
     * falar — e, pior, um card no funil com um botão de conversa que não abre nada. O Flow já
     * filtra isso do lado dele; esta é a segunda tranca, porque o corpo não vem só da tela.
     */
    if (!wa && !mail) {
      return { ok: false, erro: `O lead \`${id}\` não tem WhatsApp nem e-mail válidos.` };
    }

    leads.push({
      id,
      nome,
      email: mail,
      whatsapp: wa,
      empresa: limpar(l.empresa, LIMITES_DA_LISTA.nome),
      instagram: limpar(l.instagram, LIMITES_DA_LISTA.nome),
      segmento: limpar(l.segmento, LIMITES_DA_LISTA.nome),
    });
  }

  return {
    ok: true,
    payload: {
      origem: { listaId, rotulo },
      destino: { funilId, etapaId, seJaTemCard: seJaTemCardBruto },
      leads,
    },
  };
}
