"use client";

import { useEffect, useState } from "react";

import { Toggle } from "@/components/ui";
import {
  MARCA_DE_VERSAO,
  PERMISSOES_POR_MODULO,
  escopoPermitido,
  idDeEscopo,
  type EscopoDeModulo,
} from "@/lib/configuracoes/permissoes";
import { ESCOPOS } from "@/lib/configuracoes/permissoes";
import { canalDoNumero } from "@/lib/conversas/numeros-conectados";
import { useFunis } from "@/lib/funis-context";
import { useIdioma } from "@/lib/idioma-context";

/**
 * AS PERMISSÕES, MÓDULO POR MÓDULO, com o cabeçalho de cada um separando de verdade.
 *
 * "Lá em permissões, você vai separar por módulos (…) cada módulo você pode fazer tipo um azul
 * mais escuro para separar, para a gente saber."
 *
 * Era uma lista corrida: o nome do módulo saía como um texto cinza miúdo entre as linhas, do mesmo
 * tamanho das permissões, e onze módulos viravam cinquenta linhas iguais. Separar não é enfeite
 * aqui — é o que permite ler "o que ele pode no WhatsApp" sem contar linhas.
 *
 * E CADA MÓDULO PODE TER UM RECORTE: "de quais?". É o pedido inteiro — "às vezes eu quero que esse
 * funcionário veja apenas o funil dele; eu não quero que ele veja os outros funis, porque ele pode
 * cometer algum erro". A lista do recorte sai da conta (os números conectados, os funis criados),
 * então ela é buscada aqui e não mora numa constante.
 *
 * NADA MARCADO QUER DIZER TODOS. É o comportamento de hoje, e é o que uma lista de caixas vazias
 * promete. Marcar uma é que restringe.
 */

type NumeroConectado = { chave: string; nome: string; provedor: string; status: string };

export function PermissoesPorModulo({
  selecionadas,
  onChange,
}: {
  selecionadas: string[];
  onChange: (novas: string[]) => void;
}) {
  const { t: traduzir } = useIdioma();
  const { funis } = useFunis();
  const [numeros, setNumeros] = useState<NumeroConectado[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/integracoes/numeros")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: { numeros?: NumeroConectado[] } | null) => {
        // Sem os números a tela ainda funciona: o recorte do WhatsApp aparece vazio, dizendo que
        // não há número conectado, e todas as outras permissões continuam ali.
        if (vivo && dados?.numeros) setNumeros(dados.numeros.filter((n) => n.chave));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const marcadas = new Set(selecionadas);

  /**
   * Toda escrita carrega a MARCA DE VERSÃO junto.
   *
   * É ela que diz "estas permissões foram escolhidas com os módulos novos na tela". Sem ela, quem
   * foi convidado antes de Instagram, Equipe, Social Seller e AZUZ IA existirem continua com eles
   * abertos — e é o certo, porque ninguém nunca lhe negou isso. Ver `MARCA_DE_VERSAO`.
   */
  function salvar(novas: Set<string>) {
    novas.add(MARCA_DE_VERSAO);
    onChange([...novas]);
  }

  function alternar(id: string, ligado: boolean) {
    const novo = new Set(marcadas);
    if (ligado) novo.add(id);
    else novo.delete(id);
    salvar(novo);
  }

  /** Os itens de um recorte, do que a conta tem hoje. */
  function itensDoEscopo(escopo: EscopoDeModulo): { valor: string; rotulo: string; nota?: string }[] {
    if (escopo.prefixo === ESCOPOS.numerosDeWhatsApp.prefixo) {
      return numeros.map((n) => ({
        valor: n.chave,
        rotulo: n.nome,
        nota: `${traduzir(canalDoNumero(n.provedor))}${n.status === "conectado" ? "" : ` · ${traduzir("desconectado agora")}`}`,
      }));
    }
    if (escopo.prefixo === ESCOPOS.etapasDoFunil.prefixo) {
      /* A etapa é identificada pelo id, mas quem marca precisa ler o NOME DO FUNIL junto: numa
         conta com três quadros, "Proposta" aparece três vezes e marcar a errada é silencioso. */
      return funis.flatMap((f) =>
        (f.colunas ?? []).map((c) => ({ valor: c.id, rotulo: c.titulo, nota: f.nome })),
      );
    }
    return funis.map((f) => ({ valor: f.id, rotulo: f.nome }));
  }

  return (
    <div className="perm-modulos">
      <div className="perm-acoes">
        <button
          type="button"
          className="btn ghost"
          onClick={() => salvar(new Set(PERMISSOES_POR_MODULO.flatMap((m) => m.permissoes.map((p) => p.id))))}
        >
          {traduzir("Marcar tudo")}
        </button>
        <button type="button" className="btn ghost" onClick={() => salvar(new Set())}>
          {traduzir("Desmarcar tudo")}
        </button>
      </div>

      {PERMISSOES_POR_MODULO.map((modulo) => {
        const todasLigadas = modulo.permissoes.every((p) => marcadas.has(p.id));

        return (
          <section className="perm-modulo" key={modulo.modulo}>
            {/* A FAIXA ESCURA. É ela que separa um módulo do outro numa lista de onze. */}
            <header className="perm-modulo-h">
              <div>
                <strong>{traduzir(modulo.modulo)}</strong>
                <span>{traduzir(modulo.descricao)}</span>
              </div>
              <button
                type="button"
                className="perm-modulo-tudo"
                onClick={() => {
                  const novo = new Set(marcadas);
                  modulo.permissoes.forEach((p) => (todasLigadas ? novo.delete(p.id) : novo.add(p.id)));
                  salvar(novo);
                }}
              >
                {todasLigadas ? traduzir("Tirar tudo") : traduzir("Dar tudo")}
              </button>
            </header>

            <div className="perm-itens">
              {modulo.permissoes.map((permissao) => (
                <div className="toggle-row" key={permissao.id}>
                  <span className="tl">{traduzir(permissao.label)}</span>
                  <Toggle
                    key={`${permissao.id}-${marcadas.has(permissao.id)}`}
                    defaultOn={marcadas.has(permissao.id)}
                    label={traduzir(permissao.label)}
                    onToggle={(ligado) => alternar(permissao.id, ligado)}
                  />
                </div>
              ))}
            </div>

            {/* UM BLOCO POR RECORTE. O Funil tem dois — quais quadros e, dentro deles, quais
                colunas —, e eram perguntas diferentes disputando o mesmo campo. */}
            {(modulo.escopos ?? []).map((escopo) => {
              const itens = itensDoEscopo(escopo);
              const recorte = escopoPermitido(selecionadas, escopo);
              return (
                <div className="perm-escopo" key={escopo.prefixo}>
                  <p className="perm-escopo-t">{traduzir(escopo.titulo)}</p>
                  {itens.length === 0 ? (
                    <p className="hint">{traduzir(escopo.vazio)}</p>
                  ) : (
                    <>
                      {itens.map((item) => {
                        const id = idDeEscopo(escopo, item.valor);
                        return (
                          <label className="perm-escopo-item" key={id}>
                            <input
                              type="checkbox"
                              checked={marcadas.has(id)}
                              onChange={(e) => alternar(id, e.target.checked)}
                            />
                            <span>
                              {item.rotulo}
                              {item.nota ? <em>{item.nota}</em> : null}
                            </span>
                          </label>
                        );
                      })}
                      <p className="hint">
                        {recorte
                          ? traduzir("Só os marcados. O resto fica invisível pra essa pessoa.")
                          : traduzir("Nenhum marcado: ela enxerga todos.")}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
