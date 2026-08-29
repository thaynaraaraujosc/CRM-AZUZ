"use client";

import { useState } from "react";

import { Toggle } from "@/components/ui";
import { useIntegracaoMeta } from "./useIntegracaoMeta";

/**
 * Conexão do Instagram e do Meta Ads como painel — mesmo motivo de `ConexaoQrCode` e
 * `ConexaoWhatsAppOficial`: o fluxo roda embaixo do botão que a pessoa clicou, em vez de mandar
 * ela pra outra tela.
 *
 * Os dois são um redirect de OAuth (a autorização acontece no site da Meta e volta pro CRM), então
 * o painel não tem formulário: mostra o que vai acontecer, o estado atual e o link que inicia o
 * fluxo. O ganho é a pessoa ver o contexto e decidir aqui, sem passar por uma tela intermediária
 * que só repetia a escolha que ela já tinha feito.
 */
function PainelOAuth({
  provedor,
  href,
  descricao,
  rotuloConectado,
  rotuloDesconectar,
}: {
  provedor: string;
  href: string;
  descricao: string;
  rotuloConectado: string;
  rotuloDesconectar: string;
}) {
  const { integracao, desconectando, desconectar } = useIntegracaoMeta(provedor);
  const conectado = integracao?.status === "conectado";

  if (conectado) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p className="int-sub" style={{ margin: 0 }}>{rotuloConectado}</p>
        <button type="button" className="btn danger" onClick={() => void desconectar()} disabled={desconectando}>
          {desconectando ? "Desconectando…" : rotuloDesconectar}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <p className="hint" style={{ margin: 0 }}>{descricao}</p>
      <a href={href} className="btn primary" style={{ flex: "0 0 auto" }}>
        Autorizar
      </a>
    </div>
  );
}

/**
 * Uma preferência booleana guardada em `Integracao.metadados` — o PATCH faz merge, então cada
 * toggle grava só a sua chave sem apagar o resto (token, ids da conta, @ do perfil...).
 *
 * Salva no ato do clique, sem botão "Salvar": é uma chave só, e o estado visual do toggle já é a
 * confirmação. Se a gravação falhar, volta pro valor anterior — deixar o botão ligado com o banco
 * dizendo o contrário seria pior do que não ter o controle.
 */
function ToggleDaIntegracao({
  provedor,
  chave,
  valorAtual,
  titulo,
  descricao,
  aoSalvar,
}: {
  provedor: string;
  chave: string;
  valorAtual: boolean;
  titulo: string;
  descricao: string;
  aoSalvar: () => void;
}) {
  const [erro, setErro] = useState(false);

  async function alternar(ligado: boolean) {
    setErro(false);
    try {
      const resposta = await fetch("/api/integracoes/meta", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provedor, metadados: { [chave]: ligado } }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      aoSalvar();
    } catch (e) {
      console.error(`Falha ao salvar ${chave} de ${provedor}:`, e);
      setErro(true);
      aoSalvar();
    }
  }

  return (
    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div className="toggle-row">
        <span className="tl">{titulo}</span>
        <Toggle defaultOn={valorAtual} label={titulo} onToggle={(on) => void alternar(on)} />
      </div>
      <p className="hint" style={{ margin: "4px 0 0" }}>{descricao}</p>
      {erro ? (
        <p className="hint" style={{ color: "var(--danger)", margin: "4px 0 0" }}>
          ⚠ Não foi possível salvar essa preferência. Tente de novo.
        </p>
      ) : null}
    </div>
  );
}

export function ConexaoInstagram() {
  const { integracao, recarregar } = useIntegracaoMeta("meta_instagram");
  const usuario = integracao?.metadados?.instagramUsername as string | undefined;
  const conectado = integracao?.status === "conectado";
  // Conta autorizada mas sem assinatura de webhook = "Conectado" que não recebe nada. Melhor dizer
  // isso do que deixar a pessoa esperando mensagem que nunca vem.
  const erroAssinatura = integracao?.metadados?.assinaturaWebhookErro as string | null | undefined;

  // Padrão ligado nos dois: quem já tinha a conta conectada antes destes controles existirem não
  // pode perder mensagem nem lead só porque a chave ainda não estava gravada.
  const receberMensagens = (integracao?.metadados?.receberMensagens as boolean | undefined) ?? true;
  const entrarNoFunil = (integracao?.metadados?.entrarNoFunil as boolean | undefined) ?? true;

  const [reassinando, setReassinando] = useState(false);
  const [resultadoAssinatura, setResultadoAssinatura] = useState<string | null>(null);

  async function reassinar() {
    setReassinando(true);
    setResultadoAssinatura(null);
    try {
      const resposta = await fetch("/api/integracoes/instagram/reassinar", { method: "POST" });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao reativar.");
      setResultadoAssinatura("Recebimento reativado. Peça uma mensagem nova pra confirmar.");
    } catch (e) {
      setResultadoAssinatura(e instanceof Error ? e.message : "Falha ao reativar.");
    } finally {
      setReassinando(false);
      recarregar();
    }
  }

  return (
    <>
      <PainelOAuth
        provedor="meta_instagram"
        href="/api/integracoes/instagram/conectar"
        descricao="Autoriza o CRM a acessar sua conta profissional do Instagram e receber as mensagens do Direct — sem copiar token nenhum."
        rotuloConectado={usuario ? `Conectado — @${usuario}` : "Conta conectada"}
        rotuloDesconectar="Desconectar Instagram"
      />
      {conectado ? (
        <div style={{ marginTop: 8 }}>
          {erroAssinatura ? (
            <p className="hint" style={{ color: "var(--danger)", margin: "0 0 6px" }}>
              ⚠ A conta conectou, mas o CRM não conseguiu assinar o recebimento de mensagens:{" "}
              {erroAssinatura} — as mensagens do Direct não vão chegar até isso ser resolvido.
            </p>
          ) : null}
          <button type="button" className="btn ghost" disabled={reassinando} onClick={() => void reassinar()}>
            {reassinando ? "Reativando…" : "Reativar recebimento de mensagens"}
          </button>
          <p className="hint" style={{ margin: "4px 0 0" }}>
            {resultadoAssinatura ??
              "Use se as mensagens pararem de chegar no CRM mesmo com a conta conectada. Refaz só a assinatura dos eventos na Meta — não desconecta nada nem apaga conversa."}
          </p>
        </div>
      ) : null}

      {conectado ? (
        <div style={{ marginTop: 12 }}>
          <ToggleDaIntegracao
            provedor="meta_instagram"
            chave="receberMensagens"
            valorAtual={receberMensagens}
            aoSalvar={recarregar}
            titulo="Mostrar mensagens do Instagram nas Conversas"
            descricao={
              receberMensagens
                ? "As mensagens do Direct chegam na caixa de entrada, marcadas como Instagram."
                : "A conta segue conectada, mas nenhuma mensagem nova do Direct entra no CRM. O que já chegou continua salvo."
            }
          />
          <ToggleDaIntegracao
            provedor="meta_instagram"
            chave="entrarNoFunil"
            valorAtual={entrarNoFunil}
            aoSalvar={recarregar}
            titulo="Levar as conversas do Instagram para o funil"
            descricao={
              entrarNoFunil
                ? "Quem manda Direct pela primeira vez vira contato e entra na primeira etapa do funil, igual ao WhatsApp."
                : "O Direct funciona só como caixa de entrada: você responde por Conversas, sem gerar contato nem card no funil."
            }
          />
        </div>
      ) : null}
    </>
  );
}

export function ConexaoMetaAds() {
  const { integracao } = useIntegracaoMeta("meta_ads");
  const conta = integracao?.metadados?.adAccountNome as string | undefined;

  return (
    <PainelOAuth
      provedor="meta_ads"
      href="/api/integracoes/meta/conectar?provedor=meta_ads"
      descricao="Autoriza o CRM a ler suas campanhas — é o que faz a origem dos leads aparecer no painel de Tráfego."
      rotuloConectado={conta ? `Conectado — ${conta}` : "Conta de anúncios conectada"}
      rotuloDesconectar="Desconectar Meta Ads"
    />
  );
}
