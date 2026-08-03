"use client";

import { useState } from "react";

import { Modal, Toggle } from "@/components/ui";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

type Aba = "contas" | "assinaturas" | "modelos" | "preferencias";
const ABAS: { id: Aba; label: string }[] = [
  { id: "contas", label: "Contas" },
  { id: "assinaturas", label: "Assinaturas" },
  { id: "modelos", label: "Modelos" },
  { id: "preferencias", label: "Preferências" },
];

type ModeloEmail = { id: string; nome: string; assunto: string; conteudo: string; categoria: string };
const MODELOS_INICIAIS: ModeloEmail[] = [
  { id: "boas-vindas", nome: "Boas-vindas", assunto: "Seja bem-vindo(a), {primeiro_nome}!", conteudo: "Olá {primeiro_nome}, obrigado por entrar em contato...", categoria: "Atendimento" },
  { id: "proposta", nome: "Envio de proposta", assunto: "Sua proposta está pronta", conteudo: "Olá {primeiro_nome}, segue em anexo a proposta que conversamos...", categoria: "Vendas" },
];

/** E-mail (item 30) — conexão simulada (não conecta conta real), modelos com preview. */
export function EmailSecao() {
  const [aba, setAba] = useState<Aba>("contas");
  const [conectado, setConectado] = useState(false);
  const [remetente, setRemetente] = useState("contato@clinicavitta.com.br");
  const [nomeRemetente, setNomeRemetente] = useState("Clínica Vitta");
  const [assinatura, setAssinatura] = useState("Atenciosamente,\nEquipe Clínica Vitta");
  const [respostaAutomatica, setRespostaAutomatica] = useState(false);
  const [rastreamento, setRastreamento] = useState(true);
  const [vincularContato, setVincularContato] = useState(true);
  const [modelos] = useState(MODELOS_INICIAIS);
  const [modeloSelecionado, setModeloSelecionado] = useState<ModeloEmail | null>(null);

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="E-mail" descricao="Contas, assinaturas, modelos e rastreamento de envio." />
      <div className="config-abas">
        {ABAS.map((a) => (
          <button type="button" key={a.id} className={aba === a.id ? "on" : ""} onClick={() => setAba(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === "contas" ? (
        <div className="config-bloco">
          <div className="config-canal-card" style={{ marginBottom: 12 }}>
            <div className="config-canal-card-h">
              <span className="n">{remetente}</span>
              <span className={`int-status ${conectado ? "connected" : "off"}`}>{conectado ? "Conectado" : "Não conectado"}</span>
            </div>
            <button type="button" className="btn ghost mt8" onClick={() => setConectado((v) => !v)}>
              {conectado ? "Desconectar conta" : "Conectar conta"}
            </button>
          </div>
          <div className="config-grid-2">
            <div className="field">
              <label>E-mail remetente</label>
              <input className="input" value={remetente} onChange={(e) => setRemetente(e.target.value)} />
            </div>
            <div className="field">
              <label>Nome do remetente</label>
              <input className="input" value={nomeRemetente} onChange={(e) => setNomeRemetente(e.target.value)} />
            </div>
          </div>
        </div>
      ) : null}

      {aba === "assinaturas" ? (
        <div className="config-bloco">
          <div className="field">
            <label>Assinatura padrão</label>
            <textarea className="input" style={{ width: "100%", minHeight: 90 }} value={assinatura} onChange={(e) => setAssinatura(e.target.value)} />
          </div>
          <div className="config-email-preview">
            <p className="r">Prévia:</p>
            <pre>{assinatura}</pre>
          </div>
        </div>
      ) : null}

      {aba === "modelos" ? (
        <div className="config-bloco">
          <div className="config-lista-linhas">
            {modelos.map((m) => (
              <button type="button" key={m.id} className="config-linha-clicavel" onClick={() => setModeloSelecionado(m)}>
                <div>
                  <p className="n">{m.nome}</p>
                  <p className="r">
                    {m.categoria} · {m.assunto}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <Modal aberto={!!modeloSelecionado} onFechar={() => setModeloSelecionado(null)} titulo={modeloSelecionado?.nome ?? ""} largura={480}>
            {modeloSelecionado ? (
              <>
                <p className="hint">Assunto: {modeloSelecionado.assunto}</p>
                <div className="config-email-preview">
                  <pre>{modeloSelecionado.conteudo}</pre>
                </div>
              </>
            ) : null}
          </Modal>
        </div>
      ) : null}

      {aba === "preferencias" ? (
        <div className="config-bloco">
          {[
            { label: "Resposta automática", valor: respostaAutomatica, set: setRespostaAutomatica },
            { label: "Rastreamento visual (abertura/clique)", valor: rastreamento, set: setRastreamento },
            { label: "Vincular e-mail ao contato automaticamente", valor: vincularContato, set: setVincularContato },
          ].map((item) => (
            <div className="toggle-row" key={item.label} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <span className="tl">{item.label}</span>
              <Toggle defaultOn={item.valor} label={item.label} onToggle={item.set} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
