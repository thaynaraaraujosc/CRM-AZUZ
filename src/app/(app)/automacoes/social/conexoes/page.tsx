"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { AbasSocial } from "@/components/social/AbasSocial";
import type { ConexaoSocial } from "@/app/api/social/conexoes/route";

/**
 * Conexões da área social, e o que acontece com quem chega por elas.
 *
 * O canal sem integração aparece aqui de propósito, apagado e com o motivo escrito. Escondê-lo
 * deixaria a pergunta "cadê o TikTok?" sem resposta em lugar nenhum do produto; oferecê-lo com um
 * botão que não faz nada seria pior ainda.
 *
 * A escolha "onde cai o lead do Instagram" ficava aqui e não existe mais: quem chega pelo Direct
 * não entra no funil comercial. Ver `provedoresDeNegocio`. O que ficou no lugar é a explicação de
 * onde esse acompanhamento acontece, porque a pergunta continua legítima.
 */
export default function ConexoesSociaisPage() {
  const [conexoes, setConexoes] = useState<ConexaoSocial[] | null>(null);

  useEffect(() => {
    fetch("/api/social/conexoes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((c) => setConexoes(Array.isArray(c) ? (c as ConexaoSocial[]) : []))
      .catch(() => setConexoes([]));
  }, []);

  return (
    <>
      <Topbar title="Conexões" sub="O que está ligado e onde acompanhar quem chega por aqui" />
      <AbasAutomacoes />

      <div className="content social-layout">
        <AbasSocial />
        <div className="social-conteudo">
          <section className="card">
            <h3>Canais</h3>
            <div className="social-conexoes mt8">
              {(conexoes ?? []).map((c) => (
                <div key={c.canal} className={`social-conexao${c.disponivel ? "" : " indisponivel"}`}>
                  <h4>{c.label}</h4>
                  <p className="hint">{c.resumo}</p>
                  <p className="mt8">
                    <span className={`badge ${c.conectado ? "badge-success" : "badge-neutral"}`}>
                      {!c.disponivel ? "Sem integração" : c.conectado ? "Conectado" : "Desconectado"}
                    </span>
                    {c.detalhe ? <span className="hint" style={{ marginLeft: 8 }}>{c.detalhe}</span> : null}
                  </p>
                  {c.motivo ? <p className="hint mt8">{c.motivo}</p> : null}
                  {c.disponivel && !c.conectado ? (
                    <Link className="btn mt8" href="/configuracoes">
                      Ir para Configurações
                    </Link>
                  ) : null}
                </div>
              ))}
              {conexoes && !conexoes.length ? <p className="hint">Carregando…</p> : null}
            </div>
          </section>

          <section className="card mt16">
            <h3>Onde acompanhar quem chega pelo Instagram</h3>
            <p className="hint">
              Quem manda Direct vira contato, com @, foto e etiqueta, mas não entra no funil
              comercial. O funil é do WhatsApp, e é uma esteira de venda com etapas. O Instagram é
              evento pontual: a pessoa comentou, respondeu um story, mencionou o perfil. Misturar os
              dois no mesmo quadro fazia o funil deixar de responder à pergunta que ele existe pra
              responder.
            </p>
            <p className="hint mt8">
              Quando um Direct virar negócio de verdade, quem leva pro funil é você, na ficha do
              contato, ou um robô, com o bloco de criar negócio. É uma decisão, não um efeito
              colateral de alguém ter mandado mensagem.
            </p>
            <div className="social-atalhos mt16">
              <Link className="btn" href="/instagram">
                Caixa de entrada do Direct
              </Link>
              <Link className="btn" href="/instagram/contatos">
                Contatos do Instagram
              </Link>
              <Link className="btn" href="/automacoes/social/painel">
                Painel: eventos e robôs
              </Link>
              <Link className="btn" href="/automacoes/social/execucoes">
                Execuções e erros
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
