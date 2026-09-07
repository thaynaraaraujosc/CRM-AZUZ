import { redirect } from "next/navigation";

/** "Ações" virou "Disparo em massa" dentro de Automações. O endereço antigo continua valendo pra
 * quem tem ele salvo. */
export default function AcoesPage() {
  redirect("/automacoes/disparos");
}
