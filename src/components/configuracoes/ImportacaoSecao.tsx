"use client";

import { useRef, useState } from "react";

import { CabecalhoCategoria } from "./CabecalhoCategoria";

const MODULOS_IMPORTAR = ["Contatos", "Empresas", "Negócios", "Etiquetas", "Campos"];
const ETAPAS_IMPORTAR = ["Selecionar arquivo", "Mapear colunas", "Validar", "Visualizar problemas", "Confirmar simulação"];
const FORMATOS_EXPORTAR = ["CSV", "XLSX", "PDF"];

/** Importação e exportação (item 39) — assistente de 5 passos e opções de exportação, tudo
 * simulado (nenhum arquivo é de fato processado em servidor). */
export function ImportacaoSecao() {
  const [moduloImportar, setModuloImportar] = useState(MODULOS_IMPORTAR[0]);
  const [passo, setPasso] = useState(0);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [moduloExportar, setModuloExportar] = useState(MODULOS_IMPORTAR[0]);
  const [formatoExportar, setFormatoExportar] = useState(FORMATOS_EXPORTAR[0]);
  const [exportado, setExportado] = useState(false);

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Importação e exportação" descricao="Trazer ou tirar dados do CRM." />

      <div className="config-bloco">
        <p className="config-bloco-titulo">Importar</p>
        <div className="filters-row mb14">
          {MODULOS_IMPORTAR.map((m) => (
            <button type="button" key={m} className={`fchip${moduloImportar === m ? " active" : ""}`} onClick={() => setModuloImportar(m)}>
              {m}
            </button>
          ))}
        </div>

        <div className="config-passos">
          {ETAPAS_IMPORTAR.map((e, i) => (
            <div key={e} className={`config-passo${i === passo ? " is-atual" : i < passo ? " is-feito" : ""}`}>
              <span className="config-passo-num">{i < passo ? "✓" : i + 1}</span>
              {e}
            </div>
          ))}
        </div>

        <div className="config-bloco" style={{ background: "var(--navy-raised-2)" }}>
          {passo === 0 ? (
            <>
              <div
                className="flow-midia-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) setArquivo(file.name);
                }}
              >
                <p>Arraste um arquivo .csv ou .xlsx aqui</p>
                <p className="hint">ou</p>
                <button type="button" className="btn ghost">
                  Selecionar arquivo
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setArquivo(file.name);
                }}
              />
              {arquivo ? <p className="hint mt8">Arquivo selecionado: {arquivo}</p> : null}
            </>
          ) : passo === 1 ? (
            <p className="hint">Mapeamento simulado: colunas do arquivo já foram associadas a &quot;nome&quot;, &quot;e-mail&quot;, &quot;telefone&quot;.</p>
          ) : passo === 2 ? (
            <p className="hint">Validação simulada concluída — nenhum erro bloqueante encontrado.</p>
          ) : passo === 3 ? (
            <p className="hint">2 linhas com telefone em formato inválido serão ignoradas nesta simulação.</p>
          ) : (
            <p className="hint">Pronto pra confirmar a simulação de importação de {moduloImportar.toLowerCase()}.</p>
          )}
        </div>

        <div className="section-foot" style={{ padding: "14px 0 0" }}>
          <button type="button" className="btn ghost" disabled={passo === 0} onClick={() => setPasso((p) => Math.max(0, p - 1))}>
            Voltar
          </button>
          {passo < ETAPAS_IMPORTAR.length - 1 ? (
            <button type="button" className="btn primary" disabled={passo === 0 && !arquivo} onClick={() => setPasso((p) => Math.min(ETAPAS_IMPORTAR.length - 1, p + 1))}>
              Próximo
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={() => setPasso(0)}>
              Confirmar simulação
            </button>
          )}
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Exportar</p>
        <div className="config-grid-2">
          <div className="field">
            <label>Módulo</label>
            <select className="input" value={moduloExportar} onChange={(e) => setModuloExportar(e.target.value)}>
              {MODULOS_IMPORTAR.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Formato</label>
            <select className="input" value={formatoExportar} onChange={(e) => setFormatoExportar(e.target.value)}>
              {FORMATOS_EXPORTAR.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn primary" onClick={() => setExportado(true)}>
          Exportar {moduloExportar.toLowerCase()} ({formatoExportar})
        </button>
        {exportado ? <p className="hint mt8">✓ Exportação simulada gerada — nenhum arquivo real foi criado nesta fase.</p> : null}
      </div>
    </div>
  );
}
