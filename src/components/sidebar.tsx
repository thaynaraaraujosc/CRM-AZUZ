"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";

import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import {
  IconAcoes,
  IconAutomacoes,
  IconCalendar,
  IconConfiguracoes,
  IconContatos,
  IconDoc,
  IconEquipe,
  IconInicio,
  IconPipeline,
  IconRelatorios,
  IconSparkle,
  IconTarefas,
  IconConversas,
  IconTrafego,
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
  { href: "/trafego", label: "Tráfego", Icon: IconTrafego },
  { href: "/atividades-vendas", label: "Atividades", Icon: IconTarefas },
  { href: "/performance-vendas", label: "Performance", Icon: IconTrafego },
  { href: "/jornada-cliente", label: "Jornada do cliente", Icon: IconContatos },
  { href: "/motivos-perda", label: "Motivos de perda", Icon: IconRelatorios },
  { href: "/relatorios", label: "Relatórios", Icon: IconRelatorios },
  { href: "/crm-live", label: "CRM Live", Icon: IconTrafego },
];

const gestaoAtividadeHrefs = new Set(gestaoAtividadeItens.map((i) => i.href));

export const navEntries: NavEntry[] = [
  { href: "/inicio", label: "Início", Icon: IconInicio },
  // A tela atende WhatsApp, Instagram, TikTok e e-mail — chamar de "WhatsApp" no menu descrevia
  // um canal só e escondia os outros três de quem procurava por eles.
  { href: "/conversas", label: "Conversas", Icon: IconConversas },
  { href: "/funil", label: "Funil", Icon: IconPipeline },
  { href: "/tarefas", label: "Tarefas", Icon: IconTarefas },
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

const CHAVE_SIDEBAR_RECOLHIDA = "azuz-crm-sidebar-recolhida";

export function Sidebar() {
  const pathname = usePathname();
  const { data: sessao } = useSession();
  // Aberta por padrão pra quem entra — só recolhe se a própria pessoa pedir (guardado por
  // navegador, não é preferência de conta). Lazy-init lê `localStorage` uma vez, sem flash.
  const [recolhida, setRecolhida] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(CHAVE_SIDEBAR_RECOLHIDA) === "1";
    } catch {
      return false;
    }
  });
  function alternarRecolhida() {
    setRecolhida((prev) => {
      const proximo = !prev;
      try {
        localStorage.setItem(CHAVE_SIDEBAR_RECOLHIDA, proximo ? "1" : "0");
      } catch {
        // localStorage indisponível — só não persiste entre sessões
      }
      return proximo;
    });
  }
  const currentUser = {
    name: sessao?.user?.name ?? "",
    initials: sessao?.user?.initials ?? "",
    role: sessao?.user?.role ?? "",
    email: sessao?.user?.email ?? "",
  };
  const { funis, funilAtivoId, setFunilAtivoId } = useFunis();
  const { membros: equipe } = useEquipe();
  const [contaAberta, setContaAberta] = useState(false);
  const [contaAnchorRect, setContaAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: contaPopRef, posicao: contaPos } = useFloatingPosition(contaAnchorRect, contaAberta, 8, () => setContaAberta(false));
  const [workspaceAberto, setWorkspaceAberto] = useState(false);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nomeEmpresaSincronizado, setNomeEmpresaSincronizado] = useState<string | null>(null);
  const [salvandoNome, setSalvandoNome] = useState(false);
  // Sincroniza com a sessão assim que ela carregar — "ajustar estado durante a renderização" (não
  // num useEffect) porque só precisa rodar uma vez, quando o nome do workspace muda de verdade.
  if (sessao?.user?.workspaceNome && sessao.user.workspaceNome !== nomeEmpresaSincronizado) {
    setNomeEmpresaSincronizado(sessao.user.workspaceNome);
    setNomeEmpresa(sessao.user.workspaceNome);
  }
  const [workspaceAnchorRect, setWorkspaceAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: workspacePopRef, posicao: workspacePos } = useFloatingPosition(workspaceAnchorRect, workspaceAberto, 8, () => setWorkspaceAberto(false));

  // Único lugar do CRM que edita o nome do workspace (`PATCH /api/workspace`, coluna real) — a
  // categoria "Workspace" de Configurações > Geral foi removida por ser redundante com isto aqui.
  function salvarNomeWorkspace() {
    const nome = nomeEmpresa.trim();
    if (!nome || nome === nomeEmpresaSincronizado) return;
    setSalvandoNome(true);
    fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        setNomeEmpresaSincronizado(nome);
      })
      .catch((erro) => console.error("Falha ao atualizar nome do workspace:", erro))
      .finally(() => setSalvandoNome(false));
  }

  const souAdmin =
    equipe.find((m) => m.nome === currentUser.name)?.papelTipo === "admin";
  const outrosMembros = equipe.filter((m) => m.nome !== currentUser.name);

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

  /** Dá uma folga bem curta antes de fechar, só pra não fechar se o mouse passar rapidinho pelo
   * vão até o submenu — 2s (valor anterior) dava a sensação de "não fecha nunca" quando o mouse
   * saía de vez da sidebar. */
  function agendarFechamentoGestaoAtividade() {
    cancelarFechamentoGestaoAtividade();
    gestaoAtividadeFecharRef.current = setTimeout(() => {
      setGestaoAtividadeAberta(false);
    }, 200);
  }

  /** Se o mouse for direto pra outro item do menu (não pro submenu), fecha na hora. */
  function fecharGestaoAtividadeNaHora() {
    if (!gestaoAtividadeAberta) return;
    cancelarFechamentoGestaoAtividade();
    setGestaoAtividadeAberta(false);
  }

  useEffect(() => cancelarFechamentoGestaoAtividade, []);

  const gestaoAtividadePopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!gestaoAtividadeAberta) return;
    function aoClicarFora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (gestaoAtividadeBtnRef.current?.contains(alvo)) return;
      if (gestaoAtividadePopRef.current?.contains(alvo)) return;
      setGestaoAtividadeAberta(false);
    }
    function aoTeclarEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setGestaoAtividadeAberta(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclarEsc);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclarEsc);
    };
  }, [gestaoAtividadeAberta]);

  return (
    <aside className={`sidebar${recolhida ? " recolhida" : ""}`}>
      <div className="sb-brand">
        <div className="brand-mark">a</div>
        {!recolhida ? <span className="wordmark">azuz crm</span> : null}
        <button
          type="button"
          className="sb-recolher"
          aria-label={recolhida ? "Expandir menu lateral" : "Recolher menu lateral"}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          onClick={alternarRecolhida}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: recolhida ? "rotate(180deg)" : "none" }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div className="dropdown-anchor">
        <button
          type="button"
          className="sb-workspace"
          onClick={(e) => {
            if (workspaceAberto) {
              setWorkspaceAberto(false);
            } else {
              setWorkspaceAnchorRect(e.currentTarget.getBoundingClientRect());
              setWorkspaceAberto(true);
            }
          }}
        >
          {!recolhida ? (
            <>
              <p className="l">Workspace</p>
              <p className="v">{nomeEmpresa}</p>
            </>
          ) : (
            <div className="avatar sm" title={nomeEmpresa}>
              {(nomeEmpresa || "?")
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </div>
          )}
        </button>

        {workspaceAberto && workspacePos && typeof document !== "undefined"
          ? createPortal(
              <>
                <div
                  onClick={() => setWorkspaceAberto(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 200 }}
                />
                <div
                  ref={workspacePopRef}
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
                  {(nomeEmpresa || "?")
                    .split(" ")
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()}
                </div>
              </div>
              <div className="field">
                <label>Nome da empresa</label>
                {souAdmin ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="input"
                      value={nomeEmpresa}
                      onChange={(e) => setNomeEmpresa(e.target.value)}
                      onBlur={salvarNomeWorkspace}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      disabled={salvandoNome}
                    />
                  </div>
                ) : (
                  <div className="input">{nomeEmpresa || "—"}</div>
                )}
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
                  title={recolhida ? "Inteligência comercial" : undefined}
                >
                  <IconRelatorios />
                  {!recolhida ? (
                    <>
                      Inteligência comercial
                      <span className="r" style={{ marginLeft: "auto" }}>▸</span>
                    </>
                  ) : null}
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
                title={recolhida ? label : undefined}
              >
                <Icon />
                {!recolhida ? (
                  <>
                    {label}
                    {href === "/azuz-ia" ? <span className="nav-badge-em-breve">Em breve</span> : null}
                  </>
                ) : null}
              </Link>
              {href === "/funil" && !recolhida ? (
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
              ref={gestaoAtividadePopRef}
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
          onClick={(e) => {
            if (contaAberta) {
              setContaAberta(false);
            } else {
              setContaAnchorRect(e.currentTarget.getBoundingClientRect());
              setContaAberta(true);
            }
          }}
        >
          <div className="avatar sm" title={recolhida ? currentUser.name : undefined}>{currentUser.initials}</div>
          {!recolhida ? (
            <div>
              <p className="who">
                {currentUser.name}
                <span className="sb-foot-chevron">▾</span>
              </p>
              <p className="role">{currentUser.role}</p>
            </div>
          ) : null}
        </button>

        {contaAberta && contaPos && typeof document !== "undefined"
          ? createPortal(
              <>
                <div
                  onClick={() => setContaAberta(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 200 }}
                />
                <div
                  ref={contaPopRef}
                  className="account-pop"
                  style={{
                    position: "fixed",
                    top: contaPos.top,
                    left: contaPos.left,
                    right: "auto",
                    bottom: "auto",
                    width: 280,
                    zIndex: 201,
                  }}
                >
                  {souAdmin ? (
                    <>
                      <div className="dropdown-item" style={{ cursor: "default" }}>
                        <span className="n">Trocar de conta</span>
                        <span className="r">Você está como {currentUser.name}</span>
                      </div>
                      {outrosMembros.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          className="dropdown-item"
                          style={{ width: "100%", textAlign: "left" }}
                          onClick={() => setContaAberta(false)}
                        >
                          <span className="n">{m.nome}</span>
                          <span className="r">{m.papel}</span>
                        </button>
                      ))}
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left", borderTop: "1px solid var(--line)" }}
                    onClick={() => {
                      setContaAberta(false);
                      signOut({ callbackUrl: "/login" });
                    }}
                  >
                    <span className="n">↪ Sair</span>
                  </button>
                </div>
              </>,
              document.body,
            )
          : null}
      </div>
    </aside>
  );
}
