"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AcoesNoTopo } from "@/lib/topo-da-pagina";
import { AssistenteDisparo } from "@/components/automacoes/AssistenteDisparo";
import { descreverAudiencia } from "@/lib/campanhas/audiencia-tipos";
import { STATUS_CAMPANHA, contagens, formatarData, type CampanhaResumo } from "@/lib/campanhas/apresentacao";
import { LIMITES } from "@/lib/templates/regras";
import { nomeDoNumeroDeEnvio, type NumeroDeEnvio } from "@/lib/campanhas/canais-de-envio";
import type { CanalDisponivel } from "@/app/api/canais/route";
import { useIdioma } from "@/lib/idioma-context";

/**
 * Disparo em massa: cada disparo é um registro com contagens. Criar um novo abre o assistente em
 * passos; abrir um existente mostra destinatário por destinatário, com os erros.
 */
export default function DisparosPage() {
  const { t: traduzir } = useIdioma();
  const [campanhas, setCampanhas] = useState<CampanhaResumo[] | null>(null);
  /** Os números conectados, só pra traduzir a chave gravada no disparo num nome legível. */
  const [numeros, setNumeros] = useState<NumeroDeEnvio[]>([]);
  const [assistente, setAssistente] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Disparo com o menu de ações aberto. Um por vez. */
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  /** Disparo esperando confirmação de exclusão. Nulo = nenhum diálogo na tela. */
  const [aExcluir, setAExcluir] = useState<CampanhaResumo | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const recarregar = useCallback(async () => {
    const r = await fetch("/api/campanhas", { cache: "no-store" });
    const dados = (await r.json()) as CampanhaResumo[];
    setCampanhas(Array.isArray(dados) ? dados : []);
  }, []);

  useEffect(() => {
    fetch("/api/canais", { cache: "no-store" })
      .then((r) => r.json() as Promise<CanalDisponivel[]>)
      .then((c) => setNumeros(Array.isArray(c) ? c.flatMap((x) => x.numeros ?? []) : []))
      .catch(() => setNumeros([]));
  }, []);

  useEffect(() => {
    Promise.resolve().then(recarregar).catch((e) => console.error("Falha ao carregar disparos:", e));
    // Enquanto tem disparo processando, a lista se atualiza sozinha a cada 30s.
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") recarregar().catch(() => {});
    }, 30_000);
    return () => clearInterval(intervalo);
  }, [recarregar]);

  async function excluir() {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      const r = await fetch(`/api/campanhas/${aExcluir.id}`, { method: "DELETE" });
      const dados = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(dados.erro ?? "Não deu pra excluir.");
      setAExcluir(null);
      setAviso("Disparo removido do histórico.");
      setTimeout(() => setAviso(null), 5000);
      // Recarrega do servidor em vez de tirar da lista na mão: assim o que fica na tela é o que
      // está no banco, e um erro de escrita não vira um sumiço que volta no F5.
      await recarregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : traduzir("Não deu pra excluir."));
      setTimeout(() => setAviso(null), 6000);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <>
      <AcoesNoTopo>
        <button type="button" className="btn primary" onClick={() => setAssistente(true)}>
          + Novo disparo
        </button>
      </AcoesNoTopo>

      <div className="content">
        {aviso ? <div className="tpl-toast">{aviso}</div> : null}

        {campanhas === null ? (
          <p className="hint">{traduzir("Carregando…")}</p>
        ) : campanhas.length === 0 ? (
          <div className="card tpl-vazio">
            <strong>{traduzir("Nenhum disparo ainda.")}</strong>
            <p className="hint">Escolha o canal, o público e a mensagem; o CRM envia aos poucos e mostra aqui o que aconteceu com cada pessoa.</p>
          </div>
        ) : (
          <div className="disp-lista">
            {campanhas.map((c) => {
              const n = contagens(c.contagem);
              const st = STATUS_CAMPANHA[c.status] ?? { label: c.status, badge: "badge-neutral" };
              const numero = nomeDoNumeroDeEnvio(numeros, c.contaCanal);
              /* Quanto já saiu, em uma linha. Os seis números grandes que ficavam aqui viraram
                 seis blocos por disparo numa lista de cinquenta — "o resto mostra quando eu
                 entro". Lá dentro eles continuam inteiros, com a tabela pessoa por pessoa. */
              const andamento = n.total ? Math.round(((n.enviadas + n.falhas) / n.total) * 100) : 0;
              return (
                <div key={c.id} className="card disp-item">
                  {/* O cartão inteiro era um link. O menu de ações precisa ficar FORA dele: um
                      botão dentro de um <a> abre a página junto com o menu. */}
                  <div className="disp-item-cabecalho">
                    <Link href={`/automacoes/disparos/${c.id}`} className="disp-item-titulo">
                      <strong>{c.titulo}</strong>
                      <span className="disp-item-linha">
                        {numero ? (
                          <>
                            <em className={`disp-etiqueta ${numero.canal === "whatsapp_oficial" ? "oficial" : "qr"}`}>
                              {traduzir(numero.etiqueta)}
                            </em>
                            <span className="hint">{numero.nome}</span>
                          </>
                        ) : (
                          <span className="hint">{LIMITES[c.canal]?.label ?? c.canal}</span>
                        )}
                        <span className="hint">· {descreverAudiencia(c.audiencia)}</span>
                        <span className="hint">· {formatarData(c.agendadaPara)}</span>
                      </span>
                    </Link>
                    <div className="disp-item-acoes">
                      <span className={`badge ${st.badge}`}>{st.label}</span>
                      <div className="disp-menu-wrap">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Ações do disparo ${c.titulo}`}
                          aria-expanded={menuAberto === c.id}
                          onClick={() => setMenuAberto(menuAberto === c.id ? null : c.id)}
                        >
                          ⋯
                        </button>
                        {menuAberto === c.id ? (
                          <>
                            {/* Camada invisível que fecha o menu ao clicar em qualquer outro lugar. */}
                            <button
                              type="button"
                              className="disp-menu-fundo"
                              aria-label={traduzir("Fechar menu")}
                              onClick={() => setMenuAberto(null)}
                            />
                            <div className="disp-menu" role="menu">
                              <Link className="dropdown-item" href={`/automacoes/disparos/${c.id}`} role="menuitem">
                                {traduzir("Ver detalhes")}
                              </Link>
                              <button
                                type="button"
                                className="dropdown-item perigo"
                                role="menuitem"
                                onClick={() => {
                                  setMenuAberto(null);
                                  setAExcluir(c);
                                }}
                              >
                                {traduzir("Excluir disparo")}
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <Link href={`/automacoes/disparos/${c.id}`} className="disp-item-andamento">
                    <span className="disp-barra" aria-hidden="true">
                      <span className="disp-barra-cheia" style={{ width: `${andamento}%` }} />
                    </span>
                    <span className="hint">
                      {n.enviadas} {traduzir("de")} {n.total} {n.total === 1 ? traduzir("enviada") : traduzir("enviadas")}
                      {n.falhas ? ` · ${n.falhas} ${n.falhas === 1 ? traduzir("falha") : traduzir("falhas")}` : ""}
                      {n.respondidas ? ` · ${n.respondidas} ${n.respondidas === 1 ? traduzir("respondeu") : traduzir("responderam")}` : ""}
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reusa o modal que já existe no produto (`.modal-overlay`/`.modal`), em vez de um segundo
          conjunto de estilos que divergiria do primeiro na próxima correção de tema. */}
      {aExcluir ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={traduzir("Excluir disparo")}>
          <div className="modal" style={{ width: "min(480px, 100%)" }}>
            <div className="modal-cabecalho">
              <strong className="int-title">{traduzir("Excluir este disparo do histórico?")}</strong>
            </div>
            <div className="modal-corpo">
              <p>
                <strong>{aExcluir.titulo}</strong>
              </p>
              <p className="hint mt8">{traduzir("O registro deste disparo sai do histórico pra sempre, junto com a lista de quem recebeu e o que aconteceu com cada pessoa. Não dá pra desfazer.")}</p>
              <p className="hint mt8">{traduzir("As mensagens que já saíram NÃO voltam: elas continuam nas conversas e no aparelho de quem recebeu. Some o registro, não o envio.")}</p>
              <div className="modal-acoes">
                <button type="button" className="btn" onClick={() => setAExcluir(null)} disabled={excluindo}>
                  {traduzir("Cancelar")}
                </button>
                <button type="button" className="btn danger" onClick={excluir} disabled={excluindo}>
                  {excluindo ? "Excluindo…" : "Excluir disparo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {assistente ? (
        <AssistenteDisparo
          aoFechar={() => setAssistente(false)}
          aoConcluir={async () => {
            setAssistente(false);
            setAviso("Disparo criado. Ele começa no horário escolhido e avança aos poucos.");
            setTimeout(() => setAviso(null), 5000);
            await recarregar();
          }}
        />
      ) : null}
    </>
  );
}
