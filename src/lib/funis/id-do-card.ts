import { slugId } from "@/lib/ids";

/**
 * O id do card do funil, DEDUZIDO do nome da pessoa — e é isto que torna card duplicado impossível.
 *
 * O problema medido em produção (14/10/2026, com banco de verdade): todo caminho que cria card faz
 * "esse contato já tem card?" e depois `create`, sem nada entre as duas coisas. Com duas chamadas
 * simultâneas, as duas perguntam, as duas ouvem "não tem", e as duas criam. O id carregava
 * `Date.now()`, então os dois cards nasciam com ids diferentes e o banco aceitava os dois. A pessoa
 * ficava com dois cards no funil, e o pior: a chamada devolvia 200, então o Flow não repetia e nada
 * corrigia depois. Com 3 chamadas simultâneas, 16 de 25 rodadas duplicavam.
 *
 * A correção não precisa de lock nem de schema novo: se o id SAI do nome, o segundo `create` bate
 * na chave primária que já existe. O banco passa a ser quem garante o invariante, em vez de uma
 * sequência de dois passos que nunca pode ser atômica em código.
 *
 * Por que não `GET_LOCK`: ele vive na CONEXÃO, e aqui as conexões vêm de um pool compartilhado
 * entre instâncias serverless — pegar o lock numa conexão e liberar noutra não funciona, e um
 * processo que morre com o lock na mão trava os próximos até o tempo limite. A chave primária não
 * tem nada disso: não vaza, não expira e não depende de quantas instâncias existem.
 *
 * O `slugId` é o mesmo do id do contato ("Thais " e "thais" dão a mesma chave), então duas grafias
 * da mesma pessoa caem no mesmo card — que é justamente o defeito de 69 negócios pra 35 conversas
 * que o `chaveDeContato` já tinha atacado do lado da busca.
 */

/** Cabe no `varchar(191)` que o Prisma usa pra `String @id`, com folga pro prefixo. */
const LIMITE_DO_ID = 180;

export function idDoCard(workspaceId: string, contatoNome: string): string | null {
  const chave = slugId(contatoNome);
  // Nome sem letra nem número (só emoji, só pontuação): não há chave estável a deduzir, e inventar
  // uma faria pessoas diferentes dividirem o mesmo card.
  if (!chave) return null;

  // O prefixo `card-` existe pra o id novo nunca topar com um id antigo nem com um id de contato
  // (que é `${workspaceId}-${slug}`, a mesma string). Formatos que não se cruzam deixam a migração
  // ser nenhuma: card antigo continua com o id antigo, e é achado pelo nome como sempre.
  const id = `card-${workspaceId}-${chave}`;

  // Cortar faria dois nomes longos virarem o mesmo id, e aí duas pessoas dividiriam um card — pior
  // do que o problema que esta função resolve. Sem id dedutível, quem chama usa o id único de
  // antes: volta a ser possível duplicar nesse caso extremo, e continua sendo correto.
  return id.length <= LIMITE_DO_ID ? id : null;
}

/** O id de antes, pra quando não há chave dedutível. Único, nunca deduplicado. */
export function idDeCardSemChave(workspaceId: string): string {
  return `card-${workspaceId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
