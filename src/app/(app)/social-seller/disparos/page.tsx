import { redirect } from "next/navigation";

/**
 * O disparo do Instagram vive em Automações → Disparo em massa, junto com os outros canais.
 *
 * Esta tela existiu porque o Direct tem uma regra própria (a janela de 24 horas), mas ela já usava
 * a MESMA API que o Disparo em massa: `/api/campanhas` com `canal: "instagram"`. Eram duas telas
 * pro mesmo backend, e quem queria disparar tinha que saber por qual das duas entrar. A regra da
 * janela virou o passo de público do assistente, que é onde ela pertence.
 *
 * O endereço continua valendo pra quem tem ele salvo.
 */
export default function DisparosSociaisPage() {
  redirect("/automacoes/disparos");
}
