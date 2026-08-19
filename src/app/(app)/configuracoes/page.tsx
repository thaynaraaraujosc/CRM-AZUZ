"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Topbar } from "@/components/ui";
import { useConfiguracoes } from "@/lib/configuracoes-context";
import { categoriaPorId, type CategoriaId } from "@/lib/configuracoes/estrutura";
import { CategoriasNav } from "@/components/configuracoes/CategoriasNav";
import { AparenciaSecao } from "@/components/configuracoes/AparenciaSecao";
import { NotificacoesSecao } from "@/components/configuracoes/NotificacoesSecao";
import { SegurancaSecao } from "@/components/configuracoes/SegurancaSecao";
import { AuditoriaSecao } from "@/components/configuracoes/AuditoriaSecao";
import { EtiquetasSecao } from "@/components/configuracoes/EtiquetasSecao";
import { CanaisSecao } from "@/components/configuracoes/CanaisSecao";
import { WhatsAppSecao } from "@/components/configuracoes/WhatsAppSecao";
import { InstagramSecao } from "@/components/configuracoes/InstagramSecao";
import { EmailSecao } from "@/components/configuracoes/EmailSecao";
import { AzuzIaSecao } from "@/components/configuracoes/AzuzIaSecao";
import { IntegracoesSecao } from "@/components/configuracoes/IntegracoesSecao";
import { ImportacaoSecao } from "@/components/configuracoes/ImportacaoSecao";
import { PlanoSecao } from "@/components/configuracoes/PlanoSecao";

/**
 * Painel administrativo de Configurações (item 18) — layout de 2 colunas (categorias agrupadas à
 * esquerda + detalhe à direita). As "subcategorias" do pedido (item 18: "coluna central quando
 * necessário") viram abas dentro do próprio painel de detalhe em vez de uma 3ª coluna sempre visível:
 * a maioria das categorias tem 0 subseções, e as que têm (WhatsApp, E-mail, Azuz IA) usam no
 * máximo 5 abas — uma coluna extra ficaria vazia na maior parte do tempo. Navegação inteira sem
 * recarregar a página (troca de estado local, mesma rota).
 */
export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={null}>
      <ConfiguracoesConteudo />
    </Suspense>
  );
}

function ConfiguracoesConteudo() {
  const searchParams = useSearchParams();
  // `?categoria=plano` — usado pelo redirect pós-cadastro (proxy manda direto pra tela de
  // pagamento, ver `src/app/cadastro/page.tsx`) pra não obrigar a pessoa a achar "Plano e
  // cobrança" sozinha na primeira vez que entra, já bloqueada até pagar.
  const categoriaInicial = (searchParams.get("categoria") as CategoriaId | null) ?? "aparencia";
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaId>(categoriaInicial);
  const { categoriaSuja } = useConfiguracoes();
  const categoria = categoriaPorId(categoriaAtiva);

  // Links tipo `<Link href="/configuracoes?categoria=whatsapp">` (cards de "Conectar" na tela de
  // Integrações) navegam pra essa mesma rota com um parâmetro novo — como o componente já está
  // montado, `categoriaInicial` acima não recalcula sozinho (só roda no mount). Sem isso, clicar
  // num desses links dava a impressão de botão quebrado: a URL mudava, a tela não.
  const paramCategoria = searchParams.get("categoria");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com navegação por URL (Link), não é reset de prop derivado
    if (paramCategoria) setCategoriaAtiva(paramCategoria as CategoriaId);
  }, [paramCategoria]);

  function selecionarCategoria(id: CategoriaId) {
    if (id === categoriaAtiva) return;
    if (categoriaSuja && !window.confirm("Você tem alterações não salvas nesta categoria. Deseja descartar e continuar?")) {
      return;
    }
    setCategoriaAtiva(id);
  }

  return (
    <>
      <Topbar title="Configurações" sub="Painel administrativo do workspace — escolha uma categoria ao lado" />

      <div className="content">
        <div className="config-layout">
          <CategoriasNav ativa={categoriaAtiva} onSelecionar={selecionarCategoria} />

          <div className="config-detalhe">
            {categoriaAtiva === "aparencia" ? <AparenciaSecao /> : null}
            {categoriaAtiva === "notificacoes" ? <NotificacoesSecao /> : null}
            {categoriaAtiva === "seguranca" ? <SegurancaSecao /> : null}
            {categoriaAtiva === "auditoria" ? <AuditoriaSecao /> : null}
            {categoriaAtiva === "etiquetas" ? <EtiquetasSecao /> : null}
            {categoriaAtiva === "canais" ? <CanaisSecao /> : null}
            {categoriaAtiva === "whatsapp" ? <WhatsAppSecao /> : null}
            {categoriaAtiva === "instagram" ? <InstagramSecao /> : null}
            {categoriaAtiva === "email" ? <EmailSecao /> : null}
            {categoriaAtiva === "azuz-ia" ? <AzuzIaSecao /> : null}
            {categoriaAtiva === "integracoes" ? <IntegracoesSecao /> : null}
            {categoriaAtiva === "importacao" ? <ImportacaoSecao /> : null}
            {categoriaAtiva === "plano" ? <PlanoSecao /> : null}

            {!categoria ? <p className="hint">Categoria não encontrada.</p> : null}
          </div>
        </div>
      </div>
    </>
  );
}
