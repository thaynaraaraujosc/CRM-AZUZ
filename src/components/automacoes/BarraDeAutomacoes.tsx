"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { useFunis } from "@/lib/funis-context";
import { useIdioma } from "@/lib/idioma-context";

/**
 * A BARRA DE CIMA DE AUTOMAÇÕES: tudo que não é a grade.
 *
 * A tela tinha quatro faixas empilhadas antes de qualquer conteúdo — cabeçalho do CRM, faixa com
 * a palavra "Automações", as abas e a linha "qual funil você quer automatizar" — mais um painel
 * lateral de fontes de lead. Juntas comiam metade da altura e um quarto da largura, e sobrava uma
 * janelinha pra grade, que é a única coisa que alguém veio fazer aqui.
 *
 * Agora é UMA faixa: abas à esquerda, funil e fontes à direita. O resto da tela é a grade.
 *
 * Mora no layout do módulo, e não em cada página: antes cada uma renderizava as abas por conta
 * própria, e qualquer página nova nascia sem elas até alguém lembrar.
 */
function BarraConteudo() {
  const pathname = usePathname() ?? "";
  // O editor de fluxo é tela cheia: ele tem a barra de ferramentas dele e não cabe mais nada.
  if (pathname.startsWith("/automacoes/editor")) return null;

  return (
    <div className="autom-barra">
      <AbasAutomacoes />
      {/* O seletor de funil e as fontes só dizem respeito à grade do funil. */}
      {pathname === "/automacoes" ? (
        <div className="autom-barra-dir">
          <SeletorDeFunil />
          <FontesDeLead />
        </div>
      ) : null}
    </div>
  );
}

export function BarraDeAutomacoes() {
  // `useSearchParams` exige limite de Suspense, senão o build torna estática a árvore inteira.
  return (
    <Suspense fallback={null}>
      <BarraConteudo />
    </Suspense>
  );
}

/**
 * Qual funil a grade está mostrando.
 *
 * A escolha vai pra URL (`?funil=`), não pra um estado desta barra: a barra e a grade são
 * componentes irmãos, e o endereço é o único lugar que os dois já leem. De quebra, o link de uma
 * tela aberta num funil específico passa a abrir nele pra quem receber.
 */
function SeletorDeFunil() {
  const { t: traduzir } = useIdioma();
  const { funis } = useFunis();
  const router = useRouter();
  const params = useSearchParams();
  const escolhido = params.get("funil") ?? funis[0]?.id ?? "";

  if (funis.length === 0) return null;

  return (
    <label className="autom-funil">
      <span>{traduzir("Funil")}</span>
      <select
        className="autom-funil-sel"
        value={escolhido}
        aria-label={traduzir("Qual funil você quer automatizar")}
        onChange={(e) => router.replace(`/automacoes?funil=${encodeURIComponent(e.target.value)}`, { scroll: false })}
      >
        {funis.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

type CanalConectado = { canal: string; label: string; detalhe?: string | null; conectado: boolean };

/** As mesmas duas conexões de WhatsApp que a grade atende. Ver `AutomacaoDoFunil`. */
const FONTES_DO_FUNIL = new Set(["whatsapp_oficial", "whatsapp_nao_oficial"]);

/**
 * De onde chega o lead que esta grade automatiza.
 *
 * Era uma coluna de 260px ao lado da grade, com título, dois cartões e um link — espaço de
 * conteúdo gasto com uma informação que se lê uma vez por mês e nunca se edita aqui. Virou chip:
 * o nome da conexão, e o detalhe (o número, por exemplo) no título ao passar o mouse.
 */
function FontesDeLead() {
  const { t: traduzir } = useIdioma();
  const [canais, setCanais] = useState<CanalConectado[] | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/canais")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: CanalConectado[]) => {
        if (!vivo) return;
        setCanais(
          Array.isArray(lista) ? lista.filter((c) => c.conectado && FONTES_DO_FUNIL.has(c.canal)) : [],
        );
      })
      .catch(() => {
        if (vivo) setCanais([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (canais === null) return null;

  return (
    <div className="autom-fontes">
      <span className="autom-fontes-rotulo">{traduzir("Fontes")}</span>
      {canais.map((c) => (
        <span key={c.canal} className="autom-fonte-chip" title={c.detalhe || traduzir("Conectado")}>
          {traduzir(c.label)}
        </span>
      ))}
      {canais.length === 0 ? (
        <span className="autom-fonte-chip autom-fonte-vazia">{traduzir("Nenhuma conectada")}</span>
      ) : null}
      <Link href="/configuracoes?categoria=integracoes" className="autom-fonte-mais">
        + {traduzir("Fonte")}
      </Link>
    </div>
  );
}
