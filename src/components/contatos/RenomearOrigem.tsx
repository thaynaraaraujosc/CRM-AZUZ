"use client";

import { useEffect, useState } from "react";

import type { ContagemRenomeacao } from "@/app/api/contatos/renomear-origem/route";

/**
 * O aviso que aparece quando ainda existem contatos com a origem antiga "Indicação".
 *
 * Fica na tela de Contatos, e não escondido em Configurações: é aqui que a pessoa vê a palavra
 * errada na coluna Origem, e é aqui que ela vai querer arrumar. Some sozinho quando não sobra
 * nada, então não vira mais um item permanente na tela.
 *
 * Diz QUANTOS antes de mudar. Reescrever uma coluna de todos os contatos com um clique cego é o
 * tipo de coisa que não se oferece.
 */
export function RenomearOrigem({ aoRenomear }: { aoRenomear: () => void }) {
  const [quantos, setQuantos] = useState<number | null>(null);
  const [renomeando, setRenomeando] = useState(false);
  const [feito, setFeito] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/contatos/renomear-origem")
      .then((r) => (r.ok ? (r.json() as Promise<ContagemRenomeacao>) : null))
      .then((dados) => {
        if (vivo && dados) setQuantos(dados.quantos);
      })
      // Silêncio de propósito: quem não é admin recebe 403, e isso não é um erro pra mostrar.
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  async function renomear() {
    setRenomeando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/contatos/renomear-origem", { method: "POST" });
      if (!resposta.ok) throw new Error(String(resposta.status));
      const dados = (await resposta.json()) as ContagemRenomeacao;
      setFeito(dados.quantos);
      setQuantos(0);
      aoRenomear();
    } catch {
      setErro("Não deu pra renomear agora. Tente de novo.");
    } finally {
      setRenomeando(false);
    }
  }

  if (feito !== null) {
    return (
      <div className="migrar-aviso pronto">
        <strong>
          {feito} contato{feito === 1 ? "" : "s"} {feito === 1 ? "passou" : "passaram"} a mostrar
          &quot;Salvo manualmente&quot;.
        </strong>
        <span>Só a coluna Origem mudou. Nome, telefone, etapa e histórico ficaram como estavam.</span>
      </div>
    );
  }

  if (!quantos) return null;

  return (
    <div className="migrar-aviso">
      <div className="migrar-aviso-texto">
        <strong>
          {quantos} contato{quantos === 1 ? " tem" : "s têm"} a origem antiga &quot;Indicação&quot;.
        </strong>
        <span>
          Era o que o CRM gravava em todo contato criado à mão, mas indicação é uma afirmação sobre
          como a pessoa chegou, e o sistema só sabe que alguém digitou um nome. Eles já aparecem no
          filtro &quot;Salvo manualmente&quot;; isto acerta o que está gravado. Negócios do funil não
          são tocados: lá a origem Indicação é uma escolha de verdade.
        </span>
      </div>
      <button
        type="button"
        className="btn primary mt8"
        onClick={renomear}
        disabled={renomeando}
      >
        {renomeando ? "Renomeando…" : "Renomear para Salvo manualmente"}
      </button>
      {erro ? (
        <p className="hint mt8" style={{ color: "var(--danger)" }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}
