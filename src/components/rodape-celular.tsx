"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import { useState } from "react";

import { navEntries } from "@/components/sidebar";
import { IconClose, IconGrade } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { useIdentidadeDaEmpresa } from "@/lib/empresa/identidade";
import { useFunis } from "@/lib/funis-context";
import { useIdioma } from "@/lib/idioma-context";
import { useTelaEstreita } from "@/lib/tela-estreita";

/**
 * OS QUATRO DO RODAPÉ.
 *
 * "Você vai fazer um rodapé com quatro aplicativos que a gente mais usa: WhatsApp, Instagram,
 * automação e social seller. E aí no cantinho você coloca menu." E, vendo funcionando: "no lugar
 * do Instagram aqui embaixo, deixa o funil. Acho que a gente vai usar mais o funil."
 *
 * A escolha é dela e é de uso, não de arquitetura: são os quatro módulos onde o dia inteiro
 * acontece. O Instagram não sumiu — ele, os contatos, os relatórios e o resto moram atrás do
 * "Mais", que abre o menu completo.
 *
 * É uma lista de endereços, e não de itens copiados: o rótulo e o ícone vêm do `navEntries`, o
 * mesmo que desenha o menu do computador. Renomear "WhatsApp" lá renomeia aqui, e um endereço que
 * deixe de existir quebra o build em vez de virar um botão morto no rodapé.
 */
const ATALHOS = ["/conversas", "/funil", "/automacoes", "/social-seller"] as const;

/**
 * O RODAPÉ DO CELULAR, e por que ele existe.
 *
 * "Essa parte de cima está completamente disfuncional. Você pode colocar aquele menu lateral no
 * rodapé, igual o do Flow."
 *
 * A tentativa anterior foi deitar o menu vertical numa faixa horizontal no alto. Funcionava de
 * layout e não de uso: onze ícones de 20px lado a lado, sem rótulo, numa fila que rola — ninguém
 * acha nada ali, e o polegar não alcança o topo de um telefone de 6 polegadas.
 *
 * O rodapé resolve as duas coisas: quatro alvos grandes, com nome embaixo, na parte da tela onde
 * o polegar já está. O resto não sumiu — está no "Mais", que abre a folha com o menu inteiro.
 *
 * Em tela de computador este componente não existe (devolve `null`): lá o menu lateral continua
 * sendo o certo, porque lá há largura de sobra e ponteiro.
 */
export function RodapeCelular() {
  const { t: traduzir } = useIdioma();
  const pathname = usePathname();
  const estreita = useTelaEstreita();
  const [menuAberto, setMenuAberto] = useState(false);
  const { data: sessao } = useSession();
  const { nome: nomeEmpresa } = useIdentidadeDaEmpresa();
  const { funis, funilAtivoId, setFunilAtivoId } = useFunis();

  const atalhos = ATALHOS.map((href) => navEntries.find((e) => e.href === href)).filter(
    (e): e is (typeof navEntries)[number] => Boolean(e),
  );

  const nome = sessao?.user?.name ?? "";
  const email = sessao?.user?.email ?? "";
  const iniciais =
    nome
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?";

  if (!estreita) return null;

  /* O item ativo é o do caminho atual. `startsWith` e não igualdade porque os módulos têm
     sub-rotas (`/social-seller/painel`, `/automacoes/novo`): dentro delas o rodapé tem que
     continuar dizendo onde a pessoa está. */
  const ativo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav className="rodape-celular" aria-label={traduzir("Atalhos")}>
        {atalhos.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className={`rodape-item${ativo(e.href) ? " on" : ""}`}
            aria-current={ativo(e.href) ? "page" : undefined}
          >
            <span className="rodape-icone">
              <e.Icon width={20} height={20} />
            </span>
            <span className="rodape-rotulo">{traduzir(e.label)}</span>
          </Link>
        ))}

        <button
          type="button"
          className={`rodape-item${menuAberto ? " on" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto(true)}
        >
          <span className="rodape-icone">
            <IconGrade width={20} height={20} />
          </span>
          <span className="rodape-rotulo">{traduzir("Mais")}</span>
        </button>
      </nav>

      {menuAberto && typeof document !== "undefined"
        ? createPortal(
            <div className="folha-fundo" onClick={() => setMenuAberto(false)}>
              <div
                className="folha"
                role="dialog"
                aria-label={traduzir("Menu")}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="folha-pegador" aria-hidden="true" />

                <div className="folha-topo">
                  <div>
                    <p className="folha-titulo">{traduzir("Menu")}</p>
                    <p className="folha-sub">{nomeEmpresa}</p>
                  </div>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label={traduzir("Fechar")}
                    onClick={() => setMenuAberto(false)}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>

                <div className="folha-lista">
                  {navEntries.map((e) => (
                    <div key={e.href}>
                      <Link
                        href={e.href}
                        className={`folha-item${ativo(e.href) ? " on" : ""}`}
                        aria-current={ativo(e.href) ? "page" : undefined}
                        /* Fecha no clique, e não num efeito que observa a rota: efeito que grava
                           estado é o que o lint do projeto proíbe, e aqui seria pior que proibido —
                           tocar no item que já está aberto não muda a rota, e a folha ficaria
                           aberta por cima da tela que a pessoa acabou de pedir. */
                        onClick={() => setMenuAberto(false)}
                      >
                        <span className="folha-item-icone">
                          <e.Icon width={18} height={18} />
                        </span>
                        {traduzir(e.label)}
                      </Link>

                      {/*
                        OS FUNIS ENTRAM AQUI, e não por capricho de simetria com o computador.
                        Trocar de funil só existe no menu lateral — que no celular não existe
                        mais. Sem esta lista, quem abre o CRM no telefone fica preso no funil que
                        por acaso estava ativo, sem nenhum caminho até os outros.
                      */}
                      {e.href === "/funil" && funis.length > 1 ? (
                        <div className="folha-sublista">
                          {funis.map((f) => (
                            <button
                              type="button"
                              key={f.id}
                              className={`folha-subitem${f.id === funilAtivoId ? " on" : ""}`}
                              onClick={() => {
                                setFunilAtivoId(f.id);
                                setMenuAberto(false);
                              }}
                            >
                              {f.nome}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="folha-pe">
                  <div className="folha-usuario">
                    <span className="avatar sm">{iniciais}</span>
                    <div>
                      <p className="folha-usuario-nome">{nome}</p>
                      <p className="folha-usuario-sub">{email}</p>
                    </div>
                  </div>

                  <div className="folha-tema">
                    <span>{traduzir("Tema")}</span>
                    <ThemeToggle />
                  </div>

                  <button
                    type="button"
                    className="btn ghost block"
                    onClick={() => {
                      setMenuAberto(false);
                      signOut({ callbackUrl: "/login" });
                    }}
                  >
                    {traduzir("Sair")}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
