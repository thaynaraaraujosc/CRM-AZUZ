import type { ReactNode } from "react";

import { apiKey, integracoes, webhooks } from "@/lib/data";
import {
  IconCalendar,
  IconInstagram,
  IconWhatsApp,
} from "@/components/icons";
import { Topbar } from "@/components/ui";

const logos: Record<string, ReactNode> = {
  wa: <IconWhatsApp width={20} height={20} />,
  ig: <IconInstagram width={20} height={20} />,
  cal: <IconCalendar width={19} height={19} style={{ color: "var(--blue)" }} />,
};

export default function ConfiguracoesPage() {
  return (
    <>
      <Topbar
        title="Configurações"
        sub="Integrações, contas de anúncio, calendário e API"
      />

      <div className="content">
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
