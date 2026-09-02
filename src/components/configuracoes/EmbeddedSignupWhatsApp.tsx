"use client";

import { useEffect, useRef, useState } from "react";
import { IconAlerta } from "@/components/icons";

/**
 * Embedded Signup v4 da Meta — popup hospedado por eles, aberto de dentro do CRM, que cria a conta
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

/** Origens legítimas do popup da Meta — mensagem de qualquer outra origem é ignorada (qualquer
 * página aberta poderia mandar `postMessage` pra esta janela se não filtrasse). */
const ORIGENS_META = ["https://www.facebook.com", "https://web.facebook.com"];

export function EmbeddedSignupWhatsApp({
  dadosDoNegocio,
  aoConectar,
}: {
  dadosDoNegocio?: DadosDoNegocio;
  aoConectar?: () => void;
}) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;
  const versaoGraph = process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v23.0";

  // Inicialização preguiçosa em vez de `setState` dentro do efeito — o SDK pode já estar carregado
  // (outro componente montou antes), e nesse caso o botão precisa nascer habilitado.
  const [sdkPronto, setSdkPronto] = useState(() => typeof window !== "undefined" && Boolean(window.FB));
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const sessionInfoRef = useRef<SessionInfo | null>(null);
  const telaAbandonadaRef = useRef<string | null>(null);

  // Listener registrado ANTES de qualquer abertura de popup — é por ele que chega o session_info,
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
          // Abandono ANTES da tela final — a Meta diz em qual etapa parou, dá pra ser específico
          // em vez de mostrar "erro desconhecido".
          telaAbandonadaRef.current = dados.data?.current_step ?? null;
        }
      } catch {
        // Mensagem que não é JSON do Embedded Signup — ignora em silêncio.
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
          ? `A conexão não foi concluída — você parou na etapa "${telaAbandonadaRef.current}". Pode tentar de novo de onde parou.`
          : "A conexão não foi concluída — os dados da conta não chegaram. Tente de novo.",
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
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao concluir a conexão.");
      if (dados.pin) setPin(dados.pin);
      aoConectar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao concluir a conexão.");
    } finally {
      setConectando(false);
    }
  }

  function abrirSignup() {
    if (!window.FB || !configId) return;
    setErro(null);
    sessionInfoRef.current = null;
    telaAbandonadaRef.current = null;

    window.FB.login(
      (resposta) => {
        const code = resposta.authResponse?.code;
        if (!code) {
          setErro(
            telaAbandonadaRef.current
              ? `Você saiu na etapa "${telaAbandonadaRef.current}" — a conexão não foi concluída.`
              : "A autorização foi cancelada.",
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
          setup: {
            // Pré-preenche o que já sabemos do cadastro — reduz telas que a pessoa tem que
            // preencher no popup da Meta.
            business: {
              name: dadosDoNegocio?.nome,
              email: dadosDoNegocio?.email,
              phone: dadosDoNegocio?.telefone ? { number: dadosDoNegocio.telefone } : undefined,
              website: dadosDoNegocio?.site,
            },
          },
          sessionInfoVersion: 3,
        },
      },
    );
  }

  if (!appId || !configId) {
    return (
      <p className="hint" style={{ color: "var(--danger)", marginTop: 10 }}>
        <IconAlerta width={12} height={12} aria-hidden="true" /> Conexão com a API oficial ainda não configurada no servidor (falta NEXT_PUBLIC_META_APP_ID
        e/ou NEXT_PUBLIC_META_CONFIG_ID).
      </p>
    );
  }

  if (pin) {
    return (
      <div style={{ marginTop: 10 }}>
        <p className="int-title" style={{ margin: 0 }}>Conectado! Guarde este PIN:</p>
        <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, margin: "8px 0" }}>{pin}</p>
        <p className="hint" style={{ margin: 0 }}>
          É o PIN de verificação em duas etapas do seu número na Meta. Ele não aparece de novo —
          anote agora num lugar seguro.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" className="btn primary" onClick={abrirSignup} disabled={!sdkPronto || conectando}>
        {conectando ? "Conectando…" : sdkPronto ? "Conectar com a API oficial (Meta)" : "Carregando…"}
      </button>
      {erro ? (
        <>
          <p className="hint" style={{ color: "var(--danger)", marginTop: 8 }}>
            <IconAlerta width={12} height={12} aria-hidden="true" /> {erro}
          </p>
          {/* O erro mais comum aqui ("Falha ao iniciar sessão", mostrado dentro do popup da Meta) é
              a configuração de login pertencer a um App diferente do App ID que o site usa. Mostrar
              os dois lado a lado deixa isso óbvio sem ter que abrir o console. */}
          <p className="hint" style={{ marginTop: 4, fontSize: 11 }}>
            App ID em uso: <b>{appId}</b> · Configuração de login: <b>{configId}</b> · Graph{" "}
            <b>{versaoGraph}</b>. Os dois primeiros precisam ser do MESMO app no painel da Meta.
          </p>
        </>
      ) : null}
    </div>
  );
}
