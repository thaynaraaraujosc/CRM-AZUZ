"use client";

import { useState } from "react";
import { IconAlerta } from "@/components/icons";

/**
 * Limpeza avulsa do que um WhatsApp já desconectado deixou para trás — conversas, contatos criados
 * sozinhos e cards de funil daqueles leads.
 *
 * Só aparece com nenhum canal conectado: com um canal ativo, o caminho é o próprio "Desconectar"
 * (que já pergunta se deve apagar). Isso existe para quem desconectou ANTES da limpeza existir e
 * ficou com o espelho antigo no CRM, sem forma de removê-lo.
 */
type Resumo = { conversas: number; mensagens: number; contatos: number; cards: number };
type ResumoGrupos = { contatos: number; cards: number };

export function LimparDadosWhatsApp({ aoLimpar }: { aoLimpar?: () => void }) {
  const [limpando, setLimpando] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [resumoGrupos, setResumoGrupos] = useState<ResumoGrupos | null>(null);
  const [limpandoGrupos, setLimpandoGrupos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Grupos que viraram contato/card por um bug antigo — é entulho em qualquer cenário, não apaga
  // conversa nenhuma e não depende de canal conectado, então não precisa do aviso pesado abaixo.
  async function limparGrupos() {
    setLimpandoGrupos(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/integracoes/whatsapp/limpar-dados", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "grupos" }),
      });
      const dados = (await resposta.json()) as { erro?: string; grupos?: ResumoGrupos };
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao limpar.");
      setResumoGrupos(dados.grupos ?? { contatos: 0, cards: 0 });
      aoLimpar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao limpar.");
    } finally {
      setLimpandoGrupos(false);
    }
  }

  async function limpar() {
    const confirmado = window.confirm(
      "Apagar tudo que veio do WhatsApp que estava conectado antes?\n\n" +
        "Serão removidos as conversas e mensagens, os contatos criados automaticamente e os cards " +
        "de funil desses leads. Contatos e cards que você criou à mão ficam.\n\n" +
        "Isso não tem como desfazer.",
    );
    if (!confirmado) return;

    setLimpando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/integracoes/whatsapp/limpar-dados", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conexao: "nao_oficial" }),
      });
      const dados = (await resposta.json()) as { erro?: string; limpeza?: Resumo };
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao limpar.");
      setResumo(dados.limpeza ?? null);
      aoLimpar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao limpar.");
    } finally {
      setLimpando(false);
    }
  }

  if (resumo) {
    return (
      <p className="hint" style={{ margin: "10px 0 0" }}>
        Limpeza concluída — {resumo.conversas} conversas, {resumo.mensagens} mensagens,{" "}
        {resumo.contatos} contatos e {resumo.cards} cards removidos.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ marginBottom: 14 }}>
        {resumoGrupos ? (
          <p className="hint" style={{ margin: 0 }}>
            {resumoGrupos.contatos + resumoGrupos.cards === 0
              ? "Nenhum grupo estava ocupando lugar de contato ou de negócio."
              : `Removidos ${resumoGrupos.contatos} contatos e ${resumoGrupos.cards} cards que eram grupos.`}
          </p>
        ) : (
          <>
            <button type="button" className="btn ghost" onClick={limparGrupos} disabled={limpandoGrupos}>
              {limpandoGrupos ? "Removendo…" : "Tirar grupos da carteira e do funil"}
            </button>
            <p className="hint" style={{ margin: "6px 0 0" }}>
              Grupos do WhatsApp viraram contato e card de negócio por um erro antigo (aparecem com
              número tipo “+120363422457482263”). As conversas dos grupos continuam intactas.
            </p>
          </>
        )}
      </div>

      <button type="button" className="btn ghost" onClick={limpar} disabled={limpando}>
        {limpando ? "Limpando…" : "Limpar dados do WhatsApp anterior"}
      </button>
      <p className="hint" style={{ margin: "6px 0 0" }}>
        Remove as conversas, contatos e cards de funil que sobraram de um WhatsApp já desconectado,
        pra não se misturarem com o próximo número que você conectar.
      </p>
      {erro ? (
        <p className="hint" style={{ color: "var(--danger)", marginTop: 6 }}><IconAlerta width={12} height={12} aria-hidden="true" /> {erro}</p>
      ) : null}
    </div>
  );
}
