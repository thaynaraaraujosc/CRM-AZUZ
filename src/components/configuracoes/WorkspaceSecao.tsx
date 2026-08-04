"use client";

import { useEffect, useRef, useState } from "react";

import { IconCamera } from "@/components/icons";
import { useConfiguracoes, WORKSPACE_CONFIG_PADRAO, type WorkspaceConfig } from "@/lib/configuracoes-context";
import { FUSOS_HORARIOS, IDIOMAS, MOEDAS, PAISES, SEGMENTOS_NEGOCIO } from "@/lib/configuracoes/mock";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { ModelosSegmento } from "./ModelosSegmento";
import { SalvarBar } from "./SalvarBar";

/** Workspace (item 19-20) — dados gerais + identidade visual + modelo por segmento. O logotipo é só
 * um arquivo temporário no navegador (`URL.createObjectURL`), nunca enviado a servidor. */
export function WorkspaceSecao() {
  const { estado, atualizarWorkspace, setCategoriaSuja } = useConfiguracoes();
  const [rascunho, setRascunho] = useState<WorkspaceConfig>(estado.workspace);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(rascunho) !== JSON.stringify(estado.workspace);

  useEffect(() => {
    setCategoriaSuja(dirty);
    return () => setCategoriaSuja(false);
  }, [dirty, setCategoriaSuja]);

  function set(patch: Partial<WorkspaceConfig>) {
    setRascunho((prev) => ({ ...prev, ...patch }));
  }

  function salvar() {
    atualizarWorkspace(rascunho);
  }

  function descartar() {
    setRascunho(estado.workspace);
  }

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Workspace" descricao="Gerencie as informações gerais e preferências deste ambiente de trabalho." />

      <div className="config-bloco">
        <div className="config-grid-2">
          <div className="field">
            <label>Nome do workspace</label>
            <input className="input" value={rascunho.nome} onChange={(e) => set({ nome: e.target.value })} />
          </div>
          <div className="field">
            <label>Nome da empresa</label>
            <input className="input" value={rascunho.nomeEmpresa} onChange={(e) => set({ nomeEmpresa: e.target.value })} />
          </div>
          <div className="field">
            <label>Segmento</label>
            <select className="input" value={rascunho.segmento} onChange={(e) => set({ segmento: e.target.value })}>
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

      <div className="config-bloco">
        <p className="config-bloco-titulo">Logotipo</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="avatar" style={{ width: 56, height: 56, borderRadius: 12, fontSize: 15, overflow: "hidden" }}>
            {rascunho.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rascunho.logoUrl} alt="Logotipo atual" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              rascunho.nomeCurto.slice(0, 2).toUpperCase()
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn ghost" onClick={() => fileInputRef.current?.click()}>
              <IconCamera width={14} height={14} /> Selecionar novo arquivo
            </button>
            <button type="button" className="btn ghost" disabled={!rascunho.logoUrl} onClick={() => set({ logoUrl: null })}>
              Remover
            </button>
            <button type="button" className="btn ghost" onClick={() => set({ logoUrl: WORKSPACE_CONFIG_PADRAO.logoUrl })}>
              Restaurar padrão
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) set({ logoUrl: URL.createObjectURL(file) });
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Identidade do workspace</p>
        <p className="hint mb14">Preview local nesta fase — ainda não aplica de fato no restante do CRM.</p>
        <div className="config-grid-2">
          <div className="field">
            <label>Nome curto</label>
            <input className="input" value={rascunho.nomeCurto} onChange={(e) => set({ nomeCurto: e.target.value })} />
          </div>
          <div className="field">
            <label>Cor principal</label>
            <input className="input" type="color" value={rascunho.corPrincipal} onChange={(e) => set({ corPrincipal: e.target.value })} />
          </div>
          <div className="field">
            <label>Cor secundária</label>
            <input className="input" type="color" value={rascunho.corSecundaria} onChange={(e) => set({ corSecundaria: e.target.value })} />
          </div>
          <div className="field">
            <label>Cor de destaque</label>
            <input className="input" type="color" value={rascunho.corDestaque} onChange={(e) => set({ corDestaque: e.target.value })} />
          </div>
        </div>
        <div className="config-identidade-preview" style={{ background: rascunho.corSecundaria }}>
          <span style={{ background: rascunho.corPrincipal }} className="config-identidade-chip">
            {rascunho.nomeCurto}
          </span>
          <span style={{ color: rascunho.corDestaque }} className="config-identidade-destaque">
            Prévia da identidade
          </span>
        </div>
      </div>

      <ModelosSegmento />

      <SalvarBar dirty={dirty} onSalvar={salvar} onDescartar={descartar} mensagemSalvo="Configurações do workspace atualizadas." />
    </div>
  );
}
