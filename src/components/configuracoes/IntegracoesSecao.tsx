"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { IconInstagram, IconWhatsApp, IconCalendar } from "@/components/icons";
import { apiKey, webhooks } from "@/lib/data";
import { useIntegracaoMeta } from "./useIntegracaoMeta";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import type { StatusIntegracaoNaoOficial } from "./useIntegracaoNaoOficial";

type AppFuturo = { nome: string; descricao: string; categoria: string };
const APPS_EM_BREVE: AppFuturo[] = [
  { nome: "Google Ads", descricao: "Traga essa origem pro painel de Tráfego.", categoria: "Marketing" },
  { nome: "TikTok Ads", descricao: "Traga essa origem pro painel de Tráfego.", categoria: "Marketing" },
  { nome: "TikTok — mensagens", descricao: "Receba lead de comentário automaticamente.", categoria: "Comunicação" },
  { nome: "Google Agenda", descricao: "Sincronize compromissos com sua agenda pessoal.", categoria: "Agenda" },
  { nome: "Gmail", descricao: "Envie e receba e-mails direto do CRM.", categoria: "Comunicação" },
  { nome: "Outlook", descricao: "Sincronize sua caixa de entrada corporativa.", categoria: "Comunicação" },
  { nome: "Zapier", descricao: "Conecte o CRM a milhares de outros apps.", categoria: "Produtividade" },
  { nome: "Make", descricao: "Automatize fluxos entre o CRM e outros sistemas.", categoria: "Produtividade" },
  { nome: "Stripe", descricao: "Cobranças e assinaturas internacionais.", categoria: "Pagamentos" },
  { nome: "Mercado Pago", descricao: "Cobranças via Pix, boleto e cartão.", categoria: "Pagamentos" },
  { nome: "Google Sheets", descricao: "Exporte relatórios direto pra uma planilha.", categoria: "Dados" },
];
const CATEGORIAS = ["Todas", "Comunicação", "Marketing", "Produtividade", "Pagamentos", "Agenda", "Dados"];

function LinhaReal({
  icone,
  titulo,
  sub,
  conectado,
  href,
}: {
  icone: React.ReactNode;
  titulo: string;
  sub: string;
  conectado: boolean;
  href: string;
}) {
  return (
    <div className="int-row">
      <div className="int-logo">{icone}</div>
      <div className="int-body">
        <p className="int-title">{titulo}</p>
        <p className="int-sub">{sub}</p>
      </div>
      <span className={`int-status ${conectado ? "connected" : "off"}`}>{conectado ? "Conectado" : "Não conectado"}</span>
      <Link href={href} className={`btn ${conectado ? "ghost" : "primary"}`}>
        {conectado ? "Gerenciar" : "Conectar"}
      </Link>
    </div>
  );
}

/**
 * Integrações e aplicativos (item 2 do pedido de novas demandas) — antes toda a lista, mesmo as
 * que já tinham rota real por trás (Meta/Baileys), era só decoração: status fixo "Conectado" com
 * dado inventado, botão sem `onClick`. Agora mostra o status real de cada integração que já
 * funciona de verdade (linka pra tela onde o fluxo de conexão de fato acontece — OAuth da Meta ou
 * QR Code do WhatsApp) e separa claramente o que ainda não existe ("Em breve", sem fingir que
 * funciona) — cada integração nova entra aqui trocando de lista, não com um botão fake.
 */
export function IntegracoesSecao() {
  const whatsappMeta = useIntegracaoMeta("meta_whatsapp");
  const instagram = useIntegracaoMeta("meta_instagram");
  const metaAds = useIntegracaoMeta("meta_ads");

  // Status do WhatsApp não oficial (whatsapp-service) direto aqui, sem polling — só pra mostrar o
  // estado atual ao abrir a tela. Falha em silêncio (serviço fora do ar não pode quebrar essa tela).
  const [naoOficialStatus, setNaoOficialStatus] = useState<StatusIntegracaoNaoOficial | null>(null);
  useEffect(() => {
    fetch("/api/integracoes/whatsapp-nao-oficial")
      .then((r) => r.json())
      .then((dados) => setNaoOficialStatus("erro" in dados ? null : dados))
      .catch(() => setNaoOficialStatus(null));
  }, []);

  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const appsFiltrados = APPS_EM_BREVE.filter((a) => categoriaFiltro === "Todas" || a.categoria === categoriaFiltro);

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Integrações e aplicativos" descricao="Conexões que já funcionam de verdade e uma prévia do que vem por aí." />

      <div className="int-group">
        <p className="int-group-h">Prontas pra usar</p>
        <div className="card">
          <LinhaReal
            icone={<IconWhatsApp width={20} height={20} />}
            titulo="WhatsApp Business (API oficial)"
            sub={whatsappMeta.integracao?.status === "conectado" ? "Meta Business conectado" : "Conecte via Meta Business Manager"}
            conectado={whatsappMeta.integracao?.status === "conectado"}
            href="/configuracoes?categoria=whatsapp"
          />
          <LinhaReal
            icone={<IconWhatsApp width={20} height={20} />}
            titulo="WhatsApp via QR Code"
            sub={naoOficialStatus?.status === "conectado" ? `Número conectado${naoOficialStatus.metadados?.numero ? `: ${naoOficialStatus.metadados.numero}` : ""}` : "Escaneia o QR Code, sem precisar de aprovação da Meta"}
            conectado={naoOficialStatus?.status === "conectado"}
            href="/configuracoes?categoria=whatsapp"
          />
          <LinhaReal
            icone={<IconInstagram width={20} height={20} />}
            titulo="Instagram Direct"
            sub={instagram.integracao?.status === "conectado" ? "Conta conectada" : "Conecte via Meta Business Manager"}
            conectado={instagram.integracao?.status === "conectado"}
            href="/configuracoes?categoria=instagram"
          />
          <LinhaReal
            icone={<IconCalendar width={19} height={19} style={{ color: "var(--blue)" }} />}
            titulo="Meta Ads"
            sub={metaAds.integracao?.status === "conectado" ? "Alimenta o painel de Tráfego automaticamente" : "Conecte pra ver essa origem no painel de Tráfego"}
            conectado={metaAds.integracao?.status === "conectado"}
            href="/trafego"
          />
        </div>
      </div>

      <div className="int-group">
        <p className="int-group-h">API e webhooks — pra conectar qualquer outro sistema seu</p>
        <div className="card">
          <p className="hint" style={{ padding: "10px 17px 0" }}>Em breve — ainda não é possível gerar chave de API própria.</p>
          <div className="key-row">
            <div className="key-box">{apiKey}</div>
            <button type="button" className="btn ghost" disabled>
              Copiar
            </button>
            <button type="button" className="btn ghost" disabled>
              Gerar nova chave
            </button>
          </div>
          {webhooks.map((hook) => (
            <div className="int-row" key={hook.titulo}>
              <div className="int-body">
                <p className="int-title">{hook.titulo}</p>
                <p className="int-sub">{hook.sub}</p>
              </div>
              <span className="int-status off">Em breve</span>
            </div>
          ))}
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Em breve</p>
        <div className="filters-row mb14">
          {CATEGORIAS.map((c) => (
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
                <span className="int-status off">Em breve</span>
              </div>
              <p className="r">{a.descricao}</p>
              <div className="config-canal-card-acoes">
                <button type="button" className="btn ghost" disabled>
                  Em breve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
