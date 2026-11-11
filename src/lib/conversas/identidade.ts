import { prisma } from "@/lib/prisma";
import { nomeAindaEhIdCru } from "./exibicao";
import { renomearConversa } from "./renomear";
import { encontrarContatoPorTelefone } from "@/lib/contatos/upsert";
import { normalizarTelefoneParaComparacao } from "@/lib/telefone";

/**
 * QUEM É O DONO DESTA THREAD, decidido a partir do TELEFONE e nunca do nome de perfil solto.
 *
 * Toda a camada de mensagens é indexada por NOME: `MensagemExtra.contato` guarda o nome, a chave
 * única da `Conversa` é `[workspaceId, nome]`, e `GET /api/mensagens-extra` agrupa as mensagens
 * por essa string. Quer dizer que dois telefones diferentes caindo no mesmo nome não ficam
 * "parecidos" na tela: eles viram LITERALMENTE a mesma conversa, com as mensagens das duas pessoas
 * intercaladas numa bolha só.
 *
 * Era o que estava acontecendo, por dois caminhos:
 *
 * 1. MENSAGEM QUE EU MANDO DO CELULAR. O webhook da Evolution manda `pushName` em todo evento,
 *    inclusive nos `fromMe` (espelhamento do WhatsApp Web). Só que num `fromMe` o `pushName` é o
 *    nome do MEU perfil, não o de quem recebeu. Então cada mensagem que ela mandava do celular pra
 *    um número ainda não cadastrado era arquivada sob o nome do próprio negócio: todas as conversas
 *    novas desabavam numa thread só ("Atendimento Agência Azuz"), com "Olá Gabriela" e "Boa tarde
 *    Lázaro" lado a lado. Pior: `criarContatoPeloWhatsAppSeNaoExistir` reusava esse nome e
 *    sobrescrevia o `whatsapp` do mesmo Contato a cada destinatário novo. A conversa do cliente
 *    "sumia" porque ela nunca chegou a existir separada, e o número dele era apagado em seguida.
 *
 * 2. DUAS PESSOAS COM O MESMO NOME DE PERFIL. Dois números diferentes cujo `pushName` coincide
 *    (homônimo, ou o nome genérico que muita gente deixa) se fundiam do mesmo jeito.
 *
 * A ordem aqui vai do mais estável pro menos: thread que já existe PRA ESTE TELEFONE → contato
 * cadastrado com este telefone → nome de perfil, e SÓ se esse nome ainda não pertencer a outro
 * número → o telefone cru. Nome de perfil é enfeite: serve pra ler a lista, nunca pra decidir
 * identidade.
 *
 * A THREAD VEM ANTES DO CONTATO, e essa ordem é uma correção de 11/11/2026.
 *
 * Era o contrário, e o estrago aparecia quando a pessoa trocava de número. A ficha do contato passa
 * a ter o telefone novo; a conversa antiga continua com o antigo. Mandando pelo número novo, o CRM
 * abre (ou cria) a janela do número novo — "cada WhatsApp é independente; se eu quiser mandar para
 * o número novo, ele tem que abrir uma janela nova". Mas a RESPOSTA dela caía na thread velha:
 * chegava aqui, o contato era encontrado pelo telefone novo, e o nome dele era o da thread antiga.
 * Saída numa janela e resposta noutra, sobre a mesma conversa.
 *
 * Os dois primeiros passos são igualmente estáveis — os dois partem do telefone —, então preferir a
 * thread não perde precisão nenhuma: ela é, literalmente, onde as mensagens deste número já estão.
 * O contato continua sendo buscado e devolvido, porque é dele que sai o vínculo da conversa.
 */
export async function resolverPessoaDoTelefone(params: {
  workspaceId: string;
  /** O telefone da OUTRA pessoa (nunca o meu), só dígitos. */
  telefone: string;
  /**
   * Nome de exibição que a mensagem trouxe, quando ele é mesmo da outra pessoa. Em evento
   * `fromMe` passe `null`: ali o nome é o do dono da conta, ver o item 1 acima.
   */
  nomeDoPerfil?: string | null;
}): Promise<{ nome: string; contatoExistente: { id: string; nome: string } | null }> {
  const { workspaceId, telefone, nomeDoPerfil } = params;

  const contatoExistente = await encontrarContatoPorTelefone(workspaceId, telefone);

  // 1. Thread que já existe PRA ESTE NÚMERO. É onde as mensagens dele já estão, e por isso ganha
  //    até do contato cadastrado: ver o comentário acima sobre troca de número. Vale também pra
  //    quem começou a conversar antes de virar contato, inclusive quando a conversa foi criada com
  //    o número cru como nome.
  const porTelefone = await encontrarConversaPorTelefone(workspaceId, telefone);
  if (porTelefone) {
    const batizado = await batizarSeAindaForNumero(workspaceId, porTelefone, telefone, nomeDoPerfil);
    const nome = batizado ?? porTelefone;
    // O contato vai junto quando existe: é dele que sai `Conversa.contatoId`, e o vínculo é pelo
    // telefone, que é o mesmo nos dois lados. Só o NOME é o da thread.
    return { nome, contatoExistente: contatoExistente ? { ...contatoExistente, nome } : null };
  }

  // 2. Contato já cadastrado com esse número, quando ainda não há thread pra ele.
  if (contatoExistente) {
    const batizado = await batizarSeAindaForNumero(workspaceId, contatoExistente.nome, telefone, nomeDoPerfil);
    if (batizado) return { nome: batizado, contatoExistente: { ...contatoExistente, nome: batizado } };
    return { nome: contatoExistente.nome, contatoExistente };
  }

  // 3. Nome de perfil, e só se ele estiver livre. Ocupado por outro número, cair nele fundiria as
  //    duas pessoas de forma irreversível: vale muito mais mostrar o número.
  const nome = nomeDoPerfil?.trim();
  if (nome && !(await nomeJaPertenceAOutroNumero(workspaceId, nome, telefone))) {
    return { nome, contatoExistente: null };
  }

  // 4. O telefone cru. Já era o fallback de número desconhecido; continua sendo o nome honesto
  //    quando não há outro disponível. Dá pra renomear a conversa depois, à mão.
  return { nome: telefone, contatoExistente: null };
}

/** Conversa individual deste workspace cujo `contato` é o mesmo número (comparação normalizada,
 *  igual à dos contatos: `"(62) 99999-9999"` e `"5562999999999"` são o mesmo telefone). */
async function encontrarConversaPorTelefone(workspaceId: string, telefone: string): Promise<string | null> {
  const alvo = normalizarTelefoneParaComparacao(telefone);
  if (!alvo) return null;
  // Varredura leve (duas colunas), mesmo motivo de `encontrarContatoPorTelefone`: o conjunto de
  // conversas por workspace é pequeno, e trazer linha inteira aqui significaria baixar `fotoUrl`
  // em base64 de todas elas a cada mensagem recebida.
  const candidatas = await prisma.conversa.findMany({
    where: { workspaceId, ehGrupo: false, contato: { not: null } },
    select: { nome: true, contato: true },
  });
  return candidatas.find((c) => c.contato && normalizarTelefoneParaComparacao(c.contato) === alvo)?.nome ?? null;
}

/**
 * Esse nome já é de outra pessoa? Olha a `Conversa` e o `Contato` com esse nome exato e compara o
 * telefone de cada um com o que chegou. Sem telefone gravado do outro lado a resposta é "não":
 * conversa antiga que nunca teve número é justamente a que deve receber a mensagem.
 */
async function nomeJaPertenceAOutroNumero(workspaceId: string, nome: string, telefone: string): Promise<boolean> {
  const alvo = normalizarTelefoneParaComparacao(telefone);
  const [conversa, contato] = await Promise.all([
    prisma.conversa.findUnique({
      where: { workspaceId_nome: { workspaceId, nome } },
      select: { contato: true, ehGrupo: true },
    }),
    prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome } }, select: { whatsapp: true } }),
  ]);
  // Grupo com esse nome: uma pessoa jamais deve escrever dentro da thread de um grupo.
  if (conversa?.ehGrupo) return true;
  const outro = (valor: string | null | undefined) => {
    const normalizado = valor ? normalizarTelefoneParaComparacao(valor) : "";
    return Boolean(normalizado) && normalizado !== alvo;
  };
  return outro(conversa?.contato) || outro(contato?.whatsapp);
}

/**
 * O NÚMERO VIRA NOME NA PRIMEIRA VEZ QUE O NOME CHEGA.
 *
 * "Tem como, quando alguém me enviar a mensagem, puxar o nome que a pessoa salvou no WhatsApp dela
 * em vez do número?" Puxa — e já puxava, só que uma vez só: na CRIAÇÃO. Quem chegou numa mensagem
 * que não trouxe o nome de perfil (acontece, e acontece bastante na primeira) nascia com o telefone
 * no lugar do nome e ficava assim pra sempre, mesmo que a segunda, a terceira e a décima mensagem
 * trouxessem o nome. Era um funil cheio de "5511973935384" com o nome disponível a cada mensagem e
 * ninguém escrevendo.
 *
 * Trocar um telefone por um nome é seguro de um jeito que trocar um NOME por outro não é: o
 * telefone no campo de nome não é informação, é a ausência dela. Por isso só acontece aqui, e só
 * nessa direção — `nomeAindaEhIdCru` é a mesma guarda que a tela de renomear usa.
 *
 * A troca move tudo que é casado por nome (mensagens, card do funil, contato) numa transação só,
 * porque é assim que o CRM liga essas tabelas. Falhando — corrida com outra mensagem da mesma
 * pessoa, nome que acabou de ser ocupado — o nome velho continua valendo: perder o batismo é um
 * incômodo, perder a mensagem seria o defeito.
 */
async function batizarSeAindaForNumero(
  workspaceId: string,
  nomeAtual: string,
  telefone: string,
  nomeDoPerfil: string | null | undefined,
): Promise<string | null> {
  const novo = nomeDoPerfil?.trim().replace(/\s+/g, " ");
  if (!novo || novo.length < 2 || novo.length > 80) return null;
  if (!nomeAindaEhIdCru(nomeAtual)) return null;
  // Nome de perfil que também é só dígitos não batiza nada: trocaria um número por outro.
  if (nomeAindaEhIdCru(novo)) return null;
  if (await nomeJaPertenceAOutroNumero(workspaceId, novo, telefone)) return null;

  try {
    await renomearConversa(workspaceId, nomeAtual, novo);
    return novo;
  } catch {
    return null;
  }
}
