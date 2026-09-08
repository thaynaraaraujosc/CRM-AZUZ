"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { AssistenteDisparo } from "@/components/automacoes/AssistenteDisparo";
import { descreverAudiencia } from "@/lib/campanhas/audiencia-tipos";
import { STATUS_CAMPANHA, contagens, formatarData, type CampanhaResumo } from "@/lib/campanhas/apresentacao";
import { LIMITES } from "@/lib/templates/regras";

/**
 * Disparo em massa: cada disparo é um registro com contagens. Criar um novo abre o assistente em
 * passos; abrir um existente mostra destinatário por destinatário, com os erros.
 */
export default function DisparosPage() {
  const [campanhas, setCampanhas] = useState<CampanhaResumo[] | null>(null);
  const [assistente, setAssistente] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const r = await fetch("/api/campanhas", { cache: "no-store" });
    const dados = (await r.json()) as CampanhaResumo[];
    setCampanhas(Array.isArray(dados) ? dados : []);
  }, []);

  useEffect(() => {
    Promise.resolve().then(recarregar).catch((e) => console.error("Falha ao carregar disparos:", e));
    // Enquanto tem disparo processando, a lista se atualiza sozinha a cada 30s.
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") recarregar().catch(() => {});
    }, 30_000);
    return () => clearInterval(intervalo);
  }, [recarregar]);

  return (
    <>
      <Topbar
        title="Disparo em massa"
        sub="Uma mensagem para muitos contatos, enviada aos poucos"
        actions={
          <button type="button" className="btn primary" onClick={() => setAssistente(true)}>
            + Novo disparo
          </button>
        }
      />
      <AbasAutomacoes />

      <div className="content">
        {aviso ? <div className="tpl-toast">{aviso}</div> : null}

        {campanhas === null ? (
          <p className="hint">Carregando…</p>
        ) : campanhas.length === 0 ? (
          <div className="card tpl-vazio">
            <strong>Nenhum disparo ainda.</strong>
            <p className="hint">Escolha o canal, o público e a mensagem; o CRM envia aos poucos e mostra aqui o que aconteceu com cada pessoa.</p>
          </div>
        ) : (
          <div className="disp-lista">
            {campanhas.map((c) => {
              const n = contagens(c.contagem);
              const st = STATUS_CAMPANHA[c.status] ?? { label: c.status, badge: "badge-neutral" };
              return (
                <Link key={c.id} href={`/automacoes/disparos/${c.id}`} className="card disp-item">
                  <div className="disp-item-cabecalho">
                    <div>
                      <strong>{c.titulo}</strong>
                      <span className="hint">
                        {LIMITES[c.canal]?.label ?? c.canal} · {descreverAudiencia(c.audiencia)} · {formatarData(c.agendadaPara)}
                      </span>
                    </div>
                    <span className={`badge ${st.badge}`}>{st.label}</span>
                  </div>
                  <div className="disp-metricas">
                    <Metrica valor={n.total} label="destinatários" />
                    <Metrica valor={n.enviadas} label="enviadas" />
                    <Metrica valor={n.entregues} label="entregues" />
                    <Metrica valor={n.lidas} label="lidas" />
                    <Metrica valor={n.respondidas} label="respondidas" />
                    <Metrica valor={n.falhas} label="falhas" destaque={n.falhas > 0} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

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

function Metrica({ valor, label, destaque }: { valor: number; label: string; destaque?: boolean }) {
  return (
    <div className={`disp-metrica${destaque ? " destaque" : ""}`}>
      <strong>{valor}</strong>
      <span>{label}</span>
    </div>
  );
}
