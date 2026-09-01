"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/ui";
import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";

/**
 * Transferir um negócio: responsável, funil e etapa — numa janela só, usada em todo o CRM.
 *
 * Existe pra que os três caminhos (menu do card, painel do funil, configurações da conversa)
 * produzam exatamente o mesmo efeito no banco. Três implementações separadas divergiriam na
 * primeira correção feita só numa delas — e a divergência apareceria como "transferi por um lugar
 * e por outro não funcionou", o tipo de bug que ninguém consegue reproduzir.
 *
 * As três propriedades são independentes de propósito:
 *
 * - RESPONSÁVEL é a pessoa que atende;
 * - FUNIL é o pipeline onde o negócio está;
 * - ETAPA é a posição dentro daquele pipeline.
 *
 * Trocar de funil não troca o vendedor, e trocar o vendedor não move o negócio. Amarrar as duas
 * coisas obrigaria a inventar um funil por vendedor, que não é como o comercial funciona.
 */
export function TransferirNegocio({
  cardId,
  nomeDoNegocio,
  responsavelAtual,
  aoFechar,
}: {
  cardId: string;
  nomeDoNegocio: string;
  responsavelAtual?: string | null;
  aoFechar: () => void;
}) {
  const { funis, moverNegocio } = useFunis();
  const { membros: equipe } = useEquipe();

  /** Onde o negócio está agora — ponto de partida dos seletores. */
  const localAtual = useMemo(() => {
    for (const funil of funis) {
      for (const coluna of funil.colunas) {
        if (coluna.cards.some((c) => c.id === cardId)) return { funilId: funil.id, etapaId: coluna.id };
      }
    }
    return { funilId: funis[0]?.id ?? "", etapaId: "" };
  }, [funis, cardId]);

  const [funilId, setFunilId] = useState(localAtual.funilId);
  const [etapaId, setEtapaId] = useState(localAtual.etapaId);
  const [responsavel, setResponsavel] = useState(responsavelAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const etapasDoFunil = funis.find((f) => f.id === funilId)?.colunas ?? [];

  function trocarFunil(novoFunilId: string) {
    setFunilId(novoFunilId);
    // A etapa atual pertence ao funil ANTERIOR. Mantê-la selecionada deixaria escolher uma etapa
    // que não existe no destino — e o servidor recusaria com um erro que ninguém entenderia.
    const etapas = funis.find((f) => f.id === novoFunilId)?.colunas ?? [];
    setEtapaId(etapas.some((c) => c.id === etapaId) ? etapaId : "");
  }

  async function confirmar() {
    if (!etapaId) {
      setErro("Escolha a etapa de destino.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const resultado = await moverNegocio({
      cardId,
      etapaId,
      // Igual ao atual = `undefined`, que mantém o responsável intocado. Vazio = tirar de propósito.
      // A diferença é o que permite transferir de funil sem mexer em quem atende.
      responsavel: responsavel === (responsavelAtual ?? "") ? undefined : responsavel || null,
    });
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível transferir.");
      return;
    }
    aoFechar();
  }

  return (
    <Modal
      aberto
      onFechar={aoFechar}
      titulo={`Transferir ${nomeDoNegocio}`}
      tamanho="sm"
      rodape={
        <>
          <button type="button" className="btn ghost" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className="btn" onClick={() => void confirmar()} disabled={salvando || !etapaId}>
            {salvando ? "Transferindo…" : "Transferir"}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Responsável</label>
        <select className="input" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
          <option value="">Sem responsável</option>
          {equipe.map((membro) => (
            <option key={membro.id} value={membro.nome}>
              {membro.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Funil</label>
        <select className="input" value={funilId} onChange={(e) => trocarFunil(e.target.value)}>
          {funis.map((funil) => (
            <option key={funil.id} value={funil.id}>
              {funil.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Etapa</label>
        <select className="input" value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
          <option value="">Escolha a etapa</option>
          {/* Só as etapas do funil selecionado — nunca as de outro funil misturadas. */}
          {etapasDoFunil.map((coluna) => (
            <option key={coluna.id} value={coluna.id}>
              {coluna.titulo}
            </option>
          ))}
        </select>
      </div>

      {erro ? <p className="modelo-erro">{erro}</p> : null}
    </Modal>
  );
}
