"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { Topbar } from "@/components/ui";
import { AbasSocial } from "@/components/social/AbasSocial";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { MODELOS_SOCIAIS } from "@/lib/social/modelos-rapidos";
import { IconInstagram } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";
import type { PainelSocial } from "@/app/api/social/metricas/route";

/**
 * RESUMO DA CONTA: a primeira tela do Social Seller.
 *
 * Quem clica em "Social Seller" no menu caía direto na LISTA de automações — a tela de quem já
 * sabe o que vai editar. Quem abre o módulo quase sempre quer outra coisa antes: saber como foi o
 * dia e, se ainda não tem robô nenhum, saber por onde começar. A lista continua existindo, agora
 * em `/social-seller/automacoes`, a um clique no menu.
 *
 * SÓ NÚMERO QUE EXISTE, a mesma regra do painel. Tudo aqui sai de `/api/social/metricas`, que
 * conta linha de banco deste workspace. Não há "economia de tempo", não há "cliques em links": o
 * CRM não mede nenhum dos dois, e inventá-los seria transformar a tela de abertura do módulo numa
 * tela que mente logo no primeiro olhar.
 */

/*
 * DIA, SEMANA E MÊS, e não 7/30/90 dias.
 *
 * É a janela em que se pensa o Instagram ("como foi hoje?"), e é a mesma escada do painel por
 * baixo — a API recebe dias e não sabe que a tela chama de "semana".
 */
const PERIODOS = [
  { dias: 1, label: "Dia" },
  { dias: 7, label: "Semana" },
  { dias: 30, label: "Mês" },
] as const;

/** Só o primeiro nome: "Olá, Thaynara Araújo Santos Costa" não cabe e não é como se cumprimenta. */
function primeiroNome(nome?: string | null): string | null {
  const limpo = (nome ?? "").trim();
  if (!limpo) return null;
  return limpo.split(/\s+/)[0] ?? null;
}

function Numero({ valor, label, ajuda }: { valor: number; label: string; ajuda?: string }) {
  const { t: traduzir, localeNumero } = useIdioma();
  return (
    <div className="social-numero">
      <strong>{valor.toLocaleString(localeNumero)}</strong>
      <span>{traduzir(label)}</span>
      {ajuda ? <em>{traduzir(ajuda)}</em> : null}
    </div>
  );
}

export default function ResumoSocialPage() {
  const { t: traduzir } = useIdioma();
  const { data: sessao } = useSession();
  const router = useRouter();
  const { criarFluxo } = useAutomationFlows();
  const [dias, setDias] = useState<number>(7);
  /* O período pedido viaja JUNTO com a resposta, como no painel: assim "carregando" é derivado
     (a resposta que tenho não é do período que estou mostrando) em vez de ser um segundo estado
     que precisa ser ligado e desligado na mão, e que erra sozinho quando duas buscas se cruzam. */
  const [resposta, setResposta] = useState<{ paraDias: number; dados: PainelSocial | null } | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/social/metricas?dias=${dias}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<PainelSocial>) : null))
      .then((dados) => {
        if (!cancelado) setResposta({ paraDias: dias, dados });
      })
      .catch(() => {
        if (!cancelado) setResposta({ paraDias: dias, dados: null });
      });
    return () => {
      cancelado = true;
    };
  }, [dias]);

  const carregando = resposta?.paraDias !== dias;
  const painel = resposta?.dados ?? null;
  const nome = primeiroNome(sessao?.user?.name);

  /** Um modelo vira rascunho e abre no editor. Nunca publicado: ver `/social-seller/novo`. */
  function comecarPor(modeloId: string) {
    const modelo = MODELOS_SOCIAIS.find((m) => m.id === modeloId);
    if (!modelo) return;
    const { nodes, edges, configuracoes } = modelo.construir();
    const novo = criarFluxo({
      nome: modelo.nome,
      descricao: modelo.descricao,
      area: "social",
      nodes,
      edges,
      configuracoes,
    });
    router.push(`/automacoes/editor/${novo.id}`);
  }

  const interacoes = painel
    ? painel.crm.directs +
      painel.crm.comentarios +
      painel.crm.storiesRespondidos +
      painel.crm.mencoes +
      painel.crm.reacoes
    : 0;
  const noAr = painel?.robos.filter((r) => r.ligado).length ?? 0;

  return (
    <>
      {/* Sem subtítulo: o nome do módulo já diz o que ele é, e a saudação logo abaixo dá o resto. */}
      <Topbar
        title={traduzir("Social Seller")}
        actions={
          <Link className="btn primary" href="/social-seller/novo">
            {traduzir("+ Criar automação")}
          </Link>
        }
      />

      <div className="content social-layout">
        <AbasSocial />
        <div className="social-conteudo">
          <header className="ss-saudacao">
            <h2>
              {nome ? (
                <>
                  {traduzir("Olá,")} <span>{nome}</span>! {traduzir("Que bom ter você aqui.")}
                </>
              ) : (
                traduzir("Que bom ter você aqui.")
              )}
            </h2>
          </header>

          {/*
            A CONTA DESCONECTADA É A PRIMEIRA COISA, e não um aviso no rodapé: com ela fora do ar
            todo número desta tela é zero por falta de conexão, não por falta de movimento, e os
            dois zeros são visualmente idênticos.
          */}
          {painel && !painel.conectado ? (
            <section className="card ss-desconectado">
              <IconInstagram width={22} height={22} aria-hidden="true" />
              <div>
                <strong>{traduzir("O Instagram não está conectado.")}</strong>
                <p className="hint">
                  {painel.motivoDesconectado ? traduzir(painel.motivoDesconectado) : null}{" "}
                  {traduzir("Enquanto isso nenhum evento chega e nenhum robô daqui dispara.")}
                </p>
              </div>
              <Link className="btn" href="/configuracoes?secao=integracoes">
                {traduzir("Conectar")}
              </Link>
            </section>
          ) : null}

          <section className="ss-secao">
            <div className="ss-secao-topo">
              <h3>{traduzir("Resumo da sua conta")}</h3>
              <div className="social-periodo">
                {PERIODOS.map((p) => (
                  <button
                    key={p.dias}
                    type="button"
                    className={`seg-chip${dias === p.dias ? " on" : ""}`}
                    onClick={() => setDias(p.dias)}
                  >
                    {traduzir(p.label)}
                  </button>
                ))}
              </div>
            </div>

            {carregando || !painel ? (
              <p className="hint">{traduzir("Carregando…")}</p>
            ) : (
              <div className="social-numeros">
                <Numero
                  valor={painel.crm.automacoesIniciadas}
                  label="Automações disparadas"
                  ajuda="Cada vez que um robô do Instagram começou a rodar."
                />
                <Numero valor={interacoes} label="Interações recebidas" ajuda="Directs, comentários, stories, menções e reações." />
                <Numero
                  valor={painel.crm.leadsCriados}
                  label="Novos contatos capturados"
                  ajuda="Contatos que nasceram do Instagram no período."
                />
                <Numero valor={noAr} label="Robôs no ar" ajuda="Publicados e ligados agora. Não depende do período." />
              </div>
            )}
          </section>

          {/*
            "COMECE POR UM OBJETIVO" é o atalho de quem ainda não tem robô. São os mesmos modelos
            de `/social-seller/novo`, em uma linha: a tela de abertura é onde a pergunta "e agora,
            o que eu faço?" aparece, e mandar pra outra tela só pra escolher é um clique a mais no
            exato momento em que se está decidindo se vale a pena.
          */}
          <section className="ss-secao">
            <div className="ss-secao-topo">
              <h3>{traduzir("Escolha um objetivo e comece em minutos")}</h3>
              <Link className="link" href="/social-seller/automacoes">
                {traduzir("Todas as automações")}
              </Link>
            </div>
            <div className="ss-objetivos">
              {MODELOS_SOCIAIS.map((m) => (
                <button key={m.id} type="button" className="ss-objetivo" onClick={() => comecarPor(m.id)}>
                  <IconInstagram width={18} height={18} aria-hidden="true" />
                  <strong>{traduzir(m.nome)}</strong>
                  <span>{traduzir(m.descricao)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="ss-secao">
            <div className="ss-secao-topo">
              <h3>{traduzir("Interações recebidas")}</h3>
              <Link className="link" href="/social-seller/painel">
                {traduzir("Ver painel completo")}
              </Link>
            </div>
            {carregando || !painel ? (
              <p className="hint">{traduzir("Carregando…")}</p>
            ) : (
              <div className="social-numeros">
                <Numero valor={painel.crm.directs} label="Mensagens diretas" />
                <Numero valor={painel.crm.comentarios} label="Comentários" />
                <Numero valor={painel.crm.storiesRespondidos} label="Respostas a stories" />
                <Numero valor={painel.crm.mencoes} label="Menções em stories" />
                <Numero valor={painel.crm.reacoes} label="Reações" />
              </div>
            )}
            {/*
              O QUE A META INFORMA (alcance, visitas ao perfil) fica no painel, e não aqui. São
              números de outra procedência e outra confiabilidade: dependem de permissão, de tipo
              de conta e da API estar de pé. Lado a lado com os nossos, na tela de abertura, os
              dois pareceriam a mesma coisa.
            */}
          </section>
        </div>
      </div>
    </>
  );
}
