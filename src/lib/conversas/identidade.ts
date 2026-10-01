import { prisma } from "@/lib/prisma";
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
 * A ordem aqui vai do mais estável pro menos: telefone (não muda) → thread que já existe pra esse
 * telefone → nome de perfil, e SÓ se esse nome ainda não pertencer a outro número → o telefone cru.
 * Nome de perfil é enfeite: serve pra ler a lista, nunca pra decidir identidade.
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

  // 1. Contato já cadastrado com esse número: a resposta mais confiável que existe.
  const contatoExistente = await encontrarContatoPorTelefone(workspaceId, telefone);
  if (contatoExistente) return { nome: contatoExistente.nome, contatoExistente };

  // 2. Thread que já existe pra esse número, mesmo sem Contato. Mantém a continuidade de quem
  //    começou a conversar antes de virar contato, inclusive quando a conversa foi criada com o
  //    número cru como nome.
  const porTelefone = await encontrarConversaPorTelefone(workspaceId, telefone);
  if (porTelefone) return { nome: porTelefone, contatoExistente: null };

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
