import { randomInt } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { encriptar } from "@/lib/integracoes/crypto";
import { chamarGraph } from "@/lib/integracoes/meta";

/**
 * Passos comuns às DUAS formas de conectar uma conta do WhatsApp Business oficial:
 *
 *   - Embedded Signup (`/api/integracoes/meta/whatsapp/conectar`) — a Meta cria a conta do cliente
 *     dentro do popup e devolve um `code`, que vira token;
 *   - conexão direta (`/api/integracoes/meta/whatsapp/conectar-manual`) — a conta JÁ existe e o
 *     token permanente vem de um usuário do sistema do próprio Business.
 *
 * A diferença entre elas é só COMO o token chega. Depois disso, inscrever o app na WABA, registrar
 * o número e ler os metadados é idêntico — daí morar aqui em vez de duplicado nas duas rotas.
 */
export const PASSOS = ["token", "inscrever_waba", "registrar_numero", "metadados"] as const;
export type Passo = (typeof PASSOS)[number];

/** `metadados` é Json (união de formatos por provedor) — o cast é só pro TS, o valor já é JSON puro. */
function comoJson(valor: Record<string, unknown>): Prisma.InputJsonValue {
  return valor as Prisma.InputJsonValue;
}

type NumeroWaba = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
};

export type ResultadoConexao = {
  ok: true;
  pin: string | null;
  pinPendente: boolean;
  /** `true` quando o número vive no app do WhatsApp Business (SMB/coexistência) e a Meta não
   * aceita o passo de registro — não há PIN a gerar nesse modo. */
  registroDispensado: boolean;
};

export class ErroConexao extends Error {
  passo: Passo;
  constructor(mensagem: string, passo: Passo) {
    super(mensagem);
    this.passo = passo;
  }
}

/**
 * Do token em diante: inscreve o app na WABA (sem isso o webhook NUNCA dispara pra esse cliente —
 * tudo parece conectado e nenhuma mensagem chega), registra o número na Cloud API e grava os
 * metadados. O passo alcançado fica em `metadados.passoConexao`, então uma nova tentativa retoma
 * de onde parou em vez de obrigar a refazer tudo.
 */
export async function finalizarConexaoWhatsapp({
  workspaceId,
  accessToken,
  wabaId,
  phoneNumberId,
  businessId,
  pinExistente,
  metadadosAnteriores = {},
  metadadosExtras = {},
}: {
  workspaceId: string;
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
  pinExistente?: string;
  metadadosAnteriores?: Record<string, unknown>;
  /** Marcas de origem da conexão (ex.: `{ conexao: "manual" }`) guardadas junto dos metadados. */
  metadadosExtras?: Record<string, unknown>;
}): Promise<ResultadoConexao> {
  let passo: Passo = "inscrever_waba";
  try {
    // ---- Inscrever o app na WABA do cliente ----
    await chamarGraph(`/${wabaId}/subscribed_apps`, accessToken, { method: "POST" });

    // ---- Registrar o número na Cloud API ----
    passo = "registrar_numero";
    // PIN de 6 dígitos gerado aqui (nunca no navegador) — guardado criptografado e devolvido uma
    // única vez, pra pessoa anotar. Com `pinExistente`, usa o que ela informou (número já
    // registrado antes com outro PIN recusa um PIN novo).
    const pin = pinExistente ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
    let pinJaRegistrado = false;
    let registroDispensado = false;
    try {
      await chamarGraph(`/${phoneNumberId}/register`, accessToken, {
        method: "POST",
        body: { messaging_product: "whatsapp", pin },
      });
    } catch (erro) {
      // Número já registrado com outro PIN: não é motivo pra abortar a conexão inteira — o resto
      // funciona, e a tela pede o PIN antigo pra completar esse passo depois.
      const codigoMeta = (erro as Error & { codigoMeta?: number }).codigoMeta;
      const mensagemMeta = erro instanceof Error ? erro.message : "";
      if (codigoMeta === 133005 || codigoMeta === 133010) {
        pinJaRegistrado = true;
      } else if (/not available for SMB/i.test(mensagemMeta)) {
        // Conta de número que vive no app do WhatsApp Business (SMB/coexistência), não uma conta
        // criada direto na Cloud API: ali o número já nasce registrado e a Meta recusa o
        // `/register` por completo. Não é falha de conexão — é um passo que não se aplica, então
        // segue em frente sem PIN (não existe PIN a gerar nesse modo).
        registroDispensado = true;
      } else {
        throw erro;
      }
    }

    // ---- Buscar e salvar os metadados da conta ----
    passo = "metadados";
    const waba = await chamarGraph<{ id: string; name?: string; currency?: string; timezone_id?: string }>(
      `/${wabaId}?fields=id,name,currency,timezone_id`,
      accessToken,
    );
    const numeros = await chamarGraph<{ data?: NumeroWaba[] }>(
      `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`,
      accessToken,
    );
    const numero = numeros.data?.find((n) => n.id === phoneNumberId) ?? numeros.data?.[0];

    const metadadosFinal = comoJson({
      ...metadadosAnteriores,
      ...metadadosExtras,
      businessId,
      wabaId,
      wabaNome: waba.name,
      moeda: waba.currency,
      fusoHorario: waba.timezone_id,
      phoneNumberId,
      numeroExibicao: numero?.display_phone_number,
      numeroVerificado: numero?.verified_name,
      qualityRating: numero?.quality_rating,
      verificacaoNumero: numero?.code_verification_status,
      registerPinCriptografado:
        pinJaRegistrado || registroDispensado ? metadadosAnteriores.registerPinCriptografado : encriptar(pin),
      pinPendente: pinJaRegistrado,
      registroDispensado,
      passoConexao: "concluido",
      ultimaVerificacaoSaude: new Date().toISOString(),
    });

    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor: "meta_whatsapp" } },
      create: {
        id: `integracao-${workspaceId}-meta_whatsapp`,
        workspaceId,
        provedor: "meta_whatsapp",
        status: "conectado",
        accessTokenCriptografado: encriptar(accessToken),
        metadados: metadadosFinal,
        erroMensagem: null,
      },
      update: {
        status: "conectado",
        accessTokenCriptografado: encriptar(accessToken),
        metadados: metadadosFinal,
        erroMensagem: null,
      },
    });

    // O PIN só sai daqui nesta resposta, uma vez — depois disso fica só criptografado no banco.
    return {
      ok: true,
      pin: pinJaRegistrado || registroDispensado ? null : pin,
      pinPendente: pinJaRegistrado,
      registroDispensado,
    };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao conectar o WhatsApp Business.";
    throw new ErroConexao(mensagem, passo);
  }
}

/** Grava a falha na integração preservando o passo alcançado, pra próxima tentativa retomar dali. */
export async function salvarFalhaConexao({
  workspaceId,
  mensagem,
  passo,
  wabaId,
  phoneNumberId,
  businessId,
  accessToken,
  metadadosAnteriores = {},
}: {
  workspaceId: string;
  mensagem: string;
  passo: Passo;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  accessToken?: string | null;
  metadadosAnteriores?: Record<string, unknown>;
}) {
  const metadados = comoJson({ ...metadadosAnteriores, wabaId, phoneNumberId, businessId, passoConexao: passo });
  const token = accessToken ? { accessTokenCriptografado: encriptar(accessToken) } : {};
  await prisma.integracao.upsert({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_whatsapp" } },
    create: {
      id: `integracao-${workspaceId}-meta_whatsapp`,
      workspaceId,
      provedor: "meta_whatsapp",
      status: "erro",
      erroMensagem: mensagem,
      metadados,
      ...token,
    },
    update: { status: "erro", erroMensagem: mensagem, metadados, ...token },
  });
}
