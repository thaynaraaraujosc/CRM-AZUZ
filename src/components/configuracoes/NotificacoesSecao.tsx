"use client";

import { Toggle } from "@/components/ui";
import { useNotificacoes } from "@/lib/notificacoes-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

/** Notificações — só o que chega de verdade: mensagem nova no WhatsApp (real, ver
 * `NotificacoesPonte`) e tarefa nova (real, disparado em `tarefas/page.tsx` ao criar). Os dois
 * toggles persistem via `notificacoes-context.tsx` (banco real, sobrevive a refresh/logout). A
 * antiga "preferência por evento" (matriz canal × frequência) saiu — eram preferências de coisas
 * que nunca chegavam a ser enviadas de verdade (e-mail/push/WhatsApp), só a tela dentro do CRM
 * existe hoje. */
export function NotificacoesSecao() {
  const { notificacoesAtivas, alternarNotificacoes, notificarNovaTarefa, alternarNotificarNovaTarefa } = useNotificacoes();

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Notificações" descricao="Quando e como você é avisado sobre o que acontece no CRM." />

      <div className="config-bloco">
        <div className="toggle-row" style={{ padding: "0 0 14px", borderBottom: "1px solid var(--line-soft)" }}>
          <span className="tl">Avisar quando chegar mensagem nova no WhatsApp</span>
          <Toggle defaultOn={notificacoesAtivas} label="Avisar quando chegar mensagem nova no WhatsApp" onToggle={alternarNotificacoes} />
        </div>
        <div className="toggle-row" style={{ padding: "14px 0 0" }}>
          <span className="tl">Avisar quando criar uma tarefa nova</span>
          <Toggle defaultOn={notificarNovaTarefa} label="Avisar quando criar uma tarefa nova" onToggle={alternarNotificarNovaTarefa} />
        </div>
      </div>
    </div>
  );
}
