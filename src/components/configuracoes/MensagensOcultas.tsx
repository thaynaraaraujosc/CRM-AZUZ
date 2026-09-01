"use client";

import { useEffect, useState } from "react";

type Diagnostico = {
  invisiveis: { contaCanal: string | null; canal: string | null; quantidade: number }[];
};

/**
 * Recupera mensagens que estão gravadas mas não aparecem na tela.
 *
 * Toda mensagem carrega de qual conexão ela é — é isso que faz a caixa de entrada esvaziar ao
 * desconectar um número e voltar inteira ao reconectar. As mensagens que o CRM enviava nasciam sem
 * essa marca (o navegador não sabe por qual número a conversa fala), então ficavam invisíveis. O
 * defeito já está corrigido para as novas; este botão conserta as que ficaram para trás.
 *
 * Só aparece quando há algo a recuperar — some sozinho depois, pra ninguém encontrar um botão de
 * manutenção sem função.
 */
export function MensagensOcultas() {
  const [ocultas, setOcultas] = useState<number | null>(null);
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/conversas/diagnostico")
      .then((r) => r.json())
      .then((d: Diagnostico) =>
        setOcultas((d.invisiveis ?? []).reduce((soma, i) => soma + i.quantidade, 0)),
      )
      .catch(() => setOcultas(0));
  }, []);

  async function recuperar() {
    setRodando(true);
    setResultado(null);
    try {
      const resposta = await fetch("/api/conversas/diagnostico", { method: "POST" });
      const dados = (await resposta.json()) as { adotadas: number; aindaOrfas: number; fotosCopiadas: number };
      setOcultas(dados.aindaOrfas);
      setResultado(
        dados.adotadas > 0
          ? `${dados.adotadas} mensagens voltaram pras conversas.` +
              (dados.aindaOrfas > 0
                ? ` Outras ${dados.aindaOrfas} são do WhatsApp por QR Code e voltam quando você reconectar aquele número.`
                : "")
          : "Nada a recuperar: as que restam são de um canal desconectado e voltam sozinhas ao reconectar.",
      );
      if (dados.fotosCopiadas > 0) {
        setResultado(
          (atual) => `${atual ?? ""} ${dados.fotosCopiadas} fotos de perfil também foram levadas pros contatos.`,
        );
      }
    } catch {
      setResultado("Não deu pra recuperar agora. Tente de novo em instantes.");
    } finally {
      setRodando(false);
    }
  }

  if (ocultas === null || ocultas === 0) return resultado ? <p className="hint">{resultado}</p> : null;

  return (
    <div className="int-group">
      <p className="int-group-h">Mensagens ocultas</p>
      <p className="hint" style={{ padding: "0 4px 8px" }}>
        {ocultas} mensagens estão guardadas mas não aparecem nas conversas. Isso acontecia com as
        mensagens enviadas pelo CRM antes de uma correção recente — elas não foram perdidas.
      </p>
      <button type="button" className="btn ghost" disabled={rodando} onClick={() => void recuperar()}>
        {rodando ? "Recuperando…" : "Recuperar mensagens"}
      </button>
      {resultado ? (
        <p className="hint" style={{ paddingTop: 8 }}>
          {resultado}
        </p>
      ) : null}
    </div>
  );
}
