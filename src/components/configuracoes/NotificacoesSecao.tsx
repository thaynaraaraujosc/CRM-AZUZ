"use client";

import { Toggle } from "@/components/ui";
import { useNotificacoes } from "@/lib/notificacoes-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

/** Notificações: só o que chega de verdade, hoje mensagem nova numa conversa (ver
 * `NotificacoesPonte`). O toggle persiste via `notificacoes-context.tsx` (banco real, sobrevive a
 * refresh/logout). A antiga "preferência por evento" (matriz canal × frequência) saiu: eram
 * preferências de envios que nunca aconteciam de verdade (e-mail/push/WhatsApp), só a tela dentro
 * do CRM existe hoje. O toggle de "tarefa nova" saiu com o módulo de Tarefas, pelo mesmo motivo:
 * sem nada que crie tarefa, ele não ligava nem desligava aviso nenhum. */
export function NotificacoesSecao() {
  const { notificacoesAtivas, alternarNotificacoes } = useNotificacoes();

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Notificações" descricao="Quando e como você é avisado sobre o que acontece no CRM." />

      <div className="config-bloco">
        <div className="toggle-row">
          <span className="tl">Avisar quando chegar mensagem nova</span>
          <Toggle defaultOn={notificacoesAtivas} label="Avisar quando chegar mensagem nova" onToggle={alternarNotificacoes} />
        </div>
      </div>
    </div>
  );
}
