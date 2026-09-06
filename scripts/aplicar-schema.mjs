/**
 * Sincroniza o schema do Prisma com o banco antes do build.
 *
 * Existe porque nada aplicava mudança de banco em produção: o `prisma db push` morava no script
 * `start`, que a Vercel (serverless) nunca executa. Colocá-lo no `build` resolve — a Vercel sempre
 * roda o build e tem a `DATABASE_URL` — mas o repositório também é buildado em ambientes sem banco
 * configurado (o serviço do Railway, por exemplo, não tem nenhuma variável definida), e ali o
 * comando aborta e derruba o build inteiro por uma etapa que nem se aplica.
 *
 * Sem `--accept-data-loss` de propósito: mudança destrutiva deve falhar o build, e não apagar
 * coluna em silêncio a cada deploy.
 *
 * ---
 *
 * POR QUE FALHA DE CONEXÃO NÃO DERRUBA MAIS O BUILD
 *
 * A versão anterior falhava o build em QUALQUER erro daqui, com a justificativa de que "é sinal de
 * problema real". A justificativa está certa; a conclusão não estava, e um dia inteiro de produção
 * mostrou o porquê.
 *
 * O banco ficou fora do ar. O `db push` não conseguiu conectar. O build passou a falhar — e com ele
 * foi embora a capacidade de fazer QUALQUER deploy, inclusive o deploy que consertaria a situação.
 * Uma indisponibilidade do banco virou uma indisponibilidade de entrega, e as duas coisas se
 * travaram uma na outra: pra publicar era preciso o banco de pé, e pra arrumar o banco era preciso
 * publicar.
 *
 * Um sistema de entrega não pode depender de um recurso de execução estar saudável. São problemas
 * de natureza diferente e precisam falhar separados.
 *
 * Então a regra passa a distinguir DOIS tipos de erro:
 *
 * - **Não alcancei o banco** (fora do ar, endereço trocado, credencial errada, rede): AVISA bem
 *   alto e deixa o build seguir. A aplicação vai subir e reclamar em tempo de execução, com uma
 *   mensagem clara pra quem abrir a tela — mas o deploy acontece, e é possível publicar a correção.
 *
 * - **Alcancei o banco e a mudança foi recusada** (schema inválido, alteração destrutiva): FALHA o
 *   build, como antes. Aqui o build é o lugar certo pra barrar, porque o problema é do código que
 *   está sendo publicado, e publicar assim quebraria o que está no ar.
 */
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.warn("[schema] DATABASE_URL não definida — pulando a sincronização do banco.");
  process.exit(0);
}

// `pipe` em vez de `inherit` porque precisamos LER a saída pra classificar o erro. O texto é
// reimpresso logo abaixo, então nada se perde do log do build.
const resultado = spawnSync("npx", ["prisma", "db", "push"], { encoding: "utf-8", shell: false });
const saida = `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`;
if (saida) process.stdout.write(saida);

if (resultado.status === 0) process.exit(0);

/**
 * Marcas de "não consegui chegar no banco".
 *
 * Os códigos `P1xxx` do Prisma são a via principal e são estáveis: P1000 autenticação, P1001 não
 * alcançou o servidor, P1002 tempo esgotado, P1017 conexão fechada pelo servidor. Os erros de
 * sistema (`ECONNREFUSED` e companhia) entram porque a falha nem sempre chega a virar erro do
 * Prisma — quando o endereço não existe, ela vem crua do sistema operacional.
 */
const FALHA_DE_CONEXAO = [
  "P1000",
  "P1001",
  "P1002",
  "P1017",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "Can't reach database server",
];

const naoAlcancouOBanco = FALHA_DE_CONEXAO.some((marca) => saida.includes(marca));

if (naoAlcancouOBanco) {
  console.warn("");
  console.warn("========================================================================");
  console.warn("[schema] ATENÇÃO: não foi possível ALCANÇAR o banco de dados.");
  console.warn("");
  console.warn("  O build vai continuar de propósito — travar a publicação por causa de um");
  console.warn("  banco fora do ar impediria de publicar justamente a correção que resolve.");
  console.warn("");
  console.warn("  Mas a aplicação vai subir SEM a sincronização do schema. Se o banco estiver");
  console.warn("  mesmo fora do ar, as telas vão falhar até ele voltar. Confira, nesta ordem:");
  console.warn("    1. o banco está no ar?");
  console.warn("    2. a DATABASE_URL desta implantação aponta pro endereço atual dele?");
  console.warn("       (endereço público pode mudar quando o serviço é recriado)");
  console.warn("    3. depois de resolver, publique de novo pra sincronizar o schema.");
  console.warn("========================================================================");
  console.warn("");
  process.exit(0);
}

console.error("");
console.error("[schema] A sincronização do schema foi RECUSADA pelo banco (o banco respondeu).");
console.error("  Isso é problema do código que está sendo publicado, não de disponibilidade —");
console.error("  provavelmente uma mudança destrutiva de coluna/tabela. O build para aqui de");
console.error("  propósito: publicar assim quebraria o que já está no ar.");
console.error("");
process.exit(resultado.status ?? 1);
