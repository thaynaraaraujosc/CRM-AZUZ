"use client";

import { useSession } from "next-auth/react";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { IconInstagram, IconWhatsApp } from "@/components/icons";
import {
  LogoGmail,
  LogoGoogleAds,
  LogoGoogleAgenda,
  LogoGoogleSheets,
  LogoMeta,
  LogoOutlook,
} from "@/components/logos-marcas";
import { NumerosDeWhatsApp } from "./NumerosDeWhatsApp";
import { ConexaoWhatsAppOficial } from "./ConexaoWhatsAppOficial";
import { ConexaoInstagram, ConexaoMetaAds, ConexaoGoogleAds } from "./ConexoesOAuth";
import { useStatusGoogleAds } from "@/components/trafego/useGoogleAds";
import { DadosWebhook } from "./DadosWebhook";
import { useIntegracaoMeta } from "./useIntegracaoMeta";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { mesmoNumero } from "@/lib/integracoes/numero-whatsapp";
import type { StatusIntegracaoNaoOficial } from "./useIntegracaoNaoOficial";
import { useIdioma } from "@/lib/idioma-context";
import { AzuzFlow } from "./AzuzFlow";

/**
 * O que aparece em "Em breve". Zapier, Make, Stripe e Mercado Pago saíram: não estão no plano.
 *
 * CADA UM COM A LOGO DELE. Eram quatro cartões de texto puro, e quatro retângulos com nome e
 * descrição se parecem tanto que a tela vira uma lista de avisos. A logo é o que faz a pessoa
 * reconhecer a plataforma antes de ler — e é o que estas linhas estão vendendo.
 *
 * O Google Agenda continua aqui, e conferi antes de decidir: não existe integração de agenda no
 * CRM (nenhuma rota, nenhum cliente de API). Ela estava declarada como "Conectada" num `integracoes`
 * dentro de `src/lib/data.ts` que não é renderizado em lugar nenhum — dado de demonstração, não
 * funcionalidade.
 */
type AppFuturo = {
  nome: string;
  descricao: string;
  categoria: string;
  Logo: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
};
const APPS_EM_BREVE: AppFuturo[] = [
  { nome: "Google Agenda", descricao: "Sincronize compromissos com sua agenda pessoal.", categoria: "Agenda", Logo: LogoGoogleAgenda },
  { nome: "Gmail", descricao: "Envie e receba e-mails direto do CRM.", categoria: "Comunicação", Logo: LogoGmail },
  { nome: "Outlook", descricao: "Sincronize sua caixa de entrada corporativa.", categoria: "Comunicação", Logo: LogoOutlook },
  { nome: "Google Sheets", descricao: "Exporte relatórios direto pra uma planilha.", categoria: "Dados", Logo: LogoGoogleSheets },
];
/*
 * O FILTRO DE CATEGORIA SAIU, em 12/11/2026.
 *
 * "Não precisa deixar quatro abas. Agenda, comunicação, dados, não. Tira todas essas abas e deixa
 * só o que vai aparecer em breve."
 *
 * Eram quatro chips ("Todas", "Agenda", "Comunicação", "Dados") em cima de QUATRO cartões. Um
 * filtro para quatro itens é um controle que custa uma leitura para esconder três coisas que já
 * cabiam na tela — e dois dos chips deixavam um único cartão visível.
 *
 * O campo `categoria` fica no tipo: ele continua dizendo o que cada integração é, e o dia em que
 * a lista crescer o bastante para precisar de filtro, a informação já está lá.
 */

/**
 * Uma integração da lista "Prontas pra usar".
 *
 * Com `painel`, "Conectar" abre o fluxo AQUI MESMO, logo abaixo da linha: antes ele levava pra
 * outra tela onde a pessoa tinha que escolher de novo entre os canais que ela já tinha escolhido
 * clicando naquela linha. Sem `painel` (integração cujo fluxo é um redirect externo, como o OAuth
 * do Instagram, ou que vive noutra tela, como o painel de Tráfego), continua sendo um link.
 */
function LinhaReal({
  icone,
  titulo,
  sub,
  conectado,
  href,
  painel,
}: {
  icone: React.ReactNode;
  titulo: string;
  sub: string;
  conectado: boolean;
  href?: string;
  painel?: React.ReactNode;
}) {
  const { t: traduzir } = useIdioma();
  const [aberto, setAberto] = useState(false);

  return (
    <div>
      <div className="int-row">
        <div className="int-logo">{icone}</div>
        <div className="int-body">
          <p className="int-title">{titulo}</p>
          <p className="int-sub">{sub}</p>
        </div>
        <span className={`int-status ${conectado ? "connected" : "off"}`}>
          {conectado ? traduzir("Conectado") : traduzir("Não conectado")}
        </span>
        {painel ? (
          <button
            type="button"
            className={`btn ${conectado || aberto ? "ghost" : "primary"}`}
            onClick={() => setAberto((v) => !v)}
          >
            {aberto ? traduzir("Fechar") : conectado ? traduzir("Gerenciar") : traduzir("Conectar")}
          </button>
        ) : (
          <Link href={href ?? "#"} className={`btn ${conectado ? "ghost" : "primary"}`}>
            {conectado ? traduzir("Gerenciar") : traduzir("Conectar")}
          </Link>
        )}
      </div>
      {painel && aberto ? (
        <div className="int-painel">{painel}</div>
      ) : null}
    </div>
  );
}

/**
 * Integrações e aplicativos (item 2 do pedido de novas demandas). Antes toda a lista, mesmo as
 * que já tinham rota real por trás (Meta/Baileys), era só decoração: status fixo "Conectado" com
 * dado inventado, botão sem `onClick`. Agora mostra o status real de cada integração que já
 * funciona de verdade (linka pra tela onde o fluxo de conexão de fato acontece. OAuth da Meta ou
 * QR Code do WhatsApp) e separa claramente o que ainda não existe ("Em breve", sem fingir que
 * funciona): cada integração nova entra aqui trocando de lista, não com um botão fake.
 */
export function IntegracoesSecao() {
  const { t: traduzir } = useIdioma();
  const { data: sessao } = useSession();
  const whatsappMeta = useIntegracaoMeta("meta_whatsapp");
  const instagram = useIntegracaoMeta("meta_instagram");
  const metaAds = useIntegracaoMeta("meta_ads");
  // O Google tem um estado a mais que a Meta: `disponivel` diz se esta instalação tem o token
  // de desenvolvedor aprovado. Sem isso a linha inteira não é desenhada — botão que leva a um
  // 503 é pior que botão nenhum.
  const { statusGoogle } = useStatusGoogleAds();

  // Status do WhatsApp não oficial (Evolution API) direto aqui, sem polling: só pra mostrar o
  // estado atual ao abrir a tela. Falha em silêncio (serviço fora do ar não pode quebrar essa tela).
  const [naoOficialStatus, setNaoOficialStatus] = useState<StatusIntegracaoNaoOficial | null>(null);
  // Recarregável: conectar ou desconectar um número pela lista muda o que esta linha diz, e sem
  // isso o cartão continuava mostrando o estado de quando a tela abriu.
  const carregarNaoOficial = useCallback(
    () =>
      fetch("/api/integracoes/whatsapp-nao-oficial")
        .then((r) => r.json())
        .then((dados) => setNaoOficialStatus("erro" in dados ? null : dados))
        .catch(() => setNaoOficialStatus(null)),
    [],
  );
  useEffect(() => {
    carregarNaoOficial();
  }, [carregarNaoOficial]);

  /*
   * O número de CADA conexão, e o aviso quando são o mesmo.
   *
   * O cartão da API oficial dizia só "Meta Business conectado" e nunca mostrava o número, enquanto
   * o do QR Code mostrava. Com as duas ligadas não havia como saber qual número estava em cada
   * uma, nem perceber a única configuração que dá problema de verdade: o MESMO número nos dois
   * lados, com uma sessão brigando com a outra.
   */
  const numeroOficial = (whatsappMeta.integracao?.metadados?.numeroExibicao as string | undefined) ?? null;
  const numeroQrCode = naoOficialStatus?.metadados?.numero ?? null;
  const oficialLigada = whatsappMeta.integracao?.status === "conectado";
  const qrCodeLigada = naoOficialStatus?.status === "conectado";
  const numeroRepetido = oficialLigada && qrCodeLigada && mesmoNumero(numeroOficial, numeroQrCode);


  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo={traduzir("Integrações e aplicativos")} />

      {numeroRepetido ? (
        <p className="int-aviso-conflito">
          {traduzir(
            "As duas conexões de WhatsApp estão no MESMO número ({numero}). Elas disputam a mesma sessão e uma vai derrubar a outra. Deixe a API oficial neste número e desconecte o QR Code, ou escaneie o QR Code com outro aparelho e outro número.",
            { numero: numeroOficial ?? "" },
          )}
        </p>
      ) : null}

      <div className="int-group">
        <p className="int-group-h">{traduzir("Prontas pra usar")}</p>
        <div className="card">
          {/*
            * UMA LINHA SÓ PRO WHATSAPP, e não duas.
            *
            * Eram duas: "WhatsApp Business (API oficial)" e "Números de WhatsApp". Depois que a
            * lista passou a mostrar os DOIS canais, o número oficial aparecia duas vezes na mesma
            * tela — uma como linha própria, outra dentro da lista — cada uma com seus botões. Quem
            * olha não tem como saber se são a mesma coisa, e desconectar num lugar não casa com o
            * que o outro diz.
            *
            * A empresa tem NÚMEROS de WhatsApp. Alguns entram pela API oficial, outros por QR
            * Code, e isso é detalhe de como cada um conectou — não é uma divisão que mereça duas
            * entradas no menu de integrações.
            */}
          <LinhaReal
            icone={<IconWhatsApp width={20} height={20} />}
            titulo={traduzir("Números de WhatsApp")}
            sub={
              oficialLigada || qrCodeLigada
                ? traduzir("Conectado. Clique pra ver os números e pra onde vão os leads de cada um")
                : traduzir("Conecte um ou vários números — por QR Code ou pela API oficial da Meta")
            }
            conectado={oficialLigada || qrCodeLigada}
            painel={
              /*
               * A LISTA DE NÚMEROS, e não mais um botão de conectar só.
               *
               * Aqui ficavam três painéis da EMPRESA: conectar, diagnóstico e importação. Com
               * vários números, nenhum dos três responde pela empresa — cada um responde por um
               * celular. A lista traz os três pra dentro de cada linha, e é o mesmo componente da
               * categoria WhatsApp, pra as duas telas não divergirem.
               *
               * Sem nenhum número ainda, ela mesma mostra o "Conectar outro número", que nesse
               * caso é o primeiro.
               */
              <>
                <NumerosDeWhatsApp aoMudar={carregarNaoOficial} />
                {/* Conectar pela API oficial é outro caminho (cadastro na Meta), e por isso tem
                    lugar próprio — embaixo da lista, e só enquanto não há uma conectada. Com ela
                    de pé, o número já está na lista acima e um segundo botão de conectar seria a
                    duplicação que acabou de sair daqui. */}
                {!oficialLigada ? <ConexaoWhatsAppOficial /> : null}
              </>
            }
          />
          <LinhaReal
            icone={<IconInstagram width={20} height={20} />}
            titulo={traduzir("Instagram Direct")}
            sub={instagram.integracao?.status === "conectado" ? traduzir("Conta conectada") : traduzir("Conecte via Meta Business Manager")}
            conectado={instagram.integracao?.status === "conectado"}
            painel={<ConexaoInstagram />}
          />
          <LinhaReal
            /* Era `IconCalendar`: um calendario, cinza, do lado do nome de uma plataforma de
               anuncios. Nao era so a falta da logo — era a logo errada. */
            icone={<LogoMeta width={21} height={21} />}
            titulo={traduzir("Meta Ads")}
            sub={metaAds.integracao?.status === "conectado" ? traduzir("Alimenta o painel de Tráfego automaticamente") : traduzir("Conecte pra ver essa origem no painel de Tráfego")}
            conectado={metaAds.integracao?.status === "conectado"}
            painel={<ConexaoMetaAds />}
          />
          {statusGoogle.disponivel ? (
            <LinhaReal
              icone={<LogoGoogleAds width={21} height={21} />}
              titulo={traduzir("Google Ads")}
              sub={
                statusGoogle.status === "conectado"
                  ? traduzir("Lê suas campanhas e devolve as vendas fechadas pro Google")
                  : traduzir("Conecte pra ver essa origem no Tráfego e devolver as vendas")
              }
              conectado={statusGoogle.status === "conectado"}
              painel={<ConexaoGoogleAds />}
            />
          ) : null}
          {/* Por que o Google Ads pode não estar na lista acima, e só pra quem administra.
              O cliente não pode ver linha desligada — foi o "Google Ads" decorativo que saiu
              daqui. Mas quem cuida da instalação precisa saber que a ausência tem causa e
              conserto, senão o diagnóstico vira "o CRM não integra com o Google", que é falso. */}
          {!statusGoogle.disponivel && sessao?.user?.superAdmin ? (
            <p className="hint" style={{ padding: "10px 14px", margin: 0 }}>
              <b>{traduzir("Google Ads não aparece nesta instalação.")}</b> A integração existe e está pronta, mas
              ela só é desenhada quando <code>GOOGLE_ADS_CLIENT_ID</code>,{" "}
              <code>GOOGLE_ADS_CLIENT_SECRET</code> e <code>GOOGLE_ADS_LOGIN_CUSTOMER_ID</code>{" "}
              estiverem definidas no servidor. Enquanto faltar alguma, nenhum cliente vê o botão —
              de propósito: botão que leva a erro é pior que botão nenhum.
            </p>
          ) : null}
        </div>
      </div>

      {/* O AZUZ Flow entrega lead NESTE CRM: é integração de entrada, não de canal, então ela não
          entra na lista de "Prontas pra usar" (que é por onde a empresa fala com o cliente). */}
      <AzuzFlow />

      {/* "Formulário do CRM" MUDOU DE CASA, em 03/11/2026, junto com a do AZUZ Flow e pelo mesmo
          motivo: a mensagem que sai quando alguém preenche um formulário não é conexão, é
          automação — e era UMA mensagem para todos os formulários, quando cada um pede a sua.
          Agora fica em Automações › Formulários do Flow, uma por formulário. */}

      {/* Só pra quem administra a plataforma.
          Cadastrar o webhook na Meta é feito UMA vez, no app da Meta, por quem é dono dele. Não
          por cada empresa que usa o CRM. O cliente conecta a conta dele por um clique de
          autorização e nunca precisa ver URL nem token: expor isso na tela dele só assusta e
          convida a mexer no que pode quebrar o recebimento de todo mundo. */}
      {sessao?.user?.superAdmin ? <DadosWebhook /> : null}

      <div className="config-bloco">
        <p className="config-bloco-titulo">{traduzir("Em breve")}</p>
        <div className="config-canais-grid">
          {APPS_EM_BREVE.map((a) => (
            <div className="config-canal-card" key={a.nome}>
              <div className="config-canal-card-h">
                <span className="int-logo int-logo-pequena">
                  <a.Logo width={20} height={20} />
                </span>
                <span className="n">{traduzir(a.nome)}</span>
                <span className="int-status off">{traduzir("Em breve")}</span>
              </div>
              <p className="r">{traduzir(a.descricao)}</p>
              <div className="config-canal-card-acoes">
                <button type="button" className="btn ghost" disabled>
                  {traduzir("Em breve")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
