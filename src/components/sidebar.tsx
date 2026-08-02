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
  IconTrafego,
  IconWhatsApp,
} from "@/components/icons";

type NavEntry = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const navEntries: NavEntry[] = [
  { href: "/inicio", label: "Início", Icon: IconInicio },
  { href: "/conversas", label: "WhatsApp", Icon: IconWhatsApp },
  { href: "/funil", label: "Funil", Icon: IconPipeline },
  { href: "/tarefas", label: "Tarefas", Icon: IconTarefas },
  { href: "/formularios", label: "Formulário", Icon: IconDoc },
  { href: "/agenda", label: "Agenda", Icon: IconCalendar },
  { href: "/acoes", label: "Ações", Icon: IconAcoes },
  { href: "/equipe", label: "Equipe", Icon: IconEquipe },
  { href: "/contatos", label: "Contatos", Icon: IconContatos },
  { href: "/trafego", label: "Tráfego", Icon: IconTrafego },
  {
    href: "/atividades-vendas",
    label: "Atividades de venda",
    Icon: IconRelatorios,
  },
  {
    href: "/performance-vendas",
    label: "Performance de venda",
    Icon: IconTrafego,
  },
  { href: "/relatorios", label: "Relatórios", Icon: IconRelatorios },
  { href: "/automacoes", label: "Automações", Icon: IconAutomacoes },
  { href: "/azuz-ia", label: "Azuz IA", Icon: IconSparkle },
  { href: "/configuracoes", label: "Configurações", Icon: IconConfiguracoes },
];

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
    setTrocarContaPos({ top: rect.top, left: rect.right + 8 });
    setTrocarContaAberta(true);
  }

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
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <div key={href}>
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
