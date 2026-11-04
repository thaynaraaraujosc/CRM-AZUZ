/**
 * OS CAMPOS QUE CADA EMPRESA CRIA NO CONTATO.
 *
 * O CRM tem as colunas que todo CRM tem: nome, telefone, e-mail, empresa, cargo, origem, valor,
 * responsável. O que varia de cliente pra cliente não cabe ali — "paciente novo ou antigo" numa
 * clínica, "placa do veículo" numa oficina, "turma" num curso. Fixar esses no produto daria duas
 * coisas ruins ao mesmo tempo: uma lista interminável de campos que a maioria das empresas deixa
 * vazios, e uma migração de banco a cada cliente novo.
 *
 * Então a empresa cria os seus, com o nome que quiser. A DEFINIÇÃO fica aqui (em `Preferencia`,
 * que é onde já vive toda configuração de workspace) e o VALOR fica no próprio contato, em
 * `camposExtras`.
 */

/** Um teto, porque a lista é desenhada numa coluna lateral e não numa tela própria. */
export const MAXIMO_DE_CAMPOS = 30;
const MAXIMO_OPCOES = 40;

export type TipoDeCampo = "texto" | "numero" | "data" | "escolha";

export type CampoDoContato = {
  /** Gerado na criação e nunca mais muda: é ele que amarra a definição ao valor guardado. */
  id: string;
  nome: string;
  tipo: TipoDeCampo;
  /** Só em `escolha`. */
  opcoes?: string[];
};

export type ValoresDeCampos = Record<string, string>;

const TIPOS: TipoDeCampo[] = ["texto", "numero", "data", "escolha"];

/**
 * Lê a lista guardada, descartando o que não serve.
 *
 * A fonte é JSON gravado por uma versão anterior do produto, então ela não é confiável por
 * contrato: campo sem id não tem como amarrar valor nenhum, e campo sem nome é uma linha em
 * branco no painel. Os dois são descartados em vez de aparecerem quebrados.
 */
export function lerCamposDoContato(cru: unknown): CampoDoContato[] {
  if (!Array.isArray(cru)) return [];
  const vistos = new Set<string>();
  const saida: CampoDoContato[] = [];
  for (const item of cru) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const nome = typeof o.nome === "string" ? o.nome.trim() : "";
    if (!id || !nome || vistos.has(id)) continue;
    const tipo = TIPOS.includes(o.tipo as TipoDeCampo) ? (o.tipo as TipoDeCampo) : "texto";
    const opcoes =
      tipo === "escolha" && Array.isArray(o.opcoes)
        ? o.opcoes
            .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
            .map((x) => x.trim())
            .slice(0, MAXIMO_OPCOES)
        : undefined;
    vistos.add(id);
    saida.push({ id, nome: nome.slice(0, 60), tipo, ...(opcoes?.length ? { opcoes } : {}) });
    if (saida.length >= MAXIMO_DE_CAMPOS) break;
  }
  return saida;
}

/**
 * Os valores de um contato, limpos.
 *
 * Só sobrevive valor de campo que AINDA EXISTE: apagar um campo da empresa tem que apagar a
 * coluna da tela, e deixar o valor órfão faria ele reaparecer se alguém recriasse um campo com o
 * mesmo id. Valor vazio é removido em vez de guardado como string vazia, pra "não preenchido" ser
 * uma coisa só no banco.
 */
export function lerValoresDeCampos(cru: unknown, campos: CampoDoContato[]): ValoresDeCampos {
  if (!cru || typeof cru !== "object" || Array.isArray(cru)) return {};
  const validos = new Set(campos.map((c) => c.id));
  const saida: ValoresDeCampos = {};
  for (const [id, valor] of Object.entries(cru as Record<string, unknown>)) {
    if (!validos.has(id)) continue;
    const texto = typeof valor === "string" ? valor.trim() : typeof valor === "number" ? String(valor) : "";
    if (texto) saida[id] = texto.slice(0, 500);
  }
  return saida;
}

/** Um id curto e estável pro campo novo. Não precisa ser global: basta não repetir no workspace. */
export function novoIdDeCampo(existentes: CampoDoContato[]): string {
  let id = "";
  do {
    id = `c${Math.random().toString(36).slice(2, 8)}`;
  } while (existentes.some((c) => c.id === id));
  return id;
}

/** O rótulo do tipo, pra tela. */
export const ROTULO_DO_TIPO: Record<TipoDeCampo, string> = {
  texto: "Texto",
  numero: "Número",
  data: "Data",
  escolha: "Escolha entre opções",
};

/**
 * Saneia os VALORES vindos do navegador, sem precisar das definições.
 *
 * `lerValoresDeCampos` exige a lista de campos pra descartar valor órfão, e isso é o certo na
 * LEITURA — a tela só mostra o que ainda existe. Na ESCRITA a rota de contatos não tem a lista em
 * mãos e não vale uma consulta a mais só pra isso: o risco real ali não é valor órfão (que some
 * sozinho na leitura seguinte), é alguém usar uma coluna JSON como depósito. Então aqui o corte é
 * de FORMA e de TAMANHO: só pares de texto, no teto de campos, com valor curto.
 */
export function sanearValoresDeCampos(cru: unknown): ValoresDeCampos {
  if (!cru || typeof cru !== "object" || Array.isArray(cru)) return {};
  const saida: ValoresDeCampos = {};
  for (const [id, valor] of Object.entries(cru as Record<string, unknown>)) {
    if (Object.keys(saida).length >= MAXIMO_DE_CAMPOS) break;
    if (!id || id.length > 40) continue;
    const texto =
      typeof valor === "string" ? valor.trim() : typeof valor === "number" ? String(valor) : "";
    if (texto) saida[id] = texto.slice(0, 500);
  }
  return saida;
}
