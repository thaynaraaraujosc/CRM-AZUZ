"use client";

import { useEffect } from "react";

import { carregarIdentidadeDaEmpresa, useIdentidadeDaEmpresa } from "@/lib/empresa/identidade";

/**
 * A marca no topo do menu: o quadradinho da agência e o nome do produto ao lado.
 *
 * UM COMPONENTE SÓ, usado em dois lugares — o menu lateral e a prévia em Configurações › Dados da
 * empresa. É o que torna a prévia honesta: o que a pessoa vê ali é literalmente o que vai aparecer
 * no menu, no mesmo tamanho e sobre as mesmas cores. Uma caixa "parecida", desenhada à parte, é
 * como se chega numa prévia que corta a imagem e num menu que mostra outra coisa.
 *
 * O NOME DO PRODUTO NÃO SAI, com ou sem logo: a agência põe a marca dela no quadradinho, não no
 * lugar do nome do sistema.
 */
export function MarcaDoTopo({ mostrarNome = true }: { mostrarNome?: boolean }) {
  const { logo, carregado } = useIdentidadeDaEmpresa();

  useEffect(() => {
    // Uma leitura por sessão de navegador: o estado é compartilhado, então o segundo componente a
    // montar encontra `carregado` e não pede de novo.
    if (!carregado) void carregarIdentidadeDaEmpresa();
  }, [carregado]);

  return (
    <>
      <div className={`brand-mark${logo ? " com-logo" : ""}`}>
        {logo ? (
          // Sem `next/image` de propósito: a imagem é um data URL já do tamanho final, e o
          // otimizador não tem o que otimizar — só adicionaria uma volta pelo servidor.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" aria-hidden="true" />
        ) : (
          "a"
        )}
      </div>
      {mostrarNome ? <span className="wordmark">azuz crm</span> : null}
    </>
  );
}
