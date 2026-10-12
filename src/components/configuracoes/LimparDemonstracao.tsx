"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

import { IconAlerta } from "@/components/icons";
import { WORKSPACE_DEMO } from "@/lib/demo/identidade";
import { useIdioma } from "@/lib/idioma-context";

type Resumo = { mensagens: number; conversas: number; cards: number; tarefas: number; contatos: number };

/**
 * Tira o cenário fictício da conta de demonstração, deixando o que chegou de verdade.
 *
 * Só aparece DENTRO da demonstração: em qualquer outra conta não teria o que fazer, e um botão que
 * fala em apagar aparecendo onde não se aplica é convite a susto.
 *
 * Por que não serve "Remontar", que já existe no painel de super-admin: remontar apaga o workspace
 * inteiro e recria o cenário. Com um número real conectado na demonstração — que foi o que
 * aconteceu —, remontar levaria junto a conversa de gente de verdade E traria os 18 contatos
 * fictícios de volta. Pra gravar vídeo é o contrário que se quer.
 */
export function LimparDemonstracao({ aoLimpar }: { aoLimpar?: () => void }) {
  const { t: traduzir } = useIdioma();
  const { data: sessao } = useSession();
  const [limpando, setLimpando] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (sessao?.user?.workspaceId !== WORKSPACE_DEMO) return null;

  async function limpar() {
    const confirmado = window.confirm(
      "Apagar o cenário fictício da demonstração?\n\n" +
        "Saem os 18 contatos de exemplo (Clínica Aurora), as conversas e mensagens deles, os cards " +
        "de funil e as tarefas montadas.\n\n" +
        "FICA tudo que chegou de verdade: conversa de número real, contato criado à mão, o funil e " +
        "suas etapas, e o acesso à conta.\n\n" +
        "Isso não tem como desfazer.",
    );
    if (!confirmado) return;

    setLimpando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/admin/demo/limpar", { method: "POST" });
      const dados = (await resposta.json()) as { erro?: string; resumo?: Resumo };
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao limpar.");
      setResumo(dados.resumo ?? null);
      aoLimpar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : traduzir("Falha ao limpar."));
    } finally {
      setLimpando(false);
    }
  }

  return (
    <div className="card" style={{ padding: 14, marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="int-title" style={{ margin: 0 }}>{traduzir("Limpar o cenário de demonstração")}</p>
          <p className="hint" style={{ margin: "4px 0 0" }}>
            {traduzir(
              "Apaga os contatos, conversas, cards e tarefas de exemplo. O que chegou de verdade fica.",
            )}
          </p>
        </div>
        <button type="button" className="btn danger" onClick={() => void limpar()} disabled={limpando}>
          {limpando ? traduzir("Limpando…") : traduzir("Limpar exemplos")}
        </button>
      </div>

      {resumo ? (
        <p className="hint" style={{ marginTop: 10 }}>
          {traduzir(
            "Pronto: {contatos} contatos, {conversas} conversas, {mensagens} mensagens, {cards} cards e {tarefas} tarefas removidos.",
            resumo,
          )}
        </p>
      ) : null}

      {erro ? (
        <p className="hint" style={{ color: "var(--danger)", marginTop: 10 }}>
          <IconAlerta width={12} height={12} aria-hidden="true" /> {erro}
        </p>
      ) : null}
    </div>
  );
}
