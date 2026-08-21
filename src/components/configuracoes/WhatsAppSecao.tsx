"use client";

import { useState } from "react";

import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { useIntegracaoNaoOficial } from "./useIntegracaoNaoOficial";
import { useIntegracaoMeta } from "./useIntegracaoMeta";

/** WhatsApp (Configurações > Integrações) — só conecta o número, igual Instagram e Facebook. As
 * abas de Atendimento/Mensagens/Compatibilidade/Horários que existiam aqui saíram: eram só
 * `useState` local sem persistência nenhuma (nenhum toggle/texto/horário sobrevivia a um refresh),
 * e o que descreviam — distribuir automaticamente, responder fora do horário, mensagem de
 * boas-vindas — é comportamento automático, não conexão. Isso é escopo do módulo Automação, que
 * ainda vai consumir essa integração pra funcionar de verdade (mesmo princípio já aplicado em
 * Instagram e Facebook: integração conecta o canal, automação decide o que fazer com ele).
 *
 * Uma conta só tem uma integração de WhatsApp: oficial (Meta) OU não oficial (QR Code), nunca as
 * duas ao mesmo tempo — por isso, com uma conectada, a outra opção nem aparece. Responsável/funil
 * padrão saíram: a integração já é da conta que está logada, não faz sentido escolher "responsável"
 * separado — quem manda mensagem é quem está logado. */
export function WhatsAppSecao() {
  const { integracao, desconectando, desconectar, erroDoRedirect } = useIntegracaoMeta("meta_whatsapp");
  const naoOficial = useIntegracaoNaoOficial();
  const [painelNaoOficialAberto, setPainelNaoOficialAberto] = useState(false);

  const metaConectada = integracao?.status === "conectado";
  const naoOficialConectada = naoOficial.estado?.status === "conectado";
  const numeroConectado = metaConectada
    ? ((integracao?.metadados?.numeroExibicao as string | undefined) ?? "número não identificado")
    : naoOficialConectada
      ? (naoOficial.estado?.metadados?.numero ?? "número não identificado")
      : null;

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="WhatsApp" descricao="Conecte o número do WhatsApp que o CRM vai usar." />

      <div className="config-bloco">
        {erroDoRedirect ? (
          <p className="hint" style={{ color: "var(--danger)", marginBottom: 10 }}>
            ⚠ Não foi possível conectar: {erroDoRedirect}
          </p>
        ) : null}

        {numeroConectado ? (
          <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <p className="int-title" style={{ margin: 0 }}>
                {metaConectada ? "WhatsApp Business (API oficial da Meta)" : "WhatsApp (API não oficial, QR Code)"}
              </p>
              <p className="int-sub" style={{ margin: "4px 0 0" }}>Conectado — {numeroConectado}</p>
            </div>
            <button
              type="button"
              className="btn danger"
              onClick={metaConectada ? desconectar : naoOficial.desconectar}
              disabled={(metaConectada && desconectando) || (!metaConectada && naoOficial.desconectando)}
            >
              {(metaConectada && desconectando) || (!metaConectada && naoOficial.desconectando) ? "Desconectando…" : "Desconectar"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a href="/api/integracoes/meta/conectar" className="card" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textDecoration: "none" }}>
              <div>
                <p className="int-title" style={{ margin: 0 }}>Conectar com a API oficial (Meta)</p>
                <p className="hint" style={{ margin: "4px 0 0" }}>
                  Autoriza o CRM a acessar sua conta do WhatsApp Business direto pela Meta — sem
                  copiar token nenhum.
                </p>
              </div>
              <span className="btn primary">Conectar</span>
            </a>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p className="int-title" style={{ margin: 0 }}>Conectar com a API não oficial (QR Code)</p>
                  <p className="hint" style={{ margin: "4px 0 0" }}>
                    Escaneia como o WhatsApp Web — não passa pela verificação de negócio da Meta,
                    e o número corre risco de ser banido por violar os termos de uso do WhatsApp.
                  </p>
                </div>
                {!painelNaoOficialAberto ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setPainelNaoOficialAberto(true);
                      naoOficial.conectar();
                    }}
                    disabled={naoOficial.conectando}
                  >
                    {naoOficial.conectando ? "Conectando…" : "Conectar"}
                  </button>
                ) : null}
              </div>

              {painelNaoOficialAberto ? (
                naoOficial.erro || naoOficial.estado?.status === "erro" ? (
                  <p className="hint" style={{ color: "var(--danger)", marginTop: 10 }}>
                    ⚠ {naoOficial.erro ?? naoOficial.estado?.erroMensagem}
                  </p>
                ) : naoOficial.estado?.status === "aguardando_qr" && naoOficial.estado.metadados?.qrDataUrl ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 14 }}>
                    {/* Fundo branco explícito — o PNG que a Evolution devolve tem fundo TRANSPARENTE
                        (não branco de verdade), então sem isso o card do CRM (levemente azulado)
                        aparecia por trás, dando aquele efeito de QR "com uma tela azul em cima". */}
                    <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL gerado on-the-fly pela Evolution API, não é asset estático */}
                      <img src={naoOficial.estado.metadados.qrDataUrl} alt="QR Code de conexão do WhatsApp" width={200} height={200} />
                    </div>
                    <p className="hint">Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho.</p>
                  </div>
                ) : (
                  <p className="hint" style={{ marginTop: 10 }}>
                    {naoOficial.conectando ? "Gerando QR Code…" : "Aguardando o QR Code…"}
                  </p>
                )
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
