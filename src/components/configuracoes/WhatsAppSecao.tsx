"use client";

import { useState } from "react";

import { Toggle } from "@/components/ui";
import { equipe, funis } from "@/lib/data";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

type Aba = "conexao" | "atendimento" | "mensagens" | "compatibilidade" | "horarios";
const ABAS: { id: Aba; label: string }[] = [
  { id: "conexao", label: "Conexão" },
  { id: "atendimento", label: "Atendimento" },
  { id: "mensagens", label: "Mensagens" },
  { id: "compatibilidade", label: "Compatibilidade" },
  { id: "horarios", label: "Horários" },
];

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** WhatsApp (item 28) — reaproveita o mesmo texto de compatibilidade já usado no construtor de
 * automações (menu numerado/texto livre = compatibilidade ampla; botões/lista = conforme integração),
 * pra não divergir a mensagem entre as duas telas. */
export function WhatsAppSecao() {
  const [aba, setAba] = useState<Aba>("conexao");
  const [tipoConexao, setTipoConexao] = useState("Conexão por provedor");
  const [distribuir, setDistribuir] = useState(true);
  const [manterResponsavel, setManterResponsavel] = useState(true);
  const [encaminharFila, setEncaminharFila] = useState(false);
  const [encerrarInatividade, setEncerrarInatividade] = useState(true);
  const [reabrirNovaMsg, setReabrirNovaMsg] = useState(true);
  const [criarContato, setCriarContato] = useState(true);
  const [criarNegocio, setCriarNegocio] = useState(false);
  const [diasAtivos, setDiasAtivos] = useState<string[]>(["Seg", "Ter", "Qua", "Qui", "Sex"]);

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
          <div className="field">
            <label>Tipo de conexão</label>
            <select className="input" value={tipoConexao} onChange={(e) => setTipoConexao(e.target.value)}>
              <option>API oficial</option>
              <option>Conexão por provedor</option>
              <option>Conexão não oficial</option>
              <option>Não configurado</option>
            </select>
          </div>
          <div className="config-grid-2">
            <div className="field">
              <label>Nome da conexão</label>
              <input className="input" defaultValue="WhatsApp — Atendimento" />
            </div>
            <div className="field">
              <label>Número</label>
              <input className="input" defaultValue="+55 62 99999-0000" />
            </div>
            <div className="field">
              <label>Nome exibido</label>
              <input className="input" defaultValue="Clínica Vitta" />
            </div>
            <div className="field">
              <label>Equipe responsável</label>
              <select className="input" defaultValue={equipe[0]?.nome}>
                {equipe.map((m) => (
                  <option key={m.nome}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Responsável padrão</label>
              <select className="input" defaultValue={equipe[0]?.nome}>
                {equipe.map((m) => (
                  <option key={m.nome}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Funil padrão</label>
              <select className="input" defaultValue={funis[0]?.nome}>
                {funis.map((f) => (
                  <option key={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
          </div>
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
