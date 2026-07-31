# CRM AZUZ — Painel web

Todas as telas do mockup `crm-azuz-web.html` reconstruídas em Next.js (App Router,
TypeScript), com dados fictícios e navegação real entre as telas.

Identidade da marca: Marinho `#0B1533`, Azul Vibrante `#2E6BFF`, Poppins + Montserrat.
Sem cores quentes, por regra da marca.

## Rodar

```bash
npm run dev
```

## Rotas

| Rota | Tela |
| --- | --- |
| `/` | redireciona pra `/entrar` |
| `/entrar` | Login genérico (sem marca de cliente) |
| `/inicio` | Início — visão geral do dia |
| `/conversas` | Conversas — caixa omnichannel, conversa abre embaixo do kanban |
| `/tarefas` | Tarefas — kanban por prazo, tarefa abre embaixo |
| `/acoes` | Ações — listas de transmissão segmentadas |
| `/equipe` | Equipe — acesso e permissões |
| `/equipe/convidar` | Convidar membro — papel + permissão função por função |
| `/convite/[token]` | O convite do lado de quem foi convidado |
| `/contatos` | Contatos — visão 360° |
| `/pipeline` | Pipeline — funil kanban |
| `/trafego` | Tráfego — CPL, ROAS e atribuição |
| `/relatorios` | Relatórios — gerado por período |
| `/automacoes` | Automações — follow-up sem código |
| `/configuracoes` | Configurações — integrações, API e webhooks |

## Estrutura

```
src/
  app/
    layout.tsx           fontes + metadata
    globals.css          design system inteiro (sem Tailwind)
    entrar/              login
    convite/[token]/     definir senha (link já identificado)
    (app)/               tudo que fica atrás do login
      layout.tsx         shell com sidebar
      <tela>/page.tsx
  components/
    sidebar.tsx          nav com item ativo por rota
    ui.tsx               Topbar, Toggle, ChipFilters, SegmentChips, RadioList, MediaPicker
    icons.tsx            ícones do menu e das marcas de canal
  lib/
    data.ts              todos os dados fictícios, num lugar só
```

Os controles são interativos de verdade (toggles, chips de filtro, rádios de papel),
com estado local — não há backend.

## Correções feitas em relação ao mockup HTML

Datas e contagens que não fechavam:

- **"Terça, 30 de julho de 2026"** → **Quinta**. 30/07/2026 é uma quinta-feira.
- **Equipe: "4 pessoas"** com 5 linhas na tabela → agora conta as linhas de verdade
  (6, com o Dr. Hélio incluído).
- **Automações: "6 ativas"** com 5 automações e 4 ligadas → "5 automações · 4 ativas".
- **Conversas:** os contadores das colunas (4/3/2/2) não batiam com os cards visíveis
  → passaram a contar os cards.
- **Tarefa em "Essa semana" datada 10/08/2026** — 10 de agosto não é "essa semana" a
  partir de 30 de julho → 01/08/2026.
- **Ações: "312 contatos"** sendo que a base total é de 247 → a seleção
  ("contatos de julho" + "fecharam negócio") agora dá 36, que é o número de fechados
  do mês.
- **Tráfego:** a soma do investido por campanha dava R$ 2.800, mas o KPI total dizia
  R$ 3.200. Refeito pra fechar: 1.480 + 1.040 + 680 = 3.200, e os ROAS por campanha
  agora somam exatamente os R$ 13.440 de receita (ROAS 4,2x).
- **Relatórios:** "Leads no período 84" conflitava com "247 leads no mês" do Início.
  Separado: 247 leads no total, 84 vindos de tráfego pago. O faturamento e o "% vindo
  do tráfego pago" foram recalculados (13.440 / 96.000 = 14%).

Grafia e acentuação:

- **"visão 360º"** → **"visão 360°"**. `º` é indicador ordinal masculino; grau é `°`.
- **Avatar "DR"** para Dr. Lucas Vitta → **"LV"**.
- **"+55 62 99XXX-XXXX"** nas Configurações → **"+55 62 9XXXX-XXXX"**, mesmo formato
  usado nas Conversas (celular brasileiro tem 9 dígitos).
- **Login: "(tela 08c)"** — referência a número de tela dentro do texto do produto,
  removida.
- **`<meta name="description">`** listava telas que não existem mais nessa ordem
  (Contatos, Pipeline, Conversas...) → atualizada pra ordem real do menu.

Contradições de conteúdo:

- **Marta × Roberto:** a tela de convite cadastrava a *Marta Souza* como papel
  personalizado "Estoquista", mas a tela seguinte dava boas-vindas à Marta como
  "Secretária / Recepção" — e a tabela de Equipe listava o *Roberto Alves* como o
  estoquista. Unificado no Roberto Alves, que é quem a Equipe já mostrava.
- **Dr. Hélio Marinho** aparecia como responsável em Conversas e Tarefas mas não
  existia na tabela de Equipe. Foi incluído.
- **"Marcos Rezende" e "Dr. Marcos Aurélio"** eram duas pessoas diferentes, os dois
  com R$ 890, o que ficava confuso. Viraram um só: **Marcos Aurélio**.
- **Lead chamado "Clínica Vitta"** — mesmo nome do workspace. Virou **Beatriz
  Nogueira**. **"Studio Vitta"** virou **Lorena Bastos** (sobravam Vittas: o
  workspace, o Dr. Lucas Vitta e dois leads).
- **Paulo Lacerda** estava como "Google Ads" nos Contatos e "Instagram" nas Conversas,
  além de fechado mas na coluna "não respondido". Alinhado: Google Ads, Finalizado.
- **Renata Farias** tinha responsável diferente em cada tela (Ana × Bruno) →
  Bruno Salles nas duas.
- **Julia Prado** tinha a tarefa "Enviar orçamento" atrasada, mas a conversa dizia
  "te enviei a proposta". A tarefa virou "Fazer follow-up da proposta".
- **Camila Duarte** era um lead novo perguntando preço, com tarefa "ligar pra
  confirmar presença" → "Responder valor da consulta particular".
- **"Dia do Pediatra"** numa clínica de emagrecimento e diabetes → "Dia Mundial do
  Diabetes".
- **Convidar membro: "vocês nunca digitam a senha dela"** com o convidado sendo o
  Roberto → "a senha de ninguém".
- **Pipeline** dizia "julho 2026" com 62 negócios, contra 247 leads do mês no funil do
  Início. Passou a se identificar como o funil atual ("62 negócios no funil") e a
  coluna final como "Fechado · 7 dias".
