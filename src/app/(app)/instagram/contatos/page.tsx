"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Topbar } from "@/components/ui";
import { useRouter } from "next/navigation";

import { IconMaisOpcoes, IconSearch } from "@/components/icons";
import type { ContatoInstagram } from "@/app/api/instagram/contatos/route";

function quando(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function iniciais(nome: string): string {
  return (
    nome
      .replace(/^@/, "")
      .split(/[\s.|_]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

/**
 * A carteira de quem chegou pelo Instagram.
 *
 * Existe separada da tela de Contatos do CRM porque as colunas são outras: @, seguidores, selo de
 * verificado e se a pessoa te segue. Um contato de WhatsApp nesta tabela seria uma linha de traços.
 *
 * A seleção múltipla é o motivo principal da tela: etiquetar duzentas pessoas de uma vez é o que
 * torna possível montar um público e disparar pra ele depois. Só ações reversíveis entram na ação
 * em massa: o estrago de um clique errado numa seleção grande não tem desfazer.
 */
export default function InstagramContatosPage() {
  const router = useRouter();
  const [contatos, setContatos] = useState<ContatoInstagram[] | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [etiqueta, setEtiqueta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/instagram/contatos", { cache: "no-store" });
    setContatos(r.ok ? ((await r.json()) as ContatoInstagram[]) : []);
  }, []);

  useEffect(() => {
    Promise.resolve()
      .then(carregar)
      .catch(() => setContatos([]));
  }, [carregar]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return contatos ?? [];
    return (contatos ?? []).filter(
      (c) => c.nome.toLowerCase().includes(termo) || (c.username ?? "").toLowerCase().includes(termo),
    );
  }, [contatos, busca]);

  const todosMarcados = visiveis.length > 0 && visiveis.every((c) => escolhidos.has(c.id));

  function alternar(id: string) {
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarTodos() {
    setEscolhidos(todosMarcados ? new Set() : new Set(visiveis.map((c) => c.id)));
  }

  async function acaoEmMassa(acao: "etiquetar" | "desetiquetar") {
    if (!escolhidos.size || !etiqueta.trim()) return;
    setOcupado(true);
    setAviso(null);
    try {
      const r = await fetch("/api/instagram/contatos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao, ids: Array.from(escolhidos), etiqueta }),
      });
      const dados = (await r.json()) as { erro?: string; alterados?: number };
      if (!r.ok) throw new Error(dados.erro ?? "Não deu certo.");
      setAviso(
        `${dados.alterados ?? 0} contato(s) ${acao === "etiquetar" ? "etiquetados" : "sem a etiqueta"}.`,
      );
      setEscolhidos(new Set());
      await carregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não deu certo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Topbar title="Contatos do Instagram" sub="Quem chegou pelo Direct, por comentário ou por story" />

      <div className="content">
        <section className="card ig-contatos-card">
          <div className="ig-contatos-barra">
            <div className="ig-busca">
              <IconSearch width={14} height={14} aria-hidden="true" />
              <input
                className="input"
                placeholder="Buscar por nome ou @"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <span className="hint">
              {contatos === null ? "Carregando…" : `${visiveis.length} de ${contatos.length}`}
            </span>
          </div>

          {/* A barra de ação só existe com alguém escolhido: um painel de ação em massa sempre à
              vista, e quase sempre desabilitado, é ruído no lugar mais perigoso da tela. */}
          {escolhidos.size > 0 ? (
            <div className="ig-massa">
              <strong>{escolhidos.size} escolhido(s)</strong>
              <input
                className="input"
                placeholder="Etiqueta"
                value={etiqueta}
                onChange={(e) => setEtiqueta(e.target.value)}
              />
              <button
                type="button"
                className="btn primary"
                disabled={ocupado || !etiqueta.trim()}
                onClick={() => acaoEmMassa("etiquetar")}
              >
                Etiquetar
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={ocupado || !etiqueta.trim()}
                onClick={() => acaoEmMassa("desetiquetar")}
              >
                Tirar etiqueta
              </button>
              <button type="button" className="btn ghost" onClick={() => setEscolhidos(new Set())}>
                Limpar seleção
              </button>
            </div>
          ) : null}

          {aviso ? <p className="hint">{aviso}</p> : null}

          {contatos === null ? (
            <p className="hint mt16">Carregando…</p>
          ) : !visiveis.length ? (
            <p className="hint mt16">
              {contatos.length ? "Ninguém com esse nome." : "Nenhum contato veio do Instagram ainda."}
            </p>
          ) : (
            <table className="table mt16">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      onChange={alternarTodos}
                      aria-label="Escolher todos"
                    />
                  </th>
                  <th>Nome</th>
                  <th>Seguidores</th>
                  <th>Verificado</th>
                  <th>Segue você</th>
                  <th>Etiquetas</th>
                  <th>Atualizado</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={escolhidos.has(c.id)}
                        onChange={() => alternar(c.id)}
                        aria-label={`Escolher ${c.nome}`}
                      />
                    </td>
                    <td>
                      <span className="ig-contato-nome">
                        {c.fotoUrl ? (
                          // Foto embutida: o link do CDN da Meta vence em horas.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="ig-avatar" src={c.fotoUrl} alt="" width={30} height={30} />
                        ) : (
                          <span className="ig-avatar ig-avatar-iniciais" style={{ width: 30, height: 30 }}>
                            {iniciais(c.nome)}
                          </span>
                        )}
                        <span>
                          <strong>{c.nome}</strong>
                          {c.username ? <span className="hint">@{c.username.replace(/^@/, "")}</span> : null}
                        </span>
                      </span>
                    </td>
                    <td>{typeof c.seguidores === "number" ? c.seguidores.toLocaleString("pt-BR") : "—"}</td>
                    <td>{c.verificado == null ? "—" : c.verificado ? "Sim" : "Não"}</td>
                    <td>{c.segueVoce == null ? "—" : c.segueVoce ? "Sim" : "Não"}</td>
                    <td className="hint">{c.etiquetas.length ? c.etiquetas.join(", ") : "—"}</td>
                    <td className="hint">{quando(c.atualizadoEm)}</td>
                    <td style={{ textAlign: "right", position: "relative" }}>
                      <button
                        type="button"
                        className="icon-btn subtle"
                        aria-label={`Ações de ${c.nome}`}
                        onClick={() => setMenuAberto(menuAberto === c.id ? null : c.id)}
                      >
                        <IconMaisOpcoes width={14} height={14} />
                      </button>
                      {menuAberto === c.id ? (
                        <div className="social-menu-opcoes" role="menu">
                          <button type="button" onClick={() => router.push("/instagram")}>
                            Abrir conversa
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEscolhidos(new Set([c.id]));
                              setMenuAberto(null);
                            }}
                          >
                            Etiquetar só este
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              // O @ é o que a pessoa procura no Instagram e cola em qualquer lugar.
                              void navigator.clipboard?.writeText(`@${(c.username ?? c.nome).replace(/^@/, "")}`);
                              setMenuAberto(null);
                              setAviso("@ copiado.");
                            }}
                          >
                            Copiar @
                          </button>
                          <button type="button" onClick={() => router.push(`/contatos?busca=${encodeURIComponent(c.nome)}`)}>
                            Ver ficha no CRM
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
