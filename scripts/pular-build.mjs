/**
 * Decide se a Vercel deve buildar este commit. Chamado pelo `ignoreCommand` do `vercel.json`.
 *
 * Convenção da Vercel, e ela é invertida em relação ao que se espera:
 *   - sair com código 1 = PODE BUILDAR
 *   - sair com código 0 = PULE o build
 *
 * POR QUE ISTO EXISTE: todo push em qualquer branch virava um deploy. Trabalhando numa branch e
 * depois mesclando na `main`, cada mudança era buildada DUAS vezes — e build é a segunda maior
 * linha da fatura da Vercel (4 dias e 9 horas de CPU num mês, $21,55). Metade disso era o mesmo
 * código sendo compilado de novo.
 *
 * Só a `main` vira site no ar. Branch de trabalho não precisa de preview: quem revisa o resultado
 * é a própria pessoa rodando `npm run dev` na máquina.
 *
 * O caso do `ref` vazio é deliberado e importante: um redeploy disparado à mão pelo painel da
 * Vercel não traz o nome da branch. Tratar vazio como "pule" faria o botão de redeploy não
 * funcionar, e essa falha é chata de diagnosticar — na dúvida, buildar é o lado seguro do erro.
 */
const ref = process.env.VERCEL_GIT_COMMIT_REF ?? "";

if (ref === "" || ref === "main") {
  console.log(`[build] branch "${ref || "(sem nome — deploy manual)"}": buildando.`);
  process.exit(1);
}

console.log(`[build] branch "${ref}" não é a de produção: pulando o build.`);
process.exit(0);
