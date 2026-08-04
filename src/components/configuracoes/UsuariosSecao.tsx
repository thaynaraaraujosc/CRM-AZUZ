"use client";

import { useState } from "react";

import { Drawer, Modal } from "@/components/ui";
import { useConfiguracoes } from "@/lib/configuracoes-context";
import { useEquipe } from "@/lib/equipe-context";
import { FUNCOES_PADRAO, TODAS_PERMISSOES_IDS } from "@/lib/configuracoes/permissoes";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { MatrizPermissoes } from "./MatrizPermissoes";

const FUNCOES_OPCOES = [...FUNCOES_PADRAO.map((f) => f.nome), "Função personalizada"];

/** Usuários e permissões + Funções (itens 21-22) — tabela real de `equipe` (data.ts); adicionar
 * usuário e criar função ficam em estado local (front-end apenas, sem convite/e-mail de verdade). */
export function UsuariosSecao() {
  const { estado, adicionarFuncao, removerFuncao } = useConfiguracoes();
  const { membros: equipe, convidarMembro } = useEquipe();
  const [aba, setAba] = useState<"usuarios" | "funcoes">("usuarios");
  const [busca, setBusca] = useState("");
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [funcaoEscolhida, setFuncaoEscolhida] = useState(FUNCOES_OPCOES[2]);
  const [permissoesNovoUsuario, setPermissoesNovoUsuario] = useState<string[]>(FUNCOES_PADRAO[2]?.permissoesPadrao ?? []);

  const [novaFuncaoAberta, setNovaFuncaoAberta] = useState(false);
  const [nomeFuncao, setNomeFuncao] = useState("");
  const [descFuncao, setDescFuncao] = useState("");
  const [corFuncao, setCorFuncao] = useState("#2e6bff");
  const [permissoesFuncao, setPermissoesFuncao] = useState<string[]>([]);
  const [baseadaEm, setBaseadaEm] = useState("Nenhuma");

  const usuariosFiltrados = equipe.filter((m) => m.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <div className="config-secao">
      <CabecalhoCategoria
        titulo="Usuários e permissões"
        descricao="Quem tem acesso ao workspace e o que cada um pode fazer."
        acoes={
          aba === "usuarios" ? (
            <button type="button" className="btn primary" onClick={() => setDrawerAberto(true)}>
              + Adicionar usuário
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={() => setNovaFuncaoAberta(true)}>
              + Criar função
            </button>
          )
        }
      />

      <div className="config-abas">
        <button type="button" className={aba === "usuarios" ? "on" : ""} onClick={() => setAba("usuarios")}>
          Usuários
        </button>
        <button type="button" className={aba === "funcoes" ? "on" : ""} onClick={() => setAba("funcoes")}>
          Funções
        </button>
      </div>

      {aba === "usuarios" ? (
        <div className="config-bloco">
          <input className="input" style={{ width: "100%", marginBottom: 12 }} placeholder="Buscar usuário…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="config-tabela-scroll">
            <table className="config-tabela-notif">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Função</th>
                  <th>Status</th>
                  <th>Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((m) => (
                  <tr key={m.id}>
                    <td>{m.nome}</td>
                    <td>{m.email}</td>
                    <td>{m.papel}</td>
                    <td>{m.convitePendente ? "Pendente" : m.ativo ? "Ativo" : "Suspenso"}</td>
                    <td>{m.convitePendente ? "—" : "Hoje"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="config-bloco">
          <div className="config-lista-linhas">
            {FUNCOES_PADRAO.map((f) => (
              <div className="config-linha-clicavel" key={f.id} style={{ cursor: "default" }}>
                <div>
                  <p className="n">{f.nome}</p>
                  <p className="r">{f.permissoesPadrao.length} permissões · função padrão do sistema</p>
                </div>
              </div>
            ))}
            {estado.funcoesPersonalizadas.map((f) => (
              <div className="config-linha-clicavel" key={f.id} style={{ cursor: "default" }}>
                <span className="config-etiqueta-cor" style={{ background: f.cor }} />
                <div>
                  <p className="n">{f.nome}</p>
                  <p className="r">{f.descricao || "Função personalizada"}</p>
                </div>
                <button type="button" className="remove-chip" aria-label={`Remover ${f.nome}`} onClick={() => removerFuncao(f.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Drawer
        aberto={drawerAberto}
        onFechar={() => setDrawerAberto(false)}
        titulo="Adicionar usuário"
        subtitulo="Convite simulado — não envia e-mail real nesta fase."
        rodape={
          <>
            <button type="button" className="btn ghost" onClick={() => setDrawerAberto(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!nome.trim() || !emailNovo.trim()}
              onClick={() => {
                convidarMembro({
                  nome: `${nome.trim()} ${sobrenome.trim()}`.trim(),
                  email: emailNovo.trim(),
                  papel: funcaoEscolhida,
                  papelTipo: FUNCOES_PADRAO.some((f) => f.nome === funcaoEscolhida) ? "padrao" : "custom",
                  enxerga: "Definido pela função escolhida",
                  permissoes: permissoesNovoUsuario,
                });
                setDrawerAberto(false);
                setNome("");
                setSobrenome("");
                setEmailNovo("");
                setTelefone("");
              }}
            >
              Enviar convite
            </button>
          </>
        }
      >
        <div className="config-grid-2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Nome</label>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="field">
            <label>Sobrenome</label>
            <input className="input" value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input className="input" type="email" value={emailNovo} onChange={(e) => setEmailNovo(e.target.value)} />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div className="field">
            <label>Função</label>
            <select
              className="input"
              value={funcaoEscolhida}
              onChange={(e) => {
                setFuncaoEscolhida(e.target.value);
                const padrao = FUNCOES_PADRAO.find((f) => f.nome === e.target.value);
                setPermissoesNovoUsuario(padrao?.permissoesPadrao ?? []);
              }}
            >
              {FUNCOES_OPCOES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="config-bloco-titulo">Permissões</p>
        <MatrizPermissoes selecionadas={permissoesNovoUsuario} onChange={setPermissoesNovoUsuario} />
      </Drawer>

      <Modal
        aberto={novaFuncaoAberta}
        onFechar={() => setNovaFuncaoAberta(false)}
        titulo="Criar função personalizada"
        largura={560}
        rodape={
          <>
            <button type="button" className="btn ghost" onClick={() => setNovaFuncaoAberta(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!nomeFuncao.trim()}
              onClick={() => {
                adicionarFuncao({ nome: nomeFuncao, descricao: descFuncao, cor: corFuncao, baseadaEm });
                setNomeFuncao("");
                setDescFuncao("");
                setPermissoesFuncao([]);
                setNovaFuncaoAberta(false);
              }}
            >
              Criar função
            </button>
          </>
        }
      >
        <>
          <div className="config-grid-2" style={{ marginBottom: 12 }}>
                <div className="field">
                  <label>Nome da função</label>
                  <input className="input" value={nomeFuncao} onChange={(e) => setNomeFuncao(e.target.value)} />
                </div>
                <div className="field">
                  <label>Cor de identificação</label>
                  <input className="input" type="color" value={corFuncao} onChange={(e) => setCorFuncao(e.target.value)} />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Descrição</label>
                  <textarea className="input" style={{ width: "100%", minHeight: 60 }} value={descFuncao} onChange={(e) => setDescFuncao(e.target.value)} />
                </div>
                <div className="field">
                  <label>Copiar permissões de</label>
                  <select
                    className="input"
                    value={baseadaEm}
                    onChange={(e) => {
                      setBaseadaEm(e.target.value);
                      const padrao = FUNCOES_PADRAO.find((f) => f.nome === e.target.value);
                      setPermissoesFuncao(padrao?.permissoesPadrao ?? (e.target.value === "Todas" ? TODAS_PERMISSOES_IDS : []));
                    }}
                  >
                    {["Nenhuma", ...FUNCOES_PADRAO.map((f) => f.nome), "Todas"].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
          <p className="config-bloco-titulo">Permissões</p>
          <MatrizPermissoes selecionadas={permissoesFuncao} onChange={setPermissoesFuncao} />
          {nomeFuncao ? (
            <p className="hint mt8">
              Usuários com esta função poderão: {permissoesFuncao.length > 0 ? `${permissoesFuncao.length} ações liberadas` : "nada — nenhuma permissão marcada ainda"}.
            </p>
          ) : null}
        </>
      </Modal>
    </div>
  );
}
