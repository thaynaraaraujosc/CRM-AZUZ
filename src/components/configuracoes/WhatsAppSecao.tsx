"use client";

import { useState } from "react";

import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { ConexaoManualWhatsApp } from "./ConexaoManualWhatsApp";
import { LimparDadosWhatsApp } from "./LimparDadosWhatsApp";
import { EmbeddedSignupWhatsApp } from "./EmbeddedSignupWhatsApp";
import { ImportarConversas } from "./ImportarConversas";
import { useIntegracaoNaoOficial } from "./useIntegracaoNaoOficial";
import { ModeloDeRetomada } from "./ModeloDeRetomada";
import { useIntegracaoMeta } from "./useIntegracaoMeta";
import { IconAlerta } from "@/components/icons";

/** Semáforo de qualidade que a Meta atribui ao número. Cai pra amarelo/vermelho quando as pessoas
 * bloqueiam/denunciam, e vermelho por tempo demais leva a restrição de envio. */
function SaudeConexaoOficial({ metadados }: { metadados: Record<string, unknown> }) {
  const qualidade = metadados.qualityRating as string | undefined;
  const limite = metadados.limiteEnvio as string | undefined;
  const verificado = metadados.ultimaVerificacaoSaude as string | undefined;
  const banimento = metadados.banimento as string | undefined;
  const pinPendente = metadados.pinPendente as boolean | undefined;

  const corQualidade =
    qualidade === "GREEN" ? "#25d366" : qualidade === "YELLOW" ? "#f2b100" : qualidade === "RED" ? "var(--danger)" : undefined;

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
      {banimento ? (
        <p className="hint" style={{ color: "var(--danger)", margin: 0 }}>
          <IconAlerta width={12} height={12} aria-hidden="true" /> A Meta restringiu esta conta ({banimento}). Resolva pelo WhatsApp Manager.
        </p>
      ) : null}
      {pinPendente ? (
        <p className="hint" style={{ color: "var(--danger)", margin: 0 }}>
          <IconAlerta width={12} height={12} aria-hidden="true" /> Este número já tinha sido registrado antes com outro PIN. Informe o PIN antigo pra
          concluir o registro na Cloud API.
        </p>
      ) : null}
      {qualidade ? (
        <p className="hint" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: corQualidade, display: "inline-block" }} />
          Qualidade do número: {qualidade === "GREEN" ? "boa" : qualidade === "YELLOW" ? "média" : "baixa"}
        </p>
      ) : null}
      {limite ? <p className="hint" style={{ margin: 0 }}>Limite de envio atual: {limite}</p> : null}
      {verificado ? (
        <p className="hint" style={{ margin: 0 }}>
          Última verificação: {new Date(verificado).toLocaleString("pt-BR")}
        </p>
      ) : null}
    </div>
  );
}

/** WhatsApp (Configurações > Integrações): só conecta o número, igual Instagram e Facebook. As
 * abas de Atendimento/Mensagens/Compatibilidade/Horários que existiam aqui saíram: eram só
 * `useState` local sem persistência nenhuma (nenhum toggle/texto/horário sobrevivia a um refresh),
 * e o que descreviam: distribuir automaticamente, responder fora do horário, mensagem de
 * boas-vindas: é comportamento automático, não conexão. Isso é escopo do módulo Automação, que
 * ainda vai consumir essa integração pra funcionar de verdade (mesmo princípio já aplicado em
 * Instagram e Facebook: integração conecta o canal, automação decide o que fazer com ele).
 *
 * Uma conta só tem uma integração de WhatsApp: oficial (Meta) OU não oficial (QR Code), nunca as
 * duas ao mesmo tempo: por isso, com uma conectada, a outra opção nem aparece. Responsável/funil
 * padrão saíram: a integração já é da conta que está logada, não faz sentido escolher "responsável"
 * separado: quem manda mensagem é quem está logado. */
export function WhatsAppSecao() {
  const { integracao, desconectando, desconectar, erroDoRedirect, recarregar } = useIntegracaoMeta("meta_whatsapp");
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
            <IconAlerta width={12} height={12} aria-hidden="true" /> Não foi possível conectar: {erroDoRedirect}
          </p>
        ) : null}

        {numeroConectado ? (
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p className="int-title" style={{ margin: 0 }}>
                  {metaConectada ? "WhatsApp Business (API oficial da Meta)" : "WhatsApp (API não oficial, QR Code)"}
                </p>
                <p className="int-sub" style={{ margin: "4px 0 0" }}>Conectado • {numeroConectado}</p>
              </div>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  // Desconectar sem limpar deixava o espelho do WhatsApp para trás (contatos, cards
                  // no funil, pendências no Início, conversa órfã), que se misturava com o do canal
                  // conectado depois. Apagar é irreversível, então é escolha explícita: e "Cancelar"
                  // mantém o comportamento antigo em vez de abortar a desconexão.
                  const limpar = window.confirm(
                    "Desconectar e apagar tudo que veio deste WhatsApp?\n\n" +
                      "Serão removidos as conversas e mensagens, os contatos criados automaticamente " +
                      "e os cards de funil desses leads. Contatos e cards que você criou à mão ficam.\n\n" +
                      "OK = desconectar e apagar · Cancelar = só desconectar, mantendo os dados.",
                  );
                  void (metaConectada ? desconectar(limpar) : naoOficial.desconectar(limpar));
                }}
                disabled={(metaConectada && desconectando) || (!metaConectada && naoOficial.desconectando)}
              >
                {(metaConectada && desconectando) || (!metaConectada && naoOficial.desconectando) ? "Desconectando…" : "Desconectar"}
              </button>
            </div>
            {metaConectada && integracao?.metadados ? (
              <SaudeConexaoOficial metadados={integracao.metadados as Record<string, unknown>} />
            ) : null}
            {!metaConectada && naoOficial.estado?.metadados?.historico ? (
              <ImportarConversas
                historico={naoOficial.estado.metadados.historico}
                aoMudar={naoOficial.aplicarHistorico}
              />
            ) : null}
            {/* Só na conexão oficial: modelo aprovado é coisa da Cloud API. No QR Code não existe
                janela de 24 horas nem modelo, então a escolha não teria o que fazer. */}
            {metaConectada ? <ModeloDeRetomada /> : null}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="card" style={{ padding: 14 }}>
              <div>
                <p className="int-title" style={{ margin: 0 }}>Conectar com a API oficial (Meta)</p>
                <p className="hint" style={{ margin: "4px 0 0" }}>
                  Abre o cadastro da própria Meta aqui dentro. Cria (ou conecta) sua conta do
                  WhatsApp Business sem sair do CRM e sem copiar token nenhum.
                </p>
              </div>
              <EmbeddedSignupWhatsApp />
              {/* Saída pra quem já tem a conta criada: o Embedded Signup acima só funciona com o
                  app aprovado como Provedor de Tecnologia pela Meta, o que leva dias. Com a WABA
                  já aprovada, conectar por token não depende de aprovação nenhuma. */}
              <ConexaoManualWhatsApp aoConectar={recarregar} />
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p className="int-title" style={{ margin: 0 }}>Conectar com a API não oficial (QR Code)</p>
                  <p className="hint" style={{ margin: "4px 0 0" }}>
                    Escaneia como o WhatsApp Web. Não passa pela verificação de negócio da Meta,
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
                    <IconAlerta width={12} height={12} aria-hidden="true" /> {naoOficial.erro ?? naoOficial.estado?.erroMensagem}
                  </p>
                ) : naoOficial.estado?.status === "aguardando_qr" && naoOficial.estado.metadados?.qrDataUrl ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 14 }}>
                    {/* Fundo branco explícito: o PNG que a Evolution devolve tem fundo TRANSPARENTE
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

        {/* Fora do ramo acima de propósito: o espelho de um WhatsApp antigo continua no CRM mesmo
            com OUTRO canal já conectado. Foi o que aconteceu ao conectar a API oficial por cima do
            QR Code: e era exatamente aí que o botão sumia, sem forma nenhuma de limpar. */}
        <LimparDadosWhatsApp aoLimpar={() => window.location.reload()} />
      </div>
    </div>
  );
}
