"use client";

import { useState } from "react";

import { Toggle } from "@/components/ui";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { useIntegracaoNaoOficial } from "./useIntegracaoNaoOficial";
import { useIntegracaoMeta } from "./useIntegracaoMeta";

type Aba = "conexao" | "atendimento" | "mensagens" | "compatibilidade" | "horarios";
const ABAS: { id: Aba; label: string }[] = [
  { id: "conexao", label: "Conexão" },
  { id: "atendimento", label: "Atendimento" },
  { id: "mensagens", label: "Mensagens" },
  { id: "compatibilidade", label: "Compatibilidade" },
  { id: "horarios", label: "Horários" },
];

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** WhatsApp (item 28) — único lugar do CRM pra conectar o número (o botão que existia solto em
 * /conversas saiu de lá, ver commit). Uma conta só tem uma integração de WhatsApp: oficial (Meta)
 * OU não oficial (QR Code), nunca as duas ao mesmo tempo — por isso, com uma conectada, a outra
 * opção nem aparece. Responsável/funil padrão saíram: a integração já é da conta que está logada,
 * não faz sentido escolher "responsável" separado — quem manda mensagem é quem está logado. */
export function WhatsAppSecao() {
  const [aba, setAba] = useState<Aba>("conexao");
  const { integracao, desconectando, desconectar, erroDoRedirect } = useIntegracaoMeta("meta_whatsapp");
  const naoOficial = useIntegracaoNaoOficial();
  const [painelNaoOficialAberto, setPainelNaoOficialAberto] = useState(false);

  const [distribuir, setDistribuir] = useState(true);
  const [manterResponsavel, setManterResponsavel] = useState(true);
  const [encaminharFila, setEncaminharFila] = useState(false);
  const [encerrarInatividade, setEncerrarInatividade] = useState(true);
  const [reabrirNovaMsg, setReabrirNovaMsg] = useState(true);
  const [criarContato, setCriarContato] = useState(true);
  const [criarNegocio, setCriarNegocio] = useState(false);
  const [diasAtivos, setDiasAtivos] = useState<string[]>(["Seg", "Ter", "Qua", "Qui", "Sex"]);

  const metaConectada = integracao?.status === "conectado";
  const naoOficialConectada = naoOficial.estado?.status === "conectado";
  const numeroConectado = metaConectada
    ? ((integracao?.metadados?.numeroExibicao as string | undefined) ?? "número não identificado")
    : naoOficialConectada
      ? (naoOficial.estado?.metadados?.numero ?? "número não identificado")
      : null;

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="WhatsApp" descricao="Conexão, atendimento, mensagens e compatibilidade de formatos." />
      <div className="config-abas">
        {ABAS.map((a) => (
          <button type="button" key={a.id} className={aba === a.id ? "on" : ""} onClick={() => setAba(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === "conexao" ? (
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
                      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL gerado on-the-fly pela Evolution API, não é asset estático */}
                      <img src={naoOficial.estado.metadados.qrDataUrl} alt="QR Code de conexão do WhatsApp" width={200} height={200} />
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
      ) : null}


      {aba === "atendimento" ? (
        <div className="config-bloco">
          {[
            { label: "Distribuir automaticamente", valor: distribuir, set: setDistribuir },
            { label: "Manter responsável atual", valor: manterResponsavel, set: setManterResponsavel },
            { label: "Encaminhar para fila", valor: encaminharFila, set: setEncaminharFila },
            { label: "Encerrar após inatividade", valor: encerrarInatividade, set: setEncerrarInatividade },
            { label: "Reabrir ao receber nova mensagem", valor: reabrirNovaMsg, set: setReabrirNovaMsg },
            { label: "Criar contato automaticamente", valor: criarContato, set: setCriarContato },
            { label: "Criar negócio automaticamente", valor: criarNegocio, set: setCriarNegocio },
          ].map((item) => (
            <div className="toggle-row" key={item.label} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <span className="tl">{item.label}</span>
              <Toggle defaultOn={item.valor} label={item.label} onToggle={item.set} />
            </div>
          ))}
        </div>
      ) : null}

      {aba === "mensagens" ? (
        <div className="config-bloco">
          <div className="field">
            <label>Mensagem de boas-vindas</label>
            <textarea className="input" style={{ width: "100%", minHeight: 60 }} defaultValue="Olá! Recebemos sua mensagem 💙 Já já alguém te atende." />
          </div>
          <div className="field">
            <label>Mensagem de ausência</label>
            <textarea className="input" style={{ width: "100%", minHeight: 60 }} defaultValue="No momento estamos fora do horário de atendimento." />
          </div>
          <div className="field">
            <label>Mensagem fora do horário</label>
            <textarea className="input" style={{ width: "100%", minHeight: 60 }} defaultValue="Voltamos amanhã às 08:00 — deixe sua mensagem que respondemos assim que possível." />
          </div>
          <div className="field">
            <label>Mensagem de encerramento</label>
            <textarea className="input" style={{ width: "100%", minHeight: 60 }} defaultValue="Atendimento encerrado. Qualquer coisa é só chamar de novo!" />
          </div>
          <div className="field">
            <label>Assinatura do atendente</label>
            <input className="input" defaultValue="— {atendente}, Clínica Vitta" />
          </div>
        </div>
      ) : null}

      {aba === "compatibilidade" ? (
        <div className="config-bloco">
          <div className="config-compat-lista">
            <div className="config-compat-item">
              <span className="n">Menu numerado</span>
              <span className="config-formato-compat ampla">Compatibilidade ampla</span>
            </div>
            <div className="config-compat-item">
              <span className="n">Texto livre</span>
              <span className="config-formato-compat ampla">Compatibilidade ampla</span>
            </div>
            <div className="config-compat-item">
              <span className="n">Botões clicáveis</span>
              <span className="config-formato-compat">Disponibilidade conforme a integração</span>
            </div>
            <div className="config-compat-item">
              <span className="n">Lista interativa</span>
              <span className="config-formato-compat">Disponibilidade conforme a integração</span>
            </div>
          </div>
          <p className="hint mt8" title="Alguns recursos interativos dependem do provedor e do tipo de conexão configurado.">
            ⓘ Alguns recursos interativos dependem do provedor e do tipo de conexão configurado.
          </p>
        </div>
      ) : null}

      {aba === "horarios" ? (
        <div className="config-bloco">
          <div className="field">
            <label>Dias da semana</label>
            <div className="filters-row">
              {DIAS.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`fchip${diasAtivos.includes(d) ? " active" : ""}`}
                  onClick={() => setDiasAtivos((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="config-grid-2">
            <div className="field">
              <label>Horário inicial</label>
              <input className="input" type="time" defaultValue="08:00" />
            </div>
            <div className="field">
              <label>Horário final</label>
              <input className="input" type="time" defaultValue="20:00" />
            </div>
            <div className="field">
              <label>Intervalo</label>
              <input className="input" type="text" placeholder="Ex.: 12:00–13:00" />
            </div>
            <div className="field">
              <label>Feriados</label>
              <select className="input" defaultValue="respeitar">
                <option value="respeitar">Respeitar calendário de feriados</option>
                <option value="ignorar">Atender normalmente</option>
              </select>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
