"use client";

import { useEffect, useRef, useState } from "react";
import { IconAlerta } from "@/components/icons";
import { envLimpo } from "@/lib/integracoes/env-limpo";
import { useIdioma } from "@/lib/idioma-context";

/**
 * Embedded Signup v4 da Meta. Popup hospedado por eles, aberto de dentro do CRM, que cria a conta
 * do WhatsApp Business do cliente e devolve o que a gente precisa pra conectar. Não é v2/v3 (a v2
 * é descontinuada em out/2026).
 *
 * O fluxo devolve DUAS coisas por caminhos diferentes, e a conexão só pode ser finalizada com as
 * duas em mãos:
 *   - `session_info` (waba_id / phone_number_id / business_id) chega por `postMessage`;
 *   - `code` (trocável por token) chega no callback do `FB.login`.
 * Por isso o `session_info` fica num ref e o backend só é chamado quando o `code` também chegar.
 */
type SessionInfo = { wabaId: string; phoneNumberId: string; businessId?: string };

type DadosDoNegocio = {
  nome?: string;
  email?: string;
  telefone?: string;
  site?: string;
};

declare global {
  interface Window {
    FB?: {
      init: (opcoes: Record<string, unknown>) => void;
      login: (
        callback: (resposta: { authResponse?: { code?: string } | null; status?: string }) => void,
        opcoes: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

/** Origens legítimas do popup da Meta. Mensagem de qualquer outra origem é ignorada (qualquer
 * página aberta poderia mandar `postMessage` pra esta janela se não filtrasse). */
const ORIGENS_META = ["https://www.facebook.com", "https://web.facebook.com"];

export function EmbeddedSignupWhatsApp({
  dadosDoNegocio,
  aoConectar,
}: {
  dadosDoNegocio?: DadosDoNegocio;
  aoConectar?: () => void;
}) {
  const { t: traduzir } = useIdioma();
  // `envLimpo`, e não `process.env` cru: uma TABULAÇÃO colada no início do `config_id` foi a causa
  // real da falha de conexão, e era invisível na tela. Ver `env-limpo.ts`.
  const appId = envLimpo(process.env.NEXT_PUBLIC_META_APP_ID);
  const configId = envLimpo(process.env.NEXT_PUBLIC_META_CONFIG_ID);
  /*
   * A VERSÃO DO DIÁLOGO É SEPARADA DA VERSÃO DAS CHAMADAS DE SERVIDOR, e isso é a correção.
   *
   * O SDK era iniciado com `NEXT_PUBLIC_META_GRAPH_VERSION`, a MESMA constante que todas as
   * chamadas de servidor usam (`META_GRAPH_VERSION`, em `lib/integracoes/meta.ts`), hoje em v23.0.
   * Só que o diálogo de login e a API são coisas diferentes: a configuração de Login do Facebook
   * para Empresas é criada mirando uma versão, e abrir o diálogo numa versão mais velha que a dela
   * falha logo na entrada, com "Falha ao iniciar sessão" — antes de qualquer parâmetro nosso ser
   * lido. É exatamente a diferença observada: o mesmo fluxo roda em v26.0 no painel da Meta e
   * falhava em v23.0 aqui.
   *
   * Env var PRÓPRIA, de propósito: subir a versão das chamadas de servidor junto mexeria no
   * Instagram e no WhatsApp que já funcionam, e não há motivo pra arriscar isso pra consertar um
   * diálogo de login.
   */
  const versaoGraph = envLimpo(process.env.NEXT_PUBLIC_META_LOGIN_VERSION) ?? "v26.0";

  // Inicialização preguiçosa em vez de `setState` dentro do efeito. O SDK pode já estar carregado
  // (outro componente montou antes), e nesse caso o botão precisa nascer habilitado.
  const [sdkPronto, setSdkPronto] = useState(() => typeof window !== "undefined" && Boolean(window.FB));
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const sessionInfoRef = useRef<SessionInfo | null>(null);
  const telaAbandonadaRef = useRef<string | null>(null);

  // Listener registrado ANTES de qualquer abertura de popup. É por ele que chega o session_info,
  // e ele pode chegar antes do callback do FB.login terminar.
  useEffect(() => {
    function aoReceberMensagem(evento: MessageEvent) {
      if (!ORIGENS_META.includes(evento.origin)) return;
      try {
        const dados = typeof evento.data === "string" ? JSON.parse(evento.data) : evento.data;
        if (dados?.type !== "WA_EMBEDDED_SIGNUP") return;

        if (dados.event === "FINISH" || dados.event === "FINISH_ONLY_WABA" || dados.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
          sessionInfoRef.current = {
            wabaId: dados.data?.waba_id,
            phoneNumberId: dados.data?.phone_number_id,
            businessId: dados.data?.business_id,
          };
        } else if (dados.event === "CANCEL") {
          // Abandono ANTES da tela final. A Meta diz em qual etapa parou, dá pra ser específico
          // em vez de mostrar "erro desconhecido".
          telaAbandonadaRef.current = dados.data?.current_step ?? null;
        }
      } catch {
        // Mensagem que não é JSON do Embedded Signup. Ignora em silêncio.
      }
    }
    window.addEventListener("message", aoReceberMensagem);
    return () => window.removeEventListener("message", aoReceberMensagem);
  }, []);

  // Carrega o SDK JS do Facebook uma vez.
  useEffect(() => {
    if (!appId || window.FB) return;
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, cookie: true, xfbml: false, version: versaoGraph });
      setSdkPronto(true);
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [appId, versaoGraph]);

  async function finalizarConexao(code: string) {
    const info = sessionInfoRef.current;
    if (!info?.wabaId || !info?.phoneNumberId) {
      setErro(
        telaAbandonadaRef.current
          ? `A conexão não foi concluída. Você parou na etapa "${telaAbandonadaRef.current}". Pode tentar de novo de onde parou.`
          : traduzir("A conexão não foi concluída. Os dados da conta não chegaram. Tente de novo."),
      );
      return;
    }

    setConectando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/integracoes/meta/whatsapp/conectar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, ...info }),
      });
      const dados = (await resposta.json()) as { erro?: string; pin?: string | null };
      if (!resposta.ok) throw new Error(dados.erro ?? traduzir("Falha ao concluir a conexão."));
      if (dados.pin) setPin(dados.pin);
      aoConectar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : traduzir("Falha ao concluir a conexão."));
    } finally {
      setConectando(false);
    }
  }

  function abrirSignup() {
    if (!window.FB || !configId) return;
    setErro(null);
    sessionInfoRef.current = null;
    telaAbandonadaRef.current = null;

    // Só os campos realmente preenchidos: chave com `undefined` some no JSON, mas montar aqui
    // deixa explícito quando não há NADA pra mandar.
    const negocioParaSetup = (() => {
      const campos = {
        ...(dadosDoNegocio?.nome ? { name: dadosDoNegocio.nome } : {}),
        ...(dadosDoNegocio?.email ? { email: dadosDoNegocio.email } : {}),
        ...(dadosDoNegocio?.telefone ? { phone: { number: dadosDoNegocio.telefone } } : {}),
        ...(dadosDoNegocio?.site ? { website: dadosDoNegocio.site } : {}),
      };
      return Object.keys(campos).length > 0 ? campos : null;
    })();

    /*
     * O QUE REALMENTE VAI PRA META, impresso antes de chamar.
     *
     * A investigação estava presa em hipóteses sobre o painel da Meta porque faltava o dado mais
     * básico: os parâmetros que o SDK recebe de fato. Isto imprime exatamente isso, do lado de
     * dentro, sem depender de ler uma URL gigante na barra do popup.
     *
     * Nada aqui é segredo: `app_id` e `config_id` são identificadores públicos — o primeiro
     * aparece na própria barra de endereço do diálogo — e nenhum token ou código de autorização
     * existe neste ponto, que é ANTES da autorização acontecer.
     */
    const parametros = {
      config_id: configId,
      response_type: "code",
      override_default_response_type: true,
      extras: {
        setup: negocioParaSetup ? { business: negocioParaSetup } : {},
        featureType: "",
        sessionInfoVersion: "3",
      },
    };
    console.info("[meta] FB.login com:", JSON.stringify(parametros));
    console.info(
      "[meta] SDK:",
      "appId:", appId,
      "versão:", versaoGraph,
      "FB carregado:", Boolean(window.FB),
      "origem:", window.location.origin,
    );

    window.FB.login(
      (resposta) => {
        const code = resposta.authResponse?.code;
        if (!code) {
          /*
           * O MOTIVO QUE A META DEVOLVE, no console, sem segredo nenhum.
           *
           * Quando o diálogo recusa, a mensagem que a pessoa vê ("Falha ao iniciar sessão") é
           * genérica de propósito — a Meta não conta o motivo na tela pra não ajudar quem está
           * sondando um app. Mas o `status` da resposta distingue os casos, e sem ele a
           * investigação vira tentativa e erro.
           *
           * Só `status` e a lista de CHAVES presentes: nunca o conteúdo de `authResponse`, que
           * numa autorização bem-sucedida carrega o código de autorização.
           */
          console.error(
            "[meta] autorização não concluída. status:",
            resposta?.status ?? "(sem status)",
            "campos presentes:",
            Object.keys(resposta ?? {}).join(", ") || "(resposta vazia)",
          );
          setErro(
            telaAbandonadaRef.current
              ? traduzir('Você saiu na etapa "{etapa}". A conexão não foi concluída.', {
                  etapa: telaAbandonadaRef.current,
                })
              : traduzir("A autorização foi cancelada."),
          );
          return;
        }
        void finalizarConexao(code);
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          /*
           * O TRECHO DOCUMENTADO PELA META, AO PÉ DA LETRA.
           *
           * Eu tinha passado a omitir `setup` quando não havia nada pra pré-preencher, achando que
           * mandar objeto vazio era desnecessário. Mas o exemplo oficial do Cadastro Incorporado
           * manda `setup: {}` SEMPRE, e `featureType: ''` junto — e divergir de um contrato que a
           * gente não controla, por elegância, é como se cria diferença entre "o fluxo deles" e "o
           * nosso". Nesta investigação, qualquer diferença é suspeita até prova em contrário.
           */
          setup: negocioParaSetup ? { business: negocioParaSetup } : {},
          featureType: "",
          // TEXTO, não número: é o formato que a documentação usa.
          sessionInfoVersion: "3",
        },
      },
    );
  }

  if (!appId || !configId) {
    return (
      <p className="hint" style={{ color: "var(--danger)", marginTop: 10 }}>
        <IconAlerta width={12} height={12} aria-hidden="true" />{traduzir("Conexão com a API oficial ainda não configurada no servidor (falta NEXT_PUBLIC_META_APP_ID e/ou NEXT_PUBLIC_META_CONFIG_ID).")}</p>
    );
  }

  if (pin) {
    return (
      <div style={{ marginTop: 10 }}>
        <p className="int-title" style={{ margin: 0 }}>{traduzir("Conectado! Guarde este PIN:")}</p>
        <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, margin: "8px 0" }}>{pin}</p>
        <p className="hint" style={{ margin: 0 }}>{traduzir("É o PIN de verificação em duas etapas do seu número na Meta. Ele não aparece de novo. Anote agora num lugar seguro.")}</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" className="btn primary" onClick={abrirSignup} disabled={!sdkPronto || conectando}>
        {conectando ? traduzir("Conectando…") : sdkPronto ? traduzir("Conectar com a API oficial (Meta)") : traduzir("Carregando…")}
      </button>
      {erro ? (
        <p className="hint" style={{ color: "var(--danger)", marginTop: 8 }}>
          <IconAlerta width={12} height={12} aria-hidden="true" /> {erro}
        </p>
      ) : null}
      {/*
        * A LINHA COM APP ID E CONFIG ID SAIU DA TELA.
        *
        * Ela nasceu durante a investigação da falha de conexão e cumpriu o papel dela. Mas esta é
        * tela de CLIENTE: identificador de app e de configuração de login são detalhe de quem
        * mantém o sistema, e mostrá-los só gera a pergunta "o que é isso?" para quem só quer
        * ligar o WhatsApp.
        *
        * Nada se perde no diagnóstico: os mesmos valores continuam indo pro console
        * (`[meta] FB.login com:` e `[meta] SDK:`), que é onde se olha quando algo falha — e foi de
        * lá que a tabulação invisível no `config_id` apareceu.
        */}
    </div>
  );
}
