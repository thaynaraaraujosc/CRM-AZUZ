import { headers } from "next/headers";

/**
 * Limite de uso por janela de tempo — a trava contra força bruta, spam e abuso de custo.
 *
 * Não existia nada disso no CRM: login, recuperação de senha e envio de mensagem aceitavam
 * chamadas ilimitadas. Na prática, testar senhas até acertar era só uma questão de paciência, e um
 * endpoint que fala com a Meta ou com a IA podia ser disparado em laço por qualquer pessoa
 * autenticada — cada chamada é dinheiro.
 *
 * LIMITAÇÃO QUE VOCÊ PRECISA CONHECER: a contagem vive na MEMÓRIA do processo. Em ambiente
 * serverless (Vercel) existem várias instâncias, e cada uma conta o seu pedaço — então o limite
 * real é o configurado multiplicado pelo número de instâncias ativas. Isso reduz muito a força
 * bruta (que depende de milhares de tentativas), mas não é uma trava exata.
 *
 * A versão exata exige um armazenamento compartilhado (Redis/Upstash). Está anotado no relatório
 * como próximo passo; não inventei uma dependência nova sem combinar.
 */

type Registro = { contagem: number; expiraEm: number };

const contadores = new Map<string, Registro>();

/** Descarta o que já venceu — sem isso o mapa cresce pra sempre num processo de vida longa. */
function limpar(agora: number) {
  if (contadores.size < 5000) return;
  for (const [chave, registro] of contadores) {
    if (registro.expiraEm <= agora) contadores.delete(chave);
  }
}

export type PoliticaDeLimite = {
  /** Quantas chamadas cabem na janela. */
  maximo: number;
  /** Tamanho da janela, em segundos. */
  janelaSegundos: number;
};

/**
 * Políticas por categoria. Deliberadamente diferentes: aplicar o mesmo número em tudo ou trava o
 * uso normal, ou deixa o ponto sensível aberto.
 */
export const POLITICAS = {
  /** Login: apertado. Ninguém erra a senha 10 vezes em 5 minutos usando o CRM de verdade. */
  login: { maximo: 10, janelaSegundos: 300 },
  /** Recuperação de senha: mais apertado ainda — cada chamada manda e-mail e revela se a conta existe. */
  recuperacaoDeSenha: { maximo: 5, janelaSegundos: 900 },
  /** Cadastro: impede criação de contas em massa. */
  cadastro: { maximo: 5, janelaSegundos: 3600 },
  /** Envio de mensagem: generoso pro atendimento real, suficiente pra barrar disparo em massa. */
  envioDeMensagem: { maximo: 60, janelaSegundos: 60 },
  /** Chamadas que custam dinheiro (IA, mídia da Meta): por workspace, não por pessoa. */
  custoExterno: { maximo: 30, janelaSegundos: 60 },
  /** Rotas autenticadas comuns: teto alto, só pra conter laço acidental ou raspagem. */
  padraoAutenticado: { maximo: 300, janelaSegundos: 60 },
} as const satisfies Record<string, PoliticaDeLimite>;

export type ResultadoDoLimite = {
  permitido: boolean;
  /** Quantos segundos faltam pra janela virar — vai no cabeçalho `Retry-After`. */
  esperarSegundos: number;
};

/**
 * Conta uma chamada e diz se ela cabe.
 *
 * `chave` deve descrever QUEM está chamando e O QUÊ: um IP sozinho pune escritórios inteiros que
 * saem pelo mesmo endereço, e um usuário sozinho não protege o login (onde ainda não há usuário).
 * Por isso quem chama monta a chave conforme o caso.
 */
export function contarChamada(chave: string, politica: PoliticaDeLimite): ResultadoDoLimite {
  const agora = Date.now();
  limpar(agora);

  const registro = contadores.get(chave);
  if (!registro || registro.expiraEm <= agora) {
    contadores.set(chave, { contagem: 1, expiraEm: agora + politica.janelaSegundos * 1000 });
    return { permitido: true, esperarSegundos: 0 };
  }

  registro.contagem += 1;
  if (registro.contagem > politica.maximo) {
    return { permitido: false, esperarSegundos: Math.ceil((registro.expiraEm - agora) / 1000) };
  }
  return { permitido: true, esperarSegundos: 0 };
}

/**
 * IP de quem chamou, atrás do proxy da hospedagem.
 *
 * `x-forwarded-for` pode vir com uma cadeia; o primeiro é o cliente original. É um valor que o
 * cliente NÃO controla sozinho aqui porque a Vercel reescreve o cabeçalho — mas ainda assim ele
 * nunca é usado como identidade, só como um dos ingredientes do limite.
 */
export async function ipDeQuemChamou(): Promise<string> {
  const cabecalhos = await headers();
  const encaminhado = cabecalhos.get("x-forwarded-for");
  return encaminhado?.split(",")[0]?.trim() || cabecalhos.get("x-real-ip") || "desconhecido";
}

/** Resposta padrão de limite estourado. Diz só o necessário — nada sobre a política interna. */
export function respostaDeLimiteExcedido(esperarSegundos: number): Response {
  return new Response(
    JSON.stringify({ erro: "Muitas tentativas. Aguarde um momento e tente de novo." }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(esperarSegundos),
        "cache-control": "no-store",
      },
    },
  );
}
