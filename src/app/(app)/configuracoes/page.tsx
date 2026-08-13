"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Topbar } from "@/components/ui";
import { useConfiguracoes } from "@/lib/configuracoes-context";
import { categoriaPorId, type CategoriaId } from "@/lib/configuracoes/estrutura";
import { CategoriasNav } from "@/components/configuracoes/CategoriasNav";
import { WorkspaceSecao } from "@/components/configuracoes/WorkspaceSecao";
import { AparenciaSecao } from "@/components/configuracoes/AparenciaSecao";
import { NotificacoesSecao } from "@/components/configuracoes/NotificacoesSecao";
import { UsuariosSecao } from "@/components/configuracoes/UsuariosSecao";
import { EquipesSecao } from "@/components/configuracoes/EquipesSecao";
import { SegurancaSecao } from "@/components/configuracoes/SegurancaSecao";
import { AuditoriaSecao } from "@/components/configuracoes/AuditoriaSecao";
import { FunisSecao } from "@/components/configuracoes/FunisSecao";
import { CamposSecao } from "@/components/configuracoes/CamposSecao";
import { EtiquetasSecao } from "@/components/configuracoes/EtiquetasSecao";
import { AutomacoesPrefsSecao } from "@/components/configuracoes/AutomacoesPrefsSecao";
import { CanaisSecao } from "@/components/configuracoes/CanaisSecao";
import { WhatsAppSecao } from "@/components/configuracoes/WhatsAppSecao";
import { InstagramSecao } from "@/components/configuracoes/InstagramSecao";
import { EmailSecao } from "@/components/configuracoes/EmailSecao";
import { AgendaSecao } from "@/components/configuracoes/AgendaSecao";
import { AzuzIaSecao } from "@/components/configuracoes/AzuzIaSecao";
import { IntegracoesSecao } from "@/components/configuracoes/IntegracoesSecao";
import { ImportacaoSecao } from "@/components/configuracoes/ImportacaoSecao";
import { PlanoSecao } from "@/components/configuracoes/PlanoSecao";

/**
 * Painel administrativo de Configurações (item 18) — layout de 2 colunas (categorias agrupadas à
 * esquerda + detalhe à direita). As "subcategorias" do pedido (item 18: "coluna central quando
 * necessário") viram abas dentro do próprio painel de detalhe em vez de uma 3ª coluna sempre visível:
 * a maioria das categorias tem 0 subseções, e as que têm (WhatsApp, E-mail, Azuz IA, Usuários) usam
 * no máximo 5 abas — uma coluna extra ficaria vazia na maior parte do tempo. Navegação inteira sem
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
  const categoriaInicial = (searchParams.get("categoria") as CategoriaId | null) ?? "workspace";
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaId>(categoriaInicial);
  const { categoriaSuja } = useConfiguracoes();
  const categoria = categoriaPorId(categoriaAtiva);

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
            {categoriaAtiva === "workspace" ? <WorkspaceSecao /> : null}
            {categoriaAtiva === "aparencia" ? <AparenciaSecao /> : null}
            {categoriaAtiva === "notificacoes" ? <NotificacoesSecao /> : null}
            {categoriaAtiva === "usuarios" ? <UsuariosSecao /> : null}
            {categoriaAtiva === "equipes" ? <EquipesSecao /> : null}
            {categoriaAtiva === "seguranca" ? <SegurancaSecao /> : null}
            {categoriaAtiva === "auditoria" ? <AuditoriaSecao /> : null}
            {categoriaAtiva === "funis" ? <FunisSecao /> : null}
            {categoriaAtiva === "campos" ? <CamposSecao /> : null}
            {categoriaAtiva === "etiquetas" ? <EtiquetasSecao /> : null}
            {categoriaAtiva === "automacoes" ? <AutomacoesPrefsSecao /> : null}
            {categoriaAtiva === "canais" ? <CanaisSecao /> : null}
            {categoriaAtiva === "whatsapp" ? <WhatsAppSecao /> : null}
            {categoriaAtiva === "instagram" ? <InstagramSecao /> : null}
            {categoriaAtiva === "email" ? <EmailSecao /> : null}
            {categoriaAtiva === "agenda" ? <AgendaSecao /> : null}
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
