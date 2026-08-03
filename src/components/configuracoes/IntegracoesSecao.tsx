"use client";

import { useState, type ReactNode } from "react";

import { IconInstagram, IconWhatsApp, IconCalendar } from "@/components/icons";
import { apiKey, integracoes, webhooks } from "@/lib/data";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

const logos: Record<string, ReactNode> = {
  wa: <IconWhatsApp width={20} height={20} />,
  ig: <IconInstagram width={20} height={20} />,
  cal: <IconCalendar width={19} height={19} style={{ color: "var(--blue)" }} />,
};

type AppBiblioteca = { nome: string; descricao: string; categoria: string };
const BIBLIOTECA_APPS: AppBiblioteca[] = [
  { nome: "Gmail", descricao: "Envie e receba e-mails direto do CRM.", categoria: "Comunicação" },
  { nome: "Outlook", descricao: "Sincronize sua caixa de entrada corporativa.", categoria: "Comunicação" },
  { nome: "Facebook", descricao: "Leads de formulários e mensagens da página.", categoria: "Marketing" },
  { nome: "Zapier", descricao: "Conecte o CRM a milhares de outros apps.", categoria: "Produtividade" },
  { nome: "Make", descricao: "Automatize fluxos entre o CRM e outros sistemas.", categoria: "Produtividade" },
  { nome: "Stripe", descricao: "Cobranças e assinaturas internacionais.", categoria: "Pagamentos" },
  { nome: "Mercado Pago", descricao: "Cobranças via Pix, boleto e cartão.", categoria: "Pagamentos" },
  { nome: "Google Sheets", descricao: "Exporte relatórios direto pra uma planilha.", categoria: "Dados" },
];
const CATEGORIAS_BIBLIOTECA = ["Todas", "Comunicação", "Marketing", "Produtividade", "Pagamentos", "Agenda", "Dados", "Desenvolvimento"];

/** Integrações e aplicativos (item 34) — mantém a lista real já existente (`integracoes`/`webhooks`
 * de `data.ts`, usada de verdade em Tráfego/WhatsApp/Agenda) e acrescenta uma biblioteca maior de
 * apps mockados, sem conectar nada de verdade. */
export function IntegracoesSecao() {
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const appsFiltrados = BIBLIOTECA_APPS.filter((a) => categoriaFiltro === "Todas" || a.categoria === categoriaFiltro);

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Integrações e aplicativos" descricao="Conexões já usadas pelo CRM e uma biblioteca de outras ferramentas." />

      {integracoes.map((grupo) => (
        <div className="int-group" key={grupo.grupo}>
          <p className="int-group-h">{grupo.grupo}</p>
          <div className="card">
            {grupo.itens.map((item) => (
              <div className="int-row" key={item.titulo}>
                <div className="int-logo" style={"cor" in item ? { color: item.cor } : undefined}>
                  {logos[item.logo] ?? item.logo}
                </div>
                <div className="int-body">
                  <p className="int-title">{item.titulo}</p>
                  <p className="int-sub">{item.sub}</p>
                </div>
                <span className={`int-status ${item.status === "Conectado" ? "connected" : "off"}`}>{item.status}</span>
                <button type="button" className={`btn ${item.acao === "Conectar" ? "primary" : "ghost"}`}>
                  {item.acao}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="int-group">
        <p className="int-group-h">API e webhooks — pra conectar qualquer outro sistema seu</p>
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
              <span className={`int-status ${hook.status === "Ativo" ? "connected" : "off"}`}>{hook.status}</span>
              {hook.acao ? (
                <button type="button" className="btn ghost">
                  {hook.acao}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Biblioteca de aplicativos</p>
        <div className="filters-row mb14">
          {CATEGORIAS_BIBLIOTECA.map((c) => (
            <button type="button" key={c} className={`fchip${categoriaFiltro === c ? " active" : ""}`} onClick={() => setCategoriaFiltro(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="config-canais-grid">
          {appsFiltrados.map((a) => (
            <div className="config-canal-card" key={a.nome}>
              <div className="config-canal-card-h">
                <span className="n">{a.nome}</span>
                <span className="int-status off">Não conectado</span>
              </div>
              <p className="r">{a.descricao}</p>
              <p className="r">Categoria: {a.categoria}</p>
              <div className="config-canal-card-acoes">
                <button type="button" className="btn primary">
                  Configurar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
