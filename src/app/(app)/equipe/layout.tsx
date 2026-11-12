import type { Metadata } from "next";

import { CascaDeConfiguracoes } from "@/components/configuracoes/CascaDeConfiguracoes";

export const metadata: Metadata = { title: "Equipe · CRM AZUZ" };

/* Equipe passou a morar dentro de Configurações ("faz mais sentido"): quem convida alguém, define
   papel e mexe em permissão está configurando a conta. A tela continua sendo uma só — o que muda é
   que o menu de Configurações aparece ao lado dela. */
export default function EquipeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <CascaDeConfiguracoes ativa="equipe">{children}</CascaDeConfiguracoes>;
}
