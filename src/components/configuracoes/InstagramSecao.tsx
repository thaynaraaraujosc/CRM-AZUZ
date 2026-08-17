"use client";

import { Toggle } from "@/components/ui";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { useIntegracaoMeta } from "./useIntegracaoMeta";

/**
 * Instagram e Facebook (Configurações > Integrações) — só conecta a Meta e controla o que entra no
 * CRM a partir dessa conexão. Regras de automação (criar contato ao comentar, responder story
 * etc.) saíram daqui de propósito: pertencem ao módulo Automação, que ainda vai consumir os eventos
 * dessa integração — aqui é só "conectar e disponibilizar o canal", não "o que fazer quando algo
 * acontecer".
 */
export function InstagramSecao() {
  const { integracao, desconectando, desconectar, erroDoRedirect } = useIntegracaoMeta("meta_instagram");
  const anuncios = useIntegracaoMeta("meta_ads");

  const conectado = integracao?.status === "conectado";
  const pageNome = integracao?.metadados?.pageNome as string | undefined;
  const instagramUsername = integracao?.metadados?.instagramUsername as string | undefined;
  const adAccountNome = anuncios.integracao?.metadados?.adAccountNome as string | undefined;
  const anunciosConectados = anuncios.integracao?.status === "conectado";

  async function alternarReceberMensagens(ligado: boolean) {
    await fetch("/api/integracoes/meta", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provedor: "meta_instagram", metadados: { receberMensagens: ligado } }),
    }).catch((erro) => console.error("Falha ao salvar preferência de mensagens do Instagram:", erro));
  }

  const receberMensagens = (integracao?.metadados?.receberMensagens as boolean | undefined) ?? true;

  return (
    <div className="config-secao">
      <CabecalhoCategoria
        titulo="Instagram e Facebook"
        descricao="Conecte suas contas da Meta para centralizar informações do Instagram e Facebook, receber mensagens e utilizar esses canais nas automações do CRM."
      />

      {erroDoRedirect ? (
        <p className="hint" style={{ color: "var(--danger)", marginBottom: 10 }}>
          ⚠ Não foi possível conectar: {erroDoRedirect}
        </p>
      ) : integracao?.status === "erro" ? (
        <p className="hint" style={{ color: "var(--danger)", marginBottom: 10 }}>
          ⚠ Erro na última tentativa: {integracao.erroMensagem}
        </p>
      ) : null}

      <div className="config-bloco">
        <p className="config-bloco-titulo">Conexão com a Meta</p>

        {!conectado ? (
          <a
            href="/api/integracoes/meta/conectar?provedor=meta_instagram"
            className="card"
            style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textDecoration: "none" }}
          >
            <div>
              <p className="int-title" style={{ margin: 0 }}>Conectar com Meta</p>
              <p className="hint" style={{ margin: "4px 0 0" }}>
                Autoriza o CRM a acessar sua Página do Facebook e sua conta profissional do
                Instagram — sem precisar copiar token nenhum.
              </p>
            </div>
            <span className="btn primary">Conectar</span>
          </a>
        ) : (
          <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="int-status connected">Meta conectada</span>
            </div>

            <div className="int-row" style={{ padding: 0 }}>
              <div className="int-body">
                <p className="int-title">Facebook</p>
                <p className="int-sub">{pageNome ? `Página ${pageNome}` : "Página conectada"}</p>
              </div>
              <span className="int-status connected">Conectado</span>
            </div>

            <div className="int-row" style={{ padding: 0 }}>
              <div className="int-body">
                <p className="int-title">Instagram</p>
                <p className="int-sub">{instagramUsername ? `@${instagramUsername}` : "Conta conectada"}</p>
              </div>
              <span className="int-status connected">Conectado</span>
            </div>

            <div className="int-row" style={{ padding: 0 }}>
              <div className="int-body">
                <p className="int-title">Conta de anúncios</p>
                <p className="int-sub">{anunciosConectados ? adAccountNome ?? "Conta conectada" : "Conecte em Tráfego, se quiser usar dados de anúncios"}</p>
              </div>
              <span className={`int-status ${anunciosConectados ? "connected" : "off"}`}>
                {anunciosConectados ? "Conectado" : "Não conectado"}
              </span>
            </div>

            <div style={{ marginTop: 4 }}>
              <button type="button" className="btn danger" onClick={desconectar} disabled={desconectando}>
                {desconectando ? "Desconectando…" : "Desconectar Meta"}
              </button>
            </div>
          </div>
        )}
      </div>

      {conectado ? (
        <div className="config-bloco">
          <p className="config-bloco-titulo">Mensagens do Instagram</p>
          <div className="toggle-row" style={{ padding: "10px 0" }}>
            <span className="tl">Receber mensagens do Instagram no CRM</span>
            <Toggle defaultOn={receberMensagens} label="Receber mensagens do Instagram no CRM" onToggle={alternarReceberMensagens} />
          </div>
          <p className="hint">
            {receberMensagens
              ? "Mensagens recebidas pelo Instagram são encaminhadas para o módulo de Conversas, identificadas como Instagram, pra sua equipe acompanhar e responder por lá."
              : "Mensagens do Instagram não são encaminhadas para o módulo de Conversas — a conta continua conectada, só o recebimento fica pausado."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
