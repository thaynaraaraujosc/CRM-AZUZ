"use client";

import { useEffect, useRef } from "react";

import { useConversas } from "@/lib/conversas-context";
import { useNotificacoes } from "@/lib/notificacoes-context";
import { conversasComNovidade, fotoDasConversas } from "@/lib/notificacoes/novidades";

/**
 * Liga o sino de notificações a mensagens reais: `conversas-context.tsx` já busca
 * `/api/conversas` a cada 5s (o `naoLidas` de cada conversa vem do banco, incrementado de verdade
 * pelo webhook — ver `src/lib/conversas/upsert.ts`). Aqui só comparamos o `naoLidas` desta busca
 * com o da anterior: se subiu, chegou mensagem nova. Fica solto no layout, fora de qualquer
 * página, porque o aviso vale em qualquer tela do CRM.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * O QUE ESTAVA ERRADO: A ENXURRADA AO ABRIR O CRM.
 *
 * "Não fica mandando notificação atrasada. Quando eu abri o CRM, aparecem todas as notificações
 * que estavam. Não precisa — só as que chegarem."
 *
 * A comparação já pulava a primeira passagem (`if (anterior)`), e mesmo assim avisava de tudo. O
 * motivo é que a primeira passagem acontecia ANTES da busca voltar: o provider começa com a lista
 * vazia, então a foto de referência era `{}`. Quando os dados chegavam no segundo render, toda
 * conversa não lida tinha `antes = 0` e `naoLidas > 0` — e cada uma virava um aviso. Abrir o CRM
 * com doze conversas por ler disparava doze toasts e doze apitos de mensagens que, em alguns
 * casos, eram de ontem.
 *
 * A correção é esperar a lista EXISTIR antes de tirar a foto. `carregando` é o que diz isso, e
 * nenhum aviso sai antes dele virar `false`.
 *
 * CONVERSA QUE APARECE DEPOIS DA FOTO continua avisando: é gente nova escrevendo pela primeira
 * vez, que é exatamente o aviso que não pode faltar. A diferença entre as duas situações é só
 * ter havido uma foto antes — e agora há.
 */
export function NotificacoesPonte() {
  const { conversas, carregando } = useConversas();
  const { notificarNovaMensagem } = useNotificacoes();
  /** `null` = ainda não houve foto, e enquanto for assim nada avisa. */
  const anteriorRef = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    // Sem lista carregada não há foto, e sem foto não há "subiu". Abrir o CRM não é evento.
    if (carregando) return;

    // A regra mora em `notificacoes/novidades.ts`, com teste: é a diferença entre avisar e
    // incomodar, e o defeito que ela corrige era invisível de ler aqui dentro.
    for (const c of conversasComNovidade(anteriorRef.current, conversas)) {
      notificarNovaMensagem(c.nome, c.canal);
    }
    anteriorRef.current = fotoDasConversas(conversas);
  }, [conversas, carregando, notificarNovaMensagem]);

  return null;
}
