/**
 * A FOTO DE PERFIL FICA GUARDADA, NÃO LINKADA.
 *
 * O defeito que isto corrige: o WhatsApp guardava o endereço que a Evolution devolve
 * (`pps.whatsapp.net/...`), e esse endereço EXPIRA em algumas horas. Depois disso a imagem não
 * carrega mais, e a conversa passa a mostrar o ícone genérico pra sempre — porque o campo não
 * está vazio, então nada nunca tentava buscar de novo. Grupo visto na semana passada ficava sem
 * foto; grupo visto hoje aparecia. Era essa a diferença.
 *
 * O Instagram já fazia certo (baixava e guardava), e esta é a mesma função, agora num lugar que os
 * dois canais alcançam — duas cópias divergiriam na primeira correção feita só de um lado.
 *
 * Guardar imagem no banco tem custo, e ele é aceito conscientemente: foto de perfil tem dezenas de
 * kilobytes, o teto aqui é 2 MB, e a alternativa é uma tela de atendimento onde metade das pessoas
 * não tem rosto.
 */

/** Teto do que vale guardar embutido. Acima disso não é foto de perfil. */
import { motivoDaFalha, prazoDe, PRAZO_DOWNLOAD_MS } from "@/lib/integracoes/prazo";

const TETO_BYTES = 2 * 1024 * 1024;

/**
 * Esta foto precisa ser baixada?
 *
 * Sim quando não há nada guardado, e TAMBÉM quando o que está guardado é um ENDEREÇO: ou ele já
 * expirou, ou vai expirar. Só o `data:` é definitivo — é a imagem em si, dentro do banco.
 *
 * É o que faz a correção alcançar o que já está gravado: sem esta segunda condição, toda conversa
 * que hoje tem um link quebrado continuaria quebrada, porque o campo não está vazio.
 */
export function precisaBaixarFoto(guardada: string | null | undefined): boolean {
  if (!guardada) return true;
  return !guardada.startsWith("data:");
}

/** Baixa a imagem e devolve como `data:` pra guardar. `null` quando não dá — e não dar é comum
 *  (perfil sem foto, endereço já expirado), não é erro que mereça derrubar o recebimento. */
export async function baixarFotoDePerfil(url: string): Promise<string | null> {
  try {
    // Prazo: o CDN da Meta às vezes aceita a conexão e não responde. Sem isto, o recebimento da
    // mensagem ficava pendurado aqui até a função ser morta. Ver `prazo.ts`.
    const resposta = await fetch(url, { signal: prazoDe(PRAZO_DOWNLOAD_MS) });
    if (!resposta.ok) return null;
    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (bytes.length > TETO_BYTES) return null;
    const mimeType = resposta.headers.get("content-type") ?? "image/jpeg";
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  } catch (erro) {
    console.error("[foto-de-perfil] falha ao baixar:", motivoDaFalha(erro, PRAZO_DOWNLOAD_MS));
    return null;
  }
}
