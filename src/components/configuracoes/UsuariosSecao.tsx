"use client";

import { useState } from "react";

import { Modal } from "@/components/ui";
import { useConfiguracoes } from "@/lib/configuracoes-context";
import { FUNCOES_PADRAO, TODAS_PERMISSOES_IDS } from "@/lib/configuracoes/permissoes";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { MatrizPermissoes } from "./MatrizPermissoes";

/** Funções personalizadas de permissão — a lista de usuários/convite (que já morou aqui) virou
 * duplicidade de navegação depois que /equipe e /equipe/convidar passaram a cobrir exatamente a
 * mesma coisa (mesma tabela real, mesmo convite por e-mail via `convidarMembro`); removida daqui
 * (não do banco/context — `useEquipe`/`convidarMembro` continuam intactos, só o segundo caminho de
 * navegação que sumiu). O que só existe aqui — criar função personalizada com cor/descrição/
 * permissões — continua. */
export function UsuariosSecao() {
  const { estado, adicionarFuncao, removerFuncao } = useConfiguracoes();

  const [novaFuncaoAberta, setNovaFuncaoAberta] = useState(false);
  const [nomeFuncao, setNomeFuncao] = useState("");
  const [descFuncao, setDescFuncao] = useState("");
  const [corFuncao, setCorFuncao] = useState("#2e6bff");
  const [permissoesFuncao, setPermissoesFuncao] = useState<string[]>([]);
  const [baseadaEm, setBaseadaEm] = useState("Nenhuma");

  return (
    <div className="config-secao">
      <CabecalhoCategoria
        titulo="Funções e permissões"
        descricao="Papéis personalizados que podem ser atribuídos a qualquer pessoa da equipe (gerenciar quem tem cada papel fica em Equipe, no menu principal)."
        acoes={
          <button type="button" className="btn primary" onClick={() => setNovaFuncaoAberta(true)}>
            + Criar função
          </button>
        }
      />

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
