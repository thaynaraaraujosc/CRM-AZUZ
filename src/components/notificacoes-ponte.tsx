"use client";

import { useEffect, useRef } from "react";

import { useConversas } from "@/lib/conversas-context";
import { useNotificacoes } from "@/lib/notificacoes-context";

/**
 * Liga o sino de notificações a mensagens reais do WhatsApp: `conversas-context.tsx` já faz
 * polling de `/api/conversas` a cada 5s (o `naoLidas` de cada conversa vem do banco, incrementado
 * de verdade pelo webhook — ver `src/lib/conversas/upsert.ts`). Aqui só comparamos o `naoLidas`
 * desta busca com o da anterior: se subiu, chegou mensagem nova de verdade, dispara o aviso.
 * Fica solto no layout (fora de qualquer página) porque o aviso precisa valer em qualquer tela do
 * CRM, não só dentro de Conversas.
 */
export function NotificacoesPonte() {
  const { conversas } = useConversas();
  const { notificarNovaMensagem } = useNotificacoes();
  const anteriorRef = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    const anterior = anteriorRef.current;
    if (anterior) {
      for (const c of conversas) {
        const antes = anterior.get(c.id) ?? 0;
        if (c.naoLidas > antes) {
          notificarNovaMensagem(c.nome);
        }
      }
    }
    anteriorRef.current = new Map(conversas.map((c) => [c.id, c.naoLidas]));
  }, [conversas, notificarNovaMensagem]);

  return null;
}
