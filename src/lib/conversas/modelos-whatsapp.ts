/**
 * OS MODELOS APROVADOS, BUSCADOS ANTES DE SEREM PEDIDOS.
 *
 * "Quando a gente vai escolher o modelo, carregar o modelo — tem alguma forma de já deixar
 * pronto? Tipo, na hora que eu clico em 'escolher modelo', já aparece, sem essa espera."
 *
 * Tem, e a espera nunca precisou existir. A janela buscava os modelos ao ABRIR: o clique abria uma
 * caixa escrita "Carregando seus modelos…" e a pessoa esperava uma ida à Meta parada olhando. Só
 * que, quando esse clique acontece, o CRM já sabia fazia tempo que ia precisar deles — a conversa
 * está aberta, o canal é o oficial, e pelo oficial o modelo é o ÚNICO caminho pra falar primeiro.
 * Dá pra buscar enquanto a pessoa lê a conversa, e ter a lista pronta quando ela clicar.
 *
 * TRÊS COISAS, E SÓ ELAS:
 *
 *  · UM CACHE no módulo, porque a lista é a mesma pra toda conversa da mesma conta. Sem ele,
 *    abrir a janela em dez conversas seriam dez idas à Meta pra receber a mesma resposta.
 *
 *  · UMA BUSCA EM VOO POR VEZ. Aquecer e clicar quase junto disparava duas; a segunda chegaria
 *    depois e sobrescreveria a primeira com o mesmo conteúdo, gastando o dobro à toa. Quem chega
 *    no meio espera a que já está correndo.
 *
 *  · UM PRAZO CURTO. Modelo aprovado pela Meta aparece quando ela aprova, e quem acabou de criar
 *    um volta pro CRM pra usá-lo. Cache eterno faria o modelo novo não aparecer até recarregar a
 *    página — ou seja, trocaria uma espera visível por uma ausência silenciosa, que é pior.
 */

export type ModeloWhatsApp = {
  id: string;
  nome: string;
  idioma: string;
  categoria: string;
  status: string;
  componentes: unknown;
};

/** Cinco minutos. Tempo de ler uma conversa e responder, não de criar um modelo novo na Meta. */
export const VALIDADE_DO_CACHE_MS = 5 * 60 * 1000;

type Estado = {
  modelos: ModeloWhatsApp[] | null;
  buscadoEm: number;
  emVoo: Promise<ModeloWhatsApp[]> | null;
};

const estado: Estado = { modelos: null, buscadoEm: 0, emVoo: null };

/** O cache serve pra este instante? Puro, pra a regra do prazo poder ser testada sem relógio real. */
export function cacheAindaVale(buscadoEm: number, agora: number, validadeMs = VALIDADE_DO_CACHE_MS): boolean {
  return buscadoEm > 0 && agora - buscadoEm < validadeMs;
}

/** Os modelos que já estão na mão, ou `null`. É o que faz a janela abrir preenchida. */
export function modelosEmCache(agora = Date.now()): ModeloWhatsApp[] | null {
  return cacheAindaVale(estado.buscadoEm, agora) ? estado.modelos : null;
}

async function buscarNaMeta(): Promise<ModeloWhatsApp[]> {
  const resposta = await fetch("/api/integracoes/meta/whatsapp/templates");
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error((dados as { erro?: string }).erro ?? "Falha ao buscar os modelos.");
  return dados as ModeloWhatsApp[];
}

/**
 * Os modelos, do cache quando ele vale e da Meta quando não vale.
 *
 * Chamadas simultâneas compartilham a mesma ida: a segunda não dispara nada, espera a primeira.
 */
export function buscarModelos(agora = Date.now()): Promise<ModeloWhatsApp[]> {
  const doCache = modelosEmCache(agora);
  if (doCache) return Promise.resolve(doCache);
  if (estado.emVoo) return estado.emVoo;

  estado.emVoo = buscarNaMeta()
    .then((modelos) => {
      estado.modelos = modelos;
      estado.buscadoEm = Date.now();
      return modelos;
    })
    .finally(() => {
      estado.emVoo = null;
    });
  return estado.emVoo;
}

/**
 * Começa a buscar sem esperar e sem reclamar — pra chamar quando o CRM já SABE que vai precisar.
 *
 * Falha em silêncio de propósito: isto roda enquanto a pessoa lê a conversa, e um erro aqui não é
 * dela nem pra ela. Quando ela clicar, a janela busca de novo e aí sim mostra o motivo.
 */
export function aquecerModelos(): void {
  void buscarModelos().catch(() => {});
}

/** Só pros testes: zera o cache entre um caso e outro. */
export function limparCacheDeModelos(): void {
  estado.modelos = null;
  estado.buscadoEm = 0;
  estado.emVoo = null;
}
