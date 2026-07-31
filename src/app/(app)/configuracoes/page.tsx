"use client";

import { useState, type ReactNode } from "react";

import {
  apiKey,
  currentUser,
  integracoes,
  webhooks,
  workspace,
} from "@/lib/data";
import {
  IconCalendar,
  IconCamera,
  IconInstagram,
  IconPhone,
  IconWhatsApp,
} from "@/components/icons";
import { Topbar } from "@/components/ui";

const logos: Record<string, ReactNode> = {
  wa: <IconWhatsApp width={20} height={20} />,
  ig: <IconInstagram width={20} height={20} />,
  cal: <IconCalendar width={19} height={19} style={{ color: "var(--blue)" }} />,
  call: <IconPhone width={19} height={19} style={{ color: "var(--blue)" }} />,
};

export default function ConfiguracoesPage() {
  const [nomeEmpresa, setNomeEmpresa] = useState(workspace.name);
  const [segmento, setSegmento] = useState(workspace.segment);

  return (
    <>
      <Topbar
        title="Configurações"
        sub="Workspace, integrações, contas de anúncio, calendário e API"
      />

      <div className="content">
        <div className="int-group" id="workspace">
          <p className="int-group-h">
            Workspace — a empresa/clínica que está usando esse CRM
          </p>
          <div className="card">
            <div style={{ display: "flex", gap: 16, padding: "17px", alignItems: "center", flexWrap: "wrap" }}>
              <div
                className="avatar"
                style={{ width: 56, height: 56, borderRadius: 14, fontSize: 18 }}
              >
                {nomeEmpresa
                  .split(" ")
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <button type="button" className="btn ghost">
                <IconCamera width={15} height={15} />
                Trocar foto
              </button>
            </div>
            <div className="field">
              <label>Nome da empresa</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Segmento</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
              />
            </div>

            <div className="panel-h divided">
              <h4>Quem está logado agora</h4>
            </div>
            <div className="field">
              <label>Nome</label>
              <div className="input">{currentUser.name}</div>
            </div>
            <div className="field">
              <label>E-mail</label>
              <div className="input">{currentUser.email}</div>
            </div>
            <div className="field">
              <label>Papel</label>
              <div className="input">{currentUser.role}</div>
            </div>
          </div>
        </div>

        {integracoes.map((grupo) => (
          <div className="int-group" key={grupo.grupo}>
            <p className="int-group-h">{grupo.grupo}</p>
            <div className="card">
              {grupo.itens.map((item) => (
                <div className="int-row" key={item.titulo}>
                  <div
                    className="int-logo"
                    style={"cor" in item ? { color: item.cor } : undefined}
                  >
                    {logos[item.logo] ?? item.logo}
                  </div>
                  <div className="int-body">
                    <p className="int-title">{item.titulo}</p>
                    <p className="int-sub">{item.sub}</p>
                  </div>
                  <span
                    className={`int-status ${
                      item.status === "Conectado" ? "connected" : "off"
                    }`}
                  >
                    {item.status}
                  </span>
                  <button
                    type="button"
                    className={`btn ${
                      item.acao === "Conectar" ? "primary" : "ghost"
                    }`}
                  >
                    {item.acao}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="int-group">
          <p className="int-group-h">
            API e webhooks — pra conectar qualquer outro sistema seu
          </p>
          <div className="card">
            <div className="key-row">
              <div className="key-box">{apiKey}</div>
              <button type="button" className="btn ghost">
                Copiar
              </button>
              <button type="button" className="btn ghost">
                Gerar nova chave
              </button>
            </div>
            {webhooks.map((hook) => (
              <div className="int-row" key={hook.titulo}>
                <div className="int-body">
                  <p className="int-title">{hook.titulo}</p>
                  <p className="int-sub">{hook.sub}</p>
                </div>
                <span
                  className={`int-status ${
                    hook.status === "Ativo" ? "connected" : "off"
                  }`}
                >
                  {hook.status}
                </span>
                {hook.acao ? (
                  <button type="button" className="btn ghost">
                    {hook.acao}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
