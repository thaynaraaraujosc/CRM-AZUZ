/**
 * A URL de conexão do banco, com os parâmetros que a Vercel exige.
 *
 * Função pura e testada, e não montagem de string solta dentro de `prisma.ts`, porque cada um
 * destes parâmetros foi pago com uma fatura ou com uma mensagem de cliente perdida. Um deles
 * sumir numa edição futura não daria erro de compilação nem teste vermelho: só voltaria a cobrar
 * caro, meses depois, sem ninguém ligar uma coisa à outra.
 */

/** Conexões simultâneas por processo. */
const LIMITE_DE_CONEXOES = 3;

/**
 * Quantas conexões o pool mantém vivas quando está parado.
 *
 * ZERO, e este é o conserto principal. O padrão do driver `mariadb` é `minimumIdle =
 * connectionLimit`, ou seja, 3 no nosso caso: todo processo que encosta no banco abre 3 conexões
 * e as segura para sempre, mesmo sem nenhuma consulta acontecendo.
 *
 * Num servidor tradicional isso é ótimo (o processo é um só e vive meses). Na Vercel é o
 * contrário: cada instância serverless nova abre as suas 3, e quando a Vercel CONGELA a instância
 * os timers param junto, então ela nunca devolve nada. As conexões ficam penduradas do lado do
 * MySQL até o servidor derrubá-las por conta própria.
 *
 * Foi o que o diagnóstico mediu em produção: 73 conexões abertas para um teto de 151, sem
 * nenhum cliente usando o produto, e 4.753 tentativas de conexão RECUSADAS de 13.875. Uma em
 * cada três.
 *
 * E conexão recusada aqui não é lentidão, é perda de dado: quando chega uma mensagem de WhatsApp,
 * o webhook precisa de uma conexão para gravá-la. Sem conexão ele falha, e a Evolution não tenta
 * de novo. A mensagem some. Era o "mandei mensagem e não chegou no CRM" que a gente perseguiu por
 * dias procurando no lugar errado.
 *
 * Com zero, o pool abre conexão quando tem consulta e devolve quando termina. Uma instância
 * congelada entre requisições segura nada.
 */
const MINIMO_OCIOSO = 0;

/**
 * Segundos até uma conexão parada ser devolvida. O padrão do driver é 1800 (meia hora).
 *
 * 30 segundos casa com o ritmo real do produto: o polling das telas bate de 10 em 10 segundos e o
 * cron roda de minuto em minuto, então uma conexão que passou 30 segundos sem uso provavelmente
 * pertence a uma instância que não vai voltar. Reabrir custa milissegundos; ficar pendurada custa
 * uma vaga no teto do banco.
 */
const SEGUNDOS_OCIOSO = 30;

/**
 * Monta a URL final a partir da `DATABASE_URL` do ambiente.
 *
 * Parâmetro que já venha escrito na variável de ambiente é respeitado: quem precisar ajustar em
 * produção sem esperar deploy consegue, e o padrão daqui só vale para o que não foi dito.
 */
export function urlDeConexao(databaseUrl: string): string {
  // O CLI do Prisma (`db push`/`migrate`) exige o prefixo `mysql://`, que é o provider declarado
  // no schema, mas o driver `@prisma/adapter-mariadb` só aceita `mariadb://`. Converter aqui faz
  // a mesma variável servir aos dois sem ninguém manter duas versões.
  const url = databaseUrl.replace(/^mysql:\/\//, "mariadb://");

  // O "?" que separa a query é o primeiro DEPOIS do último "@", e nunca o primeiro da string.
  // Senha de banco é gerada por máquina e pode conter "?" e "@" literais; cortar no primeiro "?"
  // partia a URL no meio da senha e transformava host e nome do banco em lixo codificado, o que
  // derruba a conexão inteira sem dizer por quê.
  const fimDoUsuario = url.lastIndexOf("@");
  const inicioDaQuery = url.indexOf("?", fimDoUsuario === -1 ? 0 : fimDoUsuario);
  const base = inicioDaQuery === -1 ? url : url.slice(0, inicioDaQuery);
  const parametros = new URLSearchParams(inicioDaQuery === -1 ? "" : url.slice(inicioDaQuery + 1));

  const padroes: Record<string, string> = {
    connectionLimit: String(LIMITE_DE_CONEXOES),
    minimumIdle: String(MINIMO_OCIOSO),
    idleTimeout: String(SEGUNDOS_OCIOSO),
    // O servidor comprime (zlib) tudo que manda para cá. O banco mora na Railway e a aplicação na
    // Vercel, e a Railway cobra por gigabyte que SAI do banco. Texto e JSON, que são o grosso do
    // tráfego, encolhem de 3 a 5 vezes. Custa CPU, a linha mais barata da conta, para economizar
    // tráfego, que é a mais cara.
    compress: "true",
  };

  for (const [chave, valor] of Object.entries(padroes)) {
    if (!parametros.has(chave)) parametros.set(chave, valor);
  }

  return `${base}?${parametros.toString()}`;
}
