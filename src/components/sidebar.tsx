"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";

import { currentUser, equipe, workspace } from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import {
  IconAcoes,
  IconAutomacoes,
  IconCalendar,
  IconCamera,
  IconConfiguracoes,
  IconContatos,
  IconDoc,
  IconEquipe,
  IconInicio,
  IconPipeline,
  IconRelatorios,
  IconSparkle,
  IconTarefas,
  IconText,
  IconTrafego,
  IconWhatsApp,
} from "@/components/icons";

type NavEntry = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Sub-rotas agrupadas dentro do menu "Inteligência comercial" na sidebar —
 * a central que conecta tráfego, atividades, performance, jornada do
 * cliente, motivos de perda, relatórios e o telão em tempo real, todos
 * lendo dos mesmos dados (ver `src/lib/metrics.ts` e `src/lib/timeline.ts`).
 */
export const gestaoAtividadeItens: NavEntry[] = [
  { href: "/inteligencia-comercial", label: "Visão geral", Icon: IconRelatorios },
  { href: "/trafego", label: "Tráfego", Icon: IconTrafego },
  { href: "/atividades-vendas", label: "Atividades", Icon: IconTarefas },
  { href: "/performance-vendas", label: "Performance", Icon: IconTrafego },
  { href: "/jornada-cliente", label: "Jornada do cliente", Icon: IconContatos },
  {
    href: "/performance-vendas?aba=motivos-perda",
    label: "Motivos de perda",
    Icon: IconRelatorios,
  },
  { href: "/relatorios", label: "Relatórios", Icon: IconRelatorios },
  { href: "/crm-live", label: "CRM Live", Icon: IconTrafego },
];

const gestaoAtividadeHrefs = new Set(gestaoAtividadeItens.map((i) => i.href));

export const navEntries: NavEntry[] = [
  { href: "/inicio", label: "Início", Icon: IconInicio },
  { href: "/conversas", label: "WhatsApp", Icon: IconWhatsApp },
  { href: "/funil", label: "Funil", Icon: IconPipeline },
  { href: "/tarefas", label: "Tarefas", Icon: IconTarefas },
  { href: "/documentos", label: "Documentos", Icon: IconText },
  { href: "/formularios", label: "Formulário", Icon: IconDoc },
  { href: "/agenda", label: "Agenda", Icon: IconCalendar },
  { href: "/acoes", label: "Ações", Icon: IconAcoes },
  { href: "/equipe", label: "Equipe", Icon: IconEquipe },
  { href: "/contatos", label: "Contatos", Icon: IconContatos },
  ...gestaoAtividadeItens,
  { href: "/automacoes", label: "Automações", Icon: IconAutomacoes },
  { href: "/azuz-ia", label: "Azuz IA", Icon: IconSparkle },
  { href: "/configuracoes", label: "Configurações", Icon: IconConfiguracoes },
];

/**
 * Posiciona um popover flutuante ao lado do elemento que o abriu, sempre
 * dentro dos limites da tela — vira pra esquerda se não couber à direita e
 * nunca deixa o topo/base vazar pra fora da viewport (funciona em qualquer
 * tamanho de tela, do desktop ao tablet).
 */
function posicionarFlyoutLateral(
  rect: DOMRect,
  width: number,
  alturaEstimada: number,
) {
  const margem = 12;
  let left = rect.right + 8;
  if (left + width > window.innerWidth - margem) {
    left = rect.left - width - 8;
  }
  left = Math.min(Math.max(left, margem), Math.max(margem, window.innerWidth - width - margem));

  const alturaMax = Math.min(alturaEstimada, window.innerHeight - margem * 2);
  let top = rect.top;
  top = Math.min(top, window.innerHeight - alturaMax - margem);
  top = Math.max(top, margem);

  return { top, left };
}

export function Sidebar() {
  const pathname = usePathname();
  const { funis, funilAtivoId, setFunilAtivoId } = useFunis();
  const [contaAberta, setContaAberta] = useState(false);
  const [workspaceAberto, setWorkspaceAberto] = useState(false);
  const [nomeEmpresa, setNomeEmpresa] = useState(workspace.name);
  const [segmento, setSegmento] = useState(workspace.segment);
  const workspaceBtnRef = useRef<HTMLButtonElement>(null);
  const [workspacePos, setWorkspacePos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!workspaceAberto || !workspaceBtnRef.current) return;
    const rect = workspaceBtnRef.current.getBoundingClientRect();
    setWorkspacePos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
  }, [workspaceAberto]);

  const [perfilAberto, setPerfilAberto] = useState(false);
  const perfilBtnRef = useRef<HTMLButtonElement>(null);
  const [perfilPos, setPerfilPos] = useState({ top: 0, left: 0 });
  const [perfilNome, setPerfilNome] = useState(currentUser.name);
  const [perfilEmail, setPerfilEmail] = useState(currentUser.email);
  const [perfilSenha, setPerfilSenha] = useState("");
  const [perfilSalvo, setPerfilSalvo] = useState(false);

  useEffect(() => {
    if (!perfilAberto || !perfilBtnRef.current) return;
    const rect = perfilBtnRef.current.getBoundingClientRect();
    setPerfilPos({ top: rect.top, left: rect.right + 8 });
  }, [perfilAberto]);

  function salvarPerfil() {
    setPerfilSalvo(true);
    setTimeout(() => setPerfilSalvo(false), 2000);
  }

  const souAdmin =
    equipe.find((m) => m.nome === currentUser.name)?.papelTipo === "admin";
  const outrosMembros = equipe.filter((m) => m.nome !== currentUser.name);
  const [trocarContaAberta, setTrocarContaAberta] = useState(false);
  const membrosBtnRef = useRef<HTMLDivElement>(null);
  const [trocarContaPos, setTrocarContaPos] = useState({ top: 0, left: 0 });

  function abrirTrocarConta() {
    if (!souAdmin || !membrosBtnRef.current) return;
    const rect = membrosBtnRef.current.getBoundingClientRect();
    const alturaEstimada = 62 + outrosMembros.length * 56;
    setTrocarContaPos(posicionarFlyoutLateral(rect, 260, alturaEstimada));
    setTrocarContaAberta(true);
  }

  const [gestaoAtividadeAberta, setGestaoAtividadeAberta] = useState(false);
  const gestaoAtividadeBtnRef = useRef<HTMLDivElement>(null);
  const [gestaoAtividadePos, setGestaoAtividadePos] = useState({ top: 0, left: 0 });
  const gestaoAtividadeFecharRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelarFechamentoGestaoAtividade() {
    if (gestaoAtividadeFecharRef.current) {
      clearTimeout(gestaoAtividadeFecharRef.current);
      gestaoAtividadeFecharRef.current = null;
    }
  }

  function abrirGestaoAtividade() {
    cancelarFechamentoGestaoAtividade();
    if (!gestaoAtividadeBtnRef.current) return;
    const rect = gestaoAtividadeBtnRef.current.getBoundingClientRect();
    const alturaEstimada = gestaoAtividadeItens.length * 46;
    setGestaoAtividadePos(posicionarFlyoutLateral(rect, 240, alturaEstimada));
    setGestaoAtividadeAberta(true);
  }

  /** Dá uma folga de 2s antes de fechar, pra dar tempo do mouse atravessar o espaço até o popup. */
  function agendarFechamentoGestaoAtividade() {
    cancelarFechamentoGestaoAtividade();
    gestaoAtividadeFecharRef.current = setTimeout(() => {
      setGestaoAtividadeAberta(false);
    }, 2000);
  }

  /** Se o mouse for direto pra outro item do menu (não pro submenu), fecha na hora. */
  function fecharGestaoAtividadeNaHora() {
    if (!gestaoAtividadeAberta) return;
    cancelarFechamentoGestaoAtividade();
    setGestaoAtividadeAberta(false);
  }

  useEffect(() => cancelarFechamentoGestaoAtividade, []);

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="brand-mark">a</div>
        <span className="wordmark">azuz crm</span>
      </div>

      <div className="dropdown-anchor">
        <button
          type="button"
          ref={workspaceBtnRef}
          className="sb-workspace"
          onClick={() => setWorkspaceAberto((v) => !v)}
        >
          <p className="l">Workspace</p>
          <p className="v">{nomeEmpresa}</p>
        </button>

        {workspaceAberto && typeof document !== "undefined"
          ? createPortal(
              <>
                <div
                  onClick={() => setWorkspaceAberto(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 200 }}
                />
                <div
                  className="dropdown-pop"
                  style={{
                    position: "fixed",
                    top: workspacePos.top,
                    left: workspacePos.left,
                    width: 300,
                    padding: "4px 0",
                    zIndex: 201,
                  }}
                >
              <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 14px 10px" }}>
                <div
                  className="avatar"
                  style={{ width: 44, height: 44, borderRadius: 12, fontSize: 15 }}
                >
                  {nomeEmpresa
                    .split(" ")
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <button type="button" className="btn ghost">
                  <IconCamera width={14} height={14} />
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
              </>,
              document.body,
            )
          : null}
      </div>

      <nav className="nav">
        {navEntries.map(({ href, label, Icon }) => {
          if (gestaoAtividadeHrefs.has(href)) {
            if (href !== gestaoAtividadeItens[0].href) return null;
            const gestaoAtiva = gestaoAtividadeItens.some(
              (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
            );
            return (
              <div
                key="gestao-atividade"
                ref={gestaoAtividadeBtnRef}
                onMouseEnter={abrirGestaoAtividade}
                onMouseLeave={agendarFechamentoGestaoAtividade}
              >
                <button
                  type="button"
                  className={`nav-item${gestaoAtiva ? " active" : ""}`}
                  style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                  aria-haspopup="true"
                  aria-expanded={gestaoAtividadeAberta}
                >
                  <IconRelatorios />
                  Inteligência comercial
                  <span className="r" style={{ marginLeft: "auto" }}>▸</span>
                </button>
              </div>
            );
          }
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <div key={href} onMouseEnter={fecharGestaoAtividadeNaHora}>
              <Link
                href={href}
                className={`nav-item${href === "/conversas" ? " nav-item-whatsapp" : ""}${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                {label}
              </Link>
              {href === "/funil" ? (
                <div className="nav-sublist">
                  {funis.map((f) => {
                    const subAtivo = active && f.id === funilAtivoId;
                    return (
                      <Link
                        key={f.id}
                        href="/funil"
                        className={`nav-subitem${subAtivo ? " active" : ""}`}
                        onClick={() => setFunilAtivoId(f.id)}
                      >
                        {f.nome}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {gestaoAtividadeAberta && typeof document !== "undefined"
        ? createPortal(
            <div
              className="dropdown-pop"
              style={{
                position: "fixed",
                top: gestaoAtividadePos.top,
                left: gestaoAtividadePos.left,
                width: 240,
                padding: "4px 0",
                zIndex: 210,
              }}
              onMouseEnter={cancelarFechamentoGestaoAtividade}
              onMouseLeave={agendarFechamentoGestaoAtividade}
            >
              {gestaoAtividadeItens.map((item) => {
                const subAtivo =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                if (item.href === "/crm-live") {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      title="Abre numa aba nova — telão pra projetar no escritório"
                    >
                      <span className="n">{item.label}</span>
                      <span className="r">TV</span>
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => setGestaoAtividadeAberta(false)}
                  >
                    <span className="n">{item.label}</span>
                    {subAtivo ? <span className="r">●</span> : null}
                  </Link>
                );
              })}
            </div>,
            document.body,
          )
        : null}

      <div className="sb-foot">
        <button
          type="button"
          className="sb-foot-info"
          aria-haspopup="true"
          aria-expanded={contaAberta}
          onClick={() => setContaAberta((v) => !v)}
        >
          <div className="avatar sm">{currentUser.initials}</div>
          <div>
            <p className="who">
              {currentUser.name}
              <span className="sb-foot-chevron">▾</span>
            </p>
            <p className="role">{currentUser.role}</p>
          </div>
        </button>

        {contaAberta ? (
          <>
          <div
            onClick={() => setContaAberta(false)}
            style={{ position: "fixed", inset: 0, zIndex: 55 }}
          />
          <div className="account-pop">
            <button
              type="button"
              ref={perfilBtnRef}
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => {
                setContaAberta(false);
                setPerfilAberto(true);
              }}
            >
              <span className="n">👤 Meu Perfil</span>
            </button>
            <div
              ref={membrosBtnRef}
              onMouseEnter={abrirTrocarConta}
              onMouseLeave={() => setTrocarContaAberta(false)}
            >
              <Link
                href="/equipe"
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => setContaAberta(false)}
              >
                <span className="n">👥 Gerenciar Membros</span>
                {souAdmin ? <span className="r">▸</span> : null}
              </Link>
            </div>
            <Link
              href="/configuracoes"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => setContaAberta(false)}
            >
              <span className="n">⚙️ Configurações</span>
            </Link>
            <Link
              href="/entrar"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left", borderTop: "1px solid var(--line)" }}
              onClick={() => setContaAberta(false)}
            >
              <span className="n">↪ Sair</span>
            </Link>
          </div>
          </>
        ) : null}

        {trocarContaAberta && souAdmin && typeof document !== "undefined"
          ? createPortal(
              <div
                className="dropdown-pop"
                style={{
                  position: "fixed",
                  top: trocarContaPos.top,
                  left: trocarContaPos.left,
                  width: 260,
                  padding: "4px 0",
                  zIndex: 210,
                }}
                onMouseEnter={() => setTrocarContaAberta(true)}
                onMouseLeave={() => setTrocarContaAberta(false)}
              >
                <div className="dropdown-item" style={{ borderBottom: "1px solid var(--line)" }}>
                  <span className="n">Trocar de conta</span>
                  <span className="r">Você está como {currentUser.name}</span>
                </div>
                {outrosMembros.map((m) => (
                  <button
                    type="button"
                    key={m.nome}
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => {
                      setTrocarContaAberta(false);
                      setContaAberta(false);
                    }}
                  >
                    <span className="n">{m.nome}</span>
                    <span className="r">{m.papel}</span>
                  </button>
                ))}
              </div>,
              document.body,
            )
          : null}

        {perfilAberto && typeof document !== "undefined"
          ? createPortal(
              <>
                <div
                  onClick={() => setPerfilAberto(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 200 }}
                />
                <div
                  className="dropdown-pop"
                  style={{
                    position: "fixed",
                    top: perfilPos.top,
                    left: perfilPos.left,
                    width: 300,
                    padding: "4px 0",
                    zIndex: 201,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 14px 10px" }}>
                    <div
                      className="avatar"
                      style={{ width: 44, height: 44, borderRadius: 12, fontSize: 15 }}
                    >
                      {currentUser.initials}
                    </div>
                    <button type="button" className="btn ghost">
                      <IconCamera width={14} height={14} />
                      Trocar foto
                    </button>
                  </div>
                  <div className="field">
                    <label>Nome</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      type="text"
                      value={perfilNome}
                      onChange={(e) => setPerfilNome(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>E-mail de login</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      type="email"
                      value={perfilEmail}
                      onChange={(e) => setPerfilEmail(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Nova senha</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      type="password"
                      placeholder="Deixe em branco pra manter a atual"
                      value={perfilSenha}
                      onChange={(e) => setPerfilSenha(e.target.value)}
                    />
                  </div>
                  <div className="section-foot">
                    <button
                      type="button"
                      className="btn primary block"
                      onClick={salvarPerfil}
                    >
                      {perfilSalvo ? "✓ Perfil salvo" : "Salvar perfil"}
                    </button>
                  </div>
                </div>
              </>,
              document.body,
            )
          : null}
      </div>
    </aside>
  );
}
