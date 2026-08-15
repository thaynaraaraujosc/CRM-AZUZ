"use client";

import { useEffect, useState } from "react";

import { useConfiguracoes, type WorkspaceConfig } from "@/lib/configuracoes-context";
import { FUSOS_HORARIOS, IDIOMAS, MOEDAS, PAISES, SEGMENTOS_NEGOCIO } from "@/lib/configuracoes/mock";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { SalvarBar } from "./SalvarBar";

type NomeSegmento = { nome: string; segmento: string };
const NOME_SEGMENTO_PADRAO: NomeSegmento = { nome: "", segmento: "" };

/** Workspace — dados gerais + modelo por segmento. Nome/segmento são coluna real de `Workspace`
 * (`GET/PATCH /api/workspace`, fonte única de verdade — lidos também na sessão/sidebar/e-mails/
 * relatórios); o resto dos campos (país/cidade/fuso/idioma/moeda/formatos) fica no blob de
 * preferências, que não tem outro consumidor. Nasce em branco, preenchido pela própria empresa
 * depois do cadastro (nome do workspace já vem do nome digitado no cadastro — ver `salvo` abaixo). */
export function WorkspaceSecao() {
  const { estado, atualizarWorkspace, setCategoriaSuja } = useConfiguracoes();
  const [salvoReal, setSalvoReal] = useState<NomeSegmento>(NOME_SEGMENTO_PADRAO);
  const [rascunho, setRascunho] = useState<WorkspaceConfig>(estado.workspace);
  const [rascunhoReal, setRascunhoReal] = useState<NomeSegmento>(NOME_SEGMENTO_PADRAO);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => r.json())
      .then((dados: NomeSegmento) => {
        setSalvoReal(dados);
        setRascunhoReal(dados);
        setCarregado(true);
      })
      .catch((erro) => console.error("Falha ao carregar dados do workspace:", erro));
  }, []);

  // O blob de preferências já resolve sozinho quando `estado.workspace` chega depois da hidratação
  // assíncrona do provider (mesma renderização, sem efeito) — só ainda não tinha acontecido pra
  // nome/segmento porque agora eles vêm de uma fonte separada (acima).
  const [estadoBlobAnterior, setEstadoBlobAnterior] = useState(estado.workspace);
  if (estado.workspace !== estadoBlobAnterior) {
    setEstadoBlobAnterior(estado.workspace);
    setRascunho(estado.workspace);
  }

  const dirty =
    JSON.stringify(rascunho) !== JSON.stringify(estado.workspace) ||
    JSON.stringify(rascunhoReal) !== JSON.stringify(salvoReal);

  useEffect(() => {
    setCategoriaSuja(dirty);
    return () => setCategoriaSuja(false);
  }, [dirty, setCategoriaSuja]);

  function set(patch: Partial<WorkspaceConfig>) {
    setRascunho((prev) => ({ ...prev, ...patch }));
  }

  function setReal(patch: Partial<NomeSegmento>) {
    setRascunhoReal((prev) => ({ ...prev, ...patch }));
  }

  function salvar() {
    if (JSON.stringify(rascunhoReal) !== JSON.stringify(salvoReal)) {
      fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rascunhoReal),
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          setSalvoReal(rascunhoReal);
        })
        .catch((erro) => console.error("Falha ao atualizar nome/segmento do workspace:", erro));
    }
    atualizarWorkspace(rascunho);
  }

  function descartar() {
    setRascunho(estado.workspace);
    setRascunhoReal(salvoReal);
  }

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Workspace" descricao="Gerencie as informações gerais e preferências deste ambiente de trabalho." />

      <div className="config-bloco">
        <div className="config-grid-2">
          <div className="field">
            <label>Nome do workspace</label>
            <input
              className="input"
              placeholder={carregado ? "Ex.: Nome do seu negócio" : "Carregando…"}
              value={rascunhoReal.nome}
              onChange={(e) => setReal({ nome: e.target.value })}
              disabled={!carregado}
            />
          </div>
          <div className="field">
            <label>Nome da empresa</label>
            <input className="input" placeholder="Razão social ou nome fantasia" value={rascunho.nomeEmpresa} onChange={(e) => set({ nomeEmpresa: e.target.value })} />
          </div>
          <div className="field">
            <label>Segmento</label>
            <select className="input" value={rascunhoReal.segmento} onChange={(e) => setReal({ segmento: e.target.value })} disabled={!carregado}>
              <option value="">Selecione…</option>
              {SEGMENTOS_NEGOCIO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>País</label>
            <select className="input" value={rascunho.pais} onChange={(e) => set({ pais: e.target.value })}>
              {PAISES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Estado</label>
            <input className="input" value={rascunho.estado} onChange={(e) => set({ estado: e.target.value })} />
          </div>
          <div className="field">
            <label>Cidade</label>
            <input className="input" value={rascunho.cidade} onChange={(e) => set({ cidade: e.target.value })} />
          </div>
          <div className="field">
            <label>Fuso horário</label>
            <select className="input" value={rascunho.fusoHorario} onChange={(e) => set({ fusoHorario: e.target.value })}>
              {FUSOS_HORARIOS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Idioma</label>
            <select className="input" value={rascunho.idioma} onChange={(e) => set({ idioma: e.target.value })}>
              {IDIOMAS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Moeda</label>
            <select className="input" value={rascunho.moeda} onChange={(e) => set({ moeda: e.target.value })}>
              {MOEDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Formato de data</label>
            <select className="input" value={rascunho.formatoData} onChange={(e) => set({ formatoData: e.target.value })}>
              <option value="DD/MM/AAAA">DD/MM/AAAA</option>
              <option value="MM/DD/AAAA">MM/DD/AAAA</option>
              <option value="AAAA-MM-DD">AAAA-MM-DD</option>
            </select>
          </div>
          <div className="field">
            <label>Formato de hora</label>
            <select className="input" value={rascunho.formatoHora} onChange={(e) => set({ formatoHora: e.target.value })}>
              <option value="24 horas">24 horas</option>
              <option value="12 horas (AM/PM)">12 horas (AM/PM)</option>
            </select>
          </div>
          <div className="field">
            <label>Semana começa em</label>
            <select className="input" value={rascunho.semanaComecaEm} onChange={(e) => set({ semanaComecaEm: e.target.value as "domingo" | "segunda" })}>
              <option value="domingo">Domingo</option>
              <option value="segunda">Segunda-feira</option>
            </select>
          </div>
        </div>
      </div>

      <SalvarBar dirty={dirty} onSalvar={salvar} onDescartar={descartar} mensagemSalvo="Configurações do workspace atualizadas." />
    </div>
  );
}
