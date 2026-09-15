import { redirect } from "next/navigation";

import { ROTA_INICIAL } from "@/lib/rota-inicial";

/**
 * O antigo painel de início, agora só uma passagem.
 *
 * A tela saiu porque ninguém a usava: nem quem construiu o CRM abria aquilo pra ver pendência. Mas
 * o endereço continua existindo em favorito de navegador, em link antigo e no histórico de quem já
 * usava — e apagar a rota transformaria tudo isso em "página não encontrada", que é uma forma
 * grosseira de comunicar uma decisão de produto.
 *
 * Redireciona em vez de existir.
 */
export default function InicioPage() {
  redirect(ROTA_INICIAL);
}
