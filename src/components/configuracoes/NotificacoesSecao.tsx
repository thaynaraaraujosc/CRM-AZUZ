"use client";

import { Toggle } from "@/components/ui";
import { EVENTOS_NOTIFICACAO, useConfiguracoes, type FrequenciaNotificacao } from "@/lib/configuracoes-context";
import { useNotificacoes } from "@/lib/notificacoes-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

const CANAIS: { chave: "dentroCrm" | "email" | "push" | "whatsapp"; label: string }[] = [
  { chave: "dentroCrm", label: "Dentro do CRM" },
  { chave: "email", label: "E-mail" },
  { chave: "push", label: "Push" },
  { chave: "whatsapp", label: "WhatsApp" },
];

const FREQUENCIAS: { valor: FrequenciaNotificacao; label: string }[] = [
  { valor: "imediatamente", label: "Imediatamente" },
  { valor: "resumo_diario", label: "Resumo diário" },
  { valor: "resumo_semanal", label: "Resumo semanal" },
  { valor: "desativado", label: "Desativado" },
];

/** Notificações — todo controle desta tela persiste de verdade: os 3 toggles de topo salvam via
 * `notificacoes-context.tsx` (chave `"notificacoes"`), a matriz evento × canal × frequência salva
 * via `configuracoes-context.tsx` (chave `"configuracoes"`) — chaves diferentes de preferência, mas
 * as duas gravam no banco (`Preferencia`) e sobrevivem a refresh/logout. Nenhum controle aqui é só
 * visual. (O que ainda não existe é o *disparo* de verdade — e-mail/push/WhatsApp respeitando essa
 * matriz —, fora do escopo desta tela: aqui só a preferência é configurada.) */
export function NotificacoesSecao() {
  const {
    notificacoesAtivas,
    alternarNotificacoes,
    notificarNovaTarefa,
    alternarNotificarNovaTarefa,
    notificarComentario,
    alternarNotificarComentario,
    simularNovaTarefa,
    simularComentario,
  } = useNotificacoes();
  const { estado, atualizarNotificacao } = useConfiguracoes();

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Notificações" descricao="Quando e como você é avisado sobre o que acontece no CRM." />

      <div className="config-bloco">
        <p className="config-bloco-titulo">Aviso na tela (já ativo)</p>
        <div className="toggle-row" style={{ padding: "0 0 14px", borderBottom: "1px solid var(--line-soft)" }}>
          <span className="tl">Avisar quando chegar mensagem nova no WhatsApp</span>
          <Toggle defaultOn={notificacoesAtivas} label="Avisar quando chegar mensagem nova no WhatsApp" onToggle={alternarNotificacoes} />
        </div>
        <div className="toggle-row" style={{ padding: "14px 0", borderBottom: "1px solid var(--line-soft)" }}>
          <span className="tl">Avisar quando criar uma tarefa nova</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" className="btn ghost" onClick={() => simularNovaTarefa("Ligar pra confirmar consulta")}>
              Testar
            </button>
            <Toggle defaultOn={notificarNovaTarefa} label="Avisar quando criar uma tarefa nova" onToggle={alternarNotificarNovaTarefa} />
          </span>
        </div>
        <div className="toggle-row" style={{ padding: "14px 0 0" }}>
          <span className="tl">Avisar quando alguém comentar</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" className="btn ghost" onClick={() => simularComentario("Bruno Salles")}>
              Testar
            </button>
            <Toggle defaultOn={notificarComentario} label="Avisar quando alguém comentar" onToggle={alternarNotificarComentario} />
          </span>
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Preferências por evento</p>
        <div className="config-tabela-scroll">
          <table className="config-tabela-notif">
            <thead>
              <tr>
                <th>Evento</th>
                {CANAIS.map((c) => (
                  <th key={c.chave}>{c.label}</th>
                ))}
                <th>Frequência</th>
              </tr>
            </thead>
            <tbody>
              {EVENTOS_NOTIFICACAO.map((evento) => {
                const pref = estado.notificacoes[evento.id];
                return (
                  <tr key={evento.id}>
                    <td>{evento.label}</td>
                    {CANAIS.map((c) => (
                      <td key={c.chave}>
                        <input
                          type="checkbox"
                          checked={pref[c.chave]}
                          onChange={(e) => atualizarNotificacao(evento.id, { [c.chave]: e.target.checked })}
                          aria-label={`${evento.label} · ${c.label}`}
                        />
                      </td>
                    ))}
                    <td>
                      <select
                        className="input"
                        value={pref.frequencia}
                        onChange={(e) => atualizarNotificacao(evento.id, { frequencia: e.target.value as FrequenciaNotificacao })}
                      >
                        {FREQUENCIAS.map((f) => (
                          <option key={f.valor} value={f.valor}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
