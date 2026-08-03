"use client";

import { useState } from "react";

import { Toggle } from "@/components/ui";
import { useConfiguracoes } from "@/lib/configuracoes-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

type Sessao = { id: string; dispositivo: string; local: string; ultimoAcesso: string; atual?: boolean };
const SESSOES_MOCK: Sessao[] = [
  { id: "s1", dispositivo: "Chrome · Windows", local: "Goiânia, GO", ultimoAcesso: "Agora", atual: true },
  { id: "s2", dispositivo: "App · iPhone 14", local: "Goiânia, GO", ultimoAcesso: "há 2h" },
  { id: "s3", dispositivo: "Chrome · Android", local: "Aparecida de Goiânia, GO", ultimoAcesso: "ontem" },
];

/** Segurança (item 37) — tudo simulado: nenhuma sessão real é encerrada, 2FA não liga em provedor
 * nenhum. */
export function SegurancaSecao() {
  const { estado, atualizarSeguranca } = useConfiguracoes();
  const [sessoes, setSessoes] = useState(SESSOES_MOCK);

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Segurança" descricao="Autenticação, sessões e políticas de acesso." />

      <div className="config-bloco">
        <div className="toggle-row" style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
          <span className="tl">Autenticação em duas etapas</span>
          <Toggle defaultOn={estado.seguranca.doisFatores} label="Autenticação em duas etapas" onToggle={(v) => atualizarSeguranca({ doisFatores: v })} />
        </div>
        <div className="toggle-row" style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
          <span className="tl">Exigir senha forte</span>
          <Toggle defaultOn={estado.seguranca.politicaSenhaForte} label="Exigir senha forte" onToggle={(v) => atualizarSeguranca({ politicaSenhaForte: v })} />
        </div>
        <div className="toggle-row" style={{ padding: "10px 0" }}>
          <span className="tl">Restringir por função</span>
          <Toggle defaultOn={estado.seguranca.restringirPorFuncao} label="Restringir por função" onToggle={(v) => atualizarSeguranca({ restringirPorFuncao: v })} />
        </div>
        <div className="config-grid-2 mt14">
          <div className="field">
            <label>Expirar sessão após (minutos)</label>
            <input className="input" type="number" value={estado.seguranca.expirarSessaoMin} onChange={(e) => atualizarSeguranca({ expirarSessaoMin: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Bloquear após tentativas incorretas</label>
            <input className="input" type="number" value={estado.seguranca.bloquearAposTentativas} onChange={(e) => atualizarSeguranca({ bloquearAposTentativas: Number(e.target.value) })} />
          </div>
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Sessões ativas</p>
        <div className="config-lista-linhas">
          {sessoes.map((s) => (
            <div className="config-linha-clicavel" key={s.id} style={{ cursor: "default" }}>
              <div>
                <p className="n">
                  {s.dispositivo} {s.atual ? <span className="pill on">Esta sessão</span> : null}
                </p>
                <p className="r">
                  {s.local} · último acesso {s.ultimoAcesso}
                </p>
              </div>
              {!s.atual ? (
                <button type="button" className="btn danger" onClick={() => setSessoes((prev) => prev.filter((x) => x.id !== s.id))}>
                  Encerrar sessão
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
