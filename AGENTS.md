<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Referências de design do CRM AZUZ

Fontes que a Thaynara escolheu para guiar a evolução visual do produto. Servem como **referência
de princípios** (hierarquia, espaçamento, densidade, microinterações): não para copiar telas nem
para importar componentes sem avaliar peso, acessibilidade e encaixe na identidade azul do CRM.

| Fonte | Endereço | Para quê |
|---|---|---|
| 21st.dev | https://21st.dev/ | Catálogo de componentes, templates e temas React. Oferece integração via MCP. |
| Assemble UI | https://www.assembleui.com/ | Componentes e seções prontas para montar interfaces. |
| React Bits | https://www.reactbits.dev/ | Animações, fundos, cards, menus e efeitos de interação. Também oferece MCP. |
| Dribbble | https://dribbble.com/ | Inspiração visual. Termos úteis: `CRM dashboard`, `SaaS dashboard`, `sales pipeline`, `inbox UI`, `dark SaaS`. |

Contraste de cor: usar o **Color Contrast Checker** do Figma. (Havia uma quarta ferramenta chamada
"Color" que não foi identificada com segurança. Se aparecer o endereço certo, é só acrescentar aqui.)

## Como usar isto sem estragar o que existe

- A identidade é **azul, com tema claro e escuro**. Referência externa entra para amadurecer essa
  identidade, nunca para substituí-la por outra.
- O produto evita glow, neon, gradiente pesado, vidro em tudo e arredondamento exagerado. A
  sensação de produto caro vem de proporção, tipografia, espaçamento e consistência.
- Componente copiado de fora precisa passar pelos tokens do `globals.css` antes de entrar. Caso
  contrário o CRM volta a ter várias linguagens visuais convivendo, que foi o problema que a
  unificação do renderizador de mensagens acabou de resolver.

# Quando publicar: por entrega, não por commit

Todo push na `main` dispara um build de produção na Vercel, e build é a maior linha de uso da
fatura: **8.320 minutos de CPU = $20,96** no ciclo de 15/08 a 14/09 de 2026. No mesmo período
houve **390 commits na `main`** (74 num único dia). Não era muito trabalho: era o mesmo trabalho
fatiado fino demais na hora de publicar. Para comparação, atender 683 mil requisições no mesmo
ciclo custou **$0,24**. Servir o CRM é praticamente de graça; compilá-lo é que não é.

O `scripts/pular-build.mjs` já impede que branch de trabalho vire build — só a `main` compila. Mas
essa proteção não serve de nada se cada commit for imediatamente mesclado na `main`, que é
exatamente o que vinha acontecendo.

**A regra, decidida pela Thaynara em 18/09/2026:**

- Trabalhe e commite à vontade em `claude/pronto-cvdtz4`. Push nessa branch não gasta build.
- Só leve para a `main` quando a **entrega estiver fechada e verificada** (tsc, testes e build
  passando). Uma entrega pode conter vários commits.
- Alvo: de 1 a 3 builds por dia, não de 20 a 70.

O custo aceito dessa escolha: uma correção pode levar algumas horas até estar no ar. Foi uma
decisão consciente, não um descuido — não "otimize" voltando a publicar por commit.
